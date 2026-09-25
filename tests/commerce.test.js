const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { randomUUID } = require('node:crypto');
const { createPool } = require('../server/db');
const { createApp } = require('../server/app');
const { createCommerce } = require('../server/commerce');
const { migrate } = require('../scripts/database');
const { seed } = require('../server/seed');
const { embedded } = require('../scripts/embedded');
const origin = 'http://localhost:3000';
let pool, db, app, service, rootPool, schema;
const customer = { customerName: 'Demo Buyer', customerEmail: 'buyer@example.test', customerPhone: '09171234567', shippingAddress: '123 Test Street', city: 'Manila', barangay: 'Ermita', postalCode: '1000' };
const post = (agent, url, body, key) => {
  const req = agent.post(url).set('Origin', origin).send(body);
  return key ? req.set('Idempotency-Key', key) : req;
};
async function guest(application = app) {
  const agent = request.agent(application);
  const response = await post(agent, '/api/session', {});
  assert.equal(response.status, 200, JSON.stringify(response.body));
  return agent;
}
async function quote(agent, options = {}) {
  const response = await post(agent, '/api/checkout/quote', { items: [{ slug: 'dumpling', quantity: 1 }], region: 'metro-manila', ...options });
  assert.equal(response.status, 201, JSON.stringify(response.body)); return response.body.data;
}
async function order(agent, { paymentMethod = 'cod', key = randomUUID(), ...options } = {}) {
  const pricing = await quote(agent, options);
  const payload = { ...customer, paymentMethod, quoteId: pricing.quoteId };
  const response = await post(agent, '/api/orders', payload, key);
  assert.equal(response.status, 201, JSON.stringify(response.body));
  return { ...response.body.data, payload, key };
}
async function stock(slug = 'dumpling') { return (await pool.query('SELECT stock FROM products WHERE slug=$1', [slug])).rows[0].stock; }
async function payment(agent, number, outcome, key = randomUUID()) {
  const session = await post(agent, '/api/payments/sessions', { orderNumber: number }, key);
  assert.equal(session.status, 201, JSON.stringify(session.body));
  const response = await post(agent, `/api/payments/sessions/${session.body.data.sessionId}/simulate`, { outcome });
  return { session: session.body.data, response };
}
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
  app = createApp({ pool, demoMode: true, origins: [origin], rateLimit: 100000, logger: { error() {} } });
  service = createCommerce(pool, { demoMode: true });
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

test('complete catalog, idempotent migrations/seeds, and honest review aggregates', async () => {
  await migrate(pool); await seed(pool);
  const res = await request(app).get('/api/products');
  assert.equal(res.status, 200); assert.equal(res.body.data.length, 10);
  assert.equal(res.body.data.find(p => p.slug === 'party-pack').stockQuantity, 25);
  assert.ok(res.body.data.every(p => p.rating === 0 && p.reviewsCount === 0));
  assert.equal((await request(app).get('/api/products/missing')).status, 404);
});

test('regional shipping, all vouchers, threshold, and centavo arithmetic', async () => {
  const agent = await guest();
  for (const [region, shipping] of Object.entries({ 'metro-manila': 60, luzon: 80, visayas: 110, mindanao: 110 })) {
    const q = await quote(agent, { region }); assert.equal(q.total, 89 + shipping);
  }
  const items = [{ slug: 'dumpling', quantity: 2 }];
  const free = await quote(agent, { items, voucherCode: 'FREESHIP' });
  assert.equal(free.subtotal, 178); assert.equal(free.total, 178); assert.equal(free.shippingFee, 0); assert.equal(free.shippingDiscount, 60); assert.equal(free.voucherDiscount, 0);
  assert.equal((await quote(agent, { items, voucherCode: 'WELCOME10' })).total, 220.2);
  assert.equal((await quote(agent, { items: [{ slug: 'dumpling', quantity: 4 }], voucherCode: 'SQUISHY50' })).total, 366);
  assert.equal((await quote(agent, { items: [{ slug: 'dumpling', quantity: 6 }], voucherCode: 'FREESHIP' })).shippingDiscount, 0);
  await pool.query("UPDATE products SET price_minor=50000 WHERE slug='dumpling'");
  assert.equal((await quote(agent)).shippingFee, 0);
});

test('strict validation rejects client prices, unknown products, quantities, vouchers, and regions', async () => {
  const agent = await guest();
  for (const body of [
    { items: [{ slug: 'missing', quantity: 1 }], region: 'metro-manila' },
    ...[0, -1, 1.2, '2', 100].map(quantity => ({ items: [{ slug: 'dumpling', quantity }], region: 'metro-manila' })),
    { items: [{ slug: 'dumpling', quantity: 1, price: 1 }], region: 'metro-manila' },
    { items: [{ slug: 'dumpling', quantity: 1 }], region: 'unknown' },
    { items: [{ slug: 'dumpling', quantity: 1 }], region: 'metro-manila', voucherCode: 'WELCOME10' },
    { items: [{ slug: 'dumpling', quantity: 1 }], region: 'metro-manila', voucherCode: 'FAKE' }
  ]) assert.equal((await post(agent, '/api/checkout/quote', body)).status, 400, JSON.stringify(body));
  const pricing = await quote(agent);
  assert.equal((await post(agent, '/api/orders', { ...customer, quoteId: pricing.quoteId, paymentMethod: 'bitcoin' }, randomUUID())).status, 400);
  assert.equal((await post(agent, '/api/orders', { ...customer, quoteId: pricing.quoteId, paymentMethod: 'cod', total: 1 }, randomUUID())).status, 400);
});

test('concurrent buyers cannot oversell the final item', async () => {
  await pool.query("UPDATE products SET stock=1 WHERE slug='dumpling'");
  const buyers = await Promise.all([guest(), guest()]);
  const quotes = await Promise.all(buyers.map(a => quote(a)));
  const attempts = await Promise.all(buyers.map((a,i) => post(a, '/api/orders', { ...customer, quoteId: quotes[i].quoteId, paymentMethod: 'gcash' }, randomUUID())));
  assert.deepEqual(attempts.map(r => r.status).sort(), [201,409]);
  assert.equal(await stock(), 0);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM orders')).rows[0].n, 1);
});

test('concurrent retries create one order; changed payload and reused quote are rejected', async () => {
  const agent = await guest(), q = await quote(agent), key = randomUUID();
  const body = { ...customer, quoteId: q.quoteId, paymentMethod: 'cod' };
  const responses = await Promise.all([post(agent, '/api/orders', body, key), post(agent, '/api/orders', body, key)]);
  assert.ok(responses.every(r => r.status === 201));
  assert.equal(responses[0].body.data.orderNumber, responses[1].body.data.orderNumber);
  assert.equal(await stock(), 99);
  assert.equal((await post(agent, '/api/orders', { ...body, city: 'Pasig' }, key)).status, 409);
  assert.equal((await post(agent, '/api/orders', body, randomUUID())).status, 409);
});

test('changed or expired quotes require renewed confirmation', async () => {
  const agent = await guest(), pricing = await quote(agent);
  await pool.query("UPDATE products SET price_minor=9000 WHERE slug='dumpling'");
  const body = { ...customer, quoteId: pricing.quoteId, paymentMethod: 'cod' };
  assert.equal((await post(agent, '/api/orders', body, randomUUID())).body.code, 'PRICE_CHANGED');
  await pool.query("UPDATE quotes SET expires_at=clock_timestamp()-interval '1 second'");
  assert.equal((await post(agent, '/api/orders', body, randomUUID())).body.code, 'QUOTE_EXPIRED');
  assert.equal(await stock(), 100);
});

test('cancellation followed by expiration releases inventory exactly once', async () => {
  const agent = await guest(), o = await order(agent, { paymentMethod: 'gcash' });
  await post(agent, `/api/orders/${o.orderNumber}/cancel`, { reason: 'Changed my mind' });
  await pool.query("UPDATE orders SET expires_at=clock_timestamp()-interval '1 minute'");
  await service.expireReservations();
  await post(agent, `/api/orders/${o.orderNumber}/cancel`, { reason: 'Retry cancellation' });
  assert.equal(await stock(), 100);
});

test('unpaid expiration commits cleanup; late payment cannot resurrect the order', async () => {
  const agent = await guest(), o = await order(agent, { paymentMethod: 'maya' });
  const session = await post(agent, '/api/payments/sessions', { orderNumber: o.orderNumber }, randomUUID());
  await pool.query("UPDATE orders SET expires_at=clock_timestamp()-interval '1 second'");
  assert.equal((await post(agent, `/api/payments/sessions/${session.body.data.sessionId}/simulate`, { outcome: 'success' })).status, 409);
  assert.equal((await agent.get(`/api/orders/${o.orderNumber}`)).body.data.status, 'Expired');
  await service.expireReservations(); assert.equal(await stock(), 100);
});

test('COD inventory remains committed; bundles reserve and restore components', async () => {
  const agent = await guest(), o = await order(agent, { items: [{ slug: 'party-pack', quantity: 1 }, { slug: 'dumpling', quantity: 2 }] });
  assert.equal(await stock(), 94); assert.equal(await stock('catpaw'), 96); assert.equal(await stock('peanut'), 97);
  await pool.query("UPDATE orders SET expires_at=clock_timestamp()-interval '1 day'");
  await service.expireReservations(); assert.equal(await stock(), 94);
  await post(agent, `/api/orders/${o.orderNumber}/cancel`, { reason: 'Cancel demo order' });
  assert.equal(await stock(), 100); assert.equal(await stock('peanut'), 100);
});

test('payment decline/cancel/retry, deduplication, and simulated refund', async () => {
  const agent = await guest(), o = await order(agent, { paymentMethod: 'card' });
  for (const outcome of ['declined','cancelled']) {
    const { response } = await payment(agent, o.orderNumber, outcome);
    assert.equal(response.status, 200); assert.equal(response.body.data.order.status, 'To Pay');
  }
  const key = randomUUID();
  const { session, response } = await payment(agent, o.orderNumber, 'success', key);
  assert.equal(response.body.data.order.paymentStatus, 'Paid');
  assert.equal((await post(agent, '/api/payments/sessions', { orderNumber: o.orderNumber }, key)).body.data.sessionId, session.sessionId);
  assert.equal((await post(agent, `/api/payments/sessions/${session.sessionId}/simulate`, { outcome: 'success' })).status, 200);
  assert.equal((await post(agent, `/api/payments/sessions/${session.sessionId}/simulate`, { outcome: 'declined' })).status, 409);
  assert.equal(await stock(), 99);
  const cancelled = await post(agent, `/api/orders/${o.orderNumber}/cancel`, { reason: 'Cancel paid demo' });
  assert.equal(cancelled.body.data.paymentStatus, 'Refunded'); assert.equal(await stock(), 100);
});

test('guest ownership protects orders, cancellation, payment, tracking, and reviews', async () => {
  const a = await guest(), b = await guest(), o = await order(a, { paymentMethod: 'gcash' });
  const session = await post(a, '/api/payments/sessions', { orderNumber: o.orderNumber }, randomUUID());
  assert.equal((await b.get(`/api/orders/${o.orderNumber}`)).status, 404);
  assert.equal((await b.get(`/api/tracking/${o.trackingNumber}`)).status, 404);
  assert.equal((await post(b, `/api/orders/${o.orderNumber}/cancel`, { reason: 'Unauthorized' })).status, 404);
  assert.equal((await post(b, '/api/payments/sessions', { orderNumber: o.orderNumber }, randomUUID())).status, 404);
  assert.equal((await post(b, `/api/payments/sessions/${session.body.data.sessionId}/simulate`, { outcome: 'success' })).status, 404);
  assert.equal((await post(b, '/api/reviews', { orderNumber: o.orderNumber, productSlug: 'dumpling', rating: 5, comment: 'Great demo', reviewerName: 'Buyer' })).status, 404);
  assert.equal((await request(app).get(`/api/orders/${o.orderNumber}`)).status, 401);
});

test('tracking records real transitions; reviews require completed purchased items and stay private', async () => {
  const agent = await guest(), o = await order(agent);
  let track = await agent.get(`/api/tracking/${o.trackingNumber}`);
  assert.equal(track.body.data.checkpointCount, 1);
  const review = { orderNumber: o.orderNumber, productSlug: 'dumpling', rating: 4, comment: '<img src=x onerror=alert(1)>', reviewerName: 'Demo Buyer' };
  assert.equal((await post(agent, '/api/reviews', review)).status, 409);
  await service.advanceDemo(o.orderNumber, 'Shipped');
  assert.equal((await post(agent, `/api/orders/${o.orderNumber}/cancel`, { reason: 'Too late' })).status, 409);
  await service.advanceDemo(o.orderNumber, 'Completed');
  assert.equal((await post(agent, '/api/reviews', { ...review, productSlug: 'peanut' })).status, 400);
  assert.equal((await post(agent, '/api/reviews', review)).status, 201);
  assert.equal((await post(agent, '/api/reviews', review)).status, 409);
  const data = (await request(app).get('/api/reviews/dumpling')).body.data;
  assert.equal(data.averageRating, 4); assert.equal(data.reviewsCount, 1);
  assert.ok(!JSON.stringify(data).includes(o.orderNumber));
  track = await agent.get(`/api/tracking/${o.trackingNumber}`);
  assert.equal(track.body.data.checkpointCount, 3);
  assert.equal((await agent.get('/api/tracking/unknown')).status, 404);
});

test('demo mode gates simulations and legacy unsafe routes no longer exist', async () => {
  const closed = createApp({ pool, origins: [origin], rateLimit: 100000 });
  const agent = await guest(closed), q = await quote(agent);
  assert.equal(q.demoMode, false);
  assert.equal((await post(agent, '/api/orders', { ...customer, quoteId: q.quoteId, paymentMethod: 'gcash' }, randomUUID())).status, 400);
  assert.equal((await post(agent, '/api/payments/sessions', { orderNumber: 'fake' }, randomUUID())).status, 404);
  for (const endpoint of ['confirm','webhook','create-checkout-session']) assert.equal((await post(agent, `/api/payments/${endpoint}`, {})).status, 404);
});

test('origin, content type, body size, errors, and database-backed rate limits', async () => {
  assert.equal((await request(app).post('/api/session').set('Origin', 'https://evil.example').send({})).status, 403);
  assert.equal((await request(app).post('/api/session').send({})).status, 403);
  assert.equal((await request(app).post('/api/session').set('Origin', origin).set('Content-Type','text/plain').send('hello')).status, 415);
  assert.equal((await request(app).post('/api/session').set('Origin', origin).set('Content-Type','application/json').send('{')).status, 400);
  assert.equal((await post(request(app), '/api/session', { data: 'x'.repeat(40000) })).status, 413);
  await pool.query('TRUNCATE rate_limits');
  const limited = createApp({ pool, origins: [origin], rateLimit: 1 });
  assert.equal((await request(limited).get('/api/products')).status, 200);
  assert.equal((await request(limited).get('/api/products')).status, 429);
  const broken = createApp({ pool: { query: async () => { throw new Error('private secret'); } }, logger: { error() {} } });
  const response = await post(request(broken), '/api/session', {});
  assert.equal(response.status, 503); assert.equal(response.body.success, false); assert.ok(!JSON.stringify(response.body).includes('private secret'));
});

test('new app instance reads persisted order; stock is not reset by seed', async () => {
  const agent = await guest(), o = await order(agent);
  await seed(pool); assert.equal(await stock(), 99);
  const rebuilt = createApp({ pool, demoMode: true, origins: [origin], rateLimit: 100000 });
  const sessionResponse = await post(agent, '/api/session', {});
  assert.equal(sessionResponse.status, 200);
  // Reuse the actual guest cookie against a freshly constructed application.
  const cookies = agent.jar.getCookies({ domain: '127.0.0.1', path: '/', secure: false }).toValueString();
  const response = await request(rebuilt).get(`/api/orders/${o.orderNumber}`).set('Cookie', cookies);
  assert.equal(response.status, 200); assert.equal(response.body.data.total, o.total);
});

test('database write failure rolls back order, inventory, and quote consumption', async () => {
  const agent = await guest(), q = await quote(agent), key = randomUUID();
  const payload = { ...customer, quoteId: q.quoteId, paymentMethod: 'cod' };
  await pool.query("ALTER TABLE order_events ADD CONSTRAINT injected_failure CHECK(status <> 'Order Placed')");
  try {
    const failed = await post(agent, '/api/orders', payload, key);
    assert.equal(failed.status, 503); assert.equal(failed.body.success, false);
    assert.equal(await stock(), 100);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM orders')).rows[0].n, 0);
  } finally { await pool.query('ALTER TABLE order_events DROP CONSTRAINT injected_failure'); }
  assert.equal((await post(agent, '/api/orders', payload, key)).status, 201);
  assert.equal(await stock(), 99);
});

test('payment failure rolls back all changes; concurrent success retries commit once', async () => {
  const agent = await guest(), o = await order(agent, { paymentMethod: 'gcash' });
  const session = await post(agent, '/api/payments/sessions', { orderNumber: o.orderNumber }, randomUUID());
  const endpoint = `/api/payments/sessions/${session.body.data.sessionId}/simulate`;
  await pool.query("ALTER TABLE order_events ADD CONSTRAINT injected_failure CHECK(status <> 'Payment success')");
  try {
    assert.equal((await post(agent, endpoint, { outcome: 'success' })).status, 503);
    assert.equal((await agent.get(`/api/orders/${o.orderNumber}`)).body.data.paymentStatus, 'Unpaid');
    assert.equal((await pool.query('SELECT status FROM payment_attempts')).rows[0].status, 'pending');
  } finally { await pool.query('ALTER TABLE order_events DROP CONSTRAINT injected_failure'); }
  const responses = await Promise.all([post(agent, endpoint, { outcome: 'success' }), post(agent, endpoint, { outcome: 'success' })]);
  assert.ok(responses.every(r => r.status === 200));
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM order_events WHERE status='Payment success'")).rows[0].n, 1);
  assert.equal(await stock(), 99);
});

test('bundle and standalone quantities are combined before any inventory change', async () => {
  const agent = await guest();
  await pool.query("UPDATE products SET stock=1 WHERE slug='dumpling'");
  const response = await post(agent, '/api/checkout/quote', { items: [{ slug: 'stress-free-trio', quantity: 1 }, { slug: 'dumpling', quantity: 1 }], region: 'metro-manila' });
  assert.equal(response.status, 409); assert.equal(await stock(), 1);
  assert.equal(await stock('catpaw'), 100);
});
