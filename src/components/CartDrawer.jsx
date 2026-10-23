
import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';

const peso = (amount) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 2,
  }).format(amount);

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

  return (
    <>
      <div
        className="cart-overlay"
        hidden={!isOpen}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={`cart-drawer${isOpen ? ' is-open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Your cart"
        aria-hidden={!isOpen}
        inert={!isOpen}
      >
        <header className="cart-drawer__header">
          <h2>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M6 8h12l-1 12H7L6 8Z"
                stroke="#FF6B95"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
              <path
                d="M9 8V6a3 3 0 0 1 6 0v2"
                stroke="#FF6B95"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
            Your Cart ({totalCount})
          </h2>

          <button
            className="cart-drawer__close"
            type="button"
            onClick={onClose}
            aria-label="Close cart"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M5 5l14 14M19 5L5 19"
                stroke="#2D1B3D"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>

        <div className="cart-drawer__items">
          {cart.length === 0 ? (
            <div className="cart-drawer__empty">
              <p>Your cart is looking a little squishy-empty!</p>
              <Link
                to="/shop.html"
                className="btn btn--pink btn--sm"
                onClick={onClose}
              >
                Find Your Squish
              </Link>
            </div>
          ) : (
            cart.map((item) => (
              <article className="cart-item" key={item.slug}>
                <img
                  className="cart-item__img"
                  src={`/${item.image.replace(/^\/+/, '')}`}
                  alt={item.name}
                />

                <div className="cart-item__info">
                  <h3>{item.name}</h3>
                  <p className="cart-item__price">{peso(item.price)}</p>

                  <div className="cart-item__row">
                    <div className="qty-stepper">
                      <button
                        className="qty-btn"
                        type="button"
                        aria-label={`Remove one ${item.name}`}
                        disabled={item.qty <= 1}
                        onClick={() => changeQty(item.slug, -1)}
                      >
                        −
                      </button>

                      <span className="qty-value">{item.qty}</span>

                      <button
                        className="qty-btn"
                        type="button"
                        aria-label={`Add one ${item.name}`}
                        onClick={() => changeQty(item.slug, 1)}
                      >
                        +
                      </button>
                    </div>

                    <button
                      className="cart-item__remove"
                      type="button"
                      onClick={() => removeItem(item.slug)}
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <strong className="cart-item__price">
                  {peso(item.price * item.qty)}
                </strong>
              </article>
            ))
          )}
        </div>

        {cart.length > 0 && (
          <footer className="cart-drawer__footer">
            <div className="cart-drawer__subtotal">
              <span>Subtotal</span>
              <span>{peso(subtotal)}</span>
            </div>

            <div className="cart-drawer__subtotal">
              <span>Shipping</span>
              <span>{shippingFee === 0 ? 'Free' : peso(shippingFee)}</span>
            </div>

            <p className="cart-drawer__shipping">
              {subtotal >= 500
                ? 'Yay! Your order qualifies for free shipping.'
                : `Spend ${peso(500 - subtotal)} more for free shipping!`}
            </p>

            <div className="cart-drawer__subtotal">
              <strong>Total</strong>
              <strong>{peso(total)}</strong>
            </div>

            <button
              className="btn btn--pink cart-drawer__checkout"
              type="button"
              onClick={goToCheckout}
            >
              Checkout →
            </button>

            <button
              className="cart-drawer__continue"
              type="button"
              onClick={onClose}
            >
              Continue Shopping
            </button>
          </footer>
        )}
      </aside>
    </>
  );
}
