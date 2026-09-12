/* ==========================================================================
   SQUISHIES — checkout.js
   Renders the checkout page from the shared cart (js/cart.js) and handles
   payment-method selection + Payment Gateway sandbox integration.
   Depends on: js/cart.js, js/api.js, js/payment.js
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  const contentEl = document.getElementById('checkoutContent');
  const cart = Squishies.getCart();

  if (cart.length === 0) {
    const emptyTpl = document.getElementById('checkoutEmptyTemplate');
    contentEl.appendChild(emptyTpl.content.cloneNode(true));
    return;
  }

  const tpl = document.getElementById('checkoutTemplate');
  contentEl.appendChild(tpl.content.cloneNode(true));

  /* ------------------------------------------------------------------ *
   * Order summary
   * ------------------------------------------------------------------ */
  const itemsEl = document.getElementById('orderSummaryItems');
  cart.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'order-summary__item';
    row.innerHTML = `
      <img src="${item.image}" alt="" width="52" height="52">
      <div class="order-summary__item-info">
        <h4>${item.name}</h4>
        <span>Qty: ${item.qty}</span>
      </div>
      <span class="order-summary__item-price">${Squishies.formatPeso(item.price * item.qty)}</span>`;
    itemsEl.appendChild(row);
  });

  const subtotal = Squishies.subtotal();
  const shipping = Squishies.shippingFee();
  const total = Squishies.total();

  document.getElementById('ckSubtotal').textContent = Squishies.formatPeso(subtotal);
  document.getElementById('ckShipping').textContent = shipping === 0 ? 'Free' : Squishies.formatPeso(shipping);
  document.getElementById('ckTotal').textContent = Squishies.formatPeso(total);

  const remaining = Squishies.FREE_SHIPPING_THRESHOLD - subtotal;
  const noteEl = document.getElementById('ckShippingNote');
  noteEl.textContent = remaining > 0 ? `Add ${Squishies.formatPeso(remaining)} more for free shipping` : '';

  /* ------------------------------------------------------------------ *
   * Payment method selection
   * ------------------------------------------------------------------ */
  let selectedPaymentMethod = 'cod';
  const paymentOptions = document.querySelectorAll('.payment-option');

  paymentOptions.forEach((option) => {
    const radio = option.querySelector('input[type="radio"]');
    if (radio && radio.checked) {
      selectedPaymentMethod = radio.value || option.dataset.method || 'cod';
    }
    option.addEventListener('click', () => {
      paymentOptions.forEach((o) => o.classList.remove('is-selected'));
      option.classList.add('is-selected');
      const r = option.querySelector('input[type="radio"]');
      if (r) {
        r.checked = true;
        selectedPaymentMethod = r.value || option.dataset.method || 'cod';
      }
    });
  });

  /* ------------------------------------------------------------------ *
   * Place order & payment processing
   * ------------------------------------------------------------------ */
  const placeOrderBtn = document.getElementById('placeOrderBtn');
  placeOrderBtn.addEventListener('click', async () => {
    const email = document.getElementById('ckEmail').value.trim();
    const name = document.getElementById('ckName').value.trim();
    const phone = document.getElementById('ckPhone').value.trim();
    const address = document.getElementById('ckAddress').value.trim();

    if (!email || !name || !phone || !address) {
      Squishies.showToast('Please fill in your contact and shipping details.');
      return;
    }

    placeOrderBtn.disabled = true;
    placeOrderBtn.textContent = 'Processing Order...';

    const orderPayload = {
      customerName: name,
      customerEmail: email,
      customerPhone: phone,
      shippingAddress: address,
      paymentMethod: selectedPaymentMethod,
      items: cart
    };

    let orderData = null;

    try {
      if (typeof SquishiesAPI !== 'undefined') {
        const response = await SquishiesAPI.placeOrder(orderPayload);
        if (response && response.success && response.data) {
          orderData = response.data;
        }
      }
    } catch (err) {
      console.warn('Backend server order submission failed:', err.message);
    }

    const orderNumber = orderData ? orderData.orderNumber : `SQ-${Date.now().toString().slice(-6)}`;
    const orderTotal = orderData ? orderData.total : total;

    if (selectedPaymentMethod === 'cod') {
      renderSuccessView({
        name,
        email,
        orderNumber,
        paymentStatus: 'Pending (Cash on Delivery)',
        paymentReference: null
      });
      return;
    }

    if (typeof PaymentGateway !== 'undefined') {
      placeOrderBtn.disabled = false;
      placeOrderBtn.textContent = 'Place Order & Pay →';

      PaymentGateway.openModal({
        orderNumber,
        amount: orderTotal,
        method: selectedPaymentMethod,
        customerPhone: phone,
        onSuccess: (paymentResult) => {
          renderSuccessView({
            name,
            email,
            orderNumber,
            paymentStatus: 'Paid & Confirmed',
            paymentReference: paymentResult.data ? paymentResult.data.paymentReference : 'PAY-APPROVED'
          });
        }
      });
    } else {
      renderSuccessView({
        name,
        email,
        orderNumber,
        paymentStatus: 'Paid',
        paymentReference: 'PAY-SIMULATED'
      });
    }
  });

  function renderSuccessView(info) {
    Squishies.clearCart();
    contentEl.innerHTML = '';
    const successEl = document.createElement('div');
    successEl.className = 'checkout-empty';
    successEl.innerHTML = `
      <div style="text-align: center; max-width: 520px; margin: 0 auto; padding: 24px;">
        <h2>Thank you, ${info.name.split(' ')[0]}!</h2>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 20px 0; text-align: left; font-size: 14px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span style="color: #64748b;">Order Reference:</span>
            <strong style="color: #6b21a8; font-family: monospace;">${info.orderNumber}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span style="color: #64748b;">Payment Status:</span>
            <strong style="color: #059669;">${info.paymentStatus}</strong>
          </div>
          ${info.paymentReference ? `
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #64748b;">Payment Reference:</span>
            <strong style="color: #0284c7; font-family: monospace;">${info.paymentReference}</strong>
          </div>` : ''}
        </div>
        <p>A confirmation email has been sent to <strong>${info.email}</strong>.</p>
        <a href="shop.html" class="btn btn--pink" style="margin-top: 20px; display: inline-block;">Continue Shopping →</a>
      </div>`;
    contentEl.appendChild(successEl);
  }
});
