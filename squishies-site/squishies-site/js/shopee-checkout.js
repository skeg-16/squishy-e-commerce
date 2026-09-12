/* ==========================================================================
   SQUISHIES — shopee-checkout.js
   Minimal & Formal Checkout Validation, Exit Confirmation, Regional Shipping,
   Voucher Discount Engine, and Order Lifecycle Management.
   Depends on: js/cart.js, js/api.js, js/payment.js
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  const contentEl = document.getElementById('checkoutContent');
  const cart = Squishies.getCart();

  if (cart.length === 0) {
    const emptyTpl = document.getElementById('checkoutEmptyTemplate');
    if (emptyTpl && contentEl) contentEl.appendChild(emptyTpl.content.cloneNode(true));
    return;
  }

  const tpl = document.getElementById('checkoutTemplate');
  if (tpl && contentEl) contentEl.appendChild(tpl.content.cloneNode(true));

  // Regional shipping rates & delivery day offsets
  const REGIONAL_RATES = {
    'metro-manila': { rate: 60, minDays: 1, maxDays: 2, label: 'Metro Manila' },
    'luzon': { rate: 80, minDays: 2, maxDays: 4, label: 'Luzon' },
    'visayas': { rate: 110, minDays: 4, maxDays: 7, label: 'Visayas' },
    'mindanao': { rate: 110, minDays: 4, maxDays: 7, label: 'Mindanao' }
  };

  let activeVoucher = null; // { code, discountAmount, type, description }

  /* ------------------------------------------------------------------ *
   * 1. Render Order Summary & Dynamic Shipping & Voucher Calculator
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
    if (itemsEl) itemsEl.appendChild(row);
  });

  const subtotal = Squishies.subtotal();

  function updateTotals() {
    const regionSelect = document.getElementById('ckRegion');
    const regionKey = regionSelect ? regionSelect.value : 'metro-manila';
    const regionInfo = REGIONAL_RATES[regionKey] || REGIONAL_RATES['metro-manila'];

    let shippingFee = subtotal >= Squishies.FREE_SHIPPING_THRESHOLD ? 0 : regionInfo.rate;
    let voucherDiscount = activeVoucher ? activeVoucher.discountAmount : 0;

    if (activeVoucher && activeVoucher.type === 'free_shipping') {
      shippingFee = 0;
      voucherDiscount = regionInfo.rate;
    }

    const total = Math.max(0, subtotal + shippingFee - (activeVoucher && activeVoucher.type !== 'free_shipping' ? voucherDiscount : 0));

    const ckSubtotal = document.getElementById('ckSubtotal');
    const ckShipping = document.getElementById('ckShipping');
    const ckVoucherRow = document.getElementById('ckVoucherRow');
    const ckVoucherDiscount = document.getElementById('ckVoucherDiscount');
    const ckTotal = document.getElementById('ckTotal');
    const ckNote = document.getElementById('ckShippingNote');

    if (ckSubtotal) ckSubtotal.textContent = Squishies.formatPeso(subtotal);
    if (ckShipping) ckShipping.textContent = shippingFee === 0 ? 'Free' : Squishies.formatPeso(shippingFee);

    if (activeVoucher) {
      if (ckVoucherRow) ckVoucherRow.style.display = 'flex';
      if (ckVoucherDiscount) ckVoucherDiscount.textContent = `-${Squishies.formatPeso(voucherDiscount)}`;
    } else {
      if (ckVoucherRow) ckVoucherRow.style.display = 'none';
    }

    if (ckTotal) ckTotal.textContent = Squishies.formatPeso(total);

    const remaining = Squishies.FREE_SHIPPING_THRESHOLD - subtotal;
    if (ckNote) {
      ckNote.textContent = remaining > 0
        ? `Add ${Squishies.formatPeso(remaining)} more to qualify for free shipping.`
        : 'Your order qualifies for free shipping.';
    }

    // Delivery Estimate Date Range
    const today = new Date();
    const minDate = new Date(today);
    minDate.setDate(today.getDate() + regionInfo.minDays);
    const maxDate = new Date(today);
    maxDate.setDate(today.getDate() + regionInfo.maxDays);

    const options = { weekday: 'short', month: 'short', day: 'numeric' };
    const minStr = minDate.toLocaleDateString('en-PH', options);
    const maxStr = maxDate.toLocaleDateString('en-PH', options);

    const badge = document.getElementById('deliveryEstimateBadge');
    if (badge) {
      badge.innerHTML = `Estimated Delivery: <strong>${minStr} – ${maxStr}</strong> (${regionInfo.label})`;
    }

    return { subtotal, shippingFee, voucherDiscount, total, regionKey };
  }

  const regionSelectEl = document.getElementById('ckRegion');
  if (regionSelectEl) {
    regionSelectEl.addEventListener('change', updateTotals);
  }

  // Voucher Application Action
  const applyVoucherBtn = document.getElementById('applyVoucherBtn');
  if (applyVoucherBtn) {
    applyVoucherBtn.addEventListener('click', async () => {
      const codeInput = document.getElementById('ckVoucherCode');
      const errEl = document.getElementById('err-ckVoucherCode');
      const code = codeInput ? codeInput.value.trim() : '';

      if (!code) {
        if (errEl) errEl.textContent = 'Please enter a voucher code.';
        return;
      }

      applyVoucherBtn.disabled = true;
      applyVoucherBtn.textContent = 'Verifying...';
      if (errEl) errEl.textContent = '';

      const current = updateTotals();

      try {
        if (typeof SquishiesAPI !== 'undefined') {
          const res = await SquishiesAPI.applyVoucher(code, current.subtotal, current.shippingFee);
          if (res && res.success && res.data) {
            activeVoucher = res.data;
            Squishies.showToast(`Voucher ${res.data.code} applied!`);
          }
        }
      } catch (err) {
        activeVoucher = null;
        if (errEl) errEl.textContent = err.message || 'Invalid voucher code.';
      } finally {
        applyVoucherBtn.disabled = false;
        applyVoucherBtn.textContent = 'Apply';
        updateTotals();
      }
    });
  }

  updateTotals();

  /* ------------------------------------------------------------------ *
   * 2. Form Field Validations
   * ------------------------------------------------------------------ */
  const fields = {
    ckEmail: {
      validate: (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim()),
      error: 'Please enter a valid email address (e.g. name@domain.com).'
    },
    ckName: {
      validate: (val) => val.trim().length >= 3,
      error: 'Please enter your full name (minimum 3 characters).'
    },
    ckPhone: {
      validate: (val) => /^09\d{9}$/.test(val.trim().replace(/\s+|-/g, '')),
      error: 'Please enter a valid 11-digit mobile number starting with 09 (e.g. 09171234567).'
    },
    ckAddress: {
      validate: (val) => val.trim().length >= 5,
      error: 'Please enter your street address and house number.'
    },
    ckCity: {
      validate: (val) => val.trim().length >= 2,
      error: 'Please enter your city or municipality.'
    },
    ckBarangay: {
      validate: (val) => val.trim().length >= 2,
      error: 'Please enter your barangay.'
    },
    ckPostalCode: {
      validate: (val) => /^\d{4}$/.test(val.trim()),
      error: 'Please enter a valid 4-digit postal code (e.g. 1000).'
    }
  };

  function validateSingleField(id) {
    const el = document.getElementById(id);
    const errEl = document.getElementById(`err-${id}`);
    if (!el || !fields[id]) return true;

    const isValid = fields[id].validate(el.value);
    if (!isValid) {
      el.classList.add('is-invalid');
      if (errEl) errEl.textContent = fields[id].error;
    } else {
      el.classList.remove('is-invalid');
      if (errEl) errEl.textContent = '';
    }
    return isValid;
  }

  Object.keys(fields).forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', () => validateSingleField(id));
      el.addEventListener('blur', () => validateSingleField(id));
    }
  });

  function validateForm() {
    let isValid = true;
    Object.keys(fields).forEach((id) => {
      if (!validateSingleField(id)) {
        isValid = false;
      }
    });
    return isValid;
  }

  /* ------------------------------------------------------------------ *
   * 3. Exit Confirmation Dialog ("Leave Checkout?")
   * ------------------------------------------------------------------ */
  let isFormDirty = false;
  let isSubmittingOrder = false;

  const formInputs = document.querySelectorAll('.checkout-card input, .checkout-card select');
  formInputs.forEach((input) => {
    input.addEventListener('input', () => { isFormDirty = true; });
  });

  window.addEventListener('beforeunload', (e) => {
    if (isFormDirty && !isSubmittingOrder) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  function setupExitWarningModal() {
    if (document.getElementById('exitWarningModalOverlay')) return;

    const modalHTML = `
      <div class="payment-modal-overlay" id="exitWarningModalOverlay" style="display: none;">
        <div class="payment-modal" style="max-width: 400px; text-align: center;">
          <div class="payment-modal__header" style="background: #1e293b;">
            <h3>Leave Checkout?</h3>
            <button type="button" class="payment-modal__close" id="exitModalClose">&times;</button>
          </div>
          <div class="payment-modal__body" style="padding: 24px 20px;">
            <p style="font-size: 14.5px; color: #475569; margin-bottom: 20px;">
              Your items will remain in the cart, but your entered checkout information will not be saved.
            </p>
            <div style="display: flex; gap: 10px;">
              <button class="btn btn--outline" id="stayCheckoutBtn" style="flex: 1; padding: 10px;">Keep Editing</button>
              <button class="btn btn--pink" id="leaveCheckoutBtn" style="flex: 1; padding: 10px; background: #0f172a; border-color: #0f172a;">Leave Page</button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    document.getElementById('exitModalClose').addEventListener('click', () => {
      document.getElementById('exitWarningModalOverlay').style.display = 'none';
    });
    document.getElementById('stayCheckoutBtn').addEventListener('click', () => {
      document.getElementById('exitWarningModalOverlay').style.display = 'none';
    });
  }

  setupExitWarningModal();

  let targetExitHref = null;
  document.querySelectorAll('a[href]:not([target="_blank"])').forEach((link) => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      if (isFormDirty && !isSubmittingOrder && href && !href.startsWith('#')) {
        e.preventDefault();
        targetExitHref = href;
        document.getElementById('exitWarningModalOverlay').style.display = 'flex';
      }
    });
  });

  const leaveBtn = document.getElementById('leaveCheckoutBtn');
  if (leaveBtn) {
    leaveBtn.addEventListener('click', () => {
      isFormDirty = false;
      if (targetExitHref) window.location.href = targetExitHref;
    });
  }

  /* ------------------------------------------------------------------ *
   * 4. Payment Method Selection
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
   * 5. Place Order Action
   * ------------------------------------------------------------------ */
  const placeOrderBtn = document.getElementById('placeOrderBtn');
  if (placeOrderBtn) {
    placeOrderBtn.addEventListener('click', async () => {
      if (!validateForm()) {
        Squishies.showToast('Please resolve the highlighted errors in the form.');
        const firstInvalid = document.querySelector('.is-invalid');
        if (firstInvalid) firstInvalid.focus();
        return;
      }

      isSubmittingOrder = true;
      placeOrderBtn.disabled = true;
      placeOrderBtn.textContent = 'Processing Order...';

      const email = document.getElementById('ckEmail').value.trim();
      const name = document.getElementById('ckName').value.trim();
      const phone = document.getElementById('ckPhone').value.trim().replace(/\s+|-/g, '');
      const address = document.getElementById('ckAddress').value.trim();
      const region = document.getElementById('ckRegion').value;
      const city = document.getElementById('ckCity').value.trim();
      const barangay = document.getElementById('ckBarangay').value.trim();
      const postalCode = document.getElementById('ckPostalCode').value.trim();

      const orderPayload = {
        customerName: name,
        customerEmail: email,
        customerPhone: phone,
        shippingAddress: address,
        region,
        city,
        barangay,
        postalCode,
        paymentMethod: selectedPaymentMethod,
        voucherCode: activeVoucher ? activeVoucher.code : null,
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

      const currentTotals = updateTotals();
      const orderNumber = orderData ? orderData.orderNumber : `SQ-${Date.now().toString().slice(-6)}`;
      const trackingNumber = orderData ? orderData.trackingNumber : `SPXPH${Math.floor(1000000 + Math.random() * 9000000)}`;
      const orderTotal = orderData ? orderData.total : currentTotals.total;

      if (selectedPaymentMethod === 'cod') {
        isFormDirty = false;
        renderOrderView({
          name,
          email,
          phone,
          address: `${address}, Brgy. ${barangay}, ${city}, ${region.toUpperCase()} ${postalCode}`,
          orderNumber,
          trackingNumber,
          paymentMethod: 'Cash on Delivery (COD)',
          paymentStatus: 'Pending COD',
          orderStatus: 'To Ship',
          subtotal: currentTotals.subtotal,
          shippingFee: currentTotals.shippingFee,
          voucherCode: activeVoucher ? activeVoucher.code : null,
          voucherDiscount: activeVoucher ? activeVoucher.discountAmount : 0,
          total: orderTotal,
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
            isFormDirty = false;
            const pData = paymentResult.data || {};
            renderOrderView({
              name,
              email,
              phone,
              address: `${address}, Brgy. ${barangay}, ${city}, ${region.toUpperCase()} ${postalCode}`,
              orderNumber,
              trackingNumber,
              paymentMethod: selectedPaymentMethod.toUpperCase(),
              paymentStatus: 'Paid',
              orderStatus: 'To Ship',
              subtotal: currentTotals.subtotal,
              shippingFee: currentTotals.shippingFee,
              voucherCode: activeVoucher ? activeVoucher.code : null,
              voucherDiscount: activeVoucher ? activeVoucher.discountAmount : 0,
              total: orderTotal,
              paymentReference: pData.paymentReference || 'PAY-APPROVED'
            });
          }
        });
      }
    });
  }

  /* ------------------------------------------------------------------ *
   * 6. Render Order Lifecycle View
   * ------------------------------------------------------------------ */
  function renderOrderView(info) {
    Squishies.clearCart();
    contentEl.innerHTML = '';

    const viewEl = document.createElement('div');
    viewEl.className = 'shopee-order-view';
    viewEl.innerHTML = `
      <div class="shopee-receipt-card">
        <!-- Order Header -->
        <div class="shopee-receipt-header">
          <div class="shopee-status-badge badge-to-ship" id="shopeeStatusBadge">
            Order Status: ${info.orderStatus}
          </div>
          <p class="shopee-order-ref">Order Reference: <strong>${info.orderNumber}</strong></p>
          <p class="shopee-tracking-ref">Tracking Number: <code id="shopeeTrackingNo">${info.trackingNumber}</code></p>
        </div>

        <!-- Status Timeline -->
        <div class="shopee-timeline" id="shopeeTimeline">
          <div class="timeline-step is-complete">
            <div class="step-icon">1</div>
            <span>Order Placed</span>
          </div>
          <div class="timeline-step ${info.paymentStatus.includes('Paid') ? 'is-complete' : 'is-active'}">
            <div class="step-icon">2</div>
            <span>Payment ${info.paymentStatus.includes('Paid') ? 'Verified' : 'Pending'}</span>
          </div>
          <div class="timeline-step is-active">
            <div class="step-icon">3</div>
            <span>To Ship</span>
          </div>
          <div class="timeline-step">
            <div class="step-icon">4</div>
            <span>Completed</span>
          </div>
        </div>

        <!-- Information Grid -->
        <div class="shopee-info-grid">
          <div class="shopee-info-box">
            <h4>Shipping Address</h4>
            <p><strong>${info.name}</strong> (${info.phone})</p>
            <p>${info.address}</p>
          </div>
          <div class="shopee-info-box">
            <h4>Payment Details</h4>
            <p>Payment Method: <strong>${info.paymentMethod}</strong></p>
            <p>Payment Status: <strong style="color: #059669;">${info.paymentStatus}</strong></p>
            ${info.paymentReference ? `<p>Transaction Ref: <code>${info.paymentReference}</code></p>` : ''}
          </div>
        </div>

        <!-- Financial Summary -->
        <div class="shopee-financial-box">
          <div class="financial-row"><span>Subtotal:</span> <span>${Squishies.formatPeso(info.subtotal)}</span></div>
          <div class="financial-row"><span>Shipping Fee:</span> <span>${info.shippingFee === 0 ? 'Free' : Squishies.formatPeso(info.shippingFee)}</span></div>
          ${info.voucherDiscount > 0 ? `<div class="financial-row" style="color: #059669;"><span>Voucher (${info.voucherCode}):</span> <span>-${Squishies.formatPeso(info.voucherDiscount)}</span></div>` : ''}
          <div class="financial-row financial-row--total"><span>Total Amount:</span> <strong>${Squishies.formatPeso(info.total)}</strong></div>
        </div>

        <!-- Actions -->
        <div class="shopee-actions" id="shopeeActions">
          <button class="btn btn--outline btn-cancel-order" id="cancelOrderBtn" style="color: #0f172a; border-color: #cbd5e1;">
            Cancel Order
          </button>
          <a href="shop.html" class="btn btn--pink">Continue Shopping →</a>
        </div>
      </div>
    `;

    contentEl.appendChild(viewEl);

    const cancelBtn = document.getElementById('cancelOrderBtn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        openCancellationModal(info.orderNumber);
      });
    }
  }

  /* ------------------------------------------------------------------ *
   * 7. Order Cancellation Modal Handler
   * ------------------------------------------------------------------ */
  function openCancellationModal(orderNumber) {
    let cancelOverlay = document.getElementById('cancelOrderModalOverlay');
    if (!cancelOverlay) {
      const cancelModalHTML = `
        <div class="payment-modal-overlay" id="cancelOrderModalOverlay" style="display: flex;">
          <div class="payment-modal" style="max-width: 420px;">
            <div class="payment-modal__header" style="background: #1e293b;">
              <h3>Cancel Order</h3>
              <button type="button" class="payment-modal__close" id="cancelModalClose">&times;</button>
            </div>
            <div class="payment-modal__body">
              <p style="font-size: 14px; color: #475569; margin-bottom: 14px;">
                Please select a reason for cancelling order <code>${orderNumber}</code>:
              </p>
              <form id="cancelReasonForm">
                <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px; font-size: 14px;">
                  <label><input type="radio" name="cancelReason" value="Change of mind" checked> Change of mind</label>
                  <label><input type="radio" name="cancelReason" value="Need to modify shipping address"> Need to modify shipping address</label>
                  <label><input type="radio" name="cancelReason" value="Modify order payment method"> Modify payment method</label>
                  <label><input type="radio" name="cancelReason" value="Found cheaper alternative elsewhere"> Found alternative option</label>
                </div>
                <button type="submit" class="btn btn--pink" id="confirmCancelSubmitBtn" style="width: 100%; background: #0f172a; border-color: #0f172a;">
                  Confirm Cancellation
                </button>
              </form>
            </div>
          </div>
        </div>
      `;
      document.body.insertAdjacentHTML('beforeend', cancelModalHTML);
      cancelOverlay = document.getElementById('cancelOrderModalOverlay');
    } else {
      cancelOverlay.style.display = 'flex';
    }

    const closeBtn = document.getElementById('cancelModalClose');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => { cancelOverlay.style.display = 'none'; });
    }

    const form = document.getElementById('cancelReasonForm');
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        const selectedReason = form.querySelector('input[name="cancelReason"]:checked').value;
        const submitBtn = document.getElementById('confirmCancelSubmitBtn');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Processing Cancellation...';

        try {
          if (typeof SquishiesAPI !== 'undefined') {
            await SquishiesAPI.cancelOrder(orderNumber, selectedReason);
          }
          cancelOverlay.style.display = 'none';
          updateOrderViewToCancelled(selectedReason);
        } catch (err) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Confirm Cancellation';
          alert('Failed to cancel order: ' + err.message);
        }
      };
    }
  }

  function updateOrderViewToCancelled(reason) {
    const badge = document.getElementById('shopeeStatusBadge');
    if (badge) {
      badge.className = 'shopee-status-badge badge-cancelled';
      badge.textContent = 'Order Status: Cancelled';
    }

    const timeline = document.getElementById('shopeeTimeline');
    if (timeline) {
      timeline.innerHTML = `
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; color: #475569; padding: 12px 16px; border-radius: 10px; font-size: 14px; text-align: center; width: 100%;">
          Order was cancelled upon request (${reason}). Product inventory has been restored.
        </div>`;
    }

    const actions = document.getElementById('shopeeActions');
    if (actions) {
      actions.innerHTML = `<a href="shop.html" class="btn btn--pink">Browse Catalog →</a>`;
    }
  }
});
