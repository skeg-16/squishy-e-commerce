/* Keep the team's checkout and receipt classes; all commerce state comes from the API. */
document.addEventListener('DOMContentLoaded', async () => {
  const content = document.getElementById('checkoutContent');
  const pendingKey = 'squishies-pending-checkout';
  let quote, quoting = 0, submitting = false, pending = null, unsubscribe, activeOrder;
  const fields = { customerEmail: 'ckEmail', customerName: 'ckName', customerPhone: 'ckPhone', shippingAddress: 'ckAddress', city: 'ckCity', barangay: 'ckBarangay', postalCode: 'ckPostalCode' };
  const node = (tag, text, className) => { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (className) el.className = className; return el; };
  const storePending = value => { pending = value; try { if (value) sessionStorage.setItem(pendingKey, JSON.stringify(value)); else sessionStorage.removeItem(pendingKey); } catch { /* In-memory retries still use the same key. */ } };
  try { pending = JSON.parse(sessionStorage.getItem(pendingKey) || 'null'); } catch { /* Nothing to recover. */ }

  function showError(message) {
    let target = document.getElementById('checkoutError');
    if (!target) { target = node('p', '', 'field-error'); target.id = 'checkoutError'; target.setAttribute('role', 'alert'); content.prepend(target); }
    target.textContent = message;
  }
  function errorFields(error) {
    showError(error.message);
    for (const [name, message] of Object.entries(error.fields || {})) {
      const id = fields[name] || (name === 'voucherCode' ? 'ckVoucherCode' : '');
      if (id) { const target = document.getElementById(`err-${id}`); if (target) target.textContent = message; document.getElementById(id)?.setAttribute('aria-invalid', 'true'); }
    }
  }
  function row(label, value, total = false) {
    const el = node('div', undefined, `financial-row${total ? ' financial-row--total' : ''}`);
    el.append(node('span', label), node(total ? 'strong' : 'span', value)); return el;
  }
  function accepted(order) {
    storePending(null); unsubscribe?.(); unsubscribe = null;
    Squishies.clearCart();
    history.replaceState(null, '', `checkout.html?order=${encodeURIComponent(order.orderNumber)}`);
    renderOrder(order);
  }
  function renderOrder(order) {
    activeOrder = order;
    unsubscribe?.(); unsubscribe = null;
    content.replaceChildren();
    const view = node('div', undefined, 'shopee-order-view'), card = node('div', undefined, 'shopee-receipt-card');
    const header = node('div', undefined, 'shopee-receipt-header');
    const status = node('div', `Order Status: ${order.status}`, 'shopee-status-badge badge-to-ship'); status.id = 'shopeeStatusBadge';
    header.append(status);
    const ref = node('p', `Order Reference: ${order.orderNumber}`, 'shopee-order-ref'); ref.style.overflowWrap = 'anywhere'; header.append(ref);
    const tracking = node('p', `Demo Tracking: ${order.trackingNumber}`, 'shopee-tracking-ref'); tracking.style.overflowWrap = 'anywhere'; header.append(tracking);
    const timeline = node('div', undefined, 'shopee-timeline'); timeline.id = 'shopeeTimeline';
    const milestones = [
      ['Order Placed', true],
      [order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Payment', ['Paid', 'Refunded'].includes(order.paymentStatus)],
      ['Shipped', order.events.some(e => e.status === 'Shipped')],
      ['Completed', order.status === 'Completed']
    ];
    for (const [index, [label, complete]] of milestones.entries()) {
      const step = node('div', undefined, `timeline-step${complete ? ' is-complete' : ''}`);
      step.append(node('div', String(index + 1), 'step-icon'), node('span', label)); timeline.append(step);
    }
    const activity = node('details', undefined, 'order-activity');
    activity.append(node('summary', 'Order activity'));
    const activityList = node('ol');
    for (const item of order.events) activityList.append(node('li', `${new Date(item.timestamp).toLocaleString('en-PH')} — ${item.description}`));
    activity.append(activityList);
    const grid = node('div', undefined, 'shopee-info-grid');
    const address = node('div', undefined, 'shopee-info-box');
    address.append(node('h4', 'Shipping Address'), node('p', `${order.customerName} (${order.customerPhone})`), node('p', `${order.shippingAddress}, Brgy. ${order.barangay}, ${order.city}, ${order.postalCode}`));
    const pay = node('div', undefined, 'shopee-info-box'); pay.append(node('h4', 'Payment Details'), node('p', `Method: ${order.paymentMethod.toUpperCase()}`), node('p', `Status: ${order.paymentStatus}`));
    if (order.paymentMethod !== 'cod') pay.append(node('p', 'School payment simulation — no money transferred.'));
    if (order.canPay) pay.append(node('p', `Reservation expires: ${new Date(order.expiresAt).toLocaleString('en-PH')}`));
    grid.append(address, pay);
    const totals = node('div', undefined, 'shopee-financial-box');
    for (const item of order.items) totals.append(row(`${item.name} × ${item.quantity}`, Squishies.formatPeso(item.subtotal)));
    totals.append(row('Subtotal', Squishies.formatPeso(order.subtotal)), row('Shipping', order.shippingFee ? Squishies.formatPeso(order.shippingFee) : 'Free'));
    if (order.voucherDiscount) totals.append(row(`Voucher (${order.voucherCode})`, `−${Squishies.formatPeso(order.voucherDiscount)}`));
    if (order.shippingDiscount) totals.append(row('Shipping savings (already included)', Squishies.formatPeso(order.shippingDiscount)));
    totals.append(row('Total', Squishies.formatPeso(order.total), true));
    const actions = node('div', undefined, 'shopee-actions');
    if (order.canPay) {
      const button = node('button', 'Pay / retry simulation', 'btn btn--pink'); button.id = 'retryPaymentBtn';
      button.onclick = () => PaymentGateway.openModal({ orderNumber: order.orderNumber, amount: order.total, method: order.paymentMethod, onUpdate: renderOrder }); actions.append(button);
    }
    if (order.canCancel) {
      const button = node('button', 'Cancel Order', 'btn btn--outline'); button.id = 'cancelOrderBtn';
      button.onclick = () => cancelDialog(order); actions.append(button);
    }
    const refresh = node('button', 'Refresh status', 'btn btn--outline'); refresh.onclick = async () => {
      refresh.disabled = true;
      try { renderOrder(await SquishiesAPI.getOrder(order.orderNumber)); } catch (error) { showError(error.message); refresh.disabled = false; }
    }; actions.append(refresh);
    const link = node('a', 'Continue Shopping →', 'btn btn--pink'); link.href = 'shop.html'; actions.append(link);
    card.append(header, timeline, grid, totals, actions, activity); view.append(card); content.append(view);
    if (order.status === 'Completed') reviewForm(order, card);
  }
  function cancelDialog(order) {
    const overlay = node('div', undefined, 'payment-modal-overlay'); overlay.style.display = 'flex';
    overlay.innerHTML = '<div class="payment-modal" role="dialog" aria-modal="true" aria-labelledby="cancelTitle"><div class="payment-modal__header"><h3 id="cancelTitle">Cancel Order</h3><button class="payment-modal__close" aria-label="Close cancellation">×</button></div><div class="payment-modal__body"><form><label for="cancelReason">Reason</label><select id="cancelReason" class="form-select"><option>Change of mind</option><option>Need to modify shipping address</option><option>Modify payment method</option></select><p class="field-error" role="alert"></p><button type="submit" class="btn btn--pink">Confirm Cancellation</button></form></div></div>';
    document.body.append(overlay); const close = overlay.querySelector('.payment-modal__close'); close.focus();
    close.onclick = () => { overlay.remove(); document.getElementById('cancelOrderBtn')?.focus(); };
    overlay.onkeydown = e => {
      if (e.key === 'Escape' && !close.disabled) close.click();
      if (e.key === 'Tab') {
        const controls = [...overlay.querySelectorAll('button:not([disabled]),select:not([disabled])')];
        if (e.shiftKey && document.activeElement === controls[0]) { e.preventDefault(); controls.at(-1)?.focus(); }
        else if (!e.shiftKey && document.activeElement === controls.at(-1)) { e.preventDefault(); controls[0]?.focus(); }
      }
    };
    overlay.querySelector('form').onsubmit = async e => {
      e.preventDefault(); const submit = overlay.querySelector('[type=submit]'); submit.disabled = close.disabled = true;
      try { const updated = await SquishiesAPI.cancelOrder(order.orderNumber, overlay.querySelector('select').value); overlay.remove(); renderOrder(updated); }
      catch (error) { overlay.querySelector('[role=alert]').textContent = error.message; }
      finally { submit.disabled = close.disabled = false; }
    };
  }
  function reviewForm(order, parent) {
    const form = node('form', undefined, 'checkout-card');
    form.innerHTML = '<h2>Review your purchase</h2><div class="form-field"><label for="reviewProduct">Product</label><select id="reviewProduct" class="form-select"></select></div><div class="form-field"><label for="reviewName">Public display name</label><input id="reviewName" maxlength="60" required></div><div class="form-field"><label for="reviewRating">Rating</label><select id="reviewRating" class="form-select"><option value="5">5 stars</option><option value="4">4 stars</option><option value="3">3 stars</option><option value="2">2 stars</option><option value="1">1 star</option></select></div><div class="form-field"><label for="reviewComment">Review</label><textarea id="reviewComment" minlength="3" maxlength="1000" required></textarea></div><p role="status"></p><button class="btn btn--pink" type="submit">Submit review</button>';
    for (const item of order.items) { const option = node('option', item.name); option.value = item.slug; form.querySelector('#reviewProduct').append(option); }
    form.onsubmit = async e => {
      e.preventDefault(); const button = form.querySelector('button'); button.disabled = true;
      try {
        await SquishiesAPI.submitReview({ orderNumber: order.orderNumber, productSlug: form.querySelector('#reviewProduct').value, reviewerName: form.querySelector('#reviewName').value.trim(), rating: Number(form.querySelector('#reviewRating').value), comment: form.querySelector('#reviewComment').value.trim() });
        form.querySelector('[role=status]').textContent = 'Thank you! Your verified review was saved.';
      } catch (error) { form.querySelector('[role=status]').textContent = error.message; }
      finally { button.disabled = false; }
    }; parent.append(form);
  }
  const existing = new URLSearchParams(location.search).get('order');
  if (existing) {
    content.append(node('p', 'Loading your order…'));
    try { renderOrder(await SquishiesAPI.getOrder(existing)); }
    catch (error) { content.replaceChildren(); showError(error.message); const retry = node('button', 'Retry loading order', 'btn btn--pink'); retry.onclick = () => location.reload(); content.append(retry); }
    return;
  }
  if (!Squishies.getCart().length && !pending) { content.append(document.getElementById('checkoutEmptyTemplate').content.cloneNode(true)); return; }
  content.append(document.getElementById('checkoutTemplate').content.cloneNode(true));
  const place = document.getElementById('placeOrderBtn');
  const region = document.getElementById('ckRegion');
  const voucher = document.getElementById('ckVoucherCode');
  const voucherButton = document.getElementById('applyVoucherBtn');
  function busy(value) {
    submitting = value; Squishies.setLocked(value || Boolean(pending));
    content.querySelectorAll('input,select,button').forEach(el => el.disabled = value || Boolean(pending));
    if (!value && !pending && quote) content.querySelectorAll('[name=paymentMethod]').forEach(input => { input.disabled = !quote.paymentMethods.includes(input.value); });
    place.disabled = value || (!quote && !pending);
    place.textContent = value ? 'Processing Order…' : pending ? 'Retry unconfirmed order' : 'Place Order';
  }
  async function refreshQuote() {
    if (submitting || pending || activeOrder) return;
    const version = ++quoting; quote = null; place.disabled = true; place.textContent = 'Loading totals…';
    showError(''); document.getElementById('err-ckVoucherCode').textContent = '';
    try {
      const result = await SquishiesAPI.quote({ items: Squishies.getCart().map(i => ({ slug: i.slug, quantity: i.qty })), region: region.value, voucherCode: voucher.value.trim().toUpperCase() });
      if (version !== quoting || activeOrder) return;
      quote = result;
      document.getElementById('ckSubtotal').textContent = Squishies.formatPeso(quote.subtotal);
      document.getElementById('ckShipping').textContent = quote.shippingFee ? Squishies.formatPeso(quote.shippingFee) : 'Free';
      document.getElementById('ckTotal').textContent = Squishies.formatPeso(quote.total);
      document.getElementById('ckVoucherRow').style.display = quote.voucherDiscount ? 'flex' : 'none';
      document.getElementById('ckVoucherDiscount').textContent = `−${Squishies.formatPeso(quote.voucherDiscount)}`;
      document.getElementById('ckShippingNote').textContent = quote.shippingDiscount ? `Shipping voucher saved ${Squishies.formatPeso(quote.shippingDiscount)}; already included above.` : quote.subtotal >= 500 ? 'Your order qualifies for free shipping.' : `Add ${Squishies.formatPeso(500 - quote.subtotal)} more for free shipping.`;
      document.getElementById('deliveryEstimateBadge').textContent = `Estimated delivery: ${quote.delivery.minDays}–${quote.delivery.maxDays} days (${quote.delivery.label}; school demo estimate).`;
      const list = document.getElementById('orderSummaryItems'); list.replaceChildren();
      for (const item of quote.items) {
        const itemRow = node('div', undefined, 'order-summary__item');
        const img = node('img'); img.src = item.image; img.alt = ''; img.width = img.height = 52;
        const info = node('div', undefined, 'order-summary__item-info'); info.append(node('h4', item.name), node('span', `Qty: ${item.quantity}`));
        itemRow.append(img, info, node('span', Squishies.formatPeso(item.subtotal), 'order-summary__item-price')); list.append(itemRow);
      }
      document.querySelectorAll('.payment-option').forEach(option => {
        const input = option.querySelector('input'); input.disabled = !quote.paymentMethods.includes(input.value);
        if (input.disabled && input.checked) document.querySelector('[name=paymentMethod][value=cod]').checked = true;
      });
      syncPaymentChoice(); place.disabled = false; place.textContent = 'Place Order';
    } catch (error) {
      if (version !== quoting || activeOrder) return;
      errorFields(error); place.disabled = false; place.textContent = 'Retry loading totals';
    }
  }
  function syncPaymentChoice() {
    document.querySelectorAll('.payment-option').forEach(option => option.classList.toggle('is-selected', option.querySelector('input').checked));
  }
  content.querySelectorAll('[name=paymentMethod]').forEach(input => input.addEventListener('change', syncPaymentChoice));
  content.querySelectorAll('input').forEach(input => input.addEventListener('input', () => { input.removeAttribute('aria-invalid'); const err = document.getElementById(`err-${input.id}`); if (err) err.textContent = ''; }));
  region.onchange = refreshQuote; voucherButton.onclick = refreshQuote;
  // Editing an applied code invalidates that quote until the shopper explicitly reapplies it.
  voucher.addEventListener('input', () => { ++quoting; quote = null; place.disabled = false; place.textContent = 'Refresh totals'; });
  unsubscribe = Squishies.onChange(refreshQuote);
  place.onclick = async () => {
    if (submitting) return;
    if (!pending && !quote) { await refreshQuote(); return; }
    if (!pending) {
      const inputs = [...content.querySelectorAll('input[required],select[required]')];
      const invalid = inputs.find(input => !input.checkValidity());
      if (invalid) { invalid.reportValidity(); return; }
      const payload = { quoteId: quote.quoteId, paymentMethod: content.querySelector('[name=paymentMethod]:checked').value };
      for (const [name, id] of Object.entries(fields)) payload[name] = document.getElementById(id).value.trim();
      storePending({ key: crypto.randomUUID(), payload });
    }
    busy(true); showError('');
    try { accepted(await SquishiesAPI.placeOrder(pending.payload, pending.key)); }
    catch (error) {
      // Keep both the request and key after uncertain transport/server failures.
      if (error.status >= 400 && error.status < 500 && error.status !== 429) {
        storePending(null);
        if (['QUOTE_EXPIRED', 'PRICE_CHANGED', 'OUT_OF_STOCK', 'QUOTE_USED'].includes(error.code)) quote = null;
      }
      errorFields(error);
    } finally { if (!activeOrder) busy(false); else { submitting = false; Squishies.setLocked(false); } }
  };
  if (pending?.payload && pending?.key) {
    for (const [name,id] of Object.entries(fields)) document.getElementById(id).value = pending.payload[name] || '';
    busy(false); showError('A previous checkout request was unconfirmed. Retry it to recover the saved order without creating a duplicate.');
  } else { storePending(null); await refreshQuote(); }
});
