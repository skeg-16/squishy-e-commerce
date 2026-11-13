#!/usr/bin/env node
const path = require('node:path');
const { sendOrderReceiptEmail } = require('../server/email');

async function main() {
  const recipient = process.argv[2] || process.env.TEST_EMAIL_RECIPIENT || process.env.SMTP_USER;

  console.log('----------------------------------------------------');
  console.log('  SISO Squishies — Brevo / SMTP Email Test Tool    ');
  console.log('----------------------------------------------------');
  console.log('Environment configuration detected:');
  console.log(`- BREVO_API_KEY:       ${process.env.BREVO_API_KEY ? 'Configured (Starts with ' + process.env.BREVO_API_KEY.slice(0, 8) + '...)' : 'Not set'}`);
  console.log(`- SMTP_HOST:           ${process.env.SMTP_HOST || 'smtp-relay.brevo.com'}`);
  console.log(`- SMTP_PORT:           ${process.env.SMTP_PORT || '587'}`);
  console.log(`- SMTP_USER:           ${process.env.SMTP_USER || 'Not set'}`);
  console.log(`- SMTP_PASS:           ${process.env.SMTP_PASS ? '****** (Set)' : 'Not set'}`);
  console.log(`- BREVO_SENDER_EMAIL:  ${process.env.BREVO_SENDER_EMAIL || process.env.SMTP_FROM || process.env.SMTP_USER || 'Not set'}`);
  console.log('----------------------------------------------------');

  if (!recipient) {
    console.error('Usage: node scripts/test-email.js <recipient_email@example.com>');
    console.error('Or set SMTP_USER in your .env file.');
    process.exit(1);
  }

  const sampleOrder = {
    orderNumber: 'SQ-TEST12345678',
    trackingNumber: 'DEMO-TRACK8888',
    createdAt: new Date().toISOString(),
    customerName: 'Test Squishy Fan',
    customerEmail: recipient,
    customerPhone: '09171234567',
    shippingAddress: 'Unit 402, Sakura Garden Residences, 88 Taft Avenue',
    barangay: 'Barangay 659',
    city: 'Manila',
    postalCode: '1000',
    orderNote: 'Please ring the doorbell upon arrival. Thank you!',
    paymentMethod: 'cod',
    paymentStatus: 'Pending COD',
    subtotal: 178.0,
    shippingFee: 60.0,
    voucherDiscount: 50.0,
    voucherCode: 'SQUISHY50',
    total: 188.0,
    delivery: {
      label: 'Metro Manila (1-2 days)',
      minDays: 1,
      maxDays: 2,
    },
    items: [
      {
        slug: 'cheese-cube-squishy',
        name: 'Cheese Cube Squishy',
        quantity: 1,
        price: 89.0,
        subtotal: 89.0,
      },
      {
        slug: 'peanut-squishy',
        name: 'Peanut Squishy',
        quantity: 1,
        price: 89.0,
        subtotal: 89.0,
      },
    ],
  };

  console.log(`Dispatching test receipt to: ${recipient}...`);
  const result = await sendOrderReceiptEmail(sampleOrder);
  console.log('Result:', JSON.stringify(result, null, 2));

  if (result.simulated) {
    console.log('\n[INFO] Email was simulated because neither BREVO_API_KEY nor SMTP_PASS is configured yet.');
    console.log('To send a real email:');
    console.log('1. Add BREVO_API_KEY="xkeysib-..." or SMTP_USER and SMTP_PASS to .env');
    console.log('2. Re-run: node scripts/test-email.js ' + recipient);
  } else if (result.success) {
    console.log(`\n🎉 SUCCESS! Real email receipt sent to ${recipient}! Check your inbox (and spam/promotions folder).`);
  } else {
    console.error(`\n❌ Failed to send email: ${result.error}`);
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

