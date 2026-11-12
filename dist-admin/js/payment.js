/* Controlled school demonstration: no wallet number, OTP, card number, or CVC. */
const PaymentGateway = (() => {
  let overlay, restoreFocus, busy = false;
  function closeModal() {
    if (busy || !overlay) return;
    overlay.remove(); overlay = null; restoreFocus?.focus();
  }
  async function openModal({ orderNumber, amount, method, onUpdate }) {
    if (overlay) return;
    restoreFocus = document.activeElement;
    overlay = document.createElement('div'); overlay.className = 'payment-modal-overlay'; overlay.style.display = 'flex';
    overlay.innerHTML = '<div class="payment-modal" role="dialog" aria-modal="true" aria-labelledby="paymentModalTitle"><div class="payment-modal__header"><h3 id="paymentModalTitle"></h3><button type="button" class="payment-modal__close" aria-label="Close payment simulation">×</button></div><div class="payment-modal__body"><p>No money is transferred. Choose a test outcome for this school demonstration.</p><div class="payment-summary-box"><strong id="paymentAmount"></strong></div><p id="paymentMessage" role="status"></p><div class="payment-form"><button class="btn btn--pink" data-outcome="success">Simulate success</button><button class="btn btn--outline" data-outcome="declined">Simulate decline</button><button class="btn btn--outline" data-outcome="cancelled">Simulate cancellation</button></div></div></div>';
    overlay.querySelector('h3').textContent = `${method.toUpperCase()} — payment simulation`;
    overlay.querySelector('#paymentAmount').textContent = `Amount: ${Squishies.formatPeso(amount)}`;
    const message = overlay.querySelector('#paymentMessage');
    overlay.querySelector('.payment-modal__close').onclick = closeModal;
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
    overlay.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeModal();
      if (e.key === 'Tab') {
        const buttons = [...overlay.querySelectorAll('button:not([disabled])')];
        if (e.shiftKey && document.activeElement === buttons[0]) { e.preventDefault(); buttons.at(-1)?.focus(); }
        else if (!e.shiftKey && document.activeElement === buttons.at(-1)) { e.preventDefault(); buttons[0]?.focus(); }
      }
    });
    document.body.append(overlay); overlay.querySelector('button').focus();
    let session, uncertainOutcome;
    const storageKey = `squishies-payment-${orderNumber}`;
    let key;
    try { key = sessionStorage.getItem(storageKey); } catch { /* Use an in-memory retry key. */ }
    key ||= crypto.randomUUID();
    try { sessionStorage.setItem(storageKey, key); } catch { /* In-memory key still deduplicates. */ }
    const buttons = [...overlay.querySelectorAll('[data-outcome]')];
    for (const button of buttons) button.onclick = async () => {
      if (busy) return;
      const outcome = uncertainOutcome || button.dataset.outcome;
      busy = true; buttons.forEach(b => b.disabled = true); message.textContent = 'Processing simulation…';
      try {
        session ||= await SquishiesAPI.createPaymentSession(orderNumber, key);
        // A previous outcome may already have committed despite a lost response.
        if (session.status !== 'pending') {
          const order = await SquishiesAPI.getOrder(orderNumber);
          try { sessionStorage.removeItem(storageKey); } catch { /* no-op */ }
          busy = false; closeModal(); onUpdate(order); return;
        }
        const result = await SquishiesAPI.simulatePayment(session.sessionId, outcome);
        try { sessionStorage.removeItem(storageKey); } catch { /* no-op */ }
        busy = false; closeModal(); onUpdate(result.order);
        if (outcome !== 'success') Squishies.showToast(`Payment ${outcome}. You can retry before the reservation expires.`);
      } catch (error) {
        message.textContent = error.message;
        if (!error.status || error.status >= 500) uncertainOutcome = outcome;
        else { uncertainOutcome = null; session = null; key = crypto.randomUUID(); try { sessionStorage.setItem(storageKey, key); } catch { /* no-op */ } }
      } finally {
        busy = false;
        buttons.forEach(b => { b.disabled = Boolean(uncertainOutcome && b.dataset.outcome !== uncertainOutcome); });
      }
    };
  }
  return { openModal, closeModal };
})();
