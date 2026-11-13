const nodemailer = require('nodemailer');

/**
 * Resolves the storefront public base URL for receipt tracking links.
 */
function getAppOrigin() {
  if (process.env.APP_ORIGIN) return process.env.APP_ORIGIN.replace(/\/+$/, '');
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.replace(/\/+$/, '')}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL.replace(/\/+$/, '')}`;
  return 'http://localhost:5173';
}

/**
 * Formats a currency amount to Philippine Peso format (₱X.XX).
 */
function formatPeso(amount) {
  const num = Number(amount) || 0;
  return `₱${num.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Generates an aesthetic, responsive HTML email template for the order receipt.
 */
function buildReceiptHtml(order, trackingUrl) {
  const isCod = order.paymentMethod === 'cod';
  const paymentBadge = isCod
    ? '<span style="background:#fff3cd;color:#856404;padding:4px 10px;border-radius:12px;font-weight:600;font-size:12px;">CASH ON DELIVERY (Pending COD)</span>'
    : '<span style="background:#d4edda;color:#155724;padding:4px 10px;border-radius:12px;font-weight:600;font-size:12px;">PAID ONLINE (' + (order.paymentMethod || '').toUpperCase() + ')</span>';

  const orderDate = order.createdAt
    ? new Date(order.createdAt).toLocaleString('en-PH', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : new Date().toLocaleDateString('en-PH');

  const itemsRows = (order.items || [])
    .map(
      (item) => `
      <tr>
        <td style="padding:12px 10px;border-bottom:1px solid #f0e6ed;color:#2c1b2d;font-size:14px;">
          <strong>${item.name || item.slug}</strong>
          <div style="font-size:12px;color:#8c7585;">Qty: ${item.quantity} × ${formatPeso(item.price)}</div>
        </td>
        <td style="padding:12px 10px;border-bottom:1px solid #f0e6ed;color:#2c1b2d;text-align:right;font-weight:600;font-size:14px;">
          ${formatPeso(item.subtotal || item.price * item.quantity)}
        </td>
      </tr>
    `
    )
    .join('');

  const voucherRow =
    order.voucherDiscount > 0
      ? `
      <tr>
        <td style="padding:6px 0;color:#c92a6b;font-size:13px;">Voucher Discount (${order.voucherCode || 'PROMO'})</td>
        <td style="padding:6px 0;color:#c92a6b;text-align:right;font-weight:600;font-size:13px;">−${formatPeso(order.voucherDiscount)}</td>
      </tr>
    `
      : '';

  const riderNoteBlock = order.orderNote
    ? `
      <div style="margin-top:14px;padding:10px 14px;background:#fff8fa;border-left:3px solid #ff6584;border-radius:4px;font-size:12px;color:#6b4458;">
        <strong>Delivery Note:</strong> "${escapeHtml(order.orderNote)}"
      </div>
    `
    : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Confirmation & Receipt — ${order.orderNumber}</title>
</head>
<body style="margin:0;padding:24px 12px;background:#fbf8fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#2b1b2d;line-height:1.5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" align="center" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;box-shadow:0 8px 30px rgba(133,58,110,0.08);overflow:hidden;border:1px solid #f2e6ee;">
    <!-- Header -->
    <tr>
      <td style="padding:28px 24px;background:linear-gradient(135deg, #3d1b38 0%, #220e20 100%);text-align:center;color:#ffffff;">
        <div style="font-size:24px;font-weight:800;letter-spacing:-0.5px;color:#ffffff;display:inline-block;">
          ✨ SISO Squishies Collective
        </div>
        <div style="font-size:12px;color:#e8b5d8;margin-top:4px;letter-spacing:0.5px;text-transform:uppercase;">
          Authentic Slow-Rising Squishy Sensory Store • Manila, PH
        </div>
        <div style="margin-top:16px;display:inline-block;background:rgba(255,255,255,0.12);padding:6px 14px;border-radius:20px;font-size:13px;color:#fff;">
          Official Acknowledgement Receipt <strong>OR-${(order.orderNumber || '').slice(-8)}</strong>
        </div>
      </td>
    </tr>

    <!-- Salutation & Confirmation Banner -->
    <tr>
      <td style="padding:28px 24px 16px 24px;">
        <h2 style="margin:0 0 8px 0;font-size:20px;font-weight:700;color:#2c1328;">
          Thank you for your order, ${escapeHtml(order.customerName || 'Collector')}! 🎉
        </h2>
        <p style="margin:0 0 16px 0;font-size:14px;color:#5e4857;">
          ${
            isCod
              ? 'Your Cash on Delivery order is confirmed and our Manila fulfillment team is now packing your squishies.'
              : 'Your payment was confirmed and your squishies are now queued for express fulfillment.'
          }
        </p>

        <!-- Order Meta Box -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#fdf4f8;border-radius:12px;padding:16px;margin-bottom:20px;border:1px solid #fae1ed;">
          <tr>
            <td style="padding:4px 0;font-size:13px;color:#7a586e;width:40%;">Order Number:</td>
            <td style="padding:4px 0;font-size:13px;color:#2c1328;font-weight:700;">${order.orderNumber}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;font-size:13px;color:#7a586e;">Tracking Code:</td>
            <td style="padding:4px 0;font-size:13px;color:#2c1328;font-weight:700;">${order.trackingNumber || 'DEMO-TRACK'}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;font-size:13px;color:#7a586e;">Date Placed:</td>
            <td style="padding:4px 0;font-size:13px;color:#2c1328;">${orderDate}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;font-size:13px;color:#7a586e;">Payment Status:</td>
            <td style="padding:4px 0;font-size:13px;">${paymentBadge}</td>
          </tr>
          ${
            order.paymentReference
              ? `
          <tr>
            <td style="padding:4px 0;font-size:13px;color:#7a586e;">Gateway Reference:</td>
            <td style="padding:4px 0;font-size:13px;color:#2c1328;font-weight:600;">${order.paymentReference}</td>
          </tr>`
              : ''
          }
        </table>

        <!-- Delivery Address Box -->
        <div style="background:#faf7f9;border-radius:12px;padding:16px;margin-bottom:24px;border:1px solid #eee1eb;">
          <div style="font-size:12px;font-weight:700;color:#9b5380;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">
            📍 Shipping Destination
          </div>
          <div style="font-size:14px;font-weight:600;color:#2c1328;">
            ${escapeHtml(order.customerName)} • ${escapeHtml(order.customerPhone)}
          </div>
          <div style="font-size:13px;color:#5a4755;margin-top:4px;">
            ${escapeHtml(order.shippingAddress)}, Brgy. ${escapeHtml(order.barangay)}, ${escapeHtml(order.city)}, ${escapeHtml(order.postalCode)}
          </div>
          <div style="font-size:12px;color:#856e7e;margin-top:4px;">
            Transit Zone: ${escapeHtml(order.delivery?.label || order.region || 'Standard Courier')}
          </div>
          ${riderNoteBlock}
        </div>

        <!-- Ordered Items Table -->
        <div style="font-size:14px;font-weight:700;color:#2c1328;margin-bottom:10px;">
          Purchased Squishies (${(order.items || []).length} item${(order.items || []).length === 1 ? '' : 's'})
        </div>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:20px;">
          <thead>
            <tr style="border-bottom:2px solid #ecdde7;">
              <th align="left" style="padding:8px 10px;font-size:12px;color:#7d5c72;text-transform:uppercase;">Item</th>
              <th align="right" style="padding:8px 10px;font-size:12px;color:#7d5c72;text-transform:uppercase;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>

        <!-- Totals Summary -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-top:1px solid #f0e6ed;padding-top:12px;margin-bottom:24px;">
          <tr>
            <td style="padding:4px 0;font-size:13px;color:#6b5263;">Merchandise Subtotal</td>
            <td style="padding:4px 0;font-size:13px;color:#2c1328;text-align:right;">${formatPeso(order.subtotal)}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;font-size:13px;color:#6b5263;">Courier Shipping Fee</td>
            <td style="padding:4px 0;font-size:13px;color:#2c1328;text-align:right;">
              ${order.shippingFee > 0 ? formatPeso(order.shippingFee) : '<span style="color:#15803d;font-weight:600;">FREE</span>'}
            </td>
          </tr>
          ${voucherRow}
          <tr style="border-top:2px solid #3d1b38;">
            <td style="padding:14px 0 4px 0;font-size:16px;font-weight:800;color:#2c1328;">Total Amount Due:</td>
            <td style="padding:14px 0 4px 0;font-size:20px;font-weight:900;color:#c92a6b;text-align:right;">
              ${formatPeso(order.total)}
            </td>
          </tr>
          ${
            isCod
              ? `<tr><td colspan="2" style="font-size:12px;color:#856404;text-align:right;padding-top:2px;">(Please prepare exact cash for the delivery rider)</td></tr>`
              : ''
          }
        </table>

        <!-- CTA Button to Track Order Online -->
        <div style="text-align:center;margin:32px 0 16px 0;">
          <a href="${trackingUrl}" target="_blank" style="background:linear-gradient(135deg, #ff6584 0%, #d82b6b 100%);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:30px;font-weight:700;font-size:15px;display:inline-block;box-shadow:0 4px 14px rgba(216,43,107,0.35);">
            Track Order & View Live Receipt →
          </a>
        </div>
        <p style="text-align:center;font-size:12px;color:#8f7988;margin:0 0 16px 0;">
          Or open this link: <a href="${trackingUrl}" style="color:#d82b6b;word-break:break-all;">${trackingUrl}</a>
        </p>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="padding:20px 24px;background:#f8f2f6;border-top:1px solid #ebdbe5;text-align:center;font-size:12px;color:#8c7585;">
        <p style="margin:0 0 6px 0;">
          Need help with your parcel? Reply to this email or visit our store support.
        </p>
        <p style="margin:0;font-size:11px;color:#a894a2;">
          © ${new Date().getFullYear()} SISO Squishies Collective. All rights reserved. • Manila, Philippines
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/**
 * Generates a clean plain-text fallback receipt for text-only mail clients.
 */
function buildReceiptPlainText(order, trackingUrl) {
  const isCod = order.paymentMethod === 'cod';
  const lines = [
    '====================================================',
    '       SISO SQUISHIES COLLECTIVE — ORDER RECEIPT     ',
    '====================================================',
    `Official Acknowledgement Receipt: OR-${(order.orderNumber || '').slice(-8)}`,
    `Order Number:    ${order.orderNumber}`,
    `Tracking Code:   ${order.trackingNumber || 'DEMO-TRACK'}`,
    `Payment Method:  ${(order.paymentMethod || '').toUpperCase()}`,
    `Payment Status:  ${order.paymentStatus || (isCod ? 'Pending COD' : 'Paid')}`,
    order.paymentReference ? `Gateway Ref:     ${order.paymentReference}` : null,
    '----------------------------------------------------',
    'SHIPPING DETAILS:',
    `Recipient:       ${order.customerName}`,
    `Contact Phone:   ${order.customerPhone}`,
    `Address:         ${order.shippingAddress}, Brgy. ${order.barangay}, ${order.city}, ${order.postalCode}`,
    order.orderNote ? `Delivery Note:   "${order.orderNote}"` : null,
    '----------------------------------------------------',
    'ITEMS ORDERED:',
    ...(order.items || []).map(
      (item) =>
        `- ${item.name} x ${item.quantity} = ${formatPeso(item.subtotal || item.price * item.quantity)}`
    ),
    '----------------------------------------------------',
    `Merchandise Subtotal: ${formatPeso(order.subtotal)}`,
    `Shipping Fee:         ${order.shippingFee > 0 ? formatPeso(order.shippingFee) : 'FREE'}`,
    order.voucherDiscount > 0
      ? `Voucher Discount:     -${formatPeso(order.voucherDiscount)} (${order.voucherCode})`
      : null,
    `TOTAL AMOUNT DUE:     ${formatPeso(order.total)}`,
    '----------------------------------------------------',
    `Track your delivery and view printable receipt online:`,
    `${trackingUrl}`,
    '====================================================',
    'Thank you for ordering authentic squishies with us!',
  ];

  return lines.filter(Boolean).join('\n');
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

/**
 * Dispatches an email using Brevo's Transactional Email API (https://api.brevo.com/v3/smtp/email).
 */
async function sendViaBrevoApi({ apiKey, fromEmail, fromName, toEmail, toName, subject, html, text }) {
  const url = 'https://api.brevo.com/v3/smtp/email';
  const payload = {
    sender: {
      name: fromName,
      email: fromEmail,
    },
    to: [
      {
        email: toEmail,
        name: toName || 'Valued Customer',
      },
    ],
    subject,
    htmlContent: html,
    textContent: text,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`Brevo API responded with ${response.status}: ${responseText}`);
  }

  let data = {};
  try {
    data = JSON.parse(responseText);
  } catch {
    data = { raw: responseText };
  }

  return { success: true, messageId: data.messageId || 'sent' };
}

/**
 * Dispatches an email using standard SMTP via Nodemailer.
 */
async function sendViaSmtp({ host, port, user, pass, fromEmail, fromName, toEmail, toName, subject, html, text }) {
  const transporter = nodemailer.createTransport({
    host: host || 'smtp-relay.brevo.com',
    port: Number(port) || 587,
    secure: Number(port) === 465,
    auth: {
      user,
      pass,
    },
    // Useful defaults for Brevo relay
    tls: {
      rejectUnauthorized: true,
    },
  });

  const info = await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to: toName ? `"${toName}" <${toEmail}>` : toEmail,
    subject,
    text,
    html,
  });

  return { success: true, messageId: info.messageId };
}

/**
 * Main dispatch function for customer order receipt emails.
 * Supports:
 *  1. Brevo REST API (`BREVO_API_KEY`)
 *  2. Brevo SMTP / Standard SMTP (`SMTP_USER` & `SMTP_PASS`, or `SMTP_HOST`)
 *  3. Simulated mode fallback when credentials are not yet configured.
 *
 * Guaranteed non-blocking: never crashes order creation or rolls back DB transactions.
 */
async function sendOrderReceiptEmail(order) {
  if (!order || !order.customerEmail) {
    console.warn('[EmailService] Order has no customerEmail; skipping receipt email.');
    return { skipped: true, reason: 'NO_RECIPIENT_EMAIL' };
  }

  const toEmail = order.customerEmail.trim();
  const toName = order.customerName || 'Squishy Collector';
  const appOrigin = getAppOrigin();
  const trackingUrl = `${appOrigin}/checkout?order=${encodeURIComponent(order.orderNumber)}`;

  const subject = `Order Confirmed: #${order.orderNumber} — SISO Squishies Collective`;
  const html = buildReceiptHtml(order, trackingUrl);
  const text = buildReceiptPlainText(order, trackingUrl);

  const brevoApiKey = process.env.BREVO_API_KEY;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpHost = process.env.SMTP_HOST || 'smtp-relay.brevo.com';
  const smtpPort = process.env.SMTP_PORT || '587';

  // The sender email should be the verified sender in Brevo (e.g. your Brevo account email)
  const fromEmail =
    process.env.BREVO_SENDER_EMAIL ||
    process.env.SMTP_FROM ||
    process.env.SMTP_USER ||
    'orders@squishies.shop';
  const fromName = process.env.BREVO_SENDER_NAME || 'SISO Squishies Collective';

  try {
    // 1. Try Brevo REST API if API key is present (best for Vercel/serverless)
    if (brevoApiKey && !brevoApiKey.includes('YOUR_BREVO_API_KEY')) {
      console.log(`[EmailService] Sending receipt for #${order.orderNumber} via Brevo API to ${toEmail}...`);
      const result = await sendViaBrevoApi({
        apiKey: brevoApiKey,
        fromEmail,
        fromName,
        toEmail,
        toName,
        subject,
        html,
        text,
      });
      console.log(`[EmailService] Receipt sent successfully via Brevo API (MessageId: ${result.messageId})`);
      return { success: true, channel: 'brevo_api', messageId: result.messageId };
    }

    // 2. Try SMTP if SMTP credentials are provided
    if (smtpUser && smtpPass && !smtpPass.includes('YOUR_SMTP_PASSWORD')) {
      console.log(`[EmailService] Sending receipt for #${order.orderNumber} via SMTP (${smtpHost}:${smtpPort}) to ${toEmail}...`);
      const result = await sendViaSmtp({
        host: smtpHost,
        port: smtpPort,
        user: smtpUser,
        pass: smtpPass,
        fromEmail,
        fromName,
        toEmail,
        toName,
        subject,
        html,
        text,
      });
      console.log(`[EmailService] Receipt sent successfully via SMTP (MessageId: ${result.messageId})`);
      return { success: true, channel: 'smtp', messageId: result.messageId };
    }

    // 3. Fallback simulation when no credentials have been filled in yet
    console.log(
      `[EmailService] SMTP / Brevo credentials not configured. Simulated receipt for order ${order.orderNumber} to <${toEmail}>.`
    );
    console.log(`[EmailService] To enable live emails, add BREVO_API_KEY or SMTP_USER & SMTP_PASS in .env / Vercel.`);
    return {
      success: true,
      simulated: true,
      orderNumber: order.orderNumber,
      recipient: toEmail,
      trackingUrl,
    };
  } catch (err) {
    console.error(`[EmailService] Failed to dispatch receipt email for ${order.orderNumber}:`, err.message);
    // Non-blocking: returns error status without throwing, so caller transaction is never broken
    return { success: false, error: err.message };
  }
}

module.exports = {
  sendOrderReceiptEmail,
  buildReceiptHtml,
  buildReceiptPlainText,
  getAppOrigin,
};

