const express = require('express');
const { createHmac, createHash, timingSafeEqual } = require('node:crypto');
const { transaction } = require('./db');
const { AppError, fail } = require('./errors');
const { parse } = require('./validation');

const COOKIE = 'squishies_admin';
const SESSION_MS = 8 * 3600 * 1000;
const COOKIE_PATH = '/api/admin';
const ORDER_STATUSES = ['To Pay', 'To Ship', 'Shipped', 'Completed', 'Cancelled', 'Expired'];
const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const digest = value => createHash('sha256').update(value).digest('hex');
const safeEqual = (a, b) => timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());
const toMinor = pesos => Math.round(pesos * 100);

/**
 * Admin API. Authentication is one shared password (ADMIN_PASSWORD) that issues a signed,
 * HttpOnly, SameSite=Strict cookie valid for 8 hours. The cookie is stateless, so it works on
 * serverless hosts; changing the password or ADMIN_SESSION_SECRET signs everyone out.
 */
function createAdminRouter({ pool, commerce, password = '', secret = '', secureCookies = false }) {
  const router = express.Router();
  const enabled = password.length >= 8;
  const key = secret || digest(`squishies-admin:${password}`);
  const sign = expires => createHmac('sha256', key).update(String(expires)).digest('hex');
  const send = (fn, status = 200) => asyncRoute(async (req, res) => res.status(status).json({ success: true, data: await fn(req) }));

  function isAuthenticated(req) {
    if (!enabled) return false;
    const cookie = (req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith(`${COOKIE}=`));
    const [expires, signature] = (cookie?.slice(COOKIE.length + 1) || '').split('.');
    if (!/^\d{10,16}$/.test(expires || '') || !/^[a-f0-9]{64}$/.test(signature || '')) return false;
    return Number(expires) > Date.now() && safeEqual(signature, sign(expires));
  }
  const cookieOptions = { httpOnly: true, secure: secureCookies, sameSite: 'strict', path: COOKIE_PATH };

  router.get('/session', send(async req => ({ authenticated: isAuthenticated(req), configured: enabled })));

  router.post('/login', asyncRoute(async (req, res) => {
    if (!enabled) fail(503, 'ADMIN_DISABLED', 'Admin is not configured. Set ADMIN_PASSWORD (at least 8 characters) and restart.');
    // Stricter shared limit for login attempts, on top of the general API limit.
    const { rows: [limit] } = await pool.query(`INSERT INTO rate_limits(bucket,hits,expires_at) VALUES($1,1,clock_timestamp()+interval '1 minute')
      ON CONFLICT(bucket) DO UPDATE SET
        hits=CASE WHEN rate_limits.expires_at <= clock_timestamp() THEN 1 ELSE rate_limits.hits+1 END,
        expires_at=CASE WHEN rate_limits.expires_at <= clock_timestamp() THEN clock_timestamp()+interval '1 minute' ELSE rate_limits.expires_at END RETURNING hits`,
    [`admin-login:${digest(req.ip || 'unknown')}`]);
    if (limit.hits > 10) { res.set('Retry-After', '60'); fail(429, 'RATE_LIMITED', 'Too many login attempts. Try again in a minute.'); }
    const { password: given } = parse('adminLogin', req.body);
    if (!safeEqual(given, password)) fail(401, 'INVALID_LOGIN', 'Incorrect password.');
    const expires = Date.now() + SESSION_MS;
    res.cookie(COOKIE, `${expires}.${sign(expires)}`, { ...cookieOptions, maxAge: SESSION_MS });
    res.json({ success: true, data: { authenticated: true } });
  }));

  router.post('/logout', (req, res) => {
    res.clearCookie(COOKIE, cookieOptions);
    res.json({ success: true, data: { authenticated: false } });
  });

  // Everything below requires a valid admin cookie.
  router.use((req, res, next) => isAuthenticated(req) ? next() : next(new AppError(401, 'ADMIN_REQUIRED', 'Please log in.')));

  // ---------- dashboard ----------
  router.get('/summary', send(async () => {
    await commerce.expireReservations();
    const { rows: statuses } = await pool.query('SELECT status,count(*)::int AS count FROM orders GROUP BY status');
    const { rows: [revenue] } = await pool.query("SELECT COALESCE(sum((pricing->>'totalMinor')::bigint),0)::text AS minor, count(*)::int AS orders FROM orders WHERE payment_status='Paid'");
    const { rows: lowStock } = await pool.query("SELECT slug,name,stock FROM products WHERE kind='single' AND active AND stock<=10 ORDER BY stock,slug");
    const { rows: [products] } = await pool.query('SELECT count(*) FILTER (WHERE active)::int AS active, count(*)::int AS total FROM products');
    return { orders: Object.fromEntries(statuses.map(s => [s.status, s.count])), revenue: Number(revenue.minor) / 100, paidOrders: revenue.orders, lowStock, products };
  }));

  // ---------- products ----------
  const productRow = (p, components) => ({
    slug: p.slug, name: p.name, kind: p.kind, price: p.price_minor / 100, stock: Number(p.available), active: p.active,
    description: p.content.description || '', badge: p.content.badge || '', badgeClass: p.content.badgeClass || '',
    image: p.content.image || '', specs: p.content.specs || {}, components: components.get(p.slug) || []
  });
  async function loadProduct(slug) {
    const list = await listProducts(slug);
    if (!list.length) fail(404, 'NOT_FOUND', 'Product not found.');
    return list[0];
  }
  async function listProducts(slug) {
    const { rows } = await pool.query(`SELECT p.*,
      CASE WHEN kind='single' THEN stock ELSE COALESCE((
        SELECT min(floor(c.stock::numeric/b.quantity)) FROM bundle_components b JOIN products c ON c.slug=b.product_slug WHERE b.bundle_slug=p.slug
      ),0) END AS available
      FROM products p WHERE ($1::text IS NULL OR slug=$1) ORDER BY kind, slug`, [slug || null]);
    const { rows: parts } = await pool.query('SELECT bundle_slug,product_slug,quantity FROM bundle_components ORDER BY bundle_slug,product_slug');
    const components = new Map();
    for (const c of parts) components.set(c.bundle_slug, [...(components.get(c.bundle_slug) || []), { slug: c.product_slug, quantity: c.quantity }]);
    return rows.map(p => productRow(p, components));
  }
  function buildContent(old, b) {
    const content = { ...old, description: b.description, image: b.image, specs: b.specs };
    if (b.badge) { content.badge = b.badge; content.badgeClass = b.badgeClass || 'badge--pink'; }
    else { delete content.badge; delete content.badgeClass; }
    return content;
  }
  async function saveComponents(q, kind, slug, components) {
    if (kind !== 'bundle') return;
    const slugs = components.map(c => c.slug);
    if (!slugs.length || new Set(slugs).size !== slugs.length) fail(400, 'VALIDATION_ERROR', 'Please check the submitted details.', { components: 'A bundle needs at least one product, each listed once.' });
    const { rowCount } = await q.query("SELECT 1 FROM products WHERE slug=ANY($1::text[]) AND kind='single'", [slugs]);
    if (rowCount !== slugs.length || slugs.includes(slug)) fail(400, 'VALIDATION_ERROR', 'Please check the submitted details.', { components: 'Bundle parts must be existing single products.' });
    await q.query('DELETE FROM bundle_components WHERE bundle_slug=$1', [slug]);
    for (const c of components) await q.query('INSERT INTO bundle_components(bundle_slug,product_slug,quantity) VALUES($1,$2,$3)', [slug, c.slug, c.quantity]);
  }
  const duplicate = error => { if (error.code === '23505') fail(409, 'DUPLICATE', 'A product with this slug or name already exists.'); throw error; };

  router.get('/products', send(() => listProducts()));
  router.post('/products', send(async req => {
    const b = parse('adminProductCreate', req.body);
    await transaction(pool, async q => {
      await q.query('INSERT INTO products(slug,name,kind,price_minor,stock,active,content) VALUES($1,$2,$3,$4,$5,$6,$7)',
        [b.slug, b.name, b.kind, toMinor(b.price), b.kind === 'single' ? b.stock : 0, b.active, buildContent({}, b)]).catch(duplicate);
      await saveComponents(q, b.kind, b.slug, b.components);
    });
    return loadProduct(b.slug);
  }, 201));
  router.put('/products/:slug', send(async req => {
    const slug = parse('slug', req.params.slug);
    const b = parse('adminProduct', req.body);
    await transaction(pool, async q => {
      const { rows: [p] } = await q.query('SELECT * FROM products WHERE slug=$1 FOR UPDATE', [slug]);
      if (!p) fail(404, 'NOT_FOUND', 'Product not found.');
      await q.query('UPDATE products SET name=$2,price_minor=$3,stock=$4,active=$5,content=$6 WHERE slug=$1',
        [slug, b.name, toMinor(b.price), p.kind === 'single' ? b.stock : 0, b.active, buildContent(p.content, b)]).catch(duplicate);
      await saveComponents(q, p.kind, slug, b.components);
    });
    return loadProduct(slug);
  }));
  router.patch('/products/:slug/stock', send(async req => {
    const slug = parse('slug', req.params.slug);
    const { stock } = parse('adminStock', req.body);
    await transaction(pool, async q => {
      const { rows: [p] } = await q.query('SELECT kind FROM products WHERE slug=$1 FOR UPDATE', [slug]);
      if (!p) fail(404, 'NOT_FOUND', 'Product not found.');
      if (p.kind !== 'single') fail(409, 'INVALID_STATE', 'Bundle stock comes from its parts. Update the single products instead.');
      await q.query('UPDATE products SET stock=$2 WHERE slug=$1', [slug, stock]);
    });
    return loadProduct(slug);
  }));

  // ---------- vouchers ----------
  const voucherRow = v => ({ code: v.code, type: v.type, value: v.type === 'fixed_amount' ? v.value / 100 : v.value, minSpend: v.min_spend_minor / 100, active: v.active, description: v.description });
  function voucherValues(b) {
    const fieldError = (value) => fail(400, 'VALIDATION_ERROR', 'Please check the submitted details.', { value });
    if (b.type === 'percentage' && !(Number.isInteger(b.value) && b.value >= 1 && b.value <= 100)) fieldError('Percentage must be a whole number from 1 to 100.');
    if (b.type === 'fixed_amount' && !(b.value > 0)) fieldError('Enter the peso amount to take off.');
    const value = b.type === 'fixed_amount' ? toMinor(b.value) : b.type === 'percentage' ? b.value : 0;
    return [b.type, value, toMinor(b.minSpend), b.description, b.active];
  }
  router.get('/vouchers', send(async () => (await pool.query('SELECT * FROM vouchers ORDER BY code')).rows.map(voucherRow)));
  router.post('/vouchers', send(async req => {
    const b = parse('adminVoucherCreate', req.body);
    const { rows: [v] } = await pool.query('INSERT INTO vouchers(code,type,value,min_spend_minor,description,active) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING RETURNING *', [b.code, ...voucherValues(b)]);
    if (!v) fail(409, 'DUPLICATE', 'That voucher code already exists.');
    return voucherRow(v);
  }, 201));
  router.put('/vouchers/:code', send(async req => {
    const code = parse('voucherCode', req.params.code);
    const b = parse('adminVoucher', req.body);
    const { rows: [v] } = await pool.query('UPDATE vouchers SET type=$2,value=$3,min_spend_minor=$4,description=$5,active=$6 WHERE code=$1 RETURNING *', [code, ...voucherValues(b)]);
    if (!v) fail(404, 'NOT_FOUND', 'Voucher not found.');
    return voucherRow(v);
  }));
  router.delete('/vouchers/:code', send(async req => {
    const { rowCount } = await pool.query('DELETE FROM vouchers WHERE code=$1', [parse('voucherCode', req.params.code)]);
    if (!rowCount) fail(404, 'NOT_FOUND', 'Voucher not found.');
    return { deleted: true };
  }));

  // ---------- orders ----------
  router.get('/orders', send(async req => {
    await commerce.expireReservations();
    const status = ORDER_STATUSES.includes(req.query.status) ? req.query.status : '';
    const search = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
    const { rows } = await pool.query(`SELECT order_number,status,payment_status,payment_method,created_at,
        customer->>'customerName' AS name, customer->>'customerEmail' AS email, (pricing->>'totalMinor')::int AS total_minor
      FROM orders WHERE ($1='' OR status=$1) AND ($2='' OR order_number ILIKE '%'||$2||'%' OR customer->>'customerName' ILIKE '%'||$2||'%' OR customer->>'customerEmail' ILIKE '%'||$2||'%')
      ORDER BY created_at DESC LIMIT 200`, [status, search]);
    return rows.map(r => ({ orderNumber: r.order_number, status: r.status, paymentStatus: r.payment_status, paymentMethod: r.payment_method, createdAt: r.created_at, customerName: r.name, customerEmail: r.email, total: r.total_minor / 100 }));
  }));
  router.get('/orders/:number', send(req => commerce.adminOrder(parse('orderNumber', req.params.number))));
  router.post('/orders/:number/action', send(req => {
    const { action, reason } = parse('adminOrderAction', req.body);
    return commerce.adminUpdate(parse('orderNumber', req.params.number), action, reason);
  }));

  // ---------- reviews ----------
  router.get('/reviews', send(async () => (await pool.query(`SELECT r.id,r.rating,r.comment,r.reviewer_name,r.created_at,r.product_slug,p.name AS product_name,o.order_number
      FROM reviews r JOIN products p ON p.slug=r.product_slug JOIN orders o ON o.id=r.order_id ORDER BY r.created_at DESC LIMIT 200`)).rows
    .map(r => ({ id: r.id, rating: r.rating, comment: r.comment, reviewerName: r.reviewer_name, createdAt: r.created_at, productSlug: r.product_slug, productName: r.product_name, orderNumber: r.order_number }))));
  router.delete('/reviews/:id', send(async req => {
    const { rowCount } = await pool.query('DELETE FROM reviews WHERE id=$1', [parse('uuid', req.params.id)]);
    if (!rowCount) fail(404, 'NOT_FOUND', 'Review not found.');
    return { deleted: true };
  }));

  return router;
}
module.exports = { createAdminRouter };
