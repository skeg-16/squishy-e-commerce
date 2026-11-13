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

const reqPut = (agent, url, body) =>
  agent.put(url).set('Origin', origin).send(body);

const reqDelete = (agent, url, body) => {
  const req = agent.delete(url).set('Origin', origin);
  return body !== undefined ? req.send(body) : req;
};

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
    'TRUNCATE admin_audit_logs,admin_sessions,reviews,order_events,payment_attempts,reservations,order_items,orders,quotes,user_sessions,users,guest_sessions,bundle_components,products,vouchers,rate_limits CASCADE'
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

  const tooLongFields = await reqPost(
    agent,
    '/api/orders',
    {
      quoteId: qRes.body.data.quoteId,
      paymentMethod: 'gcash',
      customerName: 'A'.repeat(65),
      customerEmail: `${'a'.repeat(75)}@siso.test`,
      customerPhone: '09171234567',
      shippingAddress: 'S'.repeat(105),
      city: 'C'.repeat(55),
      barangay: 'B'.repeat(55),
      postalCode: '1108',
    },
    randomUUID()
  );
  assert.equal(tooLongFields.status, 400);
  const longFieldNames = Object.keys(tooLongFields.body.fields || {});
  assert.ok(longFieldNames.includes('customerName'));
  assert.ok(longFieldNames.includes('customerEmail'));
  assert.ok(longFieldNames.includes('shippingAddress'));
  assert.ok(longFieldNames.includes('city'));
  assert.ok(longFieldNames.includes('barangay'));
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

test('admin authentication, user management, suspension, and self-lockout protection', async () => {
  const adminAgent = request.agent(app);

  // Unauthenticated admin access is rejected
  assert.equal((await adminAgent.get('/api/admin/summary')).status, 401);
  const initSession = await adminAgent.get('/api/admin/session');
  assert.equal(initSession.status, 200);
  assert.equal(initSession.body.data.authenticated, false);
  assert.equal(initSession.body.data.configured, true);

  // Wrong admin password rejected
  assert.equal(
    (await reqPost(adminAgent, '/api/admin/login', { password: 'wrong-password' })).status,
    401
  );

  // Master password login succeeds
  const loginRes = await reqPost(adminAgent, '/api/admin/login', {
    password: 'squishy-admin',
  });
  assert.equal(loginRes.status, 200, JSON.stringify(loginRes.body));
  assert.equal(loginRes.body.data.authenticated, true);

  // Admin creates a customer user and an admin user
  const createdCustomer = await reqPost(adminAgent, '/api/admin/users', {
    username: 'cust_maria',
    fullName: 'Maria Clara',
    email: 'maria@siso.test',
    phone: '09171112222',
    password: 'Password123',
    role: 'customer',
    active: true,
  });
  assert.equal(createdCustomer.status, 201, JSON.stringify(createdCustomer.body));
  const customerId = createdCustomer.body.data.id;

  const createdStaff = await reqPost(adminAgent, '/api/admin/users', {
    username: 'staff_admin',
    fullName: 'Staff Admin',
    email: 'staff@siso.test',
    phone: '09173334444',
    password: 'AdminPassword1',
    role: 'admin',
    active: true,
  });
  assert.equal(createdStaff.status, 201, JSON.stringify(createdStaff.body));
  const staffId = createdStaff.body.data.id;

  // Customer user logs into storefront
  const customerAgent = await guestSession();
  const custLogin = await reqPost(customerAgent, '/api/auth/login', {
    identifier: 'cust_maria',
    password: 'Password123',
  });
  assert.equal(custLogin.status, 200);
  assert.equal((await customerAgent.get('/api/auth/me')).body.data.authenticated, true);

  // Customer user cannot log into /api/admin/login
  const badAdminAttempt = await reqPost(request.agent(app), '/api/admin/login', {
    identifier: 'cust_maria',
    password: 'Password123',
  });
  assert.equal(badAdminAttempt.status, 403);

  // Admin suspends customer -> customer's active storefront session is immediately revoked
  const suspendRes = await reqPatch(adminAgent, `/api/admin/users/${customerId}`, {
    active: false,
  });
  assert.equal(suspendRes.status, 200);
  assert.equal(suspendRes.body.data.active, false);
  assert.equal((await customerAgent.get('/api/auth/me')).body.data.authenticated, false);
  assert.equal(
    (
      await reqPost(customerAgent, '/api/auth/login', {
        identifier: 'cust_maria',
        password: 'Password123',
      })
    ).status,
    403
  );

  // Admin re-activates customer and resets their password
  await reqPatch(adminAgent, `/api/admin/users/${customerId}`, { active: true });
  const resetPw = await reqPost(
    adminAgent,
    `/api/admin/users/${customerId}/reset-password`,
    { newPassword: 'NewCustPassword1' }
  );
  assert.equal(resetPw.status, 200);

  // Customer can now log in with new password and clear defaultAddress with null
  const relogin = await reqPost(customerAgent, '/api/auth/login', {
    identifier: 'cust_maria',
    password: 'NewCustPassword1',
  });
  assert.equal(relogin.status, 200);
  const clearAddr = await reqPatch(customerAgent, '/api/account/profile', {
    username: 'cust_maria',
    email: 'maria@siso.test',
    phone: '09171112222',
    birthday: '2002-05-10',
    defaultAddress: null,
  });
  assert.equal(clearAddr.status, 200, JSON.stringify(clearAddr.body));
  assert.equal(clearAddr.body.data.user.defaultAddress, null);

  // Staff admin logs into /api/admin/login using their username & password
  const staffAgent = request.agent(app);
  const staffLogin = await reqPost(staffAgent, '/api/admin/login', {
    identifier: 'staff_admin',
    password: 'AdminPassword1',
  });
  assert.equal(staffLogin.status, 200, JSON.stringify(staffLogin.body));
  assert.equal(staffLogin.body.data.admin.username, 'staff_admin');

  // Staff admin cannot demote, suspend, or delete their own account
  assert.equal(
    (await reqPatch(staffAgent, `/api/admin/users/${staffId}`, { role: 'customer' })).status,
    409
  );
  assert.equal(
    (await reqPatch(staffAgent, `/api/admin/users/${staffId}`, { active: false })).status,
    409
  );
  assert.equal((await reqDelete(staffAgent, `/api/admin/users/${staffId}`)).status, 409);

  // Master admin deletes customer account
  const delCust = await reqDelete(adminAgent, `/api/admin/users/${customerId}`);
  assert.equal(delCust.status, 200);

  // Logout clears admin session
  await reqPost(staffAgent, '/api/admin/logout', {});
  assert.equal((await staffAgent.get('/api/admin/summary')).status, 401);
});

test('admin catalog CRUD, stock updates, vouchers, order fulfillment, and review moderation', async () => {
  const adminAgent = request.agent(app);
  await reqPost(adminAgent, '/api/admin/login', { password: 'squishy-admin' });

  // Create a new single product and a new bundle product
  const newSingle = await reqPost(adminAgent, '/api/admin/products', {
    name: 'Ube Cheese Pandesal Squishy',
    slug: 'ube-pandesal',
    kind: 'single',
    price: 95,
    stock: 40,
    active: true,
    badge: 'Pinoy Drop',
    badgeClass: 'badge--purple',
    image: 'assets/images/product-dumpling.svg',
    description: 'Pillow-soft ube pandesal squishy with slow-rising foam.',
    specs: { Material: 'Slow-rising PU foam', Scent: 'Sweet Ube' },
  });
  assert.equal(newSingle.status, 201, JSON.stringify(newSingle.body));
  assert.equal(newSingle.body.data.price, 95);
  assert.equal(newSingle.body.data.stock, 40);

  // Storefront immediately sees the new product
  const storefrontProd = await request(app).get('/api/products/ube-pandesal');
  assert.equal(storefrontProd.status, 200);
  assert.equal(storefrontProd.body.data.name, 'Ube Cheese Pandesal Squishy');

  // Update stock and product details
  const stockRes = await reqPatch(adminAgent, '/api/admin/products/ube-pandesal/stock', {
    stock: 8,
  });
  assert.equal(stockRes.status, 200);
  assert.equal(stockRes.body.data.stock, 8);

  const updatedProd = await reqPut(adminAgent, '/api/admin/products/ube-pandesal', {
    name: 'Ube Cheese Pandesal Deluxe',
    price: 99,
    stock: 8,
    active: true,
    badge: 'Limited',
    badgeClass: 'badge--purple',
    image: 'assets/images/product-dumpling.svg',
    description: 'Deluxe ube pandesal squishy.',
    specs: { Material: 'Memory foam' },
  });
  assert.equal(updatedProd.status, 200);
  assert.equal(updatedProd.body.data.price, 99);

  // Create a new voucher and verify it works in checkout quote
  const newVoucher = await reqPost(adminAgent, '/api/admin/vouchers', {
    code: 'UBELOVE25',
    type: 'fixed_amount',
    value: 25,
    minSpend: 90,
    description: '₱25 off Ube drops',
    active: true,
  });
  assert.equal(newVoucher.status, 201, JSON.stringify(newVoucher.body));
  assert.equal(newVoucher.body.data.value, 25);

  const availVouchers = await request(app).get('/api/vouchers/available');
  assert.equal(availVouchers.status, 200);
  assert.ok(availVouchers.body.data.some((v) => v.code === 'UBELOVE25' && v.value === 25));

  // Buyer places an order using the new product and new voucher
  const buyer = await guestSession();
  const qRes = await reqPost(buyer, '/api/checkout/quote', {
    items: [{ slug: 'ube-pandesal', quantity: 2 }],
    region: 'metro-manila',
    voucherCode: 'UBELOVE25',
  });
  assert.equal(qRes.status, 201, JSON.stringify(qRes.body));
  assert.equal(qRes.body.data.subtotal, 198);
  assert.equal(qRes.body.data.voucherDiscount, 25);

  const ordRes = await reqPost(
    buyer,
    '/api/orders',
    {
      quoteId: qRes.body.data.quoteId,
      paymentMethod: 'cod',
      customerName: 'Carlo Mendoza',
      customerEmail: 'carlo@siso.test',
      customerPhone: '09178889999',
      shippingAddress: '88 Taft Ave',
      city: 'Manila',
      barangay: 'Malate',
      postalCode: '1004',
    },
    randomUUID()
  );
  assert.equal(ordRes.status, 201);
  const orderNumber = ordRes.body.data.orderNumber;

  // Product referenced by an order cannot be deleted (must be hidden instead)
  assert.equal(
    (await reqDelete(adminAgent, '/api/admin/products/ube-pandesal')).status,
    409
  );

  // Admin ships, marks out for delivery, and completes the order
  const shipRes = await reqPost(adminAgent, `/api/admin/orders/${orderNumber}/action`, {
    action: 'ship',
  });
  assert.equal(shipRes.status, 200);
  assert.equal(shipRes.body.data.status, 'Shipped');

  const otdRes = await reqPost(adminAgent, `/api/admin/orders/${orderNumber}/action`, {
    action: 'out_for_delivery',
  });
  assert.equal(otdRes.status, 200);
  assert.equal(otdRes.body.data.deliveryStage, 'out_for_delivery');

  const compRes = await reqPost(adminAgent, `/api/admin/orders/${orderNumber}/action`, {
    action: 'complete',
  });
  assert.equal(compRes.status, 200);
  assert.equal(compRes.body.data.status, 'Completed');
  assert.equal(compRes.body.data.paymentStatus, 'Paid');

  // Buyer leaves a review, admin moderates (lists and deletes) the review
  const revRes = await reqPost(buyer, '/api/reviews', {
    orderNumber,
    productSlug: 'ube-pandesal',
    reviewerName: 'Carlo M.',
    rating: 5,
    comment: 'Best ube pandesal squishy ever!',
  });
  assert.equal(revRes.status, 201);

  const adminReviews = await adminAgent.get('/api/admin/reviews');
  assert.equal(adminReviews.status, 200);
  assert.equal(adminReviews.body.data.length, 1);
  const reviewId = adminReviews.body.data[0].id;

  const delReview = await reqDelete(adminAgent, `/api/admin/reviews/${reviewId}`);
  assert.equal(delReview.status, 200);
  assert.equal((await adminAgent.get('/api/admin/reviews')).body.data.length, 0);

  // Dashboard summary reflects paid revenue, lowStock (ube-pandesal has 6 left <= 10), and audit logs
  const summary = await adminAgent.get('/api/admin/summary');
  assert.equal(summary.status, 200);
  assert.equal(summary.body.data.paidOrders, 1);
  assert.equal(summary.body.data.revenue, 233);
  assert.ok(summary.body.data.lowStock.some((item) => item.slug === 'ube-pandesal'));
  assert.ok(summary.body.data.recentLogs.length > 0);
});


