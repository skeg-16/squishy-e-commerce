const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildReceiptHtml, sendOrderReceiptEmail } = require('../server/email');

test('buildReceiptHtml formats order, items, and totals accurately', () => {
  const sampleOrder = {
    orderNumber: 'SQ-ABCDEF1234',
    trackingNumber: 'DEMO-ABCDEF1234',
    customerName: 'Maria Clara',
    customerEmail: 'maria@example.ph',
    customerPhone: '09171234567',
    shippingAddress: '456 Rizal Ave',
    barangay: 'San Lorenzo',
    city: 'Makati City',
    postalCode: '1223',
    paymentMethod: 'gcash',
    paymentStatus: 'Paid',
    items: [
      { name: 'Giant Baozi Squishy', quantity: 2, priceMinor: 24900 },
      { name: 'Matcha Mochi Cat', quantity: 1, priceMinor: 19900 },
    ],
    subtotal: 697.00,
    shippingFee: 60.00,
    voucherDiscount: 50.00,
    total: 707.00,
  };

  const html = buildReceiptHtml(sampleOrder);

  assert.ok(html.includes('SQ-ABCDEF1234'), 'Includes order number');
  assert.ok(html.includes('DEMO-ABCDEF1234'), 'Includes tracking number');
  assert.ok(html.includes('Maria Clara'), 'Includes customer name');
  assert.ok(html.includes('09171234567'), 'Includes phone');
  assert.ok(html.includes('Makati City'), 'Includes city');
  assert.ok(html.includes('Giant Baozi Squishy'), 'Includes item name');
  assert.ok(html.includes('Matcha Mochi Cat'), 'Includes second item');
  assert.ok(html.includes('GCASH (Paid)'), 'Includes payment info');
  assert.ok(html.includes('₱707.00'), 'Includes formatted grand total');
  assert.ok(html.includes('SISO Squishies Collective'), 'Includes brand name');
});

test('sendOrderReceiptEmail skips in test environment safely', async () => {
  const result = await sendOrderReceiptEmail({
    orderNumber: 'SQ-TEST',
    customerEmail: 'test@example.com',
  });
  assert.equal(result.sent, true);
  assert.equal(result.skipped, true);
});

test('sendOrderReceiptEmail handles missing email or missing API key safely', async () => {
  const originalKey = process.env.BREVO_API_KEY;
  try {
    delete process.env.BREVO_API_KEY;
    const noKeyResult = await sendOrderReceiptEmail({ orderNumber: 'SQ-1' });
    assert.equal(noKeyResult.sent, false);
    assert.equal(noKeyResult.reason, 'BREVO_API_KEY not configured');

    process.env.BREVO_API_KEY = 'test-key';
    const noEmailResult = await sendOrderReceiptEmail({ orderNumber: 'SQ-1' });
    assert.equal(noEmailResult.sent, false);
    assert.equal(noEmailResult.reason, 'No recipient email specified');
  } finally {
    if (originalKey) process.env.BREVO_API_KEY = originalKey;
  }
});
