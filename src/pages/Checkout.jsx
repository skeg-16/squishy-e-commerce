import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { SquishiesAPI } from '../services/api';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import {
  FIELD_LIMITS,
  formatCardExpiry,
  formatCardNumber,
  sanitizeBarangayName,
  sanitizeCityName,
  sanitizeDigits,
  sanitizeEmail,
  sanitizePersonName,
  sanitizePhPhone,
  sanitizeStreetAddress,
  scrollToFirstInvalidField,
  validateCheckoutFields,
  validatePhPhone,
} from '../utils/validators';

const PENDING_KEY = 'squishies-pending-checkout';
const REGIONS = [
  { value: 'metro-manila', label: 'Metro Manila (₱60 — 1–2 days)' },
  { value: 'luzon', label: 'Luzon (₱80 — 2–4 days)' },
  { value: 'visayas', label: 'Visayas (₱110 — 4–7 days)' },
  { value: 'mindanao', label: 'Mindanao (₱110 — 4–7 days)' },
];

const REGION_TO_CODE = {
  'Metro Manila': 'metro-manila',
  Luzon: 'luzon',
  Visayas: 'visayas',
  Mindanao: 'mindanao',
};

const EMPTY_FIELDS = {
  customerEmail: '',
  customerName: '',
  customerPhone: '',
  shippingAddress: '',
  city: '',
  barangay: '',
  postalCode: '',
  orderNote: '',
};

function readPending() {
  try {
    return JSON.parse(sessionStorage.getItem(PENDING_KEY) || 'null');
  } catch {
    return null;
  }
}

function savePending(value) {
  try {
    if (value) sessionStorage.setItem(PENDING_KEY, JSON.stringify(value));
    else sessionStorage.removeItem(PENDING_KEY);
  } catch {
    // In-memory state permits retrying.
  }
}

function ErrorMessage({ children, id }) {
  return (
    <span className="field-error" id={id}>
      {children || ''}
    </span>
  );
}

const FIELD_IDS = {
  customerName: 'ckName',
  customerPhone: 'ckPhone',
  customerEmail: 'ckEmail',
  region: 'ckRegion',
  shippingAddress: 'ckAddress',
  city: 'ckCity',
  barangay: 'ckBarangay',
  postalCode: 'ckPostalCode',
  orderNote: 'ckOrderNote',
  voucherCode: 'ckVoucherCode',
};

const CHECKOUT_FIELD_ORDER = [
  'customerName',
  'customerPhone',
  'customerEmail',
  'region',
  'shippingAddress',
  'city',
  'barangay',
  'postalCode',
  'orderNote',
  'voucherCode',
];

function Field({ label, name, value, onChange, error, optional = false, ...props }) {
  const id = FIELD_IDS[name] || name;
  return (
    <div className={`form-field${error ? ' has-error' : ''}`}>
      <label htmlFor={id}>
        {label} {!optional && <span className="required-star">*</span>}
      </label>
      <input
        id={id}
        name={name}
        value={value}
        onChange={onChange}
        required={!optional}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `err-${id}` : undefined}
        className={error ? 'is-invalid' : ''}
        {...props}
      />
      <ErrorMessage id={`err-${id}`}>{error}</ErrorMessage>
    </div>
  );
}

/* ── Realistic GCash / Maya / Card Interactive Payment Gateway Modal ── */

function PaymentModal({ order, onClose, onUpdate, formatPeso, showToast }) {
  const method = order.paymentMethod || 'gcash';
  const isCard = method === 'card';
  const isMaya = method === 'maya';
  const brandName = isCard ? 'Credit / Debit Card' : isMaya ? 'Maya Wallet' : 'GCash Express Pay';

  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [formErr, setFormErr] = useState('');
  const [session, setSession] = useState(null);
  const [uncertainOutcome, setUncertainOutcome] = useState(null);

  // Wallet inputs (GCash / Maya)
  const [payerMobile, setPayerMobile] = useState(() =>
    sanitizePhPhone(order.customerPhone || '09171234567')
  );
  const [demoOtp] = useState(() =>
    String(Math.floor(100000 + Math.random() * 900000))
  );
  const [otpInput, setOtpInput] = useState('');
  const [mpin, setMpin] = useState('');

  // Card inputs
  const [cardName, setCardName] = useState(() =>
    sanitizePersonName(order.customerName || '')
  );
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');

  const [sessionKey, setSessionKey] = useState(() => {
    const storageKey = `squishies-payment-${order.orderNumber}`;
    try {
      return sessionStorage.getItem(storageKey) || crypto.randomUUID();
    } catch {
      return crypto.randomUUID();
    }
  });

  const storageKey = `squishies-payment-${order.orderNumber}`;
  const demoWalletBalance = 12450;

  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, sessionKey);
    } catch {
      // No-op.
    }
  }, [sessionKey, storageKey]);

  function handleNextWalletStep(event) {
    event.preventDefault();
    setFormErr('');
    if (step === 1) {
      const err = validatePhPhone(payerMobile);
      if (err) {
        setFormErr(err);
        return;
      }
      setStep(2);
      return;
    }
    if (step === 2) {
      if (otpInput.length !== 6) {
        setFormErr('Enter the 6-digit SMS OTP code.');
        return;
      }
      if (otpInput !== demoOtp) {
        setFormErr(`Invalid OTP code. Check the simulated SMS (${demoOtp}).`);
        return;
      }
      setStep(3);
    }
  }

  async function executeSimulation(outcome, detailsPayload = {}) {
    if (busy) return;
    const selectedOutcome = uncertainOutcome || outcome;
    setBusy(true);
    setFormErr('');
    setMessage(
      selectedOutcome === 'success'
        ? `Authorizing ${brandName} payment...`
        : `Simulating ${selectedOutcome} response...`
    );

    try {
      const currentSession =
        session ||
        (await SquishiesAPI.createPaymentSession(
          order.orderNumber,
          sessionKey
        ));

      setSession(currentSession);

      if (currentSession.status !== 'pending') {
        const updatedOrder = await SquishiesAPI.getOrder(order.orderNumber);
        try {
          sessionStorage.removeItem(storageKey);
        } catch {
          // No-op.
        }
        onClose();
        onUpdate(updatedOrder);
        return;
      }

      const result = await SquishiesAPI.simulatePayment(currentSession.sessionId, {
        outcome: selectedOutcome,
        ...detailsPayload,
      });

      try {
        sessionStorage.removeItem(storageKey);
      } catch {
        // No-op.
      }

      onClose();
      onUpdate(result.order);

      if (selectedOutcome === 'success') {
        showToast?.(`${brandName} payment confirmed! Your squishies are moving to To Ship.`);
      } else {
        showToast?.(
          `Payment ${selectedOutcome}. You can retry safely before the reservation expires.`
        );
      }
    } catch (error) {
      setMessage(error.message || 'Payment gateway request failed.');
      if (!error.status || error.status >= 500) {
        setUncertainOutcome(selectedOutcome);
      } else {
        setUncertainOutcome(null);
        setSession(null);
        setSessionKey(crypto.randomUUID());
      }
    } finally {
      setBusy(false);
    }
  }

  function handleConfirmWalletPay(event) {
    event.preventDefault();
    setFormErr('');
    if (mpin.length !== 4 || !/^\d{4}$/.test(mpin)) {
      setFormErr('Enter your 4-digit numeric MPIN to authorize.');
      return;
    }
    executeSimulation('success', {
      payerMobile,
      otpCode: otpInput,
      mpin,
    });
  }

  function handleConfirmCardPay(event) {
    event.preventDefault();
    setFormErr('');
    const digits = sanitizeDigits(cardNumber, 16);
    if (cardName.trim().length < 2) {
      setFormErr('Enter cardholder full name.');
      return;
    }
    if (digits.length < 13) {
      setFormErr('Enter a valid 13–16 digit card number.');
      return;
    }
    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(cardExpiry)) {
      setFormErr('Enter expiry in MM/YY format.');
      return;
    }
    if (cardCvv.length !== 3) {
      setFormErr('Enter the 3-digit CVV.');
      return;
    }
    executeSimulation('success', {
      cardLast4: digits.slice(-4),
    });
  }

  return (
    <div
      className="payment-modal-overlay"
      style={{ display: 'flex' }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !busy) onClose();
      }}
    >
      <div
        className={`payment-modal payment-modal--portal payment-modal--${method}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="paymentModalTitle"
      >
        <div className="payment-modal__header">
          <div className="payment-portal-brand">
            <span className={`payment-portal-pill payment-portal-pill--${method}`}>
              {isCard ? 'CARD' : isMaya ? 'MAYA' : 'GCASH'}
            </span>
            <div>
              <h3 id="paymentModalTitle">{brandName}</h3>
              <small>Merchant: SISO Squishies Collective</small>
            </div>
          </div>
          <button
            type="button"
            className="payment-modal__close"
            aria-label="Close payment portal"
            onClick={onClose}
            disabled={busy}
          >
            ×
          </button>
        </div>

        <div className="payment-modal__body">
          <div className="payment-summary-box payment-summary-box--portal">
            <div>
              <span>Order {order.orderNumber}</span>
              <small>Total Amount Due</small>
            </div>
            <strong>{formatPeso(order.total)}</strong>
          </div>

          {!isCard ? (
            <>
              <div className="wallet-steps-bar" aria-label="Payment authorization steps">
                <span className={step >= 1 ? 'is-active' : ''}>1. Mobile</span>
                <span className={step >= 2 ? 'is-active' : ''}>2. SMS OTP</span>
                <span className={step >= 3 ? 'is-active' : ''}>3. Authorize MPIN</span>
              </div>

              {step === 1 && (
                <form className="payment-portal-form" onSubmit={handleNextWalletStep} noValidate>
                  <div className="form-field">
                    <label htmlFor="payWalletMobile">
                      {isMaya ? 'Maya' : 'GCash'} Registered Mobile Number (Digits Only)
                    </label>
                    <input
                      id="payWalletMobile"
                      type="tel"
                      inputMode="numeric"
                      maxLength={11}
                      placeholder="09171234567"
                      value={payerMobile}
                      onChange={(e) => {
                        setPayerMobile(sanitizePhPhone(e.target.value));
                        setFormErr('');
                      }}
                      required
                    />
                  </div>
                  {formErr && <p className="field-error" role="alert">{formErr}</p>}
                  <button type="submit" className="btn btn--pink btn--full">
                    Send Verification OTP →
                  </button>
                </form>
              )}

              {step === 2 && (
                <form className="payment-portal-form" onSubmit={handleNextWalletStep} noValidate>
                  <div className="sim-sms-toast" role="status">
                    <div>
                      <strong>Simulated SMS Inbox</strong>
                      <span>
                        Your {isMaya ? 'Maya' : 'GCash'} authentication code is{' '}
                        <code className="sim-otp-code">{demoOtp}</code>
                      </span>
                    </div>
                    <button
                      type="button"
                      className="btn btn--outline btn--xs"
                      onClick={() => {
                        setOtpInput(demoOtp);
                        setFormErr('');
                      }}
                    >
                      Autofill OTP
                    </button>
                  </div>

                  <div className="form-field">
                    <label htmlFor="payWalletOtp">Enter 6-Digit SMS OTP (Numbers Only)</label>
                    <input
                      id="payWalletOtp"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="6-digit code"
                      value={otpInput}
                      onChange={(e) => {
                        setOtpInput(sanitizeDigits(e.target.value, 6));
                        setFormErr('');
                      }}
                      required
                    />
                  </div>
                  {formErr && <p className="field-error" role="alert">{formErr}</p>}
                  <div className="payment-portal-actions">
                    <button type="button" className="btn btn--outline" onClick={() => setStep(1)}>
                      ← Back
                    </button>
                    <button type="submit" className="btn btn--pink">
                      Verify OTP →
                    </button>
                  </div>
                </form>
              )}

              {step === 3 && (
                <form className="payment-portal-form" onSubmit={handleConfirmWalletPay} noValidate>
                  <div className="wallet-balance-card">
                    <div>
                      <span>Simulated {isMaya ? 'Maya' : 'GCash'} Balance</span>
                      <strong>{formatPeso(demoWalletBalance)}</strong>
                    </div>
                    <div>
                      <span>Remaining After Pay</span>
                      <strong>{formatPeso(Math.max(0, demoWalletBalance - Number(order.total || 0)))}</strong>
                    </div>
                  </div>

                  <div className="form-field">
                    <label htmlFor="payWalletMpin">Enter 4-Digit MPIN (Any 4 Digits for Demo)</label>
                    <input
                      id="payWalletMpin"
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      placeholder="••••"
                      value={mpin}
                      onChange={(e) => {
                        setMpin(sanitizeDigits(e.target.value, 4));
                        setFormErr('');
                      }}
                      required
                    />
                  </div>
                  {formErr && <p className="field-error" role="alert">{formErr}</p>}
                  {message && <p className="payment-status-msg" role="status">{message}</p>}
                  <div className="payment-portal-actions">
                    <button type="button" className="btn btn--outline" onClick={() => setStep(2)} disabled={busy}>
                      ← Back
                    </button>
                    <button
                      type="submit"
                      className="btn btn--pink"
                      disabled={busy && uncertainOutcome !== 'success'}
                    >
                      {busy ? 'Authorizing...' : `Pay ${formatPeso(order.total)}`}
                    </button>
                  </div>
                </form>
              )}
            </>
          ) : (
            <form className="payment-portal-form" onSubmit={handleConfirmCardPay} noValidate>
              <div className="form-field">
                <label htmlFor="payCardName">Cardholder Name (Letters Only)</label>
                <input
                  id="payCardName"
                  type="text"
                  placeholder="JUANA DELA CRUZ"
                  value={cardName}
                  onChange={(e) => {
                    setCardName(sanitizePersonName(e.target.value));
                    setFormErr('');
                  }}
                  required
                />
              </div>
              <div className="form-field">
                <label htmlFor="payCardNumber">Card Number (Digits Only)</label>
                <input
                  id="payCardNumber"
                  type="text"
                  inputMode="numeric"
                  maxLength={19}
                  placeholder="4242 4242 4242 4242"
                  value={cardNumber}
                  onChange={(e) => {
                    setCardNumber(formatCardNumber(e.target.value));
                    setFormErr('');
                  }}
                  required
                />
              </div>
              <div className="form-row">
                <div className="form-field">
                  <label htmlFor="payCardExpiry">Expiry (MM/YY)</label>
                  <input
                    id="payCardExpiry"
                    type="text"
                    inputMode="numeric"
                    maxLength={5}
                    placeholder="12/29"
                    value={cardExpiry}
                    onChange={(e) => {
                      setCardExpiry(formatCardExpiry(e.target.value));
                      setFormErr('');
                    }}
                    required
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="payCardCvv">CVV (3 Digits)</label>
                  <input
                    id="payCardCvv"
                    type="password"
                    inputMode="numeric"
                    maxLength={3}
                    placeholder="123"
                    value={cardCvv}
                    onChange={(e) => {
                      setCardCvv(sanitizeDigits(e.target.value, 3));
                      setFormErr('');
                    }}
                    required
                  />
                </div>
              </div>
              {formErr && <p className="field-error" role="alert">{formErr}</p>}
              {message && <p className="payment-status-msg" role="status">{message}</p>}
              <button
                type="submit"
                className="btn btn--pink btn--full"
                disabled={busy && uncertainOutcome !== 'success'}
              >
                {busy ? 'Processing Card...' : `Pay ${formatPeso(order.total)} Now`}
              </button>
            </form>
          )}

          <details className="payment-demo-edge-controls">
            <summary>Demo Edge-Case Simulator (Decline / Cancel)</summary>
            <p>Test how the storefront handles wallet declines or buyer cancellations cleanly:</p>
            <div className="payment-edge-buttons">
              <button
                type="button"
                className="btn btn--outline btn--xs"
                disabled={busy && uncertainOutcome !== 'declined'}
                onClick={() => executeSimulation('declined')}
              >
                Simulate Declined
              </button>
              <button
                type="button"
                className="btn btn--outline btn--xs"
                disabled={busy && uncertainOutcome !== 'cancelled'}
                onClick={() => executeSimulation('cancelled')}
              >
                Simulate Cancelled
              </button>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}

/* ── Official Digital & Printable E-Receipt Modal ────────────────────── */

function DigitalReceiptModal({ order, formatPeso, onClose }) {
  const receiptDate = order.paidAt || order.updatedAt || order.createdAt;
  const gatewayRef = order.paymentReference || order.trackingNumber;
  const payerAccount = order.paymentDetails?.maskedAccount;

  return (
    <div
      className="payment-modal-overlay"
      style={{ display: 'flex' }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose();
      }}
    >
      <div
        className="payment-modal digital-receipt-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="digitalReceiptTitle"
      >
        <div className="payment-modal__header">
          <h3 id="digitalReceiptTitle">Official Squishies E-Receipt</h3>
          <button
            type="button"
            className="payment-modal__close"
            aria-label="Close e-receipt"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="digital-receipt-sheet">
          <div className="digital-receipt-brand">
            <strong>SISO Squishies Collective</strong>
            <span>Authentic Slow-Rising Sensory Store • Manila, PH</span>
            <small>Official Acknowledgement Receipt (OR-{order.orderNumber.slice(-8)})</small>
          </div>

          <div className="digital-receipt-meta">
            <div><span>Order Number</span><strong>{order.orderNumber}</strong></div>
            <div><span>Tracking Code</span><strong>{order.trackingNumber}</strong></div>
            <div><span>Date Issued</span><strong>{new Date(receiptDate).toLocaleString('en-PH')}</strong></div>
            <div><span>Order Status</span><strong>{order.status}</strong></div>
            <div>
              <span>Payment Method</span>
              <strong>
                {order.paymentMethod.toUpperCase()}
                {payerAccount ? ` (${payerAccount})` : ''}
              </strong>
            </div>
            <div><span>Payment Status</span><strong>{order.paymentStatus}</strong></div>
            <div><span>Gateway Ref</span><strong>{gatewayRef}</strong></div>
            <div><span>Buyer</span><strong>{order.customerName} ({order.customerPhone})</strong></div>
          </div>

          <div className="digital-receipt-items">
            {(order.items || []).map((item, idx) => (
              <div key={`${item.slug}-${idx}`} className="digital-receipt-item">
                <span>{item.name} × {item.quantity}</span>
                <strong>{formatPeso(item.subtotal)}</strong>
              </div>
            ))}
          </div>

          <div className="digital-receipt-totals">
            <div><span>Merchandise Subtotal</span><span>{formatPeso(order.subtotal)}</span></div>
            <div><span>Shipping Fee</span><span>{order.shippingFee ? formatPeso(order.shippingFee) : 'FREE'}</span></div>
            {order.voucherDiscount > 0 && (
              <div><span>Voucher Discount ({order.voucherCode})</span><span>−{formatPeso(order.voucherDiscount)}</span></div>
            )}
            <div className="is-grand">
              <strong>Total Amount</strong>
              <strong>{formatPeso(order.total)}</strong>
            </div>
          </div>

          <div className="digital-receipt-footer">
            <p>Shipped to: {order.shippingAddress}, Brgy. {order.barangay}, {order.city}, {order.postalCode}</p>
            <div className="digital-receipt-actions">
              <button
                type="button"
                className="btn btn--pink"
                onClick={() => window.print()}
              >
                Print / Save PDF Receipt
              </button>
              <button
                type="button"
                className="btn btn--outline"
                onClick={onClose}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Shopee-Style Live Order Receipt & Courier Delivery Simulator ───── */

function OrderReceipt({
  order,
  formatPeso,
  onRefresh,
  onCancel,
  onPay,
  onReview,
  onAdvanceDelivery,
  advanceBusy,
  onOpenReceipt,
}) {
  const stage = order.deliveryStage || 'preparing';
  const isCancelled = order.status === 'Cancelled' || order.status === 'Expired';
  const hasShipped =
    ['in_transit', 'out_for_delivery', 'delivered'].includes(stage) ||
    order.status === 'Shipped' ||
    order.status === 'Completed' ||
    (order.events || []).some((e) => e.status === 'Shipped');
  const isOutForDelivery =
    ['out_for_delivery', 'delivered'].includes(stage) ||
    order.status === 'Completed';
  const isCompleted = stage === 'delivered' || order.status === 'Completed';
  const isPaymentDone =
    ['Paid', 'Refunded'].includes(order.paymentStatus) || order.paymentMethod === 'cod';

  const milestones = [
    ['Order Placed', true],
    [order.paymentMethod === 'cod' ? 'COD Confirmed' : 'Paid Online', isPaymentDone],
    ['In Transit', hasShipped],
    ['Out for Delivery', isOutForDelivery],
    ['Completed', isCompleted],
  ];

  // Determine next logical real-life Shopee delivery progression step
  let nextDeliveryAction = null;
  if (!isCancelled && !isCompleted) {
    if (order.status === 'To Ship') {
      nextDeliveryAction = {
        stage: 'shipped',
        label: 'Dispatch Parcel (Mark Shipped)',
        helper: 'Hand over parcel to SISO Express / J&T courier hub.',
      };
    } else if (order.status === 'Shipped' && stage !== 'out_for_delivery') {
      nextDeliveryAction = {
        stage: 'out_for_delivery',
        label: 'Mark Out for Delivery',
        helper: 'Courier rider departed local delivery hub toward buyer.',
      };
    } else if (order.status === 'Shipped' && stage === 'out_for_delivery') {
      nextDeliveryAction = {
        stage: 'completed',
        label:
          order.paymentMethod === 'cod'
            ? 'Confirm Delivery & Collect COD'
            : 'Order Received (Complete Order)',
        helper: 'Buyer receives squishies, completing transaction & unlocking verified review.',
      };
    }
  }

  const displayStatus = stage === 'out_for_delivery' ? 'Out for Delivery' : order.status;
  const statusSlug = String(displayStatus || '').toLowerCase().replace(/\s+/g, '-');
  const totalQuantity = (order.items || []).reduce(
    (sum, item) => sum + Number(item.quantity || 1),
    0
  );

  const statusHeadline = isCancelled
    ? 'This order was cancelled'
    : isCompleted
      ? 'Parcel delivered & order completed'
      : stage === 'out_for_delivery'
        ? 'Your squishy parcel is out for delivery'
        : hasShipped
          ? 'Your squishy parcel is in transit'
          : order.status === 'To Pay'
            ? 'Awaiting payment authorization'
            : 'Preparing your squishy parcel for dispatch';

  return (
    <div className="shopee-order-view">
      {/* Top Breadcrumb Bar */}
      <div className="order-top-nav">
        <Link to="/account?mode=orders" className="order-nav-back">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>My Purchases</span>
        </Link>
        <Link to="/shop.html" className="order-nav-shop">
          <span>Continue Shopping</span>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>

      <div className="shopee-receipt-card">
        {/* Hero Status Banner */}
        <div className="shopee-receipt-header order-hub-banner">
          <div className="order-hub-banner__info">
            <div className="order-hub-banner__badges">
              <div className={`shopee-status-badge badge-${statusSlug}`}>
                <span className="status-dot" aria-hidden="true" />
                <span>Order Status: {displayStatus}</span>
              </div>
              <span className="order-payment-pill">
                {order.paymentMethod.toUpperCase()} • {order.paymentStatus}
              </span>
            </div>

            <h1 className="order-hub-banner__title">{statusHeadline}</h1>

            <div className="order-meta-pills">
              <p className="shopee-order-ref">
                <span>Order Reference:</span>
                <code>{order.orderNumber}</code>
              </p>
              <p className="shopee-tracking-ref">
                <span>Tracking Code:</span>
                <code>{order.trackingNumber}</code>
              </p>
            </div>
          </div>

          <div className="shopee-actions order-hub-banner__actions">
            {order.canPay && (
              <button type="button" className="btn btn--pink btn--sm" onClick={onPay}>
                Pay Now via {order.paymentMethod.toUpperCase()} →
              </button>
            )}
            <button type="button" className="btn btn--outline btn--sm" onClick={onOpenReceipt}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <rect x="6" y="14" width="12" height="8" rx="1" stroke="currentColor" strokeWidth="2" />
              </svg>
              <span>View / Print E-Receipt</span>
            </button>
            <button type="button" className="btn btn--outline btn--sm" onClick={onRefresh}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M21 12a9 9 0 1 1-2.64-6.36L21 8" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M21 3v5h-5" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>Refresh Status</span>
            </button>
            {order.canCancel && (
              <button type="button" className="btn btn--danger btn--sm" onClick={onCancel}>
                Cancel Order
              </button>
            )}
          </div>
        </div>

        {/* 5-Step Shopee Fulfillment Progress Tracker */}
        <div className="order-tracker-panel">
          <div className="shopee-timeline shopee-timeline--five">
            {milestones.map(([label, complete], index) => {
              const isCurrent =
                complete &&
                (index === milestones.length - 1 || !milestones[index + 1][1]);
              return (
                <div
                  className={`timeline-step${complete ? ' is-complete' : ''}${isCurrent ? ' is-current' : ''}`}
                  key={label}
                >
                  <div className="step-icon">
                    {complete ? (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      index + 1
                    )}
                  </div>
                  <div className="timeline-step__text">
                    <small>Step {index + 1}</small>
                    <span>{label}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {nextDeliveryAction && (
            <div className="delivery-simulator-bar">
              <div className="delivery-simulator-bar__info">
                <span className="delivery-sim-tag">Live Logistics Simulator</span>
                <strong>
                  {order.status === 'To Ship'
                    ? 'Ready for courier pickup'
                    : stage === 'out_for_delivery'
                      ? 'Rider is arriving at buyer address'
                      : 'Parcel is moving through sortation hub'}
                </strong>
                <small>{nextDeliveryAction.helper}</small>
              </div>
              <button
                type="button"
                className="btn btn--pink"
                disabled={advanceBusy}
                onClick={() => onAdvanceDelivery(nextDeliveryAction.stage)}
              >
                {advanceBusy ? 'Updating Logistics...' : `${nextDeliveryAction.label} →`}
              </button>
            </div>
          )}
        </div>

        {/* 2-Column Main Order Grid */}
        <div className="order-details-grid">
          <div className="order-details-main">
            {/* Ordered Items & Financial Breakdown */}
            <div className="shopee-financial-box order-section-card">
              <div className="order-section-head">
                <div className="order-section-icon" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                    <path d="M3 6h18M16 10a4 4 0 0 1-8 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </div>
                <div>
                  <h3>Ordered Squishies &amp; Payment Breakdown</h3>
                  <p>{totalQuantity} {totalQuantity === 1 ? 'item' : 'items'} in this parcel</p>
                </div>
              </div>

              <div className="order-items-breakdown">
                {(order.items || []).map((item, index) => (
                  <div
                    className="order-line-item"
                    key={`${item.slug || item.name}-${index}`}
                  >
                    <div className="order-line-item__left">
                      <span className="order-line-item__qty">{item.quantity}×</span>
                      <div>
                        <strong>{item.name}</strong>
                        <small>
                          Unit price: {formatPeso(item.unitPrice || item.subtotal / (item.quantity || 1))}
                        </small>
                      </div>
                    </div>
                    <strong className="order-line-item__price">{formatPeso(item.subtotal)}</strong>
                  </div>
                ))}
              </div>

              <div className="order-totals-breakdown">
                <FinancialRow label="Merchandise Subtotal" value={formatPeso(order.subtotal)} />
                <FinancialRow
                  label="Delivery Shipping"
                  value={order.shippingFee ? formatPeso(order.shippingFee) : 'Free'}
                  highlightFree={!order.shippingFee}
                />
                {order.voucherDiscount > 0 && (
                  <FinancialRow
                    label={`Voucher Discount (${order.voucherCode})`}
                    value={`−${formatPeso(order.voucherDiscount)}`}
                    discount
                  />
                )}
                {order.shippingDiscount > 0 && (
                  <FinancialRow
                    label="Shipping savings (already included)"
                    value={`−${formatPeso(order.shippingDiscount)}`}
                    discount
                  />
                )}
                <FinancialRow
                  label="Total Paid / Payable"
                  value={formatPeso(order.total)}
                  total
                />
              </div>
            </div>

            {/* Courier & Order Activity Log */}
            <details className="order-activity order-section-card" open>
              <summary className="order-section-head order-activity__summary">
                <div className="order-section-icon" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <rect x="1" y="3" width="15" height="13" rx="2" stroke="currentColor" strokeWidth="2" />
                    <path d="M16 8h4l3 3v5h-7V8z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                    <circle cx="5.5" cy="18.5" r="2.5" stroke="currentColor" strokeWidth="2" />
                    <circle cx="18.5" cy="18.5" r="2.5" stroke="currentColor" strokeWidth="2" />
                  </svg>
                </div>
                <div>
                  <h3>Courier &amp; Order Timeline</h3>
                  <p>Live timestamped fulfillment and rider dispatch events</p>
                </div>
              </summary>
              <ol className="order-timeline-list">
                {(order.events || []).map((event, index) => (
                  <li key={`${event.timestamp}-${index}`} className="order-timeline-item">
                    <span className="order-timeline-dot" aria-hidden="true" />
                    <div className="order-timeline-content">
                      <div className="order-timeline-top">
                        <strong>{event.status}</strong>
                        <time>{new Date(event.timestamp).toLocaleString('en-PH')}</time>
                      </div>
                      <p>{event.description}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </details>
          </div>

          {/* Right Column: Shipping Address, Payment Details & Verified Review */}
          <div className="order-details-side">
            <div className="shopee-info-grid order-side-stack">
              <div className="shopee-info-box order-section-card">
                <div className="order-section-head">
                  <div className="order-section-icon" aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path d="M12 21s-7-5.6-7-11a7 7 0 1 1 14 0c0 5.4-7 11-7 11z" stroke="currentColor" strokeWidth="2" />
                      <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="2" />
                    </svg>
                  </div>
                  <div>
                    <h4>Shipping Address</h4>
                    <p>Verified Philippine recipient &amp; delivery zone</p>
                  </div>
                </div>
                <div className="order-info-rows">
                  <div className="order-info-kv">
                    <span>Recipient</span>
                    <strong>{order.customerName}</strong>
                  </div>
                  <div className="order-info-kv">
                    <span>Contact Phone</span>
                    <strong>{order.customerPhone}</strong>
                  </div>
                  <div className="order-info-kv order-info-kv--block">
                    <span>Delivery Street &amp; Barangay</span>
                    <strong>
                      {order.shippingAddress}, Brgy. {order.barangay}, {order.city}, {order.postalCode}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="shopee-info-box order-section-card">
                <div className="order-section-head">
                  <div className="order-section-icon" aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <rect x="2" y="5" width="20" height="14" rx="2.5" stroke="currentColor" strokeWidth="2" />
                      <path d="M2 10h20M6 15h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div>
                    <h4>Payment Details</h4>
                    <p>Transaction method &amp; gateway audit record</p>
                  </div>
                </div>
                <div className="order-info-rows">
                  <div className="order-info-kv">
                    <span>Method</span>
                    <strong>
                      {order.paymentMethod.toUpperCase()}
                      {order.paymentDetails?.maskedAccount
                        ? ` (${order.paymentDetails.maskedAccount})`
                        : ''}
                    </strong>
                  </div>
                  <div className="order-info-kv">
                    <span>Payment Status</span>
                    <strong className={`payment-status-chip is-${String(order.paymentStatus || '').toLowerCase()}`}>
                      {order.paymentStatus}
                    </strong>
                  </div>
                  {order.paymentReference && (
                    <div className="order-info-kv">
                      <span>Gateway Ref</span>
                      <code className="order-gateway-code">{order.paymentReference}</code>
                    </div>
                  )}
                  {order.canPay && order.expiresAt && (
                    <div className="order-info-kv">
                      <span>Reservation Expires</span>
                      <strong>{new Date(order.expiresAt).toLocaleString('en-PH')}</strong>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {order.status === 'Completed' && (
              <ReviewForm order={order} onReview={onReview} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FinancialRow({ label, value, total = false, discount = false, highlightFree = false }) {
  return (
    <div
      className={`financial-row${total ? ' financial-row--total' : ''}${discount ? ' financial-row--discount' : ''}`}
    >
      <span>{label}</span>
      {total ? (
        <strong>{value}</strong>
      ) : (
        <span className={highlightFree ? 'financial-free-badge' : ''}>{value}</span>
      )}
    </div>
  );
}

function ReviewForm({ order, onReview }) {
  const [productSlug, setProductSlug] = useState(order.items?.[0]?.slug || '');
  const [reviewerName, setReviewerName] = useState(() =>
    sanitizePersonName(order.customerName || '')
  );
  const [rating, setRating] = useState('5');
  const [comment, setComment] = useState('');
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    setIsError(false);

    try {
      await onReview({
        orderNumber: order.orderNumber,
        productSlug,
        reviewerName: reviewerName.trim(),
        rating: Number(rating),
        comment: comment.trim(),
      });
      setMessage('Thank you! Your verified review was published.');
      setIsError(false);
      setComment('');
    } catch (error) {
      setMessage(error.message || 'Could not submit your review.');
      setIsError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="checkout-card squishy-glass-card order-section-card order-review-card" onSubmit={submit}>
      <div className="order-section-head">
        <div className="order-section-icon order-section-icon--star" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        </div>
        <div>
          <h2>Rate Your Verified Purchase</h2>
          <p>Share how slow-rising your squishy is with fellow collectors</p>
        </div>
      </div>

      <div className="form-field">
        <label htmlFor="reviewProduct">Product</label>
        <select
          id="reviewProduct"
          className="form-select"
          value={productSlug}
          onChange={(event) => setProductSlug(event.target.value)}
          required
        >
          {(order.items || []).map((item, index) => (
            <option key={`${item.slug}-${index}`} value={item.slug}>
              {item.name}
            </option>
          ))}
        </select>
      </div>

      <div className="form-field">
        <label htmlFor="reviewName">Public Display Name</label>
        <input
          id="reviewName"
          maxLength={60}
          required
          value={reviewerName}
          onChange={(event) => setReviewerName(event.target.value)}
        />
      </div>

      <div className="form-field">
        <label htmlFor="reviewRating">Rating</label>
        <div className="review-star-pills" role="group" aria-label="Choose star rating">
          {[5, 4, 3, 2, 1].map((num) => {
            const active = String(rating) === String(num);
            return (
              <button
                key={num}
                type="button"
                className={`review-star-pill${active ? ' is-active' : ''}`}
                onClick={() => setRating(String(num))}
              >
                <span className="review-star-pill__stars">{'★'.repeat(num)}</span>
                <span>{num}.0</span>
              </button>
            );
          })}
        </div>
        <select
          id="reviewRating"
          className="form-select review-select-fallback"
          value={rating}
          onChange={(event) => setRating(event.target.value)}
        >
          {[5, 4, 3, 2, 1].map((number) => (
            <option key={number} value={number}>
              {number} stars
            </option>
          ))}
        </select>
      </div>

      <div className="form-field">
        <label htmlFor="reviewComment">Review</label>
        <textarea
          id="reviewComment"
          minLength={3}
          maxLength={1000}
          placeholder="How slow-rising was your squishy? Share with fellow collectors!"
          required
          value={comment}
          onChange={(event) => setComment(event.target.value)}
        />
      </div>

      {message && (
        <p className={`review-status-banner${isError ? ' is-error' : ' is-success'}`} role="status">
          {message}
        </p>
      )}
      <button className="btn btn--pink btn--full" type="submit" disabled={busy}>
        {busy ? 'Submitting…' : 'Submit Verified Review'}
      </button>
    </form>
  );
}

/* ── Main Shopee-Style Checkout & Order Tracking Page ────────────────── */

export default function Checkout() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, authenticated } = useAuth();
  const {
    cart,
    clearCart,
    formatPeso,
    setLocked,
    showToast,
  } = useCart();

  const orderNumber = searchParams.get('order');
  const [pending, setPending] = useState(readPending);
  const [order, setOrder] = useState(null);
  const [fields, setFields] = useState(EMPTY_FIELDS);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [region, setRegion] = useState('metro-manila');
  const [voucherText, setVoucherText] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('gcash');
  const [quote, setQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [advanceBusy, setAdvanceBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('Change of mind');
  const [cancelError, setCancelError] = useState('');
  const [cancelBusy, setCancelBusy] = useState(false);
  const [voucherDirty, setVoucherDirty] = useState(false);
  const [availableVouchers, setAvailableVouchers] = useState(null);
  const [mobileSummaryOpen, setMobileSummaryOpen] = useState(false);

  const prefilledForUserRef = useRef(null);

  useEffect(() => {
    let active = true;
    SquishiesAPI.fetchAvailableVouchers?.()
      .then((list) => {
        if (active && Array.isArray(list)) {
          setAvailableVouchers(list);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const applySavedAddress = useCallback(() => {
    if (!user) return;
    const saved = user.defaultAddress || {};
    setFields((current) => ({
      ...current,
      customerEmail: sanitizeEmail(user.email || current.customerEmail),
      customerName: sanitizePersonName(saved.recipientName || current.customerName),
      customerPhone: sanitizePhPhone(saved.phone || user.phone || current.customerPhone),
      shippingAddress: sanitizeStreetAddress(saved.shippingAddress || current.shippingAddress),
      city: sanitizeCityName(saved.city || current.city),
      barangay: sanitizeBarangayName(saved.barangay || current.barangay),
      postalCode: sanitizeDigits(saved.postalCode || current.postalCode, FIELD_LIMITS.postalCode),
    }));
    if (saved.region && ['metro-manila', 'luzon', 'visayas', 'mindanao'].includes(saved.region)) {
      setRegion(saved.region);
    } else if (saved.region && REGION_TO_CODE[saved.region]) {
      setRegion(REGION_TO_CODE[saved.region]);
    }
    setFieldErrors({});
  }, [user]);

  // Auto-prefill Shopee address once when user logs in and form is untouched
  useEffect(() => {
    if (!authenticated || !user) return;
    if (prefilledForUserRef.current === user.id) return;
    prefilledForUserRef.current = user.id;

    const isFormEmpty =
      !fields.customerEmail &&
      !fields.customerName &&
      !fields.customerPhone &&
      !fields.shippingAddress &&
      !fields.city &&
      !fields.barangay &&
      !fields.postalCode;

    if (isFormEmpty) {
      applySavedAddress();
    }
  }, [authenticated, user, fields, applySavedAddress]);

  const cartSignature = useMemo(
    () => JSON.stringify((cart || []).map((item) => ({
      slug: item.slug,
      quantity: item.qty,
    }))),
    [cart]
  );

  useEffect(() => {
    document.title = orderNumber ? 'Order Receipt — Squishies' : 'Checkout — Squishies';
  }, [orderNumber]);

  useEffect(() => {
    setLocked(Boolean(pending) || submitting);
    return () => setLocked(false);
  }, [pending, submitting, setLocked]);

  useEffect(() => {
    if (!orderNumber) {
      setOrder(null);
      return;
    }

    let cancelled = false;
    setOrder(null);
    setError('');

    SquishiesAPI.getOrder(orderNumber)
      .then((result) => {
        if (!cancelled) setOrder(result);
      })
      .catch((fetchError) => {
        if (!cancelled) setError(fetchError.message || 'Could not load this order.');
      });

    return () => {
      cancelled = true;
    };
  }, [orderNumber]);

  useEffect(() => {
    if (orderNumber || pending || !(cart || []).length) {
      setQuote(null);
      setQuoteLoading(false);
      return;
    }

    let cancelled = false;
    setQuoteLoading(true);
    setError('');

    SquishiesAPI.quote({
      items: (cart || []).map((item) => ({
        slug: item.slug,
        quantity: item.qty,
      })),
      region,
      voucherCode: appliedVoucher,
    })
      .then((result) => {
        if (cancelled) return;
        setQuote(result);
        setFieldErrors((current) => {
          if (!current.voucherCode) return current;
          const next = { ...current };
          delete next.voucherCode;
          return next;
        });
        setPaymentMethod((current) =>
          result.paymentMethods?.includes(current)
            ? current
            : result.paymentMethods?.includes('gcash')
              ? 'gcash'
              : result.paymentMethods?.[0] || 'cod'
        );
      })
      .catch(async (quoteError) => {
        if (cancelled) return;
        const msg = quoteError.message || 'Could not load checkout totals.';
        if (appliedVoucher) {
          setAppliedVoucher('');
          setFieldErrors((current) => ({
            ...current,
            voucherCode: quoteError.fields?.voucherCode || msg,
          }));
          try {
            const fallbackResult = await SquishiesAPI.quote({
              items: (cart || []).map((item) => ({
                slug: item.slug,
                quantity: item.qty,
              })),
              region,
              voucherCode: '',
            });
            if (!cancelled) {
              setQuote(fallbackResult);
            }
          } catch {
            // Keep error displayed if base quote also fails.
          }
        } else {
          setError(msg);
          setFieldErrors(quoteError.fields || {});
        }
      })
      .finally(() => {
        if (!cancelled) setQuoteLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [orderNumber, pending, cartSignature, region, appliedVoucher, cart]);

  /**
   * Strict per-field sanitization and max-length enforcement: prevents invalid
   * characters or excessive string lengths in recipient name, email, phone,
   * street address, city, barangay, postal code, and order note.
   */
  const updateField = useCallback((event) => {
    const { name, value } = event.target;
    let cleaned = value;
    if (name === 'customerPhone') {
      cleaned = sanitizePhPhone(value);
    } else if (name === 'postalCode') {
      cleaned = sanitizeDigits(value, FIELD_LIMITS.postalCode);
    } else if (name === 'customerName') {
      cleaned = sanitizePersonName(value, FIELD_LIMITS.name);
    } else if (name === 'customerEmail') {
      cleaned = sanitizeEmail(value, FIELD_LIMITS.email);
    } else if (name === 'shippingAddress') {
      cleaned = sanitizeStreetAddress(value, FIELD_LIMITS.address);
    } else if (name === 'city') {
      cleaned = sanitizeCityName(value, FIELD_LIMITS.city);
    } else if (name === 'barangay') {
      cleaned = sanitizeBarangayName(value, FIELD_LIMITS.barangay);
    } else if (name === 'orderNote') {
      cleaned = String(value || '').slice(0, FIELD_LIMITS.orderNote);
    }

    setFields((current) => ({ ...current, [name]: cleaned }));
    setFieldErrors((current) => {
      if (!current[name]) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
  }, []);

  function applyVoucher() {
    setAppliedVoucher(voucherText.trim().slice(0, FIELD_LIMITS.voucherCode).toUpperCase());
    setVoucherDirty(false);
    setError('');
  }

  function applyQuickVoucher(code) {
    setVoucherText(code);
    setAppliedVoucher(code.trim().toUpperCase());
    setVoucherDirty(false);
    setError('');
  }

  function clearAppliedVoucher() {
    setVoucherText('');
    setAppliedVoucher('');
    setVoucherDirty(false);
    setFieldErrors((current) => {
      const next = { ...current };
      delete next.voucherCode;
      return next;
    });
    setError('');
  }

  function handleVoucherChange(event) {
    const cleaned = String(event.target.value || '')
      .replace(/[^A-Za-z0-9_-]/g, '')
      .slice(0, FIELD_LIMITS.voucherCode)
      .toUpperCase();
    setVoucherText(cleaned);
    setVoucherDirty(true);
    setFieldErrors((current) => {
      if (!current.voucherCode) return current;
      const next = { ...current };
      delete next.voucherCode;
      return next;
    });
  }

  function handleAcceptedOrder(acceptedOrder) {
    savePending(null);
    setPending(null);
    clearCart();
    setOrder(acceptedOrder);
    setError('');
    if (acceptedOrder.canPay && acceptedOrder.paymentMethod !== 'cod') {
      setPaymentOpen(true);
    }
    navigate(`/checkout.html?order=${encodeURIComponent(acceptedOrder.orderNumber)}`, {
      replace: true,
    });
  }

  function mapServerErrors(serverError) {
    const normalizedFields = {};
    if (Array.isArray(serverError?.fields)) {
      for (const issue of serverError.fields) {
        if (issue?.field && !normalizedFields[issue.field]) {
          normalizedFields[issue.field] = issue.message;
        }
      }
    } else if (serverError?.fields && typeof serverError.fields === 'object') {
      Object.assign(normalizedFields, serverError.fields);
    }
    setFieldErrors(normalizedFields);
    const firstFieldError = CHECKOUT_FIELD_ORDER.map((k) => normalizedFields[k]).find(Boolean);
    setError(firstFieldError || serverError.message || 'Something went wrong.');
    scrollToFirstInvalidField(
      normalizedFields,
      CHECKOUT_FIELD_ORDER,
      FIELD_IDS,
      '#checkoutError'
    );
  }

  async function placeOrder(event) {
    event.preventDefault();
    if (submitting) return;

    if (pending?.payload && pending?.key) {
      await sendOrder(pending.payload, pending.key);
      return;
    }

    // Strict client-side verification mirroring server/validation.js in top-to-bottom visual order
    const rawErrors = validateCheckoutFields({
      name: fields.customerName,
      email: fields.customerEmail,
      phone: fields.customerPhone,
      address: fields.shippingAddress,
      city: fields.city,
      barangay: fields.barangay,
      postalCode: fields.postalCode,
    });

    const mappedErrors = {};
    if (rawErrors.name) mappedErrors.customerName = rawErrors.name;
    if (rawErrors.phone) mappedErrors.customerPhone = rawErrors.phone;
    if (rawErrors.email) mappedErrors.customerEmail = rawErrors.email;
    if (rawErrors.address) mappedErrors.shippingAddress = rawErrors.address;
    if (rawErrors.city) mappedErrors.city = rawErrors.city;
    if (rawErrors.barangay) mappedErrors.barangay = rawErrors.barangay;
    if (rawErrors.postalCode) mappedErrors.postalCode = rawErrors.postalCode;

    if (Object.keys(mappedErrors).length > 0) {
      setFieldErrors(mappedErrors);
      const firstOrderedError = CHECKOUT_FIELD_ORDER.map((k) => mappedErrors[k]).find(Boolean);
      setError(firstOrderedError || Object.values(mappedErrors)[0]);
      scrollToFirstInvalidField(
        mappedErrors,
        CHECKOUT_FIELD_ORDER,
        FIELD_IDS,
        '#checkoutError'
      );
      return;
    }

    if (!quote) {
      setError('Please refresh your totals before placing your order.');
      scrollToFirstInvalidField({}, CHECKOUT_FIELD_ORDER, FIELD_IDS, '#checkoutError');
      return;
    }

    const payload = {
      quoteId: quote.quoteId,
      paymentMethod,
      ...Object.fromEntries(
        Object.entries(fields).map(([key, value]) => [key, String(value || '').trim()])
      ),
    };

    const key = crypto.randomUUID();
    const saved = { key, payload };
    savePending(saved);
    setPending(saved);
    await sendOrder(payload, key);
  }

  async function sendOrder(payload, key) {
    setSubmitting(true);
    setError('');
    setFieldErrors({});

    try {
      const result = await SquishiesAPI.placeOrder(payload, key);
      handleAcceptedOrder(result);
    } catch (submitError) {
      if (
        submitError.status >= 400 &&
        submitError.status < 500 &&
        submitError.status !== 429
      ) {
        savePending(null);
        setPending(null);

        if (
          ['QUOTE_EXPIRED', 'PRICE_CHANGED', 'OUT_OF_STOCK', 'QUOTE_USED'].includes(
            submitError.code
          )
        ) {
          setQuote(null);
        }
      }
      mapServerErrors(submitError);
    } finally {
      setSubmitting(false);
    }
  }

  async function refreshOrder() {
    if (!order) return;
    setError('');
    try {
      setOrder(await SquishiesAPI.getOrder(order.orderNumber));
    } catch (refreshError) {
      setError(refreshError.message || 'Could not refresh order status.');
    }
  }

  async function advanceDelivery(targetStage) {
    if (!order || advanceBusy) return;
    setAdvanceBusy(true);
    setError('');
    try {
      const updated = await SquishiesAPI.advanceDemoDelivery(order.orderNumber, targetStage);
      setOrder(updated);
      showToast?.(
        targetStage === 'completed'
          ? 'Order marked Completed! Digital Official Receipt & verified review are now unlocked.'
          : targetStage === 'out_for_delivery'
            ? 'Rider is Out for Delivery!'
            : 'Parcel dispatched to courier hub!'
      );
    } catch (advError) {
      setError(advError.message || 'Could not advance delivery status.');
    } finally {
      setAdvanceBusy(false);
    }
  }

  async function cancelOrder(event) {
    event.preventDefault();
    setCancelBusy(true);
    setCancelError('');

    try {
      const updated = await SquishiesAPI.cancelOrder(order.orderNumber, cancelReason);
      setOrder(updated);
      setCancelOpen(false);
    } catch (cancelRequestError) {
      setCancelError(cancelRequestError.message || 'Could not cancel this order.');
    } finally {
      setCancelBusy(false);
    }
  }

  async function submitReview(review) {
    return SquishiesAPI.submitReview(review);
  }

  if (orderNumber && !order) {
    return (
      <main className="checkout-jelly">
        <div className="container checkout-page">
          <div className="checkout-empty squishy-checkout-empty">
            <h2>{error ? 'Could Not Load Order' : 'Loading Your Squishy Order…'}</h2>
            <p>{error || `Fetching live status and tracking details for ${orderNumber}…`}</p>
            {error && (
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button className="btn btn--pink" onClick={() => window.location.reload()}>
                  Retry loading order
                </button>
                <Link to="/account?mode=orders" className="btn btn--outline">
                  Go to My Purchases
                </Link>
              </div>
            )}
          </div>
        </div>
      </main>
    );
  }

  if (order) {
    return (
      <main className="checkout-jelly">
        <div className="container checkout-page">
          {error && <p className="field-error" role="alert">{error}</p>}
          <OrderReceipt
            order={order}
            formatPeso={formatPeso}
            onRefresh={refreshOrder}
            onCancel={() => setCancelOpen(true)}
            onPay={() => setPaymentOpen(true)}
            onReview={submitReview}
            onAdvanceDelivery={advanceDelivery}
            advanceBusy={advanceBusy}
            onOpenReceipt={() => setReceiptOpen(true)}
          />

          {paymentOpen && (
            <PaymentModal
              order={order}
              formatPeso={formatPeso}
              showToast={showToast}
              onClose={() => setPaymentOpen(false)}
              onUpdate={(updated) => setOrder(updated)}
            />
          )}

          {receiptOpen && (
            <DigitalReceiptModal
              order={order}
              formatPeso={formatPeso}
              onClose={() => setReceiptOpen(false)}
            />
          )}

          {cancelOpen && (
            <div
              className="payment-modal-overlay"
              style={{ display: 'flex' }}
              onMouseDown={(event) => {
                if (event.target === event.currentTarget && !cancelBusy) {
                  setCancelOpen(false);
                }
              }}
            >
              <div className="payment-modal" role="dialog" aria-modal="true" aria-labelledby="cancelTitle">
                <div className="payment-modal__header">
                  <h3 id="cancelTitle">Cancel Order</h3>
                  <button
                    className="payment-modal__close"
                    aria-label="Close cancellation"
                    disabled={cancelBusy}
                    onClick={() => setCancelOpen(false)}
                  >
                    ×
                  </button>
                </div>
                <div className="payment-modal__body">
                  <form onSubmit={cancelOrder}>
                    <label htmlFor="cancelReason">Reason</label>
                    <select
                      id="cancelReason"
                      className="form-select"
                      value={cancelReason}
                      onChange={(event) => setCancelReason(event.target.value)}
                    >
                      <option>Change of mind</option>
                      <option>Need to modify shipping address</option>
                      <option>Modify payment method</option>
                    </select>
                    <p className="field-error" role="alert">{cancelError}</p>
                    <button className="btn btn--pink" type="submit" disabled={cancelBusy}>
                      {cancelBusy ? 'Cancelling…' : 'Confirm Cancellation'}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    );
  }

  if (!(cart || []).length && !pending) {
    return (
      <main className="checkout-jelly">
        <div className="container checkout-page">
          <div className="checkout-empty squishy-checkout-empty">
            <div className="cart-empty-squishy-avatar" aria-hidden="true">
              <svg width="84" height="76" viewBox="0 0 100 90" fill="none">
                <path
                  d="M50 18 C30 18, 12 36, 12 56 C12 74, 30 84, 50 84 C70 84, 88 74, 88 56 C88 36, 70 18, 50 18 Z"
                  fill="url(#ckEmptyBunGrad)"
                />
                <path d="M50 10 C46 10, 42 14, 45 19 C48 22, 52 22, 55 19 C58 14, 54 10, 50 10 Z" fill="#ffc8db" />
                <circle cx="36" cy="52" r="3.5" fill="#3c1e40" />
                <circle cx="64" cy="52" r="3.5" fill="#3c1e40" />
                <ellipse cx="30" cy="59" rx="4.5" ry="2.5" fill="#ff9ecb" opacity="0.8" />
                <ellipse cx="70" cy="59" rx="4.5" ry="2.5" fill="#ff9ecb" opacity="0.8" />
                <path d="M46 60 Q50 64 54 60" stroke="#3c1e40" strokeWidth="2" strokeLinecap="round" />
                <defs>
                  <linearGradient id="ckEmptyBunGrad" x1="50" y1="18" x2="50" y2="84" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#ffffff" />
                    <stop offset="1" stopColor="#ffe6f0" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <h2>Your Squishy Bag is Empty</h2>
            <p>Select your favorite slow-rising friends before heading to checkout!</p>
            <Link to="/shop.html" className="checkout-empty-cta">
              Explore 20 Squishies Catalog →
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const QUICK_VOUCHERS = Array.isArray(availableVouchers) && availableVouchers.length > 0
    ? availableVouchers.map((v) => ({
        code: v.code,
        label:
          v.type === 'percentage'
            ? `${v.value}% OFF`
            : v.type === 'fixed_amount'
              ? `₱${v.value} OFF`
              : 'FREE SHIPPING',
        note: v.minSpend > 0 ? `Min ₱${v.minSpend}` : v.description || 'All orders',
      }))
    : [
        { code: 'WELCOME10', label: '10% OFF', note: 'Min ₱150' },
        { code: 'FREESHIP', label: 'FREE SHIPPING', note: 'All orders' },
        { code: 'SQUISHY50', label: '₱50 OFF', note: 'Min ₱300' },
      ];

  const PAYMENT_METHODS_DATA = [
    {
      value: 'gcash',
      title: 'GCash',
      badge: 'Recommended',
      desc: 'Interactive Philippine e-wallet flow with SMS OTP & MPIN.',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="5" y="2" width="14" height="20" rx="3" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="12" cy="18" r="1.2" fill="currentColor" />
          <path d="M9 5h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      value: 'cod',
      title: 'Cash on Delivery',
      badge: 'Pay on Arrival',
      desc: 'Inspect your parcel first and pay cash directly to the rider.',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="1" y="4" width="22" height="16" rx="3" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.8" />
          <path d="M6 8h.01M18 16h.01" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      value: 'maya',
      title: 'Maya',
      badge: 'Fast Wallet',
      desc: 'Maya mobile wallet OTP & MPIN simulator.',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 2L3 7v6c0 5.5 3.8 10.7 9 12 5.2-1.3 9-6.5 9-12V7l-9-5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      value: 'card',
      title: 'Credit / Debit Card',
      badge: 'Visa / MC / JCB',
      desc: 'Simulated 16-digit card checkout gateway.',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="2" y="5" width="20" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
          <path d="M2 10h20M6 15h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      ),
    },
  ];

  return (
    <main className="checkout-jelly">
      <div className="container checkout-page">
        <div className="checkout-stepper-wrap">
          <div className="checkout-stepper-step is-complete">
            <span className="stepper-dot">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="stepper-label">Cart Bag</span>
          </div>
          <span className="stepper-line is-active" />
          <div className="checkout-stepper-step is-active">
            <span className="stepper-dot">2</span>
            <span className="stepper-label">Delivery &amp; Payment</span>
          </div>
          <span className="stepper-line" />
          <div className="checkout-stepper-step">
            <span className="stepper-dot">3</span>
            <span className="stepper-label">Tracked Parcel</span>
          </div>
        </div>

        <div className="checkout-page__head">
          <span className="checkout-badge-pill">Express Sensory Checkout</span>
          <h1>Finalize Your Squishy Drop</h1>
          <p>Shopee-style saved delivery, strict address verification, and instant GCash / courier tracking.</p>
        </div>

        {authenticated && user ? (
          <div className="checkout-shopee-address-strip" role="status">
            <div>
              <span className="address-strip-tag">Collector Account Signed In</span>
              <strong>@{user.username}</strong>
              {user.defaultAddress?.shippingAddress ? (
                <small>
                  Saved: {user.defaultAddress.shippingAddress}, Brgy. {user.defaultAddress.barangay}, {user.defaultAddress.city} ({user.defaultAddress.postalCode})
                </small>
              ) : (
                <small>No saved default address yet — fill below or save in Account Profile.</small>
              )}
            </div>
            <div className="address-strip-actions">
              {user.defaultAddress?.shippingAddress && (
                <button type="button" className="btn btn--outline btn--xs" onClick={applySavedAddress}>
                  Re-fill Saved Address
                </button>
              )}
              <Link to="/account?mode=profile" className="btn btn--outline btn--xs">
                Manage Address
              </Link>
            </div>
          </div>
        ) : (
          <div className="checkout-shopee-address-strip checkout-shopee-address-strip--guest">
            <div>
              <span className="address-strip-tag">Guest Express Checkout</span>
              <strong>Checking out without signing in</strong>
              <small>Want saved Shopee-style addresses &amp; full purchase history across devices?</small>
            </div>
            <Link to="/account?mode=login&next=/checkout.html" className="btn btn--pink btn--xs">
              Log In / Create Account →
            </Link>
          </div>
        )}

        {pending && (
          <div className="checkout-pending-notice" role="status">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
              <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span>A previous checkout request was unconfirmed. Submitting now recovers your reserved items cleanly.</span>
          </div>
        )}
        {error && (
          <p id="checkoutError" className="field-error checkout-global-error" role="alert">
            {error}
          </p>
        )}

        <form onSubmit={placeOrder} noValidate>
          <div className="checkout-page__layout">
            <div className="checkout-main-col">
              {/* Card 1: Delivery & Contact */}
              <div className="checkout-card squishy-glass-card">
                <div className="checkout-card__header">
                  <span className="checkout-card__step-orb">1</span>
                  <div>
                    <h2>Delivery Address &amp; Contact Details</h2>
                    <p className="checkout-card__subtitle">Strictly validated PH phone &amp; 4-digit postal inputs.</p>
                  </div>
                </div>

                <div className="form-row">
                  <Field
                    label="Recipient Full Name (Letters Only)"
                    name="customerName"
                    placeholder="Juana Dela Cruz"
                    autoComplete="name"
                    maxLength={FIELD_LIMITS.name}
                    value={fields.customerName}
                    onChange={updateField}
                    error={fieldErrors.customerName}
                    disabled={Boolean(pending) || submitting}
                  />
                  <Field
                    label="Mobile Phone (11 Digits Only)"
                    name="customerPhone"
                    type="tel"
                    inputMode="numeric"
                    placeholder="09171234567"
                    autoComplete="tel"
                    maxLength={FIELD_LIMITS.phone}
                    value={fields.customerPhone}
                    onChange={updateField}
                    error={fieldErrors.customerPhone}
                    disabled={Boolean(pending) || submitting}
                  />
                </div>

                <div className="form-row">
                  <Field
                    label="Email Address (Receipt &amp; Updates)"
                    name="customerEmail"
                    type="email"
                    placeholder="you@email.com"
                    autoComplete="email"
                    maxLength={FIELD_LIMITS.email}
                    value={fields.customerEmail}
                    onChange={updateField}
                    error={fieldErrors.customerEmail}
                    disabled={Boolean(pending) || submitting}
                  />
                  <div className={`form-field${fieldErrors.region ? ' has-error' : ''}`}>
                    <label htmlFor="ckRegion">
                      Delivery Region &amp; Transit Zone <span className="required-star">*</span>
                    </label>
                    <div className="form-select-wrap">
                      <select
                        id="ckRegion"
                        className={`form-select${fieldErrors.region ? ' is-invalid' : ''}`}
                        value={region}
                        onChange={(event) => setRegion(event.target.value)}
                        required
                        aria-invalid={Boolean(fieldErrors.region)}
                        disabled={Boolean(pending) || submitting}
                      >
                        {REGIONS.map((item) => (
                          <option key={item.value} value={item.value}>{item.label}</option>
                        ))}
                      </select>
                    </div>
                    <ErrorMessage id="err-ckRegion">{fieldErrors.region}</ErrorMessage>
                  </div>
                </div>

                <Field
                  label="Street Address / House No. / Building"
                  name="shippingAddress"
                  placeholder="Unit / House No., Building Name, Street"
                  autoComplete="street-address"
                  maxLength={FIELD_LIMITS.address}
                  value={fields.shippingAddress}
                  onChange={updateField}
                  error={fieldErrors.shippingAddress}
                  disabled={Boolean(pending) || submitting}
                />

                <div className="form-row form-row--tri">
                  <div className={`form-field${fieldErrors.city ? ' has-error' : ''}`}>
                    <label htmlFor="ckCity">City / Municipality <span className="required-star">*</span></label>
                    <input
                      id="ckCity"
                      name="city"
                      autoComplete="address-level2"
                      placeholder="e.g. Quezon City"
                      maxLength={FIELD_LIMITS.city}
                      required
                      value={fields.city}
                      onChange={updateField}
                      disabled={Boolean(pending) || submitting}
                      aria-invalid={Boolean(fieldErrors.city)}
                      aria-describedby={fieldErrors.city ? 'err-ckCity' : undefined}
                      className={fieldErrors.city ? 'is-invalid' : ''}
                    />
                    <ErrorMessage id="err-ckCity">{fieldErrors.city}</ErrorMessage>
                  </div>

                  <div className={`form-field${fieldErrors.barangay ? ' has-error' : ''}`}>
                    <label htmlFor="ckBarangay">Barangay <span className="required-star">*</span></label>
                    <input
                      id="ckBarangay"
                      name="barangay"
                      placeholder="Barangay"
                      maxLength={FIELD_LIMITS.barangay}
                      required
                      value={fields.barangay}
                      onChange={updateField}
                      disabled={Boolean(pending) || submitting}
                      aria-invalid={Boolean(fieldErrors.barangay)}
                      aria-describedby={fieldErrors.barangay ? 'err-ckBarangay' : undefined}
                      className={fieldErrors.barangay ? 'is-invalid' : ''}
                    />
                    <ErrorMessage id="err-ckBarangay">{fieldErrors.barangay}</ErrorMessage>
                  </div>

                  <div className={`form-field form-field--postal${fieldErrors.postalCode ? ' has-error' : ''}`}>
                    <label htmlFor="ckPostalCode">ZIP / Postal Code (4 Digits) <span className="required-star">*</span></label>
                    <input
                      id="ckPostalCode"
                      name="postalCode"
                      placeholder="1000"
                      maxLength={FIELD_LIMITS.postalCode}
                      inputMode="numeric"
                      pattern="[0-9]{4}"
                      required
                      value={fields.postalCode}
                      onChange={updateField}
                      disabled={Boolean(pending) || submitting}
                      aria-invalid={Boolean(fieldErrors.postalCode)}
                      aria-describedby={fieldErrors.postalCode ? 'err-ckPostalCode' : undefined}
                      className={fieldErrors.postalCode ? 'is-invalid' : ''}
                    />
                    <ErrorMessage id="err-ckPostalCode">{fieldErrors.postalCode}</ErrorMessage>
                  </div>
                </div>

                <Field
                  label="Message for SISO Seller / Rider (Optional)"
                  name="orderNote"
                  optional
                  maxLength={FIELD_LIMITS.orderNote}
                  placeholder="e.g., Leave parcel at guardhouse or call upon arrival"
                  value={fields.orderNote}
                  onChange={updateField}
                  error={fieldErrors.orderNote}
                  disabled={Boolean(pending) || submitting}
                />

                <div className="squishy-delivery-badge">
                  <div className="delivery-badge-icon" aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <rect x="1" y="3" width="15" height="13" rx="2" stroke="currentColor" strokeWidth="2" />
                      <path d="M16 8h4l3 3v5h-7V8z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                      <circle cx="5.5" cy="18.5" r="2.5" stroke="currentColor" strokeWidth="2" />
                      <circle cx="18.5" cy="18.5" r="2.5" stroke="currentColor" strokeWidth="2" />
                    </svg>
                  </div>
                  <div className="delivery-badge-content">
                    <span className="delivery-badge-title">
                      {quote
                        ? `Estimated Delivery: ${quote.delivery.minDays}–${quote.delivery.maxDays} Business Days`
                        : 'Calculating Dispatch Timeline…'}
                    </span>
                    <span className="delivery-badge-sub">
                      {quote
                        ? `${quote.delivery.label} — Carefully packed in anti-drop bubble cushions.`
                        : 'Select your delivery region above to view verified transit time.'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 2: Payment Method */}
              <div className="checkout-card squishy-glass-card">
                <div className="checkout-card__header">
                  <span className="checkout-card__step-orb">2</span>
                  <div>
                    <h2>Choose Payment Method</h2>
                    <p className="checkout-card__subtitle">GCash / Maya / Card open a realistic authorization modal upon Place Order.</p>
                  </div>
                </div>

                <div className="payment-options-compact-grid">
                  {PAYMENT_METHODS_DATA.map((opt) => {
                    const available = !quote || quote.paymentMethods?.includes(opt.value);
                    const isSelected = paymentMethod === opt.value;
                    return (
                      <label
                        key={opt.value}
                        className={`squishy-payment-tile${isSelected ? ' is-selected' : ''}${!available ? ' is-disabled' : ''}`}
                        data-method={opt.value}
                      >
                        <div className="payment-tile-left">
                          <div className="payment-tile-icon-wrap" aria-hidden="true">
                            {opt.icon}
                          </div>
                          <div className="squishy-payment-body">
                            <div className="payment-title-row">
                              <strong>{opt.title}</strong>
                              <span className="payment-badge-pill">{opt.badge}</span>
                            </div>
                            <span className="payment-desc-text">{opt.desc}</span>
                          </div>
                        </div>

                        <div className="payment-radio-indicator">
                          <input
                            type="radio"
                            name="paymentMethod"
                            value={opt.value}
                            checked={isSelected}
                            onChange={() => setPaymentMethod(opt.value)}
                            disabled={!available || Boolean(pending) || submitting}
                          />
                          <span className="custom-radio-orb" aria-hidden="true" />
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Sticky Order Summary Column */}
            <div className="checkout-side-col">
              <div className="checkout-card squishy-glass-card checkout-summary-card">
                <button
                  type="button"
                  className="checkout-mobile-summary-toggle"
                  aria-expanded={mobileSummaryOpen}
                  onClick={() => setMobileSummaryOpen((prev) => !prev)}
                >
                  <span className="mobile-summary-toggle__text">
                    <span className="summary-bag-icon" aria-hidden="true">🛍️</span>
                    <span>{mobileSummaryOpen ? 'Hide' : 'Show'} Order Summary ({(quote?.items || []).reduce((acc, it) => acc + (it.quantity || 1), 0)})</span>
                    <span className="summary-chevron" aria-hidden="true">{mobileSummaryOpen ? ' ▲' : ' ▼'}</span>
                  </span>
                  <span className="mobile-summary-toggle__price">
                    {quote ? formatPeso(quote.total) : '—'}
                  </span>
                </button>

                <div className={`checkout-summary-collapsible${mobileSummaryOpen ? ' is-open' : ''}`}>
                  <div className="summary-header-row">
                    <h2>Order Summary</h2>
                    <span className="summary-item-count">
                      {(quote?.items || []).reduce((acc, it) => acc + (it.quantity || 1), 0)} items
                    </span>
                  </div>

                  <div id="orderSummaryItems" className="order-summary-list">
                  {(quote?.items || []).map((item, index) => (
                    <div className="order-summary__item squishy-summary-item" key={`${item.slug || item.name}-${index}`}>
                      <div className="summary-thumb-cushion">
                        <img src={item.image} alt="" width="52" height="52" loading="lazy" />
                        <span className="summary-qty-badge">{item.quantity}</span>
                      </div>
                      <div className="order-summary__item-info">
                        <h4>{item.name}</h4>
                        <span className="summary-unit-calc">
                          {formatPeso(item.unitPrice || (item.subtotal / (item.quantity || 1)))} × {item.quantity}
                        </span>
                      </div>
                      <span className="order-summary__item-price">{formatPeso(item.subtotal)}</span>
                    </div>
                  ))}
                </div>

                <div className="voucher-box squishy-voucher-box">
                  <div className="voucher-header">
                    <label htmlFor="ckVoucherCode">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <line x1="7" y1="7" x2="7.01" y2="7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                      </svg>
                      <span>Voucher / Promo Code</span>
                    </label>

                    {appliedVoucher && (
                      <button
                        type="button"
                        className="voucher-remove-link"
                        onClick={clearAppliedVoucher}
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="quick-vouchers-strip" aria-label="Available promotional vouchers">
                    {QUICK_VOUCHERS.map((v) => {
                      const isActive = appliedVoucher === v.code;
                      return (
                        <button
                          key={v.code}
                          type="button"
                          className={`quick-voucher-pill${isActive ? ' is-applied' : ''}`}
                          onClick={() => applyQuickVoucher(v.code)}
                          disabled={Boolean(pending) || submitting || quoteLoading}
                          title={`${v.label} (${v.note})`}
                        >
                          <span className="v-code">{v.code}</span>
                          <span className="v-label">{v.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="voucher-input-group">
                    <input
                      id="ckVoucherCode"
                      type="text"
                      maxLength={FIELD_LIMITS.voucherCode}
                      aria-label="Voucher or promo code"
                      aria-invalid={Boolean(fieldErrors.voucherCode)}
                      className={fieldErrors.voucherCode ? 'is-invalid' : ''}
                      placeholder="Enter promo code"
                      value={voucherText}
                      onChange={handleVoucherChange}
                      disabled={Boolean(pending) || submitting}
                    />
                    <button
                      type="button"
                      id="applyVoucherBtn"
                      className="voucher-apply-btn"
                      onClick={applyVoucher}
                      disabled={Boolean(pending) || submitting || quoteLoading || !voucherText.trim()}
                    >
                      Apply
                    </button>
                  </div>

                  <ErrorMessage id="err-ckVoucherCode">{fieldErrors.voucherCode}</ErrorMessage>
                  {appliedVoucher && quote && (
                    <div className="voucher-applied-success" role="status">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span>Voucher active: <strong>{appliedVoucher}</strong></span>
                    </div>
                  )}
                </div>

                <div className="order-summary__rows">
                  <div className="order-summary__row">
                    <span>Merchandise Subtotal</span>
                    <span>{quote ? formatPeso(quote.subtotal) : '—'}</span>
                  </div>

                  <div className="order-summary__row">
                    <span>Delivery Shipping</span>
                    <span className={quote && !quote.shippingFee ? 'summary-free-pill' : ''}>
                      {quote ? (quote.shippingFee ? formatPeso(quote.shippingFee) : 'FREE') : '—'}
                    </span>
                  </div>

                  {quote?.voucherDiscount > 0 && (
                    <div className="order-summary__row summary-discount-row">
                      <span>Voucher Savings ({appliedVoucher})</span>
                      <span className="discount-amount">−{formatPeso(quote.voucherDiscount)}</span>
                    </div>
                  )}

                  {quote && (
                    <div
                      className={`squishy-shipping-banner${quote.subtotal >= 500 || quote.shippingDiscount ? ' is-unlocked' : ''}`}
                      role="status"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        {quote.subtotal >= 500 || quote.shippingDiscount ? (
                          <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                        ) : (
                          <>
                            <rect x="1" y="3" width="15" height="13" rx="2" stroke="currentColor" strokeWidth="2" />
                            <path d="M16 8h4l3 3v5h-7V8z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                            <circle cx="5.5" cy="18.5" r="2.5" stroke="currentColor" strokeWidth="2" />
                            <circle cx="18.5" cy="18.5" r="2.5" stroke="currentColor" strokeWidth="2" />
                          </>
                        )}
                      </svg>
                      <span>
                        {quote.shippingDiscount
                          ? `Shipping voucher saved ${formatPeso(quote.shippingDiscount)} on delivery.`
                          : quote.subtotal >= 500
                            ? 'You unlocked Free Nationwide Shipping!'
                            : `Add ${formatPeso(500 - quote.subtotal)} more to qualify for Free Shipping.`}
                      </span>
                    </div>
                  )}

                  <div className="order-summary__row order-summary__row--total">
                    <div className="total-label-wrap">
                      <span>Total Amount</span>
                      <small>Taxes &amp; handling included</small>
                    </div>
                    <strong id="ckTotal" className="final-total-display">
                      {quote ? formatPeso(quote.total) : '—'}
                    </strong>
                  </div>
                </div>
              </div>

                <button
                  id="placeOrderBtn"
                  className="checkout-place-order-btn"
                  type="submit"
                  disabled={submitting || quoteLoading || (!quote && !pending)}
                >
                  <span>
                    {submitting
                      ? 'Securing Your Squishies…'
                      : pending
                        ? 'Retry Unconfirmed Order'
                        : quoteLoading
                          ? 'Calculating Totals…'
                          : quote
                            ? `Confirm Order • ${formatPeso(quote.total)}`
                            : 'Refresh Totals'}
                  </span>
                  {!submitting && !quoteLoading && (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>

                <Link to="/shop.html" className="checkout-page__continue">
                  ← Back to Shop Catalog
                </Link>

                <div className="checkout-trust-guarantee">
                  <div className="trust-point">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="2" />
                    </svg>
                    <span>100% Non-Toxic TPR</span>
                  </div>
                  <div className="trust-point">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                      <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    <span>30–45s Slow-Rebound</span>
                  </div>
                  <div className="trust-point">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" stroke="currentColor" strokeWidth="2" />
                    </svg>
                    <span>Anti-Drop Bubble Pack</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}
