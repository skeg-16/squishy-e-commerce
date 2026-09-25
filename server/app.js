const express = require('express');
const helmet = require('helmet');
const path = require('node:path');
const { randomBytes, randomUUID, createHash } = require('node:crypto');
const { createCommerce } = require('./commerce');
const { AppError, fail } = require('./errors');
const { parse } = require('./validation');
const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const digest = value => createHash('sha256').update(value).digest('hex');

function createApp({ pool, demoMode = false, origins = ['http://localhost:3000'], secureCookies = false, rateLimit = 120, logger = console, serveStatic = false }) {
  const app = express();
  const commerce = createCommerce(pool, { demoMode });
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: { directives: {
    defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    fontSrc: ["'self'", 'https://fonts.gstatic.com'], imgSrc: ["'self'", 'data:'], connectSrc: ["'self'"],
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
  app.get('/api/products', send(() => commerce.getProducts()));
  app.get('/api/products/:slug', send(async req => (await commerce.getProducts(req.params.slug))[0]));
  app.get('/api/vouchers/available', send(async () => {
    const { rows } = await pool.query('SELECT code,type,description FROM vouchers WHERE active=true ORDER BY code');
    return rows;
  }));
  app.post('/api/checkout/quote', guest, send(req => commerce.quote(req.guestId, parse('quote', req.body)), 201));
  app.post('/api/orders', guest, send(req => commerce.createOrder(req.guestId, parse('order', req.body), parse('key', req.get('idempotency-key'))), 201));
  app.get('/api/orders/:number', guest, send(req => commerce.getOrder(req.guestId, req.params.number)));
  app.post('/api/orders/:number/cancel', guest, send(req => commerce.cancel(req.guestId, req.params.number, parse('cancel', req.body).reason)));
  app.post('/api/payments/sessions', guest, send(req => commerce.createPayment(req.guestId, parse('payment', req.body).orderNumber, parse('key', req.get('idempotency-key'))), 201));
  app.post('/api/payments/sessions/:id/simulate', guest, send(req => commerce.simulate(req.guestId, parse('uuid', req.params.id), parse('outcome', req.body).outcome)));
  app.get('/api/tracking/:number', guest, send(req => commerce.tracking(req.guestId, req.params.number)));
  app.get('/api/reviews/:slug', send(req => commerce.reviews(req.params.slug)));
  app.post('/api/reviews', guest, send(req => commerce.addReview(req.guestId, parse('review', req.body)), 201));
  app.use('/api', (req, res, next) => next(new AppError(404, 'NOT_FOUND', 'API endpoint not found.')));
  if (serveStatic) app.use(express.static(path.join(__dirname, '..', 'public'), { dotfiles: 'deny' }));
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
