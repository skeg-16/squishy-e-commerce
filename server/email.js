const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

function formatPHP(amount) {
  const num = typeof amount === 'number' ? amount : Number(amount) || 0;
  return `₱${num.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

function buildReceiptHtml(order) {
  const orderNumber = escapeHtml(order.orderNumber || order.order_number);
  const trackingNumber = escapeHtml(order.trackingNumber || order.tracking_number || 'N/A');
  const customerName = escapeHtml(order.customerName || order.customer?.customerName || 'Valued Customer');
  const customerEmail = escapeHtml(order.customerEmail || order.customer?.customerEmail || '');
  const customerPhone = escapeHtml(order.customerPhone || order.customer?.customerPhone || '');
  const shippingAddress = escapeHtml(order.shippingAddress || order.customer?.shippingAddress || '');
  const barangay = escapeHtml(order.barangay || order.customer?.barangay || '');
  const city = escapeHtml(order.city || order.customer?.city || '');
  const postalCode = escapeHtml(order.postalCode || order.customer?.postalCode || '');

  const paymentMethod = (order.paymentMethod || order.payment_method || 'COD').toUpperCase();
  const paymentStatus = order.paymentStatus || order.payment_status || 'Pending';
  const total = typeof order.total === 'number' ? order.total : ((order.pricing?.totalMinor || 0) / 100);
  const subtotal = typeof order.subtotal === 'number' ? order.subtotal : ((order.pricing?.subtotalMinor || 0) / 100);
  const shippingFee = typeof order.shippingFee === 'number' ? order.shippingFee : ((order.pricing?.shippingMinor || 0) / 100);
  const voucherDiscount = typeof order.voucherDiscount === 'number' ? order.voucherDiscount : ((order.pricing?.discountMinor || 0) / 100);

  const items = Array.isArray(order.items) ? order.items : [];
  const itemRows = items
    .map((item) => {
      const name = escapeHtml(item.name || item.product_name || item.slug);
      const qty = item.quantity || 1;
      const unitPrice = typeof item.price === 'number' ? item.price : (item.priceMinor ? item.priceMinor / 100 : 0);
      const lineTotal = unitPrice * qty;
      return `
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 12px 8px; font-size: 14px; color: #1e293b;">
            <strong>${name}</strong>
          </td>
          <td style="padding: 12px 8px; font-size: 14px; color: #64748b; text-align: center;">×${qty}</td>
          <td style="padding: 12px 8px; font-size: 14px; color: #1e293b; text-align: right;">${formatPHP(lineTotal)}</td>
        </tr>
      `;
    })
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Receipt for ${orderNumber}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #fdf4f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #fdf4f8; padding: 24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(139, 92, 246, 0.08); border: 1px solid #fed7e2;">
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #a855f7 0%, #ec4899 100%); padding: 32px 24px; text-align: center; color: #ffffff;">
              <div style="font-size: 32px; margin-bottom: 8px;">✨ 🧸 ✨</div>
              <h1 style="margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">SISO Squishies Collective</h1>
              <p style="margin: 6px 0 0; font-size: 14px; opacity: 0.95;">Official Electronic Sales Receipt & Delivery Order</p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px 24px;">
              <h2 style="margin: 0 0 12px; font-size: 20px; color: #0f172a;">Thank you, ${customerName}!</h2>
              <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #475569;">
                Your squishy parcel is officially confirmed and registered in our fulfillment queue. Here are your purchase and delivery details:
              </p>

              <!-- Order Details Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border-radius: 12px; padding: 16px; margin-bottom: 24px; border: 1px solid #e2e8f0;">
                <tr>
                  <td style="padding: 6px 8px; font-size: 13px; color: #64748b;">Order Number:</td>
                  <td style="padding: 6px 8px; font-size: 13px; font-weight: 700; color: #7c3aed; text-align: right;">${orderNumber}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 8px; font-size: 13px; color: #64748b;">Tracking Number:</td>
                  <td style="padding: 6px 8px; font-size: 13px; font-weight: 700; color: #0f172a; text-align: right;">${trackingNumber}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 8px; font-size: 13px; color: #64748b;">Payment Method:</td>
                  <td style="padding: 6px 8px; font-size: 13px; font-weight: 600; color: #0f172a; text-align: right;">${paymentMethod} (${paymentStatus})</td>
                </tr>
              </table>

              <!-- Purchased Items -->
              <h3 style="margin: 0 0 12px; font-size: 16px; color: #0f172a;">Items in Parcel</h3>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 20px;">
                <thead>
                  <tr style="border-bottom: 2px solid #e2e8f0;">
                    <th align="left" style="padding: 8px; font-size: 12px; text-transform: uppercase; color: #64748b;">Product</th>
                    <th align="center" style="padding: 8px; font-size: 12px; text-transform: uppercase; color: #64748b;">Qty</th>
                    <th align="right" style="padding: 8px; font-size: 12px; text-transform: uppercase; color: #64748b;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemRows}
                </tbody>
              </table>

              <!-- Totals Breakdown -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top: 1px solid #e2e8f0; padding-top: 12px; margin-bottom: 28px;">
                <tr>
                  <td style="padding: 4px 8px; font-size: 14px; color: #64748b;">Subtotal</td>
                  <td style="padding: 4px 8px; font-size: 14px; text-align: right; color: #1e293b;">${formatPHP(subtotal)}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 8px; font-size: 14px; color: #64748b;">Shipping Fee</td>
                  <td style="padding: 4px 8px; font-size: 14px; text-align: right; color: #1e293b;">${formatPHP(shippingFee)}</td>
                </tr>
                ${voucherDiscount > 0 ? `
                <tr>
                  <td style="padding: 4px 8px; font-size: 14px; color: #ec4899;">Voucher Discount</td>
                  <td style="padding: 4px 8px; font-size: 14px; text-align: right; color: #ec4899;">-${formatPHP(voucherDiscount)}</td>
                </tr>
                ` : ''}
                <tr style="border-top: 2px solid #e2e8f0;">
                  <td style="padding: 12px 8px 4px; font-size: 16px; font-weight: 800; color: #0f172a;">Grand Total</td>
                  <td style="padding: 12px 8px 4px; font-size: 18px; font-weight: 800; text-align: right; color: #7c3aed;">${formatPHP(total)}</td>
                </tr>
              </table>

              <!-- Delivery Address -->
              <div style="background-color: #fdf2f8; border-left: 4px solid #ec4899; padding: 14px 16px; border-radius: 8px; margin-bottom: 24px;">
                <h4 style="margin: 0 0 6px; font-size: 13px; text-transform: uppercase; color: #be185d;">Delivery Address</h4>
                <p style="margin: 0; font-size: 14px; color: #334155; line-height: 1.5;">
                  <strong>${customerName}</strong> (${customerPhone})<br>
                  ${shippingAddress}, Brgy. ${barangay}<br>
                  ${city}, ${postalCode}
                </p>
              </div>

              <!-- Button CTA -->
              <div style="text-align: center; margin: 32px 0 16px;">
                <a href="${process.env.APP_ORIGIN || 'https://squishy-e-commerce.vercel.app'}/account" style="display: inline-block; background: linear-gradient(135deg, #a855f7 0%, #ec4899 100%); color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 9999px; font-weight: 700; font-size: 14px; box-shadow: 0 4px 14px rgba(168, 85, 247, 0.35);">
                  Track Delivery on SISO
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #f1f5f9; padding: 20px 24px; text-align: center; font-size: 12px; color: #94a3b8;">
              <p style="margin: 0 0 4px;">SISO Squishies Collective — Manila, Philippines</p>
              <p style="margin: 0;">This is an automated transactional order confirmation. If you have questions, reply to this email or visit our store.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

async function sendOrderReceiptEmail(order) {
  const apiKey = process.env.BREVO_API_KEY;
  const recipientEmail = order?.customerEmail || order?.customer?.customerEmail;

  if (!apiKey) {
    return { sent: false, reason: 'BREVO_API_KEY not configured' };
  }

  if (!recipientEmail || typeof recipientEmail !== 'string' || !recipientEmail.includes('@')) {
    return { sent: false, reason: 'No recipient email specified' };
  }

  // In test runs, do not consume production Brevo credits
  const isTest =
    process.env.NODE_ENV === 'test' ||
    process.env.npm_lifecycle_event === 'test' ||
    process.argv.some((arg) => arg.includes('test'));
  if (isTest && !process.env.BREVO_TEST_SEND) {
    return { sent: true, skipped: true, reason: 'Test environment skipped Brevo delivery' };
  }

  const senderEmail = process.env.BREVO_SENDER_EMAIL || process.env.SMTP_FROM || 'john.manguni@gmail.com';
  const senderName = process.env.BREVO_SENDER_NAME || 'SISO Squishies Collective';
  const orderNumber = order.orderNumber || order.order_number || 'Squishies Order';

  const htmlContent = buildReceiptHtml(order);

  const payload = {
    sender: {
      name: senderName,
      email: senderEmail,
    },
    to: [
      {
        email: recipientEmail.trim(),
        name: (order.customerName || order.customer?.customerName || 'Squishy Enthusiast').trim(),
      },
    ],
    subject: `Order Receipt & Confirmation — ${orderNumber} | SISO Squishies Collective`,
    htmlContent,
  };

  try {
    const res = await fetch(BREVO_ENDPOINT, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.warn(`[Brevo Email] Delivery failed (${res.status}):`, data.message || res.statusText);
      return { sent: false, status: res.status, error: data.message || 'Brevo API error' };
    }

    console.log(`[Brevo Email] Receipt sent successfully for ${orderNumber} to ${recipientEmail} (messageId: ${data.messageId || 'ok'})`);
    return { sent: true, messageId: data.messageId };
  } catch (err) {
    console.warn('[Brevo Email] Network / delivery exception:', err.message);
    return { sent: false, error: err.message };
  }
}

module.exports = {
  sendOrderReceiptEmail,
  buildReceiptHtml,
};
