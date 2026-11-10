import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useCart } from '../context/CartContext';

export default function Header({ onOpenCart }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { totalCount } = useCart();
  const { pathname } = useLocation();

  const isHome = pathname === '/' || pathname === '/index.html';
  const isShop =
    pathname.startsWith('/shop') || pathname.startsWith('/product');
  const isAbout = pathname.startsWith('/about');

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <header className="site-header product-jelly-header" id="top">
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
          <Link
            to="/"
            aria-current={isHome ? 'page' : undefined}
            onClick={closeMenu}
          >
            Home
          </Link>
          <Link
            to="/shop.html"
            aria-current={isShop ? 'page' : undefined}
            onClick={closeMenu}
          >
            Shop
          </Link>
          <Link
            to="/about.html"
            aria-current={isAbout ? 'page' : undefined}
            onClick={closeMenu}
          >
            About
          </Link>
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

          <Link to="/account" className="btn btn--pink btn--sm account-btn">
            Log-in
          </Link>

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
