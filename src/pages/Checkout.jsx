
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { SquishiesAPI } from '../services/api';
import { useCart } from '../context/CartContext';

const PENDING_KEY = 'squishies-pending-checkout';
const REGIONS = [
  { value: 'metro-manila', label: 'Metro Manila (₱60 — 1–2 days)' },
  { value: 'luzon', label: 'Luzon (₱80 — 2–4 days)' },
  { value: 'visayas', label: 'Visayas (₱110 — 4–7 days)' },
  { value: 'mindanao', label: 'Mindanao (₱110 — 4–7 days)' },
];

const EMPTY_FIELDS = {
  customerEmail: '',
  customerName: '',
  customerPhone: '',
  shippingAddress: '',
  city: '',
  barangay: '',
  postalCode: '',
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
    // The in-memory state still permits retrying during this page session.
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
  customerEmail: 'ckEmail',
  customerName: 'ckName',
  customerPhone: 'ckPhone',
  shippingAddress: 'ckAddress',
  city: 'ckCity',
  barangay: 'ckBarangay',
  postalCode: 'ckPostalCode',
};

function Field({ label, name, value, onChange, error, ...props }) {
  const id = FIELD_IDS[name] || name;
  return (
    <div className="form-field">
      <label htmlFor={id}>
        {label} <span className="required-star">*</span>
      </label>
      <input
        id={id}
        name={name}
        value={value}
        onChange={onChange}
        required
        aria-invalid={Boolean(error)}
        {...props}
      />
      <ErrorMessage id={`err-${id}`}>{error}</ErrorMessage>
    </div>
  );
}


function PaymentModal({ order, onClose, onUpdate, formatPeso, showToast }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [session, setSession] = useState(null);
  const [uncertainOutcome, setUncertainOutcome] = useState(null);
  const [sessionKey, setSessionKey] = useState(() => {
    const storageKey = `squishies-payment-${order.orderNumber}`;
    try {
      return sessionStorage.getItem(storageKey) || crypto.randomUUID();
    } catch {
      return crypto.randomUUID();
    }
  });

  const storageKey = `squishies-payment-${order.orderNumber}`;

  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, sessionKey);
    } catch {
      // In-memory retry key remains available.
    }
  }, [sessionKey, storageKey]);

  async function simulate(outcome) {
    if (busy) return;

    const selectedOutcome = uncertainOutcome || outcome;
    setBusy(true);
    setMessage('Processing simulation…');

    try {
      const currentSession =
        session ||
        (await SquishiesAPI.createPaymentSession(
          order.orderNumber,
          sessionKey
        ));

      setSession(currentSession);

      // Recover if a prior attempt committed but its response was lost.
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

      const result = await SquishiesAPI.simulatePayment(
        currentSession.sessionId,
        selectedOutcome
      );

      try {
        sessionStorage.removeItem(storageKey);
      } catch {
        // No-op.
      }

      onClose();
      onUpdate(result.order);

      if (selectedOutcome !== 'success') {
        showToast?.(
          `Payment ${selectedOutcome}. You can retry before the reservation expires.`
        );
      }
    } catch (error) {
      setMessage(error.message || 'Payment simulation failed.');

      if (!error.status || error.status >= 500) {
        setUncertainOutcome(selectedOutcome);
      } else {
        setUncertainOutcome(null);
        setSession(null);
        const newKey = crypto.randomUUID();
        setSessionKey(newKey);
      }
    } finally {
      setBusy(false);
    }
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
        className="payment-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="paymentModalTitle"
      >
        <div className="payment-modal__header">
          <h3 id="paymentModalTitle">
            {order.paymentMethod.toUpperCase()} — payment simulation
          </h3>
          <button
            type="button"
            className="payment-modal__close"
            aria-label="Close payment simulation"
            onClick={onClose}
            disabled={busy}
          >
            ×
          </button>
        </div>

        <div className="payment-modal__body">
          <p>No money is transferred. Choose a test outcome for this school demonstration.</p>
          <div className="payment-summary-box">
            <strong>Amount: {formatPeso(order.total)}</strong>
          </div>
          <p role="status">{message}</p>
          <div className="payment-form">
            <button
              className="btn btn--pink"
              disabled={busy && uncertainOutcome !== 'success'}
              onClick={() => simulate('success')}
            >
              Simulate success
            </button>
            <button
              className="btn btn--outline"
              disabled={busy && uncertainOutcome !== 'declined'}
              onClick={() => simulate('declined')}
            >
              Simulate decline
            </button>
            <button
              className="btn btn--outline"
              disabled={busy && uncertainOutcome !== 'cancelled'}
              onClick={() => simulate('cancelled')}
            >
              Simulate cancellation
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function OrderReceipt({ order, formatPeso, onRefresh, onCancel, onPay, onReview }) {
  const milestones = [
    ['Order Placed', true],
    [
      order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Payment',
      ['Paid', 'Refunded'].includes(order.paymentStatus),
    ],
    ['Shipped', (order.events || []).some((event) => event.status === 'Shipped')],
    ['Completed', order.status === 'Completed'],
  ];

  return (
    <div className="shopee-order-view">
      <div className="shopee-receipt-card">
        <div className="shopee-receipt-header">
          <div className="shopee-status-badge badge-to-ship">
            Order Status: {order.status}
          </div>
          <p className="shopee-order-ref" style={{ overflowWrap: 'anywhere' }}>
            Order Reference: {order.orderNumber}
          </p>
          <p className="shopee-tracking-ref" style={{ overflowWrap: 'anywhere' }}>
            Demo Tracking: {order.trackingNumber}
          </p>
        </div>

        <div className="shopee-timeline">
          {milestones.map(([label, complete], index) => (
            <div
              className={`timeline-step${complete ? ' is-complete' : ''}`}
              key={label}
            >
              <div className="step-icon">{index + 1}</div>
              <span>{label}</span>
            </div>
          ))}
        </div>

        <div className="shopee-info-grid">
          <div className="shopee-info-box">
            <h4>Shipping Address</h4>
            <p>{order.customerName} ({order.customerPhone})</p>
            <p>
              {order.shippingAddress}, Brgy. {order.barangay}, {order.city},{' '}
              {order.postalCode}
            </p>
          </div>

          <div className="shopee-info-box">
            <h4>Payment Details</h4>
            <p>Method: {order.paymentMethod.toUpperCase()}</p>
            <p>Status: {order.paymentStatus}</p>
            {order.paymentMethod !== 'cod' && (
              <p>School payment simulation — no money transferred.</p>
            )}
            {order.canPay && order.expiresAt && (
              <p>
                Reservation expires:{' '}
                {new Date(order.expiresAt).toLocaleString('en-PH')}
              </p>
            )}
          </div>
        </div>

        <div className="shopee-financial-box">
          {(order.items || []).map((item, index) => (
            <FinancialRow
              key={`${item.slug || item.name}-${index}`}
              label={`${item.name} × ${item.quantity}`}
              value={formatPeso(item.subtotal)}
            />
          ))}
          <FinancialRow label="Subtotal" value={formatPeso(order.subtotal)} />
          <FinancialRow
            label="Shipping"
            value={order.shippingFee ? formatPeso(order.shippingFee) : 'Free'}
          />
          {order.voucherDiscount > 0 && (
            <FinancialRow
              label={`Voucher (${order.voucherCode})`}
              value={`−${formatPeso(order.voucherDiscount)}`}
            />
          )}
          {order.shippingDiscount > 0 && (
            <FinancialRow
              label="Shipping savings (already included)"
              value={formatPeso(order.shippingDiscount)}
            />
          )}
          <FinancialRow
            label="Total"
            value={formatPeso(order.total)}
            total
          />
        </div>

        <div className="shopee-actions">
          {order.canPay && (
            <button className="btn btn--pink" onClick={onPay}>
              Pay / retry simulation
            </button>
          )}
          {order.canCancel && (
            <button className="btn btn--outline" onClick={onCancel}>
              Cancel Order
            </button>
          )}
          <button className="btn btn--outline" onClick={onRefresh}>
            Refresh status
          </button>
          <Link to="/shop.html" className="btn btn--pink">
            Continue Shopping →
          </Link>
        </div>

        <details className="order-activity">
          <summary>Order activity</summary>
          <ol>
            {(order.events || []).map((event, index) => (
              <li key={`${event.timestamp}-${index}`}>
                {new Date(event.timestamp).toLocaleString('en-PH')} —{' '}
                {event.description}
              </li>
            ))}
          </ol>
        </details>
      </div>

      {order.status === 'Completed' && (
        <ReviewForm order={order} onReview={onReview} />
      )}
    </div>
  );
}

function FinancialRow({ label, value, total = false }) {
  return (
    <div className={`financial-row${total ? ' financial-row--total' : ''}`}>
      <span>{label}</span>
      {total ? <strong>{value}</strong> : <span>{value}</span>}
    </div>
  );
}

function ReviewForm({ order, onReview }) {
  const [productSlug, setProductSlug] = useState(order.items?.[0]?.slug || '');
  const [reviewerName, setReviewerName] = useState('');
  const [rating, setRating] = useState('5');
  const [comment, setComment] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage('');

    try {
      await onReview({
        orderNumber: order.orderNumber,
        productSlug,
        reviewerName: reviewerName.trim(),
        rating: Number(rating),
        comment: comment.trim(),
      });
      setMessage('Thank you! Your verified review was saved.');
      setReviewerName('');
      setComment('');
    } catch (error) {
      setMessage(error.message || 'Could not submit your review.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="checkout-card" onSubmit={submit}>
      <h2>Review your purchase</h2>

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
        <label htmlFor="reviewName">Public display name</label>
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
        <select
          id="reviewRating"
          className="form-select"
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
          required
          value={comment}
          onChange={(event) => setComment(event.target.value)}
        />
      </div>

      <p role="status">{message}</p>
      <button className="btn btn--pink" type="submit" disabled={busy}>
        {busy ? 'Submitting…' : 'Submit review'}
      </button>
    </form>
  );
}

export default function Checkout() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
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
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [quote, setQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('Change of mind');
  const [cancelError, setCancelError] = useState('');
  const [cancelBusy, setCancelBusy] = useState(false);
  const [voucherDirty, setVoucherDirty] = useState(false);

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
    if (orderNumber || pending || voucherDirty || !(cart || []).length) {
        setQuote(null);
        setQuoteLoading(false);
        return;
    }

    let cancelled = false;
    setQuote(null);
    setQuoteLoading(true);
    setError('');
    setFieldErrors({});

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
        setPaymentMethod((current) =>
          result.paymentMethods?.includes(current)
            ? current
            : result.paymentMethods?.includes('cod')
              ? 'cod'
              : result.paymentMethods?.[0] || 'cod'
        );
      })
      .catch((quoteError) => {
        if (cancelled) return;
        setError(quoteError.message || 'Could not load checkout totals.');
        setFieldErrors(quoteError.fields || {});
      })
      .finally(() => {
        if (!cancelled) setQuoteLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [orderNumber, pending, cartSignature, region, appliedVoucher]); // cartSignature tracks cart changes.

  const updateField = useCallback((event) => {
    const { name, value } = event.target;
    setFields((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[name];
      return next;
    });
  }, []);

  function applyVoucher() {
    setAppliedVoucher(voucherText.trim().toUpperCase());
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
    setError('');
  }

  function handleVoucherChange(event) {
    setVoucherText(event.target.value);
    setVoucherDirty(true);
    setQuote(null);
  }

  function handleAcceptedOrder(acceptedOrder) {
    savePending(null);
    setPending(null);
    clearCart();
    setOrder(acceptedOrder);
    setError('');
    navigate(`/checkout.html?order=${encodeURIComponent(acceptedOrder.orderNumber)}`, {
      replace: true,
    });
  }

  function mapServerErrors(serverError) {
    setError(serverError.message || 'Something went wrong.');
    setFieldErrors(serverError.fields || {});
  }

  async function placeOrder(event) {
    event.preventDefault();
    if (submitting) return;

    if (pending?.payload && pending?.key) {
      await sendOrder(pending.payload, pending.key);
      return;
    }

    if (!quote) {
      setError('Please refresh your totals before placing your order.');
      return;
    }

    const payload = {
      quoteId: quote.quoteId,
      paymentMethod,
      ...Object.fromEntries(
        Object.entries(fields).map(([key, value]) => [key, value.trim()])
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
          <p>{error || 'Loading your order…'}</p>
          {error && (
            <button className="btn btn--pink" onClick={() => window.location.reload()}>
              Retry loading order
            </button>
          )}
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

  const QUICK_VOUCHERS = [
    { code: 'WELCOME10', label: '10% OFF', note: 'Min ₱150' },
    { code: 'FREESHIP', label: 'FREE SHIPPING', note: 'All orders' },
    { code: 'SQUISHY50', label: '₱50 OFF', note: 'Min ₱300' },
  ];

  const PAYMENT_METHODS_DATA = [
    {
      value: 'cod',
      title: 'Cash on Delivery (COD)',
      badge: 'Zero Upfront Cash',
      desc: 'Pay cash directly upon parcel arrival after inspecting package.',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="1" y="4" width="22" height="16" rx="3" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.8" />
          <path d="M6 8h.01M18 16h.01" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      value: 'gcash',
      title: 'GCash',
      badge: 'Instant QR / E-Wallet',
      desc: 'Philippine mobile wallet simulation with instant confirmation.',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="5" y="2" width="14" height="20" rx="3" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="12" cy="18" r="1.2" fill="currentColor" />
          <path d="M9 5h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      value: 'maya',
      title: 'Maya',
      badge: 'Fast Transfer',
      desc: 'Maya app or dynamic QR checkout (School Demo simulator).',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 2L3 7v6c0 5.5 3.8 10.7 9 12 5.2-1.3 9-6.5 9-12V7l-9-5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      value: 'card',
      title: 'Credit / Debit Card',
      badge: 'Visa • Mastercard • JCB',
      desc: '256-bit encrypted simulated card gateway (School Demo).',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="2" y="5" width="20" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
          <path d="M2 10h20M6 15h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      ),
    },
  ];

  return (
    <main className="checkout-jelly">
      <div className="container checkout-page">
        {/* Visual Stepper Header */}
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
            <span className="stepper-label">Delivery & Payment</span>
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
          <p>Complete your shipping and payment details — safe packaging & slow-rising delight guaranteed.</p>
        </div>

        {pending && (
          <div className="checkout-pending-notice" role="status">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
              <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span>A previous checkout request was unconfirmed. Submitting now will recover your reserved items without duplicate billing.</span>
          </div>
        )}
        {error && <p className="field-error checkout-global-error" role="alert">{error}</p>}

        <form onSubmit={placeOrder}>
          <div className="checkout-page__layout">
            <div className="checkout-main-col">
              {/* Unified Card 1: Delivery & Contact */}
              <div className="checkout-card squishy-glass-card">
                <div className="checkout-card__header">
                  <span className="checkout-card__step-orb">1</span>
                  <div>
                    <h2>Shipping & Contact Details</h2>
                    <p className="checkout-card__subtitle">Where should our courier deliver your squishies?</p>
                  </div>
                </div>

                <div className="form-row">
                  <Field
                    label="Recipient Full Name"
                    name="customerName"
                    placeholder="Juana Dela Cruz"
                    autoComplete="name"
                    value={fields.customerName}
                    onChange={updateField}
                    error={fieldErrors.customerName}
                    disabled={Boolean(pending) || submitting}
                  />
                  <Field
                    label="Mobile Phone Number"
                    name="customerPhone"
                    type="tel"
                    placeholder="09171234567"
                    autoComplete="tel"
                    maxLength={11}
                    value={fields.customerPhone}
                    onChange={updateField}
                    error={fieldErrors.customerPhone}
                    disabled={Boolean(pending) || submitting}
                  />
                </div>

                <div className="form-row">
                  <Field
                    label="Email Address (Tracking Updates)"
                    name="customerEmail"
                    type="email"
                    placeholder="you@email.com"
                    autoComplete="email"
                    value={fields.customerEmail}
                    onChange={updateField}
                    error={fieldErrors.customerEmail}
                    disabled={Boolean(pending) || submitting}
                  />
                  <div className="form-field">
                    <label htmlFor="ckRegion">
                      Delivery Region & Transit Zone <span className="required-star">*</span>
                    </label>
                    <div className="form-select-wrap">
                      <select
                        id="ckRegion"
                        className="form-select"
                        value={region}
                        onChange={(event) => setRegion(event.target.value)}
                        required
                        disabled={Boolean(pending) || submitting}
                      >
                        {REGIONS.map((item) => (
                          <option key={item.value} value={item.value}>{item.label}</option>
                        ))}
                      </select>
                    </div>
                    <ErrorMessage>{fieldErrors.region}</ErrorMessage>
                  </div>
                </div>

                <Field
                  label="Street Address / House No. / Building"
                  name="shippingAddress"
                  placeholder="Unit / House No., Building Name, Street"
                  autoComplete="street-address"
                  value={fields.shippingAddress}
                  onChange={updateField}
                  error={fieldErrors.shippingAddress}
                  disabled={Boolean(pending) || submitting}
                />

                <div className="form-row form-row--tri">
                  <div className="form-field">
                    <label htmlFor="ckCity">City / Municipality <span className="required-star">*</span></label>
                    <input
                      id="ckCity"
                      name="city"
                      autoComplete="address-level2"
                      placeholder="e.g. Quezon City"
                      required
                      value={fields.city}
                      onChange={updateField}
                      disabled={Boolean(pending) || submitting}
                      aria-invalid={Boolean(fieldErrors.city)}
                    />
                    <ErrorMessage>{fieldErrors.city}</ErrorMessage>
                  </div>

                  <div className="form-field">
                    <label htmlFor="ckBarangay">Barangay <span className="required-star">*</span></label>
                    <input
                      id="ckBarangay"
                      name="barangay"
                      placeholder="Barangay"
                      required
                      value={fields.barangay}
                      onChange={updateField}
                      disabled={Boolean(pending) || submitting}
                      aria-invalid={Boolean(fieldErrors.barangay)}
                    />
                    <ErrorMessage>{fieldErrors.barangay}</ErrorMessage>
                  </div>

                  <div className="form-field form-field--postal">
                    <label htmlFor="ckPostalCode">Postal Code <span className="required-star">*</span></label>
                    <input
                      id="ckPostalCode"
                      name="postalCode"
                      placeholder="1000"
                      maxLength={4}
                      inputMode="numeric"
                      pattern="[0-9]{4}"
                      required
                      value={fields.postalCode}
                      onChange={updateField}
                      disabled={Boolean(pending) || submitting}
                      aria-invalid={Boolean(fieldErrors.postalCode)}
                    />
                    <ErrorMessage>{fieldErrors.postalCode}</ErrorMessage>
                  </div>
                </div>

                {/* High-Contrast, Compact Delivery Badge */}
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

              {/* Card 2: Payment Method (Compact 2x2 Grid) */}
              <div className="checkout-card squishy-glass-card">
                <div className="checkout-card__header">
                  <span className="checkout-card__step-orb">2</span>
                  <div>
                    <h2>Choose Payment Method</h2>
                    <p className="checkout-card__subtitle">Instant confirmation & secure checkout.</p>
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
                          <div className="payment-option__body">
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

                {/* Voucher Section with Clickable Quick Pills */}
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

                  {/* One-click quick vouchers */}
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
                      aria-label="Voucher or promo code"
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

                  <ErrorMessage>{fieldErrors.voucherCode}</ErrorMessage>
                  {appliedVoucher && quote && (
                    <div className="voucher-applied-success" role="status">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span>Voucher active: <strong>{appliedVoucher}</strong></span>
                    </div>
                  )}
                </div>

                {/* Order Summary Pricing Breakdown */}
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
                    <p className="order-summary__note">
                      {quote.shippingDiscount
                        ? `Shipping voucher saved ${formatPeso(quote.shippingDiscount)} on delivery.`
                        : quote.subtotal >= 500
                          ? '🎉 You unlocked Free Nationwide Shipping!'
                          : `Add ${formatPeso(500 - quote.subtotal)} more to qualify for Free Shipping.`}
                    </p>
                  )}

                  <div className="order-summary__row order-summary__row--total">
                    <div className="total-label-wrap">
                      <span>Total Amount</span>
                      <small>Taxes & handling included</small>
                    </div>
                    <strong className="final-total-display">
                      {quote ? formatPeso(quote.total) : '—'}
                    </strong>
                  </div>
                </div>

                {/* Primary Action Button */}
                <button
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

                {/* Sensory Buyer Protection Ribbon */}
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
