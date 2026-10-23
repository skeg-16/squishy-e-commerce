
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';

export default function Header({ onOpenCart }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { totalCount } = useCart();

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <header className="site-header" id="top">
      <div className="container header__inner">
        <Link to="/" className="logo" onClick={closeMenu}>
          <img
            src="/assets/images/logo-mark.svg"
            alt=""
            className="logo__mark"
            width="36"
            height="36"
          />
          <span className="logo__text">Squishies</span>
        </Link>

        <nav
          className={`main-nav${menuOpen ? ' is-open' : ''}`}
          id="mainNav"
        >
          <Link to="/" onClick={closeMenu}>Home</Link>
          <Link to="/shop.html" onClick={closeMenu}>Shop</Link>
          <Link to="/about.html" onClick={closeMenu}>About</Link>
        </nav>

        <div className="header__actions">
          <Link to="/shop.html" className="btn btn--pink btn--sm">
            Shop Now
          </Link>

          <button
            className="cart-btn"
            type="button"
            onClick={onOpenCart}
            aria-label={`View cart, ${totalCount} items`}
            aria-haspopup="dialog"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M6 6h15l-1.5 9h-12L5 3H2"
                stroke="#2D1B3D"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="9" cy="20" r="1.5" fill="#2D1B3D" />
              <circle cx="18" cy="20" r="1.5" fill="#2D1B3D" />
            </svg>

            <span className="cart-btn__count">{totalCount}</span>
          </button>

          <button
            className={`menu-toggle${menuOpen ? ' is-active' : ''}`}
            id="menuToggle"
            type="button"
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
            aria-controls="mainNav"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </div>
    </header>
  );
}
