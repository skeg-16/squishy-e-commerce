const express = require('express');
const helmet = require('helmet');
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes, randomUUID, createHash } = require('node:crypto');
const { createCommerce } = require('./commerce');
const { AppError, fail } = require('./errors');
const { parse } = require('./validation');
const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const digest = value => createHash('sha256').update(value).digest('hex');

const SPA_ROUTES = new Set([
  '/',
  '/index.html',
  '/shop',
  '/shop.html',
  '/product',
  '/product.html',
  '/checkout',
  '/checkout.html',
  '/about',
  '/about.html',
  '/admin',
  '/admin.html',
  '/account',
  '/account.html',
]);

function createApp({ pool, demoMode = false, origins = ['http://localhost:3000'], secureCookies = false, rateLimit = 120, logger = console, serveStatic = false, serveReact = false }) {
  const app = express();
  const commerce = createCommerce(pool, { demoMode });
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: { directives: {
    defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    fontSrc: ["'self'", 'https://fonts.gstatic.com'], imgSrc: ["'self'", 'data:', 'blob:'], connectSrc: ["'self'", 'data:', 'blob:'],
    workerSrc: ["'self'", 'blob:'],
    upgradeInsecureRequests: secureCookies ? [] : null
  } }, strictTransportSecurity: secureCookies ? undefined : false }));
  app.use('/api', (req, res, next) => {
    req.requestId = randomUUID();
    res.set('X-Request-ID', req.requestId).set('Cache-Control', 'no-store');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      if (!origins.includes(req.get('origin')) || req.get('sec-fetch-site') === 'cross-site') return next(new AppError(403, 'ORIGIN_REJECTED', 'Request origin is not allowed.'));
      if (!req.is('application/json')) return next(new AppError(415, 'JSON_REQUIRED', 'Send application/json.'));
    }
    next();
  });
  app.use(express.json({ limit: '32kb' }));
  app.get('/api/health', asyncRoute(async (req, res) => {
    await pool.query('SELECT 1');
    res.json({ success: true, data: { status: 'ok', service: 'Squishies API', demoMode } });
  }));
  app.use('/api', asyncRoute(async (req, res, next) => {
    const bucket = digest(req.ip || 'unknown');
    const { rows: [limit] } = await pool.query(`INSERT INTO rate_limits(bucket,hits,expires_at) VALUES($1,1,clock_timestamp()+interval '1 minute')
      ON CONFLICT(bucket) DO UPDATE SET
        hits=CASE WHEN rate_limits.expires_at <= clock_timestamp() THEN 1 ELSE rate_limits.hits+1 END,
        expires_at=CASE WHEN rate_limits.expires_at <= clock_timestamp() THEN clock_timestamp()+interval '1 minute' ELSE rate_limits.expires_at END RETURNING hits`, [bucket]);
    if (limit.hits > rateLimit) { res.set('Retry-After', '60'); fail(429, 'RATE_LIMITED', 'Too many requests. Please try again in a minute.'); }
    // Bound the shared limiter table without relying on a long-lived process.
    await pool.query("DELETE FROM rate_limits WHERE expires_at < clock_timestamp()-interval '1 hour'");
    next();
  }));
  async function resolveGuest(req) {
    const cookie = (req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith('squishies_guest='));
    const token = cookie?.slice('squishies_guest='.length);
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
    const { rows: [session] } = await pool.query('SELECT id FROM guest_sessions WHERE token_hash=$1 AND expires_at>clock_timestamp()', [digest(token)]);
    return session?.id || null;
  }
  app.post('/api/session', asyncRoute(async (req, res) => {
    let id = await resolveGuest(req);
    if (!id) {
      const token = randomBytes(32).toString('hex');
      id = randomUUID();
      await pool.query('INSERT INTO guest_sessions(id,token_hash) VALUES($1,$2)', [id, digest(token)]);
      res.cookie('squishies_guest', token, { httpOnly: true, secure: secureCookies, sameSite: 'strict', maxAge: 30 * 86400000, path: '/' });
    }
    res.json({ success: true, data: { demoMode } });
  }));
  const guest = asyncRoute(async (req, res, next) => {
    req.guestId = await resolveGuest(req);
    if (!req.guestId) fail(401, 'SESSION_REQUIRED', 'Your browser session expired. Start checkout again.');
    next();
  });
  const send = (fn, status = 200) => asyncRoute(async (req, res) => res.status(status).json({ success: true, data: await fn(req) }));
  const sendPublicCached = (fn, maxAgeSec = 15) => asyncRoute(async (req, res) => {
    const data = await fn(req);
    const payload = JSON.stringify({ success: true, data });
    const etag = `W/"${digest(payload).slice(0, 24)}"`;
    res.set('ETag', etag);
    res.set('Cache-Control', `public, max-age=${maxAgeSec}, stale-while-revalidate=60`);
    if (req.get('if-none-match') === etag) {
      return res.status(304).end();
    }
    return res.status(200).type('application/json').send(payload);
  });
  app.get('/api/products', sendPublicCached(req => commerce.getProducts(null, req.query)));
  app.get('/api/products/:slug', sendPublicCached(async req => (await commerce.getProducts(req.params.slug))[0]));
  app.get('/api/vouchers/available', sendPublicCached(async () => {
    const { rows } = await pool.query('SELECT code,type,description FROM vouchers WHERE active=true ORDER BY code');
    return rows;
  }, 30));
  app.post('/api/checkout/quote', guest, send(req => commerce.quote(req.guestId, parse('quote', req.body)), 201));
  app.post('/api/orders', guest, send(req => commerce.createOrder(req.guestId, parse('order', req.body), parse('key', req.get('idempotency-key'))), 201));
  app.get('/api/orders/:number', guest, send(req => commerce.getOrder(req.guestId, req.params.number)));
  app.post('/api/orders/:number/cancel', guest, send(req => commerce.cancel(req.guestId, req.params.number, parse('cancel', req.body).reason)));
  app.post('/api/payments/sessions', guest, send(req => commerce.createPayment(req.guestId, parse('payment', req.body).orderNumber, parse('key', req.get('idempotency-key'))), 201));
  app.post('/api/payments/sessions/:id/simulate', guest, send(req => commerce.simulate(req.guestId, parse('uuid', req.params.id), parse('outcome', req.body).outcome)));
  app.get('/api/tracking/:number', guest, send(req => commerce.tracking(req.guestId, req.params.number)));
  app.get('/api/reviews/:slug', sendPublicCached(req => commerce.reviews(req.params.slug, req.query), 10));
  app.post('/api/reviews', guest, send(req => commerce.addReview(req.guestId, parse('review', req.body)), 201));
  app.use('/api', (req, res, next) => next(new AppError(404, 'NOT_FOUND', 'API endpoint not found.')));
  if (serveStatic) {
    const distDir = path.join(__dirname, '..', 'dist');
    const distIndex = path.join(distDir, 'index.html');
    if (serveReact && fs.existsSync(distIndex)) {
      app.use((req, res, next) => {
        if ((req.method === 'GET' || req.method === 'HEAD') && SPA_ROUTES.has(req.path)) {
          return res.sendFile(distIndex);
        }
        next();
      });
      app.use(express.static(distDir, { dotfiles: 'deny', index: false, maxAge: '7d' }));
      app.use(express.static(path.join(__dirname, '..', 'public'), { dotfiles: 'deny', index: false, maxAge: '7d' }));
    } else {
      app.use(express.static(path.join(__dirname, '..', 'public'), { dotfiles: 'deny', maxAge: '7d' }));
    }
  }
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const known = error instanceof AppError;
    const malformed = error.type === 'entity.parse.failed';
    const tooLarge = error.type === 'entity.too.large';
    const status = known ? error.status : malformed ? 400 : tooLarge ? 413 : 503;
    const code = known ? error.code : malformed ? 'INVALID_JSON' : tooLarge ? 'REQUEST_TOO_LARGE' : 'SERVICE_UNAVAILABLE';
    if (!known && !malformed && !tooLarge) logger.error(JSON.stringify({ event: 'request_failed', requestId: req.requestId, code }));
    res.status(status).json({ success: false, error: known ? error.message : malformed ? 'Invalid JSON.' : tooLarge ? 'Request is too large.' : 'The service is temporarily unavailable. Your request was not confirmed; retry using the same request key.', code, ...(error.fields ? { fields: error.fields } : {}), requestId: req.requestId });
  });
  return app;
}
module.exports = { createApp };
