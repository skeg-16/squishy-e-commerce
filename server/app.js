const express = require('express');
const helmet = require('helmet');
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes, randomUUID, createHash } = require('node:crypto');
const { createCommerce } = require('./commerce');
const { createAuth } = require('./auth');
const { AppError, fail } = require('./errors');
const { parse } = require('./validation');

const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const digest = (value) => createHash('sha256').update(value).digest('hex');

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

function readCookie(req, name) {
  const prefix = `${name}=`;
  const entry = (req.headers.cookie || '')
    .split(';')
    .map((v) => v.trim())
    .find((v) => v.startsWith(prefix));
  return entry ? entry.slice(prefix.length) : '';
}

function createApp({
  pool,
  demoMode = false,
  origins = ['http://localhost:3000'],
  secureCookies = false,
  rateLimit = 120,
  logger = console,
  serveStatic = false,
  serveReact = false,
}) {
  const app = express();
  const commerce = createCommerce(pool, { demoMode });
  const auth = createAuth(pool);

  const userCookieOptions = {
    httpOnly: true,
    secure: secureCookies,
    sameSite: 'strict',
    path: '/',
  };

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'", 'data:', 'blob:'],
          workerSrc: ["'self'", 'blob:'],
          upgradeInsecureRequests: secureCookies ? [] : null,
        },
      },
      strictTransportSecurity: secureCookies ? undefined : false,
    })
  );

  app.use('/api', (req, res, next) => {
    req.requestId = randomUUID();
    res.set('X-Request-ID', req.requestId).set('Cache-Control', 'no-store');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      if (!origins.includes(req.get('origin')) || req.get('sec-fetch-site') === 'cross-site') {
        return next(new AppError(403, 'ORIGIN_REJECTED', 'Request origin is not allowed.'));
      }
      if (!req.is('application/json')) {
        return next(new AppError(415, 'JSON_REQUIRED', 'Send application/json.'));
      }
    }
    next();
  });

  app.use(express.json({ limit: '32kb' }));

  app.get(
    '/api/health',
    asyncRoute(async (req, res) => {
      await pool.query('SELECT 1');
      res.json({ success: true, data: { status: 'ok', service: 'Squishies API', demoMode } });
    })
  );

  app.use(
    '/api',
    asyncRoute(async (req, res, next) => {
      const bucket = digest(req.ip || 'unknown');
      const { rows: [limit] } = await pool.query(
        `INSERT INTO rate_limits(bucket,hits,expires_at) VALUES($1,1,clock_timestamp()+interval '1 minute')
         ON CONFLICT(bucket) DO UPDATE SET
           hits=CASE WHEN rate_limits.expires_at <= clock_timestamp() THEN 1 ELSE rate_limits.hits+1 END,
           expires_at=CASE WHEN rate_limits.expires_at <= clock_timestamp() THEN clock_timestamp()+interval '1 minute' ELSE rate_limits.expires_at END RETURNING hits`,
        [bucket]
      );
      if (limit.hits > rateLimit) {
        res.set('Retry-After', '60');
        fail(429, 'RATE_LIMITED', 'Too many requests. Please try again in a minute.');
      }
      // Bound the shared limiter table without relying on a long-lived process.
      await pool.query("DELETE FROM rate_limits WHERE expires_at < clock_timestamp()-interval '1 hour'");
      next();
    })
  );

  async function resolveGuest(req) {
    const token = readCookie(req, 'squishies_guest');
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
    const { rows: [session] } = await pool.query(
      'SELECT id FROM guest_sessions WHERE token_hash=$1 AND expires_at>clock_timestamp()',
      [digest(token)]
    );
    return session?.id || null;
  }

  async function resolveUser(req) {
    const token = readCookie(req, 'squishies_user');
    return auth.resolveUser(token);
  }

  app.post(
    '/api/session',
    asyncRoute(async (req, res) => {
      let id = await resolveGuest(req);
      if (!id) {
        const token = randomBytes(32).toString('hex');
        id = randomUUID();
        await pool.query('INSERT INTO guest_sessions(id,token_hash) VALUES($1,$2)', [
          id,
          digest(token),
        ]);
        res.cookie('squishies_guest', token, {
          ...userCookieOptions,
          maxAge: 30 * 86400000,
        });
      }
      const user = await resolveUser(req);
      res.json({ success: true, data: { demoMode, authenticated: Boolean(user), user } });
    })
  );

  const guest = asyncRoute(async (req, res, next) => {
    req.guestId = await resolveGuest(req);
    req.user = await resolveUser(req);
    if (!req.guestId) {
      fail(401, 'SESSION_REQUIRED', 'Your browser session expired. Start checkout again.');
    }
    next();
  });

  const requireAuth = asyncRoute(async (req, res, next) => {
    req.guestId = await resolveGuest(req);
    req.user = await resolveUser(req);
    if (!req.user) {
      fail(401, 'AUTH_REQUIRED', 'Please log in to your Squishies account to continue.');
    }
    next();
  });

  const send = (fn, status = 200) =>
    asyncRoute(async (req, res) => res.status(status).json({ success: true, data: await fn(req) }));

  const sendPublicCached = (fn, maxAgeSec = 15) =>
    asyncRoute(async (req, res) => {
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

  // =========================================================
  // AUTH & ACCOUNT ENDPOINTS
  // =========================================================
  app.get(
    '/api/auth/me',
    asyncRoute(async (req, res) => {
      const user = await resolveUser(req);
      res.json({
        success: true,
        data: { authenticated: Boolean(user), user, demoMode },
      });
    })
  );

  app.post(
    '/api/auth/register',
    asyncRoute(async (req, res) => {
      const input = parse('register', req.body);
      const guestId = await resolveGuest(req);
      const { user, token } = await auth.register(input, guestId);
      res.cookie('squishies_user', token, {
        ...userCookieOptions,
        maxAge: 30 * 86400000,
      });
      res.status(201).json({ success: true, data: { user } });
    })
  );

  app.post(
    '/api/auth/login',
    asyncRoute(async (req, res) => {
      const input = parse('login', req.body);
      const guestId = await resolveGuest(req);
      const { user, token } = await auth.login(input, guestId);
      res.cookie('squishies_user', token, {
        ...userCookieOptions,
        maxAge: 30 * 86400000,
      });
      res.json({ success: true, data: { user } });
    })
  );

  app.post(
    '/api/auth/logout',
    asyncRoute(async (req, res) => {
      const token = readCookie(req, 'squishies_user');
      await auth.logout(token);
      res.clearCookie('squishies_user', userCookieOptions);
      res.json({ success: true, data: { loggedOut: true } });
    })
  );

  app.post(
    '/api/auth/reset-password',
    send((req) => auth.resetPassword(parse('resetPassword', req.body)))
  );

  app.patch(
    '/api/account/profile',
    requireAuth,
    send(async (req) => ({
      user: await auth.updateProfile(req.user.id, parse('updateProfile', req.body)),
    }))
  );

  app.post(
    '/api/account/password',
    requireAuth,
    send((req) => auth.changePassword(req.user.id, parse('changePassword', req.body)))
  );

  app.get(
    '/api/account/orders',
    requireAuth,
    send((req) => commerce.listAccountOrders(req.user.id, req.guestId))
  );

  app.delete(
    '/api/account',
    requireAuth,
    asyncRoute(async (req, res) => {
      const data = await auth.deleteAccount(req.user.id, parse('deleteAccount', req.body));
      res.clearCookie('squishies_user', userCookieOptions);
      res.json({ success: true, data });
    })
  );

  // =========================================================
  // STOREFRONT CATALOG, CHECKOUT, PAYMENTS & TRACKING
  // =========================================================
  app.get('/api/products', sendPublicCached((req) => commerce.getProducts(null, req.query)));
  app.get(
    '/api/products/:slug',
    sendPublicCached(async (req) => (await commerce.getProducts(req.params.slug))[0])
  );
  app.get(
    '/api/vouchers/available',
    sendPublicCached(async () => {
      const { rows } = await pool.query(
        'SELECT code,type,description FROM vouchers WHERE active=true ORDER BY code'
      );
      return rows;
    }, 30)
  );

  app.post('/api/checkout/quote', guest, send((req) => commerce.quote(req.guestId, parse('quote', req.body)), 201));
  app.post(
    '/api/orders',
    guest,
    send(
      (req) =>
        commerce.createOrder(
          req.guestId,
          parse('order', req.body),
          parse('key', req.get('idempotency-key')),
          req.user?.id || null
        ),
      201
    )
  );
  app.get(
    '/api/orders/:number',
    guest,
    send((req) => commerce.getOrder(req.guestId, req.params.number, req.user?.id || null))
  );
  app.post(
    '/api/orders/:number/cancel',
    guest,
    send((req) =>
      commerce.cancel(
        req.guestId,
        req.params.number,
        parse('cancel', req.body).reason,
        req.user?.id || null
      )
    )
  );
  app.post(
    '/api/orders/:number/demo-advance',
    guest,
    send((req) =>
      commerce.advanceOwnedDemoDelivery(
        req.guestId,
        req.params.number,
        parse('deliveryStage', req.body).stage,
        req.user?.id || null
      )
    )
  );
  app.post(
    '/api/payments/sessions',
    guest,
    send(
      (req) =>
        commerce.createPayment(
          req.guestId,
          parse('payment', req.body).orderNumber,
          parse('key', req.get('idempotency-key')),
          req.user?.id || null
        ),
      201
    )
  );
  app.post(
    '/api/payments/sessions/:id/simulate',
    guest,
    send((req) =>
      commerce.simulate(
        req.guestId,
        parse('uuid', req.params.id),
        parse('outcome', req.body),
        req.user?.id || null
      )
    )
  );
  app.get(
    '/api/tracking/:number',
    guest,
    send((req) => commerce.tracking(req.guestId, req.params.number, req.user?.id || null))
  );
  app.get('/api/reviews/:slug', sendPublicCached((req) => commerce.reviews(req.params.slug, req.query), 10));
  app.post(
    '/api/reviews',
    guest,
    send((req) => commerce.addReview(req.guestId, parse('review', req.body), req.user?.id || null), 201)
  );

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
      app.use(
        express.static(path.join(__dirname, '..', 'public'), {
          dotfiles: 'deny',
          index: false,
          maxAge: '7d',
        })
      );
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
    const code = known
      ? error.code
      : malformed
        ? 'INVALID_JSON'
        : tooLarge
          ? 'REQUEST_TOO_LARGE'
          : 'SERVICE_UNAVAILABLE';
    if (!known && !malformed && !tooLarge) {
      logger.error(JSON.stringify({ event: 'request_failed', requestId: req.requestId, code }));
    }
    res.status(status).json({
      success: false,
      error: known
        ? error.message
        : malformed
          ? 'Invalid JSON.'
          : tooLarge
            ? 'Request is too large.'
            : 'The service is temporarily unavailable. Your request was not confirmed; retry using the same request key.',
      code,
      ...(error.fields ? { fields: error.fields } : {}),
      requestId: req.requestId,
    });
  });

  return app;
}

module.exports = { createApp };
