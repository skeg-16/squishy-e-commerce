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
let pool, db, app, rootPool, schema;

const reqPost = (agent, url, body, key) => {
  const req = agent.post(url).set('Origin', origin).send(body);
  return key ? req.set('Idempotency-Key', key) : req;
};

const reqPatch = (agent, url, body) =>
  agent.patch(url).set('Origin', origin).send(body);

const reqDelete = (agent, url, body) =>
  agent.delete(url).set('Origin', origin).send(body);

async function guestSession() {
  const agent = request.agent(app);
  const res = await reqPost(agent, '/api/session', {});
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return agent;
}

before(async () => {
  let url = process.env.TEST_DATABASE_URL;
  if (!url) {
    db = await embedded();
    url = db.url;
  }
  rootPool = createPool(url);
  schema = `test_${randomUUID().replaceAll('-', '')}`;
  await rootPool.query(`CREATE SCHEMA ${schema}`);
  const scoped = new URL(url);
  scoped.searchParams.set('options', `-c search_path=${schema}`);
  pool = createPool(scoped.toString());
  await migrate(pool);
  app = createApp({
    pool,
    demoMode: true,
    origins: [origin],
    rateLimit: 100000,
    logger: { error() {} },
  });
});

beforeEach(async () => {
  await pool.query(
    'TRUNCATE reviews,order_events,payment_attempts,reservations,order_items,orders,quotes,user_sessions,users,guest_sessions,bundle_components,products,vouchers,rate_limits CASCADE'
  );
  await seed(pool);
});

after(async () => {
  await pool?.end();
  if (rootPool) {
    if (schema) await rootPool.query(`DROP SCHEMA ${schema} CASCADE`);
    await rootPool.end();
  }
  await db?.stop();
});

test('account registration, duplicate checks, login, logout, and reset password', async () => {
  const agent = await guestSession();

  // Register new collector account
  const reg = await reqPost(agent, '/api/auth/register', {
    username: 'siso_collector',
    email: 'collector@siso.test',
    phone: '09171234567',
    birthday: '2004-05-29',
    password: 'StrongPassword1',
    confirmPassword: 'StrongPassword1',
  });
  assert.equal(reg.status, 201, JSON.stringify(reg.body));
  assert.equal(reg.body.data.user.username, 'siso_collector');
  assert.equal(reg.body.data.user.phone, '09171234567');

  // Verify /api/auth/me returns authenticated session
  const me = await agent.get('/api/auth/me');
  assert.equal(me.status, 200);
  assert.equal(me.body.data.authenticated, true);
  assert.equal(me.body.data.user.email, 'collector@siso.test');

  // Duplicate username rejected cleanly
  const dupAgent = await guestSession();
  const dup = await reqPost(dupAgent, '/api/auth/register', {
    username: 'SISO_COLLECTOR',
    email: 'other@siso.test',
    phone: '09181234567',
    birthday: '2003-01-15',
    password: 'StrongPassword1',
    confirmPassword: 'StrongPassword1',
  });
  assert.equal(dup.status, 409);

  // Logout ends user session
  const out = await reqPost(agent, '/api/auth/logout', {});
  assert.equal(out.status, 200);
  const meAfterLogout = await agent.get('/api/auth/me');
  assert.equal(meAfterLogout.body.data.authenticated, false);

  // Wrong password login rejected
  const badLogin = await reqPost(agent, '/api/auth/login', {
    identifier: 'siso_collector',
    password: 'WrongPassword1',
  });
  assert.equal(badLogin.status, 401);

  // Password reset verifies identity
  const reset = await reqPost(agent, '/api/auth/reset-password', {
    username: 'siso_collector',
    email: 'collector@siso.test',
    birthday: '2004-05-29',
    newPassword: 'UpdatedPassword9',
    confirmPassword: 'UpdatedPassword9',
  });
  assert.equal(reset.status, 200);

  // Login works using new password + email identifier
  const goodLogin = await reqPost(agent, '/api/auth/login', {
    identifier: 'collector@siso.test',
    password: 'UpdatedPassword9',
  });
  assert.equal(goodLogin.status, 200, JSON.stringify(goodLogin.body));
  assert.equal(goodLogin.body.data.user.username, 'siso_collector');
});

test('account profile, default address, password change, and deletion', async () => {
  const agent = await guestSession();

  await reqPost(agent, '/api/auth/register', {
    username: 'juandelacruz',
    email: 'juana@siso.test',
    phone: '09179998888',
    birthday: '2002-08-12',
    password: 'Password123',
    confirmPassword: 'Password123',
  });

  // Reject invalid ZIP / phone in saved address
  const badAddr = await reqPatch(agent, '/api/account/profile', {
    username: 'juandelacruz',
    email: 'juana@siso.test',
    phone: '09179998888',
    birthday: '2002-08-12',
    defaultAddress: {
      recipientName: 'Juana Dela Cruz',
      phone: '0917-BAD-123',
      shippingAddress: 'Unit 5 Katipunan Ave',
      city: 'Quezon City',
      barangay: 'Loyola Heights',
      postalCode: '11AB',
      region: 'metro-manila',
    },
  });
  assert.equal(badAddr.status, 400);

  // Save valid profile + address
  const goodAddr = await reqPatch(agent, '/api/account/profile', {
    username: 'juandelacruz',
    email: 'juana@siso.test',
    phone: '09179998888',
    birthday: '2002-08-12',
    defaultAddress: {
      recipientName: 'Juana Dela Cruz',
      phone: '09179998888',
      shippingAddress: 'Unit 5 Katipunan Ave',
      city: 'Quezon City',
      barangay: 'Loyola Heights',
      postalCode: '1108',
      region: 'metro-manila',
    },
  });
  assert.equal(goodAddr.status, 200, JSON.stringify(goodAddr.body));
  assert.equal(goodAddr.body.data.user.defaultAddress.postalCode, '1108');

  // Password change validates current password
  const badPw = await reqPost(agent, '/api/account/password', {
    currentPassword: 'WrongCurrent1',
    newPassword: 'BrandNewPassword1',
    confirmPassword: 'BrandNewPassword1',
  });
  assert.equal(badPw.status, 401);

  const goodPw = await reqPost(agent, '/api/account/password', {
    currentPassword: 'Password123',
    newPassword: 'BrandNewPassword1',
    confirmPassword: 'BrandNewPassword1',
  });
  assert.equal(goodPw.status, 200);

  // Permanent deletion requires password + 'DELETE'
  const badDel = await reqDelete(agent, '/api/account', {
    password: 'BrandNewPassword1',
    confirmation: 'NOPE',
  });
  assert.equal(badDel.status, 400);

  const goodDel = await reqDelete(agent, '/api/account', {
    password: 'BrandNewPassword1',
    confirmation: 'DELETE',
  });
  assert.equal(goodDel.status, 200);

  const meAfterDelete = await agent.get('/api/auth/me');
  assert.equal(meAfterDelete.body.data.authenticated, false);
});

test('strict checkout validation rejects letters in zip/phone/name', async () => {
  const agent = await guestSession();
  const qRes = await reqPost(agent, '/api/checkout/quote', {
    items: [{ slug: 'dumpling', quantity: 1 }],
    region: 'metro-manila',
  });
  assert.equal(qRes.status, 201);

  const badZip = await reqPost(
    agent,
    '/api/orders',
    {
      quoteId: qRes.body.data.quoteId,
      paymentMethod: 'gcash',
      customerName: 'Juana Dela Cruz',
      customerEmail: 'juana@siso.test',
      customerPhone: '09171234567',
      shippingAddress: 'Unit 5 Katipunan',
      city: 'Quezon City',
      barangay: 'Loyola Heights',
      postalCode: '10AB',
    },
    randomUUID()
  );
  assert.equal(badZip.status, 400);

  const badPhone = await reqPost(
    agent,
    '/api/orders',
    {
      quoteId: qRes.body.data.quoteId,
      paymentMethod: 'gcash',
      customerName: 'Juana Dela Cruz',
      customerEmail: 'juana@siso.test',
      customerPhone: '0917abc4567',
      shippingAddress: 'Unit 5 Katipunan',
      city: 'Quezon City',
      barangay: 'Loyola Heights',
      postalCode: '1108',
    },
    randomUUID()
  );
  assert.equal(badPhone.status, 400);

  const badName = await reqPost(
    agent,
    '/api/orders',
    {
      quoteId: qRes.body.data.quoteId,
      paymentMethod: 'gcash',
      customerName: 'Juana1234',
      customerEmail: 'juana@siso.test',
      customerPhone: '09171234567',
      shippingAddress: 'Unit 5 Katipunan',
      city: 'Quezon City',
      barangay: 'Loyola Heights',
      postalCode: '1108',
    },
    randomUUID()
  );
  assert.equal(badName.status, 400);
});

test('full Shopee lifecycle: login -> GCash simulation -> delivery progression -> receipt & review', async () => {
  const agent = await guestSession();

  await reqPost(agent, '/api/auth/register', {
    username: 'shopper_ph',
    email: 'shopper@siso.test',
    phone: '09175551234',
    birthday: '2001-03-14',
    password: 'ShopPassword1',
    confirmPassword: 'ShopPassword1',
  });

  const qRes = await reqPost(agent, '/api/checkout/quote', {
    items: [{ slug: 'dumpling', quantity: 2 }],
    region: 'metro-manila',
    voucherCode: 'WELCOME10',
  });
  assert.equal(qRes.status, 201);

  const ordRes = await reqPost(
    agent,
    '/api/orders',
    {
      quoteId: qRes.body.data.quoteId,
      paymentMethod: 'gcash',
      customerName: 'Sofia Navarro',
      customerEmail: 'shopper@siso.test',
      customerPhone: '09175551234',
      shippingAddress: 'Suite 21, Aurora Blvd',
      city: 'Quezon City',
      barangay: 'Cubao',
      postalCode: '1109',
      orderNote: 'Leave with lobby guard',
    },
    randomUUID()
  );
  assert.equal(ordRes.status, 201, JSON.stringify(ordRes.body));
  const orderNumber = ordRes.body.data.orderNumber;
  assert.equal(ordRes.body.data.status, 'To Pay');

  // Account order list contains newly placed order
  const listRes = await agent.get('/api/account/orders');
  assert.equal(listRes.status, 200);
  assert.equal(listRes.body.data.length, 1);
  assert.equal(listRes.body.data[0].orderNumber, orderNumber);

  // GCash payment simulation records masked mobile & GC- gateway ref
  const paySess = await reqPost(
    agent,
    '/api/payments/sessions',
    { orderNumber },
    randomUUID()
  );
  assert.equal(paySess.status, 201);

  const gcashPay = await reqPost(
    agent,
    `/api/payments/sessions/${paySess.body.data.sessionId}/simulate`,
    {
      outcome: 'success',
      payerMobile: '09175551234',
      otpCode: '482910',
      mpin: '1234',
    }
  );
  assert.equal(gcashPay.status, 200, JSON.stringify(gcashPay.body));
  assert.equal(gcashPay.body.data.order.status, 'To Ship');
  assert.equal(gcashPay.body.data.order.paymentStatus, 'Paid');
  assert.equal(
    gcashPay.body.data.order.paymentDetails.maskedAccount,
    '0917••••234'
  );
  assert.match(gcashPay.body.data.order.paymentReference, /^GC-/);

  // Delivery progression: To Ship -> Shipped -> Out for Delivery -> Completed
  const stepShipped = await reqPost(agent, `/api/orders/${orderNumber}/demo-advance`, {
    stage: 'shipped',
  });
  assert.equal(stepShipped.status, 200);
  assert.equal(stepShipped.body.data.status, 'Shipped');
  assert.equal(stepShipped.body.data.deliveryStage, 'in_transit');

  const stepOtd = await reqPost(agent, `/api/orders/${orderNumber}/demo-advance`, {
    stage: 'out_for_delivery',
  });
  assert.equal(stepOtd.status, 200);
  assert.equal(stepOtd.body.data.deliveryStage, 'out_for_delivery');

  const stepCompleted = await reqPost(agent, `/api/orders/${orderNumber}/demo-advance`, {
    stage: 'completed',
  });
  assert.equal(stepCompleted.status, 200);
  assert.equal(stepCompleted.body.data.status, 'Completed');
  assert.equal(stepCompleted.body.data.deliveryStage, 'delivered');

  // Review now unlocks for completed purchase
  const reviewRes = await reqPost(agent, '/api/reviews', {
    orderNumber,
    productSlug: 'dumpling',
    reviewerName: 'Sofia N.',
    rating: 5,
    comment: 'Super soft slow-rising dumpling squishy and fast GCash checkout!',
  });
  assert.equal(reviewRes.status, 201, JSON.stringify(reviewRes.body));
});

