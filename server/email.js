let nodemailer;
try {
  nodemailer = require('nodemailer');
} catch {
  nodemailer = null;
}

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
 * Generates a formal, Squishies-themed responsive HTML email template for the order receipt.
 */
function buildReceiptHtml(order, trackingUrl) {
  const isCod = order.paymentMethod === 'cod';
  const paymentMethodLabel = isCod
    ? 'Cash on Delivery (COD)'
    : `Online Payment (${(order.paymentMethod || 'Electronic').toUpperCase()})`;

  const paymentBadge = isCod
    ? '<span style="display:inline-block;background:#fff4e5;color:#7c4a03;border:1px solid #f5d4a1;padding:3px 10px;border-radius:999px;font-weight:700;font-size:11px;letter-spacing:0.3px;text-transform:uppercase;white-space:nowrap;">Pending Settlement (COD)</span>'
    : '<span style="display:inline-block;background:#e6f6ee;color:#115e38;border:1px solid #b5e3cc;padding:3px 10px;border-radius:999px;font-weight:700;font-size:11px;letter-spacing:0.3px;text-transform:uppercase;white-space:nowrap;">Paid Online (' +
      escapeHtml((order.paymentMethod || '').toUpperCase()) +
      ')</span>';

  const orderDate = order.createdAt
    ? new Date(order.createdAt).toLocaleString('en-PH', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : new Date().toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

  const receiptNumber = `OR-${(order.orderNumber || '').slice(-8)}`;
  const itemsList = order.items || [];
  const itemCount = itemsList.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);

  const itemsRows = itemsList
    .map((item, idx) => {
      const rowBorder = idx < itemsList.length - 1 ? 'border-bottom:1px solid #f1e4ee;' : '';
      return `
      <tr>
        <td style="padding:13px 12px;${rowBorder}color:#2d1b3d;font-size:14px;line-height:1.4;">
          <div style="font-weight:700;color:#2d1b3d;">${escapeHtml(item.name || item.slug)}</div>
          <div style="font-size:12px;color:#7a6277;margin-top:2px;">Unit Price: ${formatPeso(item.price)}</div>
        </td>
        <td align="center" style="padding:13px 6px;${rowBorder}color:#5a4d68;font-size:13px;font-weight:600;white-space:nowrap;">
          ${item.quantity}
        </td>
        <td align="right" style="padding:13px 12px;${rowBorder}color:#2d1b3d;text-align:right;font-weight:700;font-size:14px;white-space:nowrap;">
          ${formatPeso(item.subtotal || item.price * item.quantity)}
        </td>
      </tr>
    `;
    })
    .join('');

  const voucherRow =
    order.voucherDiscount > 0
      ? `
      <tr>
        <td style="padding:6px 0;color:#c92a6b;font-size:13px;">Promotional Voucher (${escapeHtml(order.voucherCode || 'PROMO')})</td>
        <td style="padding:6px 0;color:#c92a6b;text-align:right;font-weight:700;font-size:13px;">-${formatPeso(order.voucherDiscount)}</td>
      </tr>
    `
      : '';

  const riderNoteBlock = order.orderNote
    ? `
      <div style="margin-top:14px;padding:12px 14px;background:#fff7fa;border-left:3px solid #e8547d;border-radius:8px;font-size:12px;color:#5a3d52;">
        <strong style="color:#2d1b3d;text-transform:uppercase;letter-spacing:0.3px;font-size:11px;display:block;margin-bottom:2px;">Delivery Instructions</strong>
        "${escapeHtml(order.orderNote)}"
      </div>
    `
    : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Official Order Confirmation &amp; Receipt — ${escapeHtml(order.orderNumber)}</title>
</head>
<body style="margin:0;padding:32px 14px;background:#fdf3ec;font-family:'Nunito',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#2d1b3d;line-height:1.6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" align="center" style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:22px;box-shadow:0 14px 36px rgba(45,27,61,0.10);overflow:hidden;border:1px solid #f0dfea;">
    <!-- Top Brand Accent Bar -->
    <tr>
      <td style="height:6px;background:linear-gradient(90deg, #ff6b95 0%, #c9aef1 50%, #ff6b95 100%);font-size:0;line-height:0;">&nbsp;</td>
    </tr>

    <!-- Formal Squishies Theme Header -->
    <tr>
      <td style="padding:32px 28px 28px 28px;background:linear-gradient(135deg, #2d1b3d 0%, #3d1b38 55%, #231024 100%);text-align:center;color:#ffffff;">
        <div style="display:inline-block;padding:4px 14px;border-radius:999px;background:rgba(255,107,149,0.18);border:1px solid rgba(255,218,231,0.35);color:#ffdae7;font-size:11px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;margin-bottom:12px;">
          SISO Brand Collective
        </div>
        <div style="font-size:25px;font-weight:800;letter-spacing:-0.3px;color:#ffffff;line-height:1.2;">
          SISO Squishies Collective
        </div>
        <div style="font-size:11px;color:#e3c5dc;margin-top:6px;letter-spacing:1.1px;text-transform:uppercase;">
          Specialty Slow-Rising Sensory Editions &bull; Manila, Philippines
        </div>
        <div style="margin-top:18px;display:inline-block;background:rgba(255,255,255,0.10);border:1px solid rgba(255,255,255,0.22);padding:7px 18px;border-radius:999px;font-size:12px;color:#ffffff;letter-spacing:0.4px;">
          Official Acknowledgement Receipt &nbsp;|&nbsp; <strong style="white-space:nowrap;">${escapeHtml(receiptNumber)}</strong>
        </div>
      </td>
    </tr>

    <!-- Main Body Content -->
    <tr>
      <td style="padding:32px 24px 20px 24px;">
        <div style="font-size:11px;font-weight:700;color:#b84375;text-transform:uppercase;letter-spacing:1.1px;margin-bottom:4px;">
          Order Confirmation Notice
        </div>
        <h2 style="margin:0 0 12px 0;font-size:20px;font-weight:800;color:#2d1b3d;letter-spacing:-0.2px;">
          Dear ${escapeHtml(order.customerName || 'Valued Customer')},
        </h2>
        <p style="margin:0 0 22px 0;font-size:14px;color:#5a4d68;line-height:1.65;">
          ${
            isCod
              ? 'Thank you for placing an order with SISO Squishies Collective. This notice serves as your official acknowledgement receipt. Your Cash on Delivery order has been formally recorded and assigned to our Manila fulfillment center for quality inspection and dispatch.'
              : 'Thank you for placing an order with SISO Squishies Collective. This notice serves as your official acknowledgement receipt. Your payment has been verified and your order is now queued at our Manila fulfillment center for priority packing and dispatch.'
          }
        </p>

        <!-- Order & Transaction Metadata Box -->
        <div style="font-size:11px;font-weight:800;color:#7d5374;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">
          Order &amp; Transaction Summary
        </div>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#fdf6fa;border-radius:16px;padding:16px 18px;margin-bottom:24px;border:1px solid #f3dce9;">
          <tr>
            <td style="padding:5px 10px 5px 0;font-size:13px;color:#6f576b;width:42%;vertical-align:top;">Order Reference:</td>
            <td style="padding:5px 0;font-size:13px;color:#2d1b3d;font-weight:700;vertical-align:top;">${escapeHtml(order.orderNumber)}</td>
          </tr>
          <tr>
            <td style="padding:5px 10px 5px 0;font-size:13px;color:#6f576b;vertical-align:top;">Receipt Number:</td>
            <td style="padding:5px 0;font-size:13px;color:#2d1b3d;font-weight:700;vertical-align:top;">${escapeHtml(receiptNumber)}</td>
          </tr>
          <tr>
            <td style="padding:5px 10px 5px 0;font-size:13px;color:#6f576b;vertical-align:top;">Tracking Reference:</td>
            <td style="padding:5px 0;font-size:13px;color:#2d1b3d;font-weight:700;vertical-align:top;">${escapeHtml(order.trackingNumber || 'DEMO-TRACK')}</td>
          </tr>
          <tr>
            <td style="padding:5px 10px 5px 0;font-size:13px;color:#6f576b;vertical-align:top;">Date &amp; Time Issued:</td>
            <td style="padding:5px 0;font-size:13px;color:#2d1b3d;vertical-align:top;">${escapeHtml(orderDate)}</td>
          </tr>
          <tr>
            <td style="padding:5px 10px 5px 0;font-size:13px;color:#6f576b;vertical-align:top;">Payment Method:</td>
            <td style="padding:5px 0;font-size:13px;color:#2d1b3d;font-weight:600;vertical-align:top;">${escapeHtml(paymentMethodLabel)}</td>
          </tr>
          <tr>
            <td style="padding:6px 10px 4px 0;font-size:13px;color:#6f576b;vertical-align:middle;">Settlement Status:</td>
            <td style="padding:6px 0 4px 0;font-size:13px;vertical-align:middle;">${paymentBadge}</td>
          </tr>
          ${
            order.paymentReference
              ? `
          <tr>
            <td style="padding:5px 10px 5px 0;font-size:13px;color:#6f576b;vertical-align:top;">Gateway Reference:</td>
            <td style="padding:5px 0;font-size:13px;color:#2d1b3d;font-weight:700;vertical-align:top;">${escapeHtml(order.paymentReference)}</td>
          </tr>`
              : ''
          }
        </table>

        <!-- Recipient & Delivery Destination Box -->
        <div style="font-size:11px;font-weight:800;color:#7d5374;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">
          Recipient &amp; Shipping Destination
        </div>
        <div style="background:#faf6f9;border-radius:16px;padding:16px 18px;margin-bottom:26px;border:1px solid #ece0ea;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td style="padding:4px 10px 4px 0;font-size:13px;color:#6f576b;width:42%;vertical-align:top;">Recipient Name:</td>
              <td style="padding:4px 0;font-size:13px;color:#2d1b3d;font-weight:700;vertical-align:top;">${escapeHtml(order.customerName)}</td>
            </tr>
            <tr>
              <td style="padding:4px 10px 4px 0;font-size:13px;color:#6f576b;vertical-align:top;">Contact Number:</td>
              <td style="padding:4px 0;font-size:13px;color:#2d1b3d;font-weight:600;vertical-align:top;">${escapeHtml(order.customerPhone)}</td>
            </tr>
            <tr>
              <td style="padding:4px 10px 4px 0;font-size:13px;color:#6f576b;vertical-align:top;">Delivery Address:</td>
              <td style="padding:4px 0;font-size:13px;color:#2d1b3d;vertical-align:top;">
                ${escapeHtml(order.shippingAddress)}, Brgy. ${escapeHtml(order.barangay)}, ${escapeHtml(order.city)}, ${escapeHtml(order.postalCode)}
              </td>
            </tr>
            <tr>
              <td style="padding:4px 10px 4px 0;font-size:13px;color:#6f576b;vertical-align:top;">Assigned Transit Zone:</td>
              <td style="padding:4px 0;font-size:13px;color:#5a4d68;vertical-align:top;">${escapeHtml(order.delivery?.label || order.region || 'Standard Courier Service')}</td>
            </tr>
          </table>
          ${riderNoteBlock}
        </div>

        <!-- Itemized Order Statement Table -->
        <div style="font-size:11px;font-weight:800;color:#7d5374;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">
          Itemized Order Statement (${itemCount} ${itemCount === 1 ? 'Unit' : 'Units'})
        </div>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:20px;border:1px solid #f0e1ec;border-radius:14px;overflow:hidden;">
          <thead>
            <tr style="background:#f9eef5;border-bottom:1px solid #ead5e3;">
              <th align="left" style="padding:10px 12px;font-size:11px;color:#6b4962;text-transform:uppercase;letter-spacing:0.6px;">Item Description</th>
              <th align="center" style="padding:10px 6px;font-size:11px;color:#6b4962;text-transform:uppercase;letter-spacing:0.6px;width:40px;">Qty</th>
              <th align="right" style="padding:10px 12px;font-size:11px;color:#6b4962;text-transform:uppercase;letter-spacing:0.6px;width:88px;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>

        <!-- Financial Breakdown -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="padding:4px 4px 0 4px;margin-bottom:24px;">
          <tr>
            <td style="padding:5px 0;font-size:13px;color:#5a4d68;">Merchandise Subtotal</td>
            <td style="padding:5px 0;font-size:13px;color:#2d1b3d;text-align:right;font-weight:600;">${formatPeso(order.subtotal)}</td>
          </tr>
          <tr>
            <td style="padding:5px 0;font-size:13px;color:#5a4d68;">Courier Shipping &amp; Handling</td>
            <td style="padding:5px 0;font-size:13px;color:#2d1b3d;text-align:right;font-weight:600;">
              ${order.shippingFee > 0 ? formatPeso(order.shippingFee) : '<span style="color:#115e38;font-weight:700;">Complimentary (₱0.00)</span>'}
            </td>
          </tr>
          ${voucherRow}
          <tr>
            <td colspan="2" style="padding-top:10px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:linear-gradient(135deg, #fdf2f7 0%, #f7ecfb 100%);border:1px solid #efd5e6;border-radius:14px;padding:14px 16px;">
                <tr>
                  <td style="font-size:15px;font-weight:800;color:#2d1b3d;">Total Amount Due</td>
                  <td style="font-size:20px;font-weight:900;color:#c92a6b;text-align:right;white-space:nowrap;">${formatPeso(order.total)}</td>
                </tr>
                <tr>
                  <td colspan="2" style="padding-top:6px;font-size:12px;color:#6b5263;">
                    ${
                      isCod
                        ? 'Payment Notice: Please prepare the exact amount in Philippine Pesos (PHP) for remittance to the assigned courier upon delivery.'
                        : 'Payment Notice: Full settlement has been received and recorded. No additional payment is required upon delivery.'
                    }
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- CTA Button to Track Order Online -->
        <div style="text-align:center;margin:28px 0 16px 0;">
          <a href="${trackingUrl}" target="_blank" style="background:linear-gradient(135deg, #ff6b95 0%, #d82b6b 100%);color:#ffffff;text-decoration:none;padding:13px 28px;border-radius:999px;font-weight:700;font-size:14px;letter-spacing:0.2px;display:inline-block;box-shadow:0 8px 20px rgba(216,43,107,0.28);">
            View Official Receipt &amp; Track Order
          </a>
        </div>
        <p style="text-align:center;font-size:12px;color:#7f6a7b;margin:0 0 12px 0;">
          Direct verification link: <a href="${trackingUrl}" style="color:#c92a6b;text-decoration:underline;word-break:break-all;">${trackingUrl}</a>
        </p>
      </td>
    </tr>

    <!-- Formal Footer -->
    <tr>
      <td style="padding:22px 28px;background:#f9f2f6;border-top:1px solid #eadce5;text-align:center;font-size:12px;color:#6e586a;">
        <div style="font-weight:700;color:#2d1b3d;margin-bottom:4px;font-size:12px;letter-spacing:0.3px;">
          SISO Squishies Collective &mdash; Customer Operations &amp; Fulfillment
        </div>
        <p style="margin:0 0 8px 0;font-size:12px;color:#6e586a;line-height:1.5;">
          This document is an official automated transaction record. For billing inquiries or delivery assistance, please reply directly to this email and reference Order <strong>${escapeHtml(order.orderNumber)}</strong>.
        </p>
        <p style="margin:0;font-size:11px;color:#9a8495;">
          &copy; ${new Date().getFullYear()} SISO Squishies Collective. All rights reserved. Manila, Philippines.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/**
 * Generates a clean, formal plain-text fallback receipt for text-only mail clients.
 */
function buildReceiptPlainText(order, trackingUrl) {
  const isCod = order.paymentMethod === 'cod';
  const lines = [
    '====================================================',
    '       SISO SQUISHIES COLLECTIVE — ORDER RECEIPT     ',
    '====================================================',
    `Dear ${order.customerName || 'Valued Customer'},`,
    '',
    'Thank you for placing an order with SISO Squishies Collective.',
    'This document serves as your official acknowledgement receipt.',
    '----------------------------------------------------',
    `Official Acknowledgement Receipt: OR-${(order.orderNumber || '').slice(-8)}`,
    `Order Number:    ${order.orderNumber}`,
    `Tracking Code:   ${order.trackingNumber || 'DEMO-TRACK'}`,
    `Payment Method:  ${(order.paymentMethod || '').toUpperCase()}`,
    `Payment Status:  ${order.paymentStatus || (isCod ? 'Pending COD' : 'Paid')}`,
    order.paymentReference ? `Gateway Ref:     ${order.paymentReference}` : null,
    '----------------------------------------------------',
    'RECIPIENT & SHIPPING DETAILS:',
    `Recipient:       ${order.customerName}`,
    `Contact Phone:   ${order.customerPhone}`,
    `Address:         ${order.shippingAddress}, Brgy. ${order.barangay}, ${order.city}, ${order.postalCode}`,
    order.orderNote ? `Delivery Note:   "${order.orderNote}"` : null,
    '----------------------------------------------------',
    'ITEMIZED ORDER STATEMENT:',
    ...(order.items || []).map(
      (item) =>
        `- ${item.name} x ${item.quantity} = ${formatPeso(item.subtotal || item.price * item.quantity)}`
    ),
    '----------------------------------------------------',
    `Merchandise Subtotal: ${formatPeso(order.subtotal)}`,
    `Shipping Fee:         ${order.shippingFee > 0 ? formatPeso(order.shippingFee) : 'Complimentary (PHP 0.00)'}`,
    order.voucherDiscount > 0
      ? `Voucher Discount:     -${formatPeso(order.voucherDiscount)} (${order.voucherCode})`
      : null,
    `TOTAL AMOUNT DUE:     ${formatPeso(order.total)}`,
    '----------------------------------------------------',
    'View your official receipt and track your shipment online:',
    `${trackingUrl}`,
    '====================================================',
    'SISO Squishies Collective — Customer Operations & Fulfillment',
    'Manila, Philippines',
  ];

  return lines.filter((line) => line !== null).join('\n');
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
  if (!nodemailer) {
    throw new Error('nodemailer is not installed. Please install nodemailer or use BREVO_API_KEY.');
  }
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

