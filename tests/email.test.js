const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  buildReceiptHtml,
  buildReceiptPlainText,
  sendOrderReceiptEmail,
  getAppOrigin,
} = require('../server/email');

test('buildReceiptHtml includes all order details and branding', () => {
  const sampleOrder = {
    orderNumber: 'SQ-ABCDEF123456',
    trackingNumber: 'DEMO-ABCDEF123456',
    createdAt: '2026-11-14T12:00:00.000Z',
    customerName: 'Maria Santos',
    customerEmail: 'maria.santos@example.com',
    customerPhone: '09171234567',
    shippingAddress: 'Unit 12B, Sun Residences',
    barangay: 'Barangay 72',
    city: 'Manila',
    postalCode: '1008',
    paymentMethod: 'cod',
    paymentStatus: 'Pending COD',
    subtotal: 178.0,
    shippingFee: 60.0,
    voucherDiscount: 10.0,
    voucherCode: 'WELCOME10',
    total: 228.0,
    orderNote: 'Please call before delivery',
    delivery: { label: 'Metro Manila (1-2 days)' },
    items: [
      { name: 'Dumpling Squishy', quantity: 2, price: 89.0, subtotal: 178.0 },
    ],
  };

  const trackingUrl = 'http://localhost:5173/checkout?order=SQ-ABCDEF123456';
  const html = buildReceiptHtml(sampleOrder, trackingUrl);

  assert.ok(html.includes('SISO Squishies Collective'), 'Branding title present');
  assert.ok(html.includes('OR-EF123456'), 'Receipt reference present');
  assert.ok(html.includes('SQ-ABCDEF123456'), 'Order number present');
  assert.ok(html.includes('Maria Santos'), 'Customer name present');
  assert.ok(html.includes('Unit 12B, Sun Residences'), 'Address present');
  assert.ok(html.includes('Dumpling Squishy'), 'Item name present');
  assert.ok(html.includes('₱228.00'), 'Total formatted in PHP present');
  assert.ok(html.includes('WELCOME10'), 'Voucher code present');
  assert.ok(html.includes('Please call before delivery'), 'Rider note present');
  assert.ok(html.includes(trackingUrl), 'Tracking URL link present');
});

test('buildReceiptPlainText generates clean text receipt', () => {
  const sampleOrder = {
    orderNumber: 'SQ-PLAIN123456',
    trackingNumber: 'DEMO-PLAIN123456',
    customerName: 'Juan Dela Cruz',
    customerPhone: '09181234567',
    shippingAddress: '456 Rizal Ave',
    barangay: 'Barangay 10',
    city: 'Manila',
    postalCode: '1000',
    paymentMethod: 'gcash',
    paymentStatus: 'Paid',
    paymentReference: 'GC-REF999',
    subtotal: 89.0,
    shippingFee: 0,
    voucherDiscount: 0,
    total: 89.0,
    items: [
      { name: 'Peanut Squishy', quantity: 1, price: 89.0, subtotal: 89.0 },
    ],
  };

  const text = buildReceiptPlainText(sampleOrder, 'http://localhost:5173/checkout?order=SQ-PLAIN123456');

  assert.ok(text.includes('SISO SQUISHIES COLLECTIVE — ORDER RECEIPT'));
  assert.ok(text.includes('SQ-PLAIN123456'));
  assert.ok(text.includes('GC-REF999'));
  assert.ok(text.includes('Juan Dela Cruz'));
  assert.ok(text.includes('Peanut Squishy x 1 = ₱89.00'));
  assert.ok(text.includes('TOTAL AMOUNT DUE:     ₱89.00'));
});

test('sendOrderReceiptEmail handles simulation fallback gracefully', async () => {
  const origKey = process.env.BREVO_API_KEY;
  const origSmtp = process.env.SMTP_PASS;
  try {
    delete process.env.BREVO_API_KEY;
    delete process.env.SMTP_PASS;
    const result = await sendOrderReceiptEmail({
      orderNumber: 'SQ-SIMULATED-01',
      customerEmail: 'collector@example.com',
      customerName: 'Collector User',
      customerPhone: '09171234567',
      shippingAddress: 'Sample St',
      barangay: 'Brgy 1',
      city: 'Manila',
      postalCode: '1000',
      paymentMethod: 'cod',
      subtotal: 100,
      shippingFee: 60,
      voucherDiscount: 0,
      total: 160,
      items: [],
    });

    assert.equal(result.success, true);
    assert.equal(result.simulated, true);
    assert.equal(result.orderNumber, 'SQ-SIMULATED-01');
  } finally {
    if (origKey) process.env.BREVO_API_KEY = origKey;
    if (origSmtp) process.env.SMTP_PASS = origSmtp;
  }
});

test('sendOrderReceiptEmail skips when order has no email', async () => {
  const result = await sendOrderReceiptEmail({ orderNumber: 'SQ-NO-EMAIL' });
  assert.equal(result.skipped, true);
  assert.equal(result.reason, 'NO_RECIPIENT_EMAIL');
});

