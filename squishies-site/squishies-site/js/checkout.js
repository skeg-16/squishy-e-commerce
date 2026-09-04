/* ==========================================================================
   SQUISHIES — checkout.js
   Renders the checkout page from the shared cart (js/cart.js) and handles
   payment-method selection + placing the order.
   Depends on: js/cart.js (loaded first)
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
  const paymentOptions = document.querySelectorAll('.payment-option');
  paymentOptions.forEach((option) => {
    option.addEventListener('click', () => {
      paymentOptions.forEach((o) => o.classList.remove('is-selected'));
      option.classList.add('is-selected');
      option.querySelector('input[type="radio"]').checked = true;
    });
  });

  /* ------------------------------------------------------------------ *
   * Place order
   * ------------------------------------------------------------------ */
  document.getElementById('placeOrderBtn').addEventListener('click', () => {
    const email = document.getElementById('ckEmail').value.trim();
    const name = document.getElementById('ckName').value.trim();
    const phone = document.getElementById('ckPhone').value.trim();
    const address = document.getElementById('ckAddress').value.trim();

    if (!email || !name || !phone || !address) {
      Squishies.showToast('Please fill in your contact and shipping details 🧸');
      return;
    }

    Squishies.clearCart();
    contentEl.innerHTML = '';
    const successEl = document.createElement('div');
    successEl.className = 'checkout-empty';
    successEl.innerHTML = `
      <h2>Thank you, ${name.split(' ')[0]}! 🎀</h2>
      <p>Your order has been placed. A confirmation will be sent to ${email}.</p>
      <a href="shop.html" class="btn btn--pink">Continue Shopping →</a>`;
    contentEl.appendChild(successEl);
  });
});
