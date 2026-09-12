/* ==========================================================================
   SQUISHIES — payment.js
   Minimal & Formal Payment Gateway Sandbox for GCash, Maya & Card.
   ========================================================================== */

const PaymentGateway = (() => {

  function createModalDOM() {
    if (document.getElementById('paymentModal')) return;

    const overlay = document.createElement('div');
    overlay.id = 'paymentModalOverlay';
    overlay.className = 'payment-modal-overlay';
    overlay.style.display = 'none';

    overlay.innerHTML = `
      <div class="payment-modal" id="paymentModal">
        <div class="payment-modal__header" id="paymentModalHeader">
          <h3 id="paymentModalTitle">Payment Gateway</h3>
          <button type="button" class="payment-modal__close" id="paymentModalClose">&times;</button>
        </div>
        <div class="payment-modal__body" id="paymentModalBody">
          <!-- Dynamically populated -->
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById('paymentModalClose').addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
  }

  function closeModal() {
    const overlay = document.getElementById('paymentModalOverlay');
    if (overlay) overlay.style.display = 'none';
  }

  function openModal(options) {
    createModalDOM();
    const overlay = document.getElementById('paymentModalOverlay');
    const header = document.getElementById('paymentModalHeader');
    const title = document.getElementById('paymentModalTitle');
    const body = document.getElementById('paymentModalBody');

    const { orderNumber, amount, method, customerPhone, onSuccess } = options;

    overlay.style.display = 'flex';

    if (method === 'gcash' || method === 'maya') {
      const isGCash = method === 'gcash';
      header.className = `payment-modal__header ${isGCash ? 'is-gcash' : 'is-maya'}`;
      title.textContent = isGCash ? 'GCash Express Checkout' : 'Maya Wallet Payment';

      renderGCashStep1();

      function renderGCashStep1() {
        body.innerHTML = `
          <div class="payment-brand-badge ${isGCash ? 'badge-gcash' : 'badge-maya'}">
            ${isGCash ? 'GCash Step 1 of 2: Number Verification' : 'Maya Step 1 of 2: Number Verification'}
          </div>
          <div class="payment-summary-box">
            <div><span>Amount Due:</span> <strong>₱${Math.round(amount).toLocaleString('en-PH')}</strong></div>
            <div><span>Order Reference:</span> <code>${orderNumber}</code></div>
          </div>
          <form id="gcashStep1Form" class="payment-form">
            <div class="form-group">
              <label>Registered Mobile Number</label>
              <input type="text" id="payMobile" class="form-control" value="${customerPhone || '09171234567'}" required placeholder="09XXXXXXXXX" maxlength="11">
              <span class="field-error" id="err-payMobile"></span>
            </div>
            <button type="submit" class="btn btn--pink payment-submit-btn" id="nextOtpBtn">
              Next: Send Authentication OTP →
            </button>
          </form>
        `;

        document.getElementById('gcashStep1Form').addEventListener('submit', (e) => {
          e.preventDefault();
          const phoneVal = document.getElementById('payMobile').value.trim();
          if (!/^09\d{9}$/.test(phoneVal)) {
            document.getElementById('err-payMobile').textContent = 'Please enter a valid 11-digit mobile number (e.g. 09171234567).';
            return;
          }
          renderGCashStep2(phoneVal);
        });
      }

      function renderGCashStep2(phoneVal) {
        let timerSeconds = 60;
        body.innerHTML = `
          <div class="payment-brand-badge ${isGCash ? 'badge-gcash' : 'badge-maya'}">
            ${isGCash ? 'GCash Step 2 of 2: Enter 6-Digit OTP' : 'Maya Step 2 of 2: Enter 6-Digit OTP'}
          </div>
          <div class="payment-summary-box">
            <div><span>Authentication Code Sent To:</span> <strong>${phoneVal}</strong></div>
            <div><span>Amount:</span> <strong>₱${Math.round(amount).toLocaleString('en-PH')}</strong></div>
          </div>
          <form id="gcashStep2Form" class="payment-form">
            <div class="form-group">
              <label>6-Digit Security OTP</label>
              <input type="password" id="payOTP" class="form-control" value="123456" maxlength="6" required placeholder="123456" style="letter-spacing: 4px; font-weight: 700; text-align: center; font-size: 18px;">
              <span class="field-error" id="err-payOTP"></span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 12.5px; color: #64748b; margin-bottom: 16px;">
              <span>Resend Code in: <strong id="otpTimerCount" style="color: #475569;">60s</strong></span>
              <button type="button" id="resendOtpBtn" disabled style="background: none; border: none; color: #94a3b8; font-weight: 600; cursor: not-allowed; text-decoration: underline;">Resend OTP</button>
            </div>
            <button type="submit" class="btn btn--pink payment-submit-btn" id="paySubmitBtn">
              Authorize Payment ₱${Math.round(amount).toLocaleString('en-PH')}
            </button>
          </form>
        `;

        const interval = setInterval(() => {
          timerSeconds--;
          const timerEl = document.getElementById('otpTimerCount');
          const resendEl = document.getElementById('resendOtpBtn');
          if (timerEl) timerEl.textContent = `${timerSeconds}s`;
          if (timerSeconds <= 0) {
            clearInterval(interval);
            if (timerEl) timerEl.textContent = 'Expired';
            if (resendEl) {
              resendEl.disabled = false;
              resendEl.style.color = '#7c3aed';
              resendEl.style.cursor = 'pointer';
              resendEl.onclick = () => {
                clearInterval(interval);
                renderGCashStep2(phoneVal);
              };
            }
          }
        }, 1000);

        document.getElementById('gcashStep2Form').addEventListener('submit', async (e) => {
          e.preventDefault();
          const otpVal = document.getElementById('payOTP').value.trim();
          if (otpVal.length !== 6) {
            document.getElementById('err-payOTP').textContent = 'Please enter all 6 digits of the OTP.';
            return;
          }

          clearInterval(interval);
          const submitBtn = document.getElementById('paySubmitBtn');
          submitBtn.disabled = true;
          submitBtn.textContent = 'Verifying OTP & Processing Payment...';

          try {
            const result = await SquishiesAPI.confirmPayment(orderNumber, method, 'APPROVED_TEST');
            closeModal();
            if (onSuccess) onSuccess(result);
          } catch (err) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Retry Payment';
            alert('Payment authorization failed: ' + err.message);
          }
        });
      }

    } else if (method === 'card') {
      header.className = 'payment-modal__header is-card';
      title.textContent = '3D-Secure Card Payment';

      body.innerHTML = `
        <div class="payment-brand-badge badge-card">
          Visa / Mastercard Secure Authorization
        </div>
        <div class="payment-summary-box">
          <div><span>Amount Due:</span> <strong>₱${Math.round(amount).toLocaleString('en-PH')}</strong></div>
          <div><span>Order Reference:</span> <code>${orderNumber}</code></div>
        </div>
        <form id="paymentForm" class="payment-form">
          <div class="form-group">
            <label>Cardholder Name</label>
            <input type="text" id="cardName" class="form-control" value="Mary Ruth S. Batac" required>
            <span class="field-error" id="err-cardName"></span>
          </div>
          <div class="form-group">
            <label>16-Digit Card Number</label>
            <input type="text" id="cardNumber" class="form-control" value="4242 4242 4242 4242" maxlength="19" required>
            <span class="field-error" id="err-cardNumber"></span>
          </div>
          <div class="form-row" style="display: flex; gap: 12px;">
            <div class="form-group" style="flex: 1;">
              <label>Expiry (MM/YY)</label>
              <input type="text" id="cardExpiry" class="form-control" value="12/28" placeholder="MM/YY" maxlength="5" required>
              <span class="field-error" id="err-cardExpiry"></span>
            </div>
            <div class="form-group" style="flex: 1;">
              <label>CVC (3 Digits)</label>
              <input type="password" id="cardCVC" class="form-control" value="888" maxlength="4" required>
              <span class="field-error" id="err-cardCVC"></span>
            </div>
          </div>
          <div style="margin-bottom: 12px;">
            <button type="button" class="btn-link" id="fillTestCardBtn" style="background: none; border: none; color: #7c3aed; font-size: 13px; font-weight: 600; cursor: pointer; text-decoration: underline;">
              Fill Test Credentials
            </button>
          </div>
          <button type="submit" class="btn btn--pink payment-submit-btn" id="paySubmitBtn">
            Verify 3D-Secure & Pay ₱${Math.round(amount).toLocaleString('en-PH')}
          </button>
        </form>
      `;

      document.getElementById('fillTestCardBtn').addEventListener('click', () => {
        document.getElementById('cardName').value = 'Mary Ruth S. Batac';
        document.getElementById('cardNumber').value = '4242 4242 4242 4242';
        document.getElementById('cardExpiry').value = '12/28';
        document.getElementById('cardCVC').value = '888';
      });

      const form = document.getElementById('paymentForm');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const cardNo = document.getElementById('cardNumber').value.replace(/\s+/g, '');
        if (cardNo.length < 15) {
          document.getElementById('err-cardNumber').textContent = 'Please enter a valid 16-digit card number.';
          return;
        }

        const submitBtn = document.getElementById('paySubmitBtn');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Contacting Issuer Bank (3D-Secure)...';

        setTimeout(async () => {
          try {
            const result = await SquishiesAPI.confirmPayment(orderNumber, method, 'APPROVED_3D_SECURE');
            closeModal();
            if (onSuccess) onSuccess(result);
          } catch (err) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Retry Payment';
            alert('Card authorization failed: ' + err.message);
          }
        }, 1200);
      });
    }
  }

  return {
    openModal,
    closeModal
  };
})();
