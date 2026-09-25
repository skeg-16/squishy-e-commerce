const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');
const { embedded } = require('./embedded');
const { createPool } = require('../server/db');
const { createApp } = require('../server/app');
const { createCommerce } = require('../server/commerce');
const { migrate } = require('./database');
const { seed } = require('../server/seed');
const { build } = require('./build');
(async () => {
  let db, pool, server, browser;
  try {
    db = await embedded(); pool = createPool(db.url); await migrate(pool); await seed(pool); build();
    const port = 3037, base = `http://localhost:${port}`;
    server = createApp({ pool, demoMode: true, origins: [base], rateLimit: 10000, serveStatic: true }).listen(port);
    await new Promise(resolve => server.once('listening', resolve));
    browser = await chromium.launch();
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const output = path.join(__dirname, '../test-results'); await fs.mkdir(output, { recursive: true });
    const screenshot = async name => { await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' })); return page.screenshot({ path: path.join(output, name), fullPage: true }); };
    const fill = async () => {
      for (const [id, value] of Object.entries({ ckEmail: 'buyer@example.test', ckName: 'Demo Buyer', ckPhone: '09171234567', ckAddress: '123 Test Street', ckCity: 'Manila', ckBarangay: 'Ermita', ckPostalCode: '1000' })) await page.locator(`#${id}`).fill(value);
      await page.getByRole('button', { name: 'Place Order', exact: true }).waitFor();
    };
    await page.goto(base);
    await page.locator('.add-to-cart[data-slug="dumpling"]:not([disabled])').waitFor();
    await screenshot('home-desktop.png');
    await page.locator('.add-to-cart[data-slug="stress-free-trio"]').click();
    await page.goto(`${base}/checkout.html`); await fill();
    assert.equal(await page.locator('#ckTotal').textContent(), '₱309');
    await page.locator('#ckVoucherCode').fill('FREESHIP');
    await page.locator('#applyVoucherBtn').click();
    await page.waitForFunction(() => document.querySelector('#ckTotal').textContent === '₱249');
    await screenshot('checkout-desktop.png');

    // Outage before submission must leave the cart intact and show no receipt.
    await page.route('**/api/orders', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'Test outage', code: 'SERVICE_UNAVAILABLE' }) }));
    await page.locator('#placeOrderBtn').click(); await page.waitForFunction(() => document.querySelector('#checkoutError').textContent.includes('Test outage'));
    assert.equal(await page.locator('.shopee-order-view').count(), 0);
    assert.ok(await page.evaluate(() => JSON.parse(localStorage.getItem('siso-squishies-cart')).length > 0));
    await page.unroute('**/api/orders');
    // Simulate a lost response AFTER the database committed. Retry must recover it.
    await page.route('**/api/orders', async route => { await route.fetch(); await route.abort('failed'); }, { times: 1 });
    await page.locator('#placeOrderBtn').click();
    await page.waitForFunction(() => document.querySelector('#placeOrderBtn').textContent === 'Retry unconfirmed order');
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM orders')).rows[0].n, 1);
    await page.reload(); await page.locator('#placeOrderBtn').click();
    await page.locator('#shopeeStatusBadge').waitFor();
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM orders')).rows[0].n, 1);
    assert.equal(await page.locator('#shopeeStatusBadge').textContent(), 'Order Status: To Ship');
    const codNumber = new URL(page.url()).searchParams.get('order');
    await page.reload(); await page.locator('#cancelOrderBtn').click();
    await page.getByRole('button', { name: 'Confirm Cancellation', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('#shopeeStatusBadge').textContent.includes('Cancelled'));
    await page.reload(); await page.locator('#shopeeStatusBadge').waitFor();
    assert.ok((await page.locator('#shopeeStatusBadge').textContent()).includes('Cancelled'));
    assert.equal((await pool.query("SELECT stock FROM products WHERE slug='dumpling'")).rows[0].stock, 100);
    console.log('PASS desktop: fixed bundle, voucher, API failure, lost-response recovery, refresh, cancellation');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${base}/product.html?slug=peanut`);
    await page.locator('#pdpAddToCart:not([disabled])').waitFor(); await screenshot('product-mobile.png');
    await page.locator('#pdpBuyNow').click(); await fill();
    await page.locator('[name=paymentMethod][value=gcash]').check();
    await screenshot('checkout-mobile.png');
    await page.locator('#placeOrderBtn').click(); await page.locator('#retryPaymentBtn').click();
    assert.equal(await page.locator('.payment-modal input').count(), 0);
    await page.getByRole('button', { name: 'Simulate decline', exact: true }).click();
    await page.locator('#retryPaymentBtn').click();
    await page.getByRole('button', { name: 'Simulate success', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('#shopeeStatusBadge').textContent.includes('To Ship'));
    const prepaidNumber = new URL(page.url()).searchParams.get('order');
    await page.reload(); await page.locator('#shopeeStatusBadge').waitFor();
    await screenshot('receipt-mobile.png');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Mobile receipt must not overflow');
    const service = createCommerce(pool, { demoMode: true });
    await service.advanceDemo(prepaidNumber, 'Shipped'); await service.advanceDemo(prepaidNumber, 'Completed');
    await page.getByRole('button', { name: 'Refresh status', exact: true }).click(); await page.locator('#reviewName').fill('Demo Buyer');
    await page.locator('#reviewComment').fill('<img src=x onerror="window.injected=true"> Excellent squishy.');
    await page.getByRole('button', { name: 'Submit review', exact: true }).click();
    await page.getByText('Thank you! Your verified review was saved.').waitFor();
    await page.goto(`${base}/product.html?slug=peanut`);
    await page.getByText('<img src=x onerror="window.injected=true"> Excellent squishy.').waitFor();
    assert.equal(await page.evaluate(() => window.injected), undefined);
    console.log('PASS mobile: prepaid decline/retry/success, receipt refresh, delivery, verified review and safe text');

    // Displayed prices are hydrated, and recognizable legacy carts migrate safely.
    await page.goto(`${base}/shop.html`);
    await page.locator('.add-to-cart[data-slug="peanut"]:not([disabled])').waitFor();
    await page.evaluate(() => localStorage.setItem('siso-squishies-cart', JSON.stringify([{ name: 'Peanut Squishy', price: 1, image: 'javascript:alert(1)', qty: 2 }, { name: '<img onerror=alert(1)>', price: 1, qty: 1 }])));
    await page.reload(); await page.locator('.add-to-cart[data-slug="peanut"]:not([disabled])').waitFor();
    const cart = await page.evaluate(() => Squishies.getCart());
    assert.equal(cart.length, 1); assert.equal(cart[0].slug, 'peanut'); assert.equal(cart[0].price, 89);
    await screenshot('shop-mobile.png');
    const other = await browser.newContext(); const otherPage = await other.newPage();
    await otherPage.goto(`${base}/checkout.html?order=${encodeURIComponent(codNumber)}`);
    await otherPage.getByText('Order not found in this browser session.').waitFor();
    assert.equal(await otherPage.locator('.shopee-order-view').count(), 0); await other.close();
    for (const asset of ['/server/squishies-db.json', '/.env', '/server/catalog.json', '/package.json', '/squishies-site/squishies-site/index.html']) {
      assert.equal((await context.request.get(base + asset)).status(), 404, asset);
    }
    assert.deepEqual(errors, []);
    console.log('PASS cart migration, private order isolation, and public asset allowlist');
    console.log(`Screenshots: ${output}`);
  } finally {
    await browser?.close();
    if (server) await new Promise(resolve => server.close(resolve));
    await pool?.end(); await db?.stop();
  }
})().catch(error => { console.error(error); process.exit(1); });
