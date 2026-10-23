
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
      <main>
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
      <main>
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
      <main>
        <div className="container checkout-page">
          <div className="checkout-empty">
            <h2>Your cart is empty</h2>
            <p>Add a squishy or two before checking out.</p>
            <Link to="/shop.html" className="btn btn--pink">
              Browse Squishies →
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main>
      <div className="container checkout-page">
        <div className="checkout-page__head">
          <h1>Checkout</h1>
          <p>Almost there — just a few details and your squishies are on the way!</p>
        </div>

        {pending && (
          <p role="status">
            A previous checkout request was unconfirmed. Retry it to recover the saved
            order without creating a duplicate.
          </p>
        )}
        {error && <p className="field-error" role="alert">{error}</p>}

        <form onSubmit={placeOrder}>
          <div className="checkout-page__layout">
            <div>
              <div className="checkout-card">
                <h2>Contact Information</h2>
                <Field
                  label="Email Address"
                  name="customerEmail"
                  type="email"
                  placeholder="you@email.com"
                  autoComplete="email"
                  value={fields.customerEmail}
                  onChange={updateField}
                  error={fieldErrors.customerEmail}
                  disabled={Boolean(pending) || submitting}
                />
              </div>

              <div className="checkout-card">
                <h2>Shipping Address</h2>
                <Field
                  label="Full Name"
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
                <Field
                  label="Street Address / House No."
                  name="shippingAddress"
                  placeholder="Unit / House No., Building, Street Name"
                  autoComplete="street-address"
                  value={fields.shippingAddress}
                  onChange={updateField}
                  error={fieldErrors.shippingAddress}
                  disabled={Boolean(pending) || submitting}
                />

                <div className="form-row">
                  <div className="form-field">
                    <label htmlFor="ckRegion">Region / Delivery Zone <span className="required-star">*</span></label>
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
                    <ErrorMessage>{fieldErrors.region}</ErrorMessage>
                  </div>
                  <div className="form-field">
                    <label htmlFor="ckCity">City / Municipality <span className="required-star">*</span></label>
                    <input
                      id="ckCity"
                      name="city"
                      autoComplete="address-level2"
                      placeholder="City / Municipality"
                      required
                      value={fields.city}
                      onChange={updateField}
                      disabled={Boolean(pending) || submitting}
                      aria-invalid={Boolean(fieldErrors.city)}
                    />
                    <ErrorMessage>{fieldErrors.city}</ErrorMessage>
                  </div>
                </div>

                <div className="form-row">
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
                  <div className="form-field">
                    <label htmlFor="ckPostalCode">Postal Code (4 Digits) <span className="required-star">*</span></label>
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

                <div className="delivery-estimate-badge">
                  {quote
                    ? `Estimated delivery: ${quote.delivery.minDays}–${quote.delivery.maxDays} days (${quote.delivery.label}; school demo estimate).`
                    : 'Delivery estimate will appear after totals load.'}
                </div>
              </div>

              <div className="checkout-card">
                <h2>Payment Method</h2>
                {[
                  ['cod', 'Cash on Delivery', 'Pay when your order arrives'],
                  ['gcash', 'GCash', 'School demo — no money transferred'],
                  ['card', 'Credit / Debit Card', 'School demo — no money transferred'],
                  ['maya', 'Maya', 'School demo — no money transferred'],
                ].map(([value, label, description]) => {
                  const available = !quote || quote.paymentMethods?.includes(value);
                  return (
                    <label
                      key={value}
                      className={`payment-option${paymentMethod === value ? ' is-selected' : ''}`}
                      data-method={value}
                    >
                      <span className="payment-option__body">
                        <strong>{label}</strong>
                        <span>{description}</span>
                      </span>
                      <input
                        type="radio"
                        name="paymentMethod"
                        value={value}
                        checked={paymentMethod === value}
                        onChange={() => setPaymentMethod(value)}
                        disabled={!available || Boolean(pending) || submitting}
                      />
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="checkout-card">
              <h2>Order Summary</h2>

              <div id="orderSummaryItems">
                {(quote?.items || []).map((item, index) => (
                  <div className="order-summary__item" key={`${item.slug || item.name}-${index}`}>
                    <img src={item.image} alt="" width="52" height="52" />
                    <div className="order-summary__item-info">
                      <h4>{item.name}</h4>
                      <span>Qty: {item.quantity}</span>
                    </div>
                    <span className="order-summary__item-price">{formatPeso(item.subtotal)}</span>
                  </div>
                ))}
              </div>

              <div className="order-summary__rows">
                <div className="order-summary__row">
                  <span>Subtotal</span>
                  <span>{quote ? formatPeso(quote.subtotal) : '—'}</span>
                </div>
                <div className="order-summary__row">
                  <span>Shipping</span>
                  <span>{quote ? (quote.shippingFee ? formatPeso(quote.shippingFee) : 'Free') : '—'}</span>
                </div>

                {quote?.voucherDiscount > 0 && (
                  <div className="order-summary__row" style={{ color: '#059669', fontWeight: 600 }}>
                    <span>Voucher Discount</span>
                    <span>−{formatPeso(quote.voucherDiscount)}</span>
                  </div>
                )}

                <p className="order-summary__note">
                  {quote
                    ? quote.shippingDiscount
                      ? `Shipping voucher saved ${formatPeso(quote.shippingDiscount)}; already included above.`
                      : quote.subtotal >= 500
                        ? 'Your order qualifies for free shipping.'
                        : `Add ${formatPeso(500 - quote.subtotal)} more for free shipping.`
                    : ''}
                </p>

                <div className="voucher-box" style={{ margin: '16px 0' }}>
                  <label
                    htmlFor="ckVoucherCode"
                    style={{ fontSize: 13, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6 }}
                  >
                    Voucher / Promo Code
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      id="ckVoucherCode"
                      type="text"
                      aria-label="Voucher or promo code"
                      placeholder="WELCOME10 / FREESHIP"
                      value={voucherText}
                      onChange={handleVoucherChange}
                      style={{ flex: 1, padding: '8px 12px', border: '1.5px solid #cbd5e1', borderRadius: 8, fontSize: 13.5, textTransform: 'uppercase' }}
                      disabled={Boolean(pending) || submitting}
                    />
                    <button
                      type="button"
                      id="applyVoucherBtn"
                      className="btn btn--outline"
                      style={{ padding: '8px 16px', fontSize: 13.5 }}
                      onClick={applyVoucher}
                      disabled={Boolean(pending) || submitting || quoteLoading}
                    >
                      Apply
                    </button>
                  </div>
                  <ErrorMessage>{fieldErrors.voucherCode}</ErrorMessage>
                  {appliedVoucher && quote && (
                    <p role="status">Voucher applied: {appliedVoucher}</p>
                  )}
                </div>

                <div className="order-summary__row order-summary__row--total">
                  <span>Total</span>
                  <span>{quote ? formatPeso(quote.total) : '—'}</span>
                </div>
              </div>

              <button
                className="btn btn--pink checkout-page__place-order"
                type="submit"
                disabled={submitting || quoteLoading || (!quote && !pending)}
              >
                {submitting
                  ? 'Processing Order…'
                  : pending
                    ? 'Retry unconfirmed order'
                    : quoteLoading
                      ? 'Loading totals…'
                      : quote
                        ? 'Place Order'
                        : 'Refresh totals'}
              </button>
              <Link to="/shop.html" className="checkout-page__continue">
                ← Continue Shopping
              </Link>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}
