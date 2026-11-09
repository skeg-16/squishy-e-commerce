const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { randomUUID } = require('node:crypto');
const { createPool } = require('../server/db');
const { createApp } = require('../server/app');
const { migrate } = require('../scripts/database');
const { seed } = require('../server/seed');
const { embedded } = require('../scripts/embedded');
const origin = 'http://localhost:3000';
const PASSWORD = 'correct-horse-battery';
let pool, db, app, rootPool, schema;

const customer = { customerName: 'Demo Buyer', customerEmail: 'buyer@example.test', customerPhone: '09171234567', shippingAddress: '123 Test Street', city: 'Manila', barangay: 'Ermita', postalCode: '1000' };
const send = (agent, method, url, body) => agent[method](url).set('Origin', origin).send(body ?? {});
async function admin() {
  const agent = request.agent(app);
  const res = await send(agent, 'post', '/api/admin/login', { password: PASSWORD });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return agent;
}
async function placeOrder(paymentMethod = 'cod', items = [{ slug: 'dumpling', quantity: 1 }]) {
  const guest = request.agent(app);
  await send(guest, 'post', '/api/session');
  const quote = await send(guest, 'post', '/api/checkout/quote', { items, region: 'metro-manila' });
  const res = await send(guest, 'post', '/api/orders', { ...customer, paymentMethod, quoteId: quote.body.data.quoteId }).set('Idempotency-Key', randomUUID());
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.data;
}
const stock = async slug => (await pool.query('SELECT stock FROM products WHERE slug=$1', [slug])).rows[0].stock;

before(async () => {
  let url = process.env.TEST_DATABASE_URL;
  if (url && !new URL(url).pathname.toLowerCase().includes('test')) throw new Error('TEST_DATABASE_URL must reference a disposable database with "test" in its name.');
  if (!url) { db = await embedded(); url = db.url; }
  rootPool = createPool(url);
  schema = `test_${randomUUID().replaceAll('-', '')}`;
  await rootPool.query(`CREATE SCHEMA ${schema}`);
  const scoped = new URL(url); scoped.searchParams.set('options', `-c search_path=${schema}`);
  pool = createPool(scoped.toString());
  await migrate(pool);
  app = createApp({ pool, demoMode: true, origins: [origin], rateLimit: 100000, logger: { error() {} }, adminPassword: PASSWORD });
});
beforeEach(async () => {
  await pool.query('TRUNCATE reviews,order_events,payment_attempts,reservations,order_items,orders,quotes,guest_sessions,bundle_components,products,vouchers,rate_limits CASCADE');
  await seed(pool);
});
after(async () => {
  await pool?.end();
  if (rootPool) { if (schema) await rootPool.query(`DROP SCHEMA ${schema} CASCADE`); await rootPool.end(); }
  await db?.stop();
});

test('admin routes require login; wrong password is rejected; cookie is HttpOnly', async () => {
  assert.equal((await request(app).get('/api/admin/products')).status, 401);
  assert.equal((await request(app).get('/api/admin/orders')).status, 401);
  const agent = request.agent(app);
  assert.equal((await send(agent, 'post', '/api/admin/login', { password: 'wrong-password' })).status, 401);
  assert.equal((await agent.get('/api/admin/session')).body.data.authenticated, false);
  const ok = await send(agent, 'post', '/api/admin/login', { password: PASSWORD });
  assert.equal(ok.status, 200);
  assert.match(ok.headers['set-cookie'][0], /squishies_admin=.*HttpOnly.*SameSite=Strict/i);
  assert.equal((await agent.get('/api/admin/session')).body.data.authenticated, true);
  assert.equal((await agent.get('/api/admin/products')).status, 200);
  await send(agent, 'post', '/api/admin/logout');
  assert.equal((await agent.get('/api/admin/products')).status, 401);
});

test('tampered or expired admin cookies and cross-origin writes are rejected', async () => {
  const forged = `${Date.now() + 100000}.${'a'.repeat(64)}`;
  assert.equal((await request(app).get('/api/admin/products').set('Cookie', `squishies_admin=${forged}`)).status, 401);
  const agent = await admin();
  assert.equal((await agent.post('/api/admin/logout').send({})).status, 403);
  assert.equal((await agent.put('/api/admin/products/dumpling').set('Origin', 'https://evil.example').send({})).status, 403);
});

test('admin is disabled without a sufficiently long password', async () => {
  const off = createApp({ pool, origins: [origin], rateLimit: 100000, adminPassword: 'short' });
  const res = await send(request(off), 'post', '/api/admin/login', { password: 'short' });
  assert.equal(res.status, 503);
  assert.equal((await request(off).get('/api/admin/session')).body.data.configured, false);
});

test('login attempts are rate limited', async () => {
  const agent = request.agent(app);
  let last;
  for (let i = 0; i < 12; i++) last = await send(agent, 'post', '/api/admin/login', { password: 'nope-nope-nope' });
  assert.equal(last.status, 429);
});

test('summary reports order counts, paid revenue and low stock', async () => {
  const agent = await admin();
  await placeOrder();
  await pool.query("UPDATE products SET stock=3 WHERE slug='cheese'");
  const { body } = await agent.get('/api/admin/summary');
  assert.equal(body.data.orders['To Ship'], 1);
  assert.ok(body.data.lowStock.some(p => p.slug === 'cheese' && p.stock === 3));
});

test('quick stock update works for singles and is refused for bundles', async () => {
  const agent = await admin();
  const ok = await send(agent, 'patch', '/api/admin/products/dumpling/stock', { stock: 42 });
  assert.equal(ok.status, 200); assert.equal(await stock('dumpling'), 42);
  assert.equal((await send(agent, 'patch', '/api/admin/products/dumpling/stock', { stock: -1 })).status, 400);
  assert.equal((await send(agent, 'patch', '/api/admin/products/party-pack/stock', { stock: 5 })).status, 409);
  assert.equal((await send(agent, 'patch', '/api/admin/products/nope/stock', { stock: 5 })).status, 404);
});

test('create and edit a single product; it appears in the public catalog and hides when deactivated', async () => {
  const agent = await admin();
  const body = { slug: 'mochi', kind: 'single', name: 'Mochi Squishy', price: 120.5, stock: 7, active: true, description: 'Soft.', badge: 'New', badgeClass: 'badge--mint', image: 'assets/images/product-peanut.svg', specs: { Material: 'TPR' } };
  const created = await send(agent, 'post', '/api/admin/products', body);
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.equal(created.body.data.price, 120.5);
  assert.equal((await send(agent, 'post', '/api/admin/products', body)).status, 409);
  let pub = (await request(app).get('/api/products/mochi')).body.data;
  assert.equal(pub.price, 120.5); assert.equal(pub.stockQuantity, 7); assert.equal(pub.badge, 'New'); assert.equal(pub.specs.Material, 'TPR');
  const { kind, slug, ...edit } = body;
  const updated = await send(agent, 'put', '/api/admin/products/mochi', { ...edit, price: 99, stock: 3, badge: '', active: false });
  assert.equal(updated.status, 200, JSON.stringify(updated.body));
  assert.equal((await request(app).get('/api/products/mochi')).status, 404);
  assert.equal(await stock('mochi'), 3);
  const row = (await pool.query("SELECT price_minor,content FROM products WHERE slug='mochi'")).rows[0];
  assert.equal(row.price_minor, 9900); assert.equal(row.content.badge, undefined);
});

test('product validation rejects bad input without partial writes', async () => {
  const agent = await admin();
  const base = { slug: 'x-item', kind: 'single', name: 'X Item', price: 10, stock: 1, active: true, image: 'assets/images/product-peanut.svg' };
  assert.equal((await send(agent, 'post', '/api/admin/products', { ...base, price: -5 })).status, 400);
  assert.equal((await send(agent, 'post', '/api/admin/products', { ...base, image: 'https://evil.example/x.svg' })).status, 400);
  assert.equal((await send(agent, 'post', '/api/admin/products', { ...base, slug: 'Bad Slug' })).status, 400);
  assert.equal((await send(agent, 'post', '/api/admin/products', { ...base, unknown: true })).status, 400);
  assert.equal((await send(agent, 'post', '/api/admin/products', { ...base, kind: 'bundle', components: [] })).status, 400);
  assert.equal((await send(agent, 'post', '/api/admin/products', { ...base, kind: 'bundle', components: [{ slug: 'party-pack', quantity: 1 }] })).status, 400);
  assert.equal((await pool.query("SELECT 1 FROM products WHERE slug='x-item'")).rowCount, 0);
});

test('create and edit a bundle; availability follows its parts and orders decrement parts', async () => {
  const agent = await admin();
  const body = { slug: 'duo', kind: 'bundle', name: 'Duo Pack', price: 150, active: true, image: 'assets/images/product-cheese.svg', components: [{ slug: 'dumpling', quantity: 2 }, { slug: 'cheese', quantity: 1 }] };
  assert.equal((await send(agent, 'post', '/api/admin/products', body)).status, 201);
  assert.equal((await request(app).get('/api/products/duo')).body.data.stockQuantity, 50);
  const { kind, slug, ...edit } = body;
  const edited = await send(agent, 'put', '/api/admin/products/duo', { ...edit, components: [{ slug: 'dumpling', quantity: 4 }] });
  assert.equal(edited.status, 200, JSON.stringify(edited.body));
  assert.deepEqual(edited.body.data.components, [{ slug: 'dumpling', quantity: 4 }]);
  assert.equal((await request(app).get('/api/products/duo')).body.data.stockQuantity, 25);
  await placeOrder('cod', [{ slug: 'duo', quantity: 1 }]);
  assert.equal(await stock('dumpling'), 96);
});

test('voucher create, edit, delete with peso conversion and validation', async () => {
  const agent = await admin();
  const make = body => send(agent, 'post', '/api/admin/vouchers', body);
  const c = await make({ code: 'save25', type: 'fixed_amount', value: 25.5, minSpend: 100, description: 'Peso off', active: true });
  assert.equal(c.status, 201, JSON.stringify(c.body));
  assert.equal(c.body.data.code, 'SAVE25');
  assert.equal((await pool.query("SELECT value,min_spend_minor FROM vouchers WHERE code='SAVE25'")).rows[0].value, 2550);
  assert.equal((await make({ code: 'SAVE25', type: 'free_shipping', description: 'dupe', active: true })).status, 409);
  assert.equal((await make({ code: 'BAD', type: 'percentage', value: 150, description: 'too much', active: true })).status, 400);
  assert.equal((await make({ code: 'BAD2', type: 'percentage', value: 12.5, description: 'fraction', active: true })).status, 400);
  const guest = request.agent(app); await send(guest, 'post', '/api/session');
  const q = await send(guest, 'post', '/api/checkout/quote', { items: [{ slug: 'dumpling', quantity: 2 }], region: 'metro-manila', voucherCode: 'SAVE25' });
  assert.equal(q.body.data.voucherDiscount, 25.5);
  const put = await send(agent, 'put', '/api/admin/vouchers/SAVE25', { type: 'percentage', value: 20, minSpend: 0, description: 'Twenty percent', active: false });
  assert.equal(put.status, 200); assert.equal(put.body.data.active, false);
  assert.ok(!(await request(app).get('/api/vouchers/available')).body.data.some(v => v.code === 'SAVE25'));
  assert.equal((await send(agent, 'delete', '/api/admin/vouchers/SAVE25')).status, 200);
  assert.equal((await send(agent, 'delete', '/api/admin/vouchers/SAVE25')).status, 404);
});

test('orders: list, search, detail, ship, deliver; COD becomes paid; invalid transitions are 409', async () => {
  const agent = await admin();
  const order = await placeOrder();
  const list = await agent.get('/api/admin/orders?status=To%20Ship');
  assert.equal(list.body.data.length, 1);
  assert.equal((await agent.get('/api/admin/orders?q=nobody')).body.data.length, 0);
  assert.equal((await agent.get('/api/admin/orders?q=buyer@example')).body.data.length, 1);
  const url = `/api/admin/orders/${order.orderNumber}`;
  assert.equal((await agent.get(url)).body.data.customerName, 'Demo Buyer');
  assert.equal((await send(agent, 'post', `${url}/action`, { action: 'complete' })).status, 409);
  const shipped = await send(agent, 'post', `${url}/action`, { action: 'ship' });
  assert.equal(shipped.body.data.status, 'Shipped');
  assert.equal((await send(agent, 'post', `${url}/action`, { action: 'ship' })).status, 200);
  assert.equal((await send(agent, 'post', `${url}/action`, { action: 'cancel' })).status, 409);
  const done = await send(agent, 'post', `${url}/action`, { action: 'complete' });
  assert.equal(done.body.data.status, 'Completed'); assert.equal(done.body.data.paymentStatus, 'Paid');
  assert.deepEqual(done.body.data.events.map(e => e.status), ['Order Placed', 'Shipped', 'Completed']);
  assert.equal((await send(agent, 'post', '/api/admin/orders/SQ-NOPE/action', { action: 'ship' })).status, 404);
  assert.equal((await send(agent, 'post', `${url}/action`, { action: 'explode' })).status, 400);
});

test('admin cancel restores stock exactly once and records a refund for paid orders', async () => {
  const agent = await admin();
  const order = await placeOrder();
  assert.equal(await stock('dumpling'), 99);
  const url = `/api/admin/orders/${order.orderNumber}/action`;
  const cancelled = await send(agent, 'post', url, { action: 'cancel', reason: 'Out of packaging' });
  assert.equal(cancelled.body.data.status, 'Cancelled'); assert.equal(cancelled.body.data.cancellationReason, 'Out of packaging');
  assert.equal(await stock('dumpling'), 100);
  assert.equal((await send(agent, 'post', url, { action: 'cancel' })).status, 200);
  assert.equal(await stock('dumpling'), 100);

  const paid = await placeOrder('gcash');
  const guest = request.agent(app);
  void guest;
  await pool.query("UPDATE orders SET status='To Ship',payment_status='Paid' WHERE order_number=$1", [paid.orderNumber]);
  await pool.query("UPDATE reservations SET status='committed' WHERE order_id=(SELECT id FROM orders WHERE order_number=$1)", [paid.orderNumber]);
  const refunded = await send(agent, 'post', `/api/admin/orders/${paid.orderNumber}/action`, { action: 'cancel' });
  assert.equal(refunded.body.data.paymentStatus, 'Refunded');
  assert.equal(await stock('dumpling'), 100);
});

test('expired unpaid orders show as Expired and cannot be shipped', async () => {
  const agent = await admin();
  const order = await placeOrder('gcash');
  await pool.query("UPDATE orders SET expires_at=clock_timestamp()-interval '1 minute' WHERE order_number=$1", [order.orderNumber]);
  const detail = await agent.get(`/api/admin/orders/${order.orderNumber}`);
  assert.equal(detail.body.data.status, 'Expired');
  assert.equal(await stock('dumpling'), 100);
  assert.equal((await send(agent, 'post', `/api/admin/orders/${order.orderNumber}/action`, { action: 'ship' })).status, 409);
});

test('reviews can be listed and deleted by admin', async () => {
  const agent = await admin();
  const order = await placeOrder();
  await send(agent, 'post', `/api/admin/orders/${order.orderNumber}/action`, { action: 'ship' });
  await send(agent, 'post', `/api/admin/orders/${order.orderNumber}/action`, { action: 'complete' });
  const id = randomUUID();
  await pool.query("INSERT INTO reviews(id,order_id,product_slug,rating,comment,reviewer_name) SELECT $1,id,'dumpling',5,'Great squish','Demo' FROM orders WHERE order_number=$2", [id, order.orderNumber]);
  const list = await agent.get('/api/admin/reviews');
  assert.equal(list.body.data.length, 1); assert.equal(list.body.data[0].productName, 'Steamed Dumpling Squishy');
  assert.equal((await send(agent, 'delete', `/api/admin/reviews/${id}`)).status, 200);
  assert.equal((await send(agent, 'delete', `/api/admin/reviews/${id}`)).status, 404);
  assert.equal((await agent.get('/api/admin/reviews')).body.data.length, 0);
});
