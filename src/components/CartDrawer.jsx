import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';

const peso = (amount) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 2,
  }).format(amount);

const FREE_SHIPPING_GOAL = 500;

export default function CartDrawer({ isOpen, onClose }) {
  const {
    cart,
    totalCount,
    subtotal,
    shippingFee,
    total,
    changeQty,
    removeItem,
  } = useCart();

  const navigate = useNavigate();

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose();
    }

    document.addEventListener('keydown', handleKeyDown);
    document.body.classList.add('cart-open');

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.classList.remove('cart-open');
    };
  }, [isOpen, onClose]);

  function goToCheckout() {
    onClose();
    navigate('/checkout.html');
  }

  const progressPercent = Math.min(100, Math.round((subtotal / FREE_SHIPPING_GOAL) * 100));
  const amountNeeded = Math.max(0, FREE_SHIPPING_GOAL - subtotal);
  const qualifiesForFreeShipping = subtotal >= FREE_SHIPPING_GOAL;

  return (
    <>
      <div
        className={`cart-overlay${isOpen ? ' is-visible' : ''}`}
        hidden={!isOpen}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={`cart-drawer squishy-cart-drawer${isOpen ? ' is-open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Your squishy bag"
        aria-hidden={!isOpen}
        inert={!isOpen}
      >
        {/* Header */}
        <header className="cart-drawer__header">
          <div className="cart-drawer__brand-badge">
            <span className="cart-drawer__bag-orb" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M6 8h12l-1 12H7L6 8Z"
                  stroke="#ffffff"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
                <path
                  d="M9 8V6a3 3 0 0 1 6 0v2"
                  stroke="#ffffff"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <div className="cart-drawer__title-wrap">
              <h2>Your Squishy Bag</h2>
              <span className="cart-drawer__count-pill">
                {totalCount} {totalCount === 1 ? 'item' : 'items'}
              </span>
            </div>
          </div>

          <button
            className="cart-drawer__close"
            type="button"
            onClick={onClose}
            aria-label="Close cart"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M18 6L6 18M6 6l12 12"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>

        {/* Free Shipping Progress Track */}
        {cart.length > 0 && (
          <div className="cart-drawer__perks-bar">
            <div className="cart-free-shipping-card">
              <div className="cart-free-shipping-header">
                <div className="cart-free-shipping-status">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <rect x="1" y="3" width="15" height="13" rx="2" stroke="currentColor" strokeWidth="2" />
                    <path d="M16 8h4l3 3v5h-7V8z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                    <circle cx="5.5" cy="18.5" r="2.5" stroke="currentColor" strokeWidth="2" />
                    <circle cx="18.5" cy="18.5" r="2.5" stroke="currentColor" strokeWidth="2" />
                  </svg>
                  <span>
                    {qualifiesForFreeShipping
                      ? 'Free Delivery Unlocked! + Free Sticker Pack'
                      : `Add ${peso(amountNeeded)} for Free Delivery`}
                  </span>
                </div>
                <span className="cart-free-shipping-pct">{progressPercent}%</span>
              </div>
              <div className="cart-free-shipping-track" role="progressbar" aria-valuenow={progressPercent} aria-valuemin="0" aria-valuemax="100">
                <div
                  className={`cart-free-shipping-fill${qualifiesForFreeShipping ? ' is-complete' : ''}`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Cart Items Area */}
        <div className="cart-drawer__items">
          {cart.length === 0 ? (
            <div className="cart-drawer__empty">
              <div className="cart-empty-squishy-avatar" aria-hidden="true">
                <svg width="74" height="66" viewBox="0 0 100 90" fill="none">
                  {/* Dumpling bun */}
                  <path
                    d="M50 18 C30 18, 12 36, 12 56 C12 74, 30 84, 50 84 C70 84, 88 74, 88 56 C88 36, 70 18, 50 18 Z"
                    fill="url(#cartEmptyBunGrad)"
                  />
                  {/* Top knot */}
                  <path
                    d="M50 10 C46 10, 42 14, 45 19 C48 22, 52 22, 55 19 C58 14, 54 10, 50 10 Z"
                    fill="#ffc8db"
                  />
                  {/* Kawaii Eyes */}
                  <circle cx="36" cy="52" r="3.5" fill="#3c1e40" />
                  <circle cx="64" cy="52" r="3.5" fill="#3c1e40" />
                  {/* Kawaii Blushing Cheeks */}
                  <ellipse cx="30" cy="59" rx="4.5" ry="2.5" fill="#ff9ecb" opacity="0.8" />
                  <ellipse cx="70" cy="59" rx="4.5" ry="2.5" fill="#ff9ecb" opacity="0.8" />
                  {/* Cute Smile */}
                  <path d="M46 60 Q50 64 54 60" stroke="#3c1e40" strokeWidth="2" strokeLinecap="round" />
                  <defs>
                    <linearGradient id="cartEmptyBunGrad" x1="50" y1="18" x2="50" y2="84" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#ffffff" />
                      <stop offset="1" stopColor="#ffe6f0" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              <h3>Your squishy bag is empty!</h3>
              <p>Add a few ultra-soft, slow-rising companions to start relaxing.</p>
              <Link
                to="/shop.html"
                className="cart-empty-cta"
                onClick={onClose}
              >
                Browse 20 Squishies →
              </Link>
            </div>
          ) : (
            <div className="cart-item-list">
              {cart.map((item) => (
                <article className="cart-item squishy-cart-card" key={item.slug}>
                  <div className="cart-item__img-cushion">
                    <img
                      className="cart-item__img"
                      src={`/${item.image.replace(/^\/+/, '')}`}
                      alt={item.name}
                      loading="lazy"
                    />
                  </div>

                  <div className="cart-item__info">
                    <div className="cart-item__header-row">
                      <h3 className="cart-item__title">{item.name}</h3>
                      <button
                        className="cart-item__remove-pill"
                        type="button"
                        onClick={() => removeItem(item.slug)}
                        aria-label={`Remove ${item.name} from cart`}
                        title="Remove squishy"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span>Remove</span>
                      </button>
                    </div>

                    <p className="cart-item__unit-price">{peso(item.price)} each</p>

                    <div className="cart-item__action-bar">
                      <div className="qty-stepper squishy-stepper">
                        <button
                          className="qty-btn"
                          type="button"
                          aria-label={`Decrease quantity of ${item.name}`}
                          disabled={item.qty <= 1}
                          onClick={() => changeQty(item.slug, -1)}
                        >
                          −
                        </button>

                        <span className="qty-value">{item.qty}</span>

                        <button
                          className="qty-btn"
                          type="button"
                          aria-label={`Increase quantity of ${item.name}`}
                          onClick={() => changeQty(item.slug, 1)}
                        >
                          +
                        </button>
                      </div>

                      <strong className="cart-item__line-total">
                        {peso(item.price * item.qty)}
                      </strong>
                    </div>
                  </div>
                </article>
              ))}

              {/* Sensory Quality Guarantee Chip */}
              <div className="cart-trust-ribbon">
                <div className="cart-trust-item">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="2" />
                  </svg>
                  <span>100% Non-Toxic TPR</span>
                </div>
                <div className="cart-trust-item">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                    <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  <span>30–45s Slow-Rise</span>
                </div>
                <div className="cart-trust-item">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" stroke="currentColor" strokeWidth="2" />
                  </svg>
                  <span>Bubble-Wrapped</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {cart.length > 0 && (
          <footer className="cart-drawer__footer">
            <div className="cart-drawer__bill-breakdown">
              <div className="cart-drawer__subtotal">
                <span>Subtotal</span>
                <span>{peso(subtotal)}</span>
              </div>

              <div className="cart-drawer__subtotal">
                <span>Shipping</span>
                <span className={shippingFee === 0 ? 'cart-shipping-free-pill' : ''}>
                  {shippingFee === 0 ? 'FREE' : peso(shippingFee)}
                </span>
              </div>

              <div className="cart-drawer__total-row">
                <span>Estimated Total</span>
                <strong className="cart-drawer__total-amount">{peso(total)}</strong>
              </div>
            </div>

            <button
              className="cart-drawer__checkout-btn"
              type="button"
              onClick={goToCheckout}
            >
              <span>Proceed to Checkout</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            <button
              className="cart-drawer__continue-btn"
              type="button"
              onClick={onClose}
            >
              Continue Browsing
            </button>
          </footer>
        )}
      </aside>
    </>
  );
}
