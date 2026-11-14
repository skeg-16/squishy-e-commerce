import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

export default function Header({ onOpenCart }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoSquishing, setLogoSquishing] = useState(false);
  const { totalCount } = useCart();
  const { isDark, toggleTheme } = useTheme();
  const { user, authenticated } = useAuth();
  const { pathname } = useLocation();

  const isHome = pathname === '/' || pathname === '/index.html';
  const isShop =
    pathname.startsWith('/shop') || pathname.startsWith('/product');
  const isAbout = pathname.startsWith('/about');
  const isAccount = pathname.startsWith('/account');

  function closeMenu() {
    setMenuOpen(false);
  }

  function triggerLogoSquish() {
    setLogoSquishing(false);
    requestAnimationFrame(() => {
      setLogoSquishing(true);
    });
  }

  return (
    <header className="site-header product-jelly-header site-header--jelly-dock" id="top">
      <div className="container header__outer">
        <div className="header__inner header__dock">
          <Link
            to="/"
            className={`logo logo--jelly${logoSquishing ? ' is-squishing' : ''}`}
            onClick={() => {
              closeMenu();
              triggerLogoSquish();
            }}
            onPointerDown={triggerLogoSquish}
            onAnimationEnd={() => setLogoSquishing(false)}
          >
            <span className="logo__orb" aria-hidden="true">
              <img
                src="/assets/images/logo-mark.svg"
                alt=""
                className="logo__mark"
                width="30"
                height="30"
              />
            </span>
            <span className="logo__wordmark">
              <span className="logo__text">Squishies</span>
            </span>
          </Link>

          <nav
            className={`main-nav main-nav--dock${menuOpen ? ' is-open' : ''}`}
            id="mainNav"
            aria-label="Primary"
          >
            <Link
              to="/"
              aria-current={isHome ? 'page' : undefined}
              onClick={closeMenu}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3 10.5 12 3l9 7.5" />
                <path d="M5 9.5V19a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9.5" />
              </svg>
              <span>Home</span>
            </Link>
            <Link
              to="/shop.html"
              aria-current={isShop ? 'page' : undefined}
              onClick={closeMenu}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 2 3 7l9 5 9-5-9-5Z" />
                <path d="m3 17 9 5 9-5" />
                <path d="m3 12 9 5 9-5" />
              </svg>
              <span>Shop</span>
            </Link>
            <Link
              to="/about.html"
              aria-current={isAbout ? 'page' : undefined}
              onClick={closeMenu}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
              </svg>
              <span>About</span>
            </Link>
          </nav>

          <div className="header__actions header__actions--dock">
            <Link to="/shop.html" className="btn btn--pink btn--sm header__cta-pill">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.3"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 3v3m0 12v3M3 12h3m12 0h3m-2.6-6.4-2.1 2.1M8.7 15.3l-2.1 2.1m0-11.8 2.1 2.1m6.6 6.6 2.1 2.1" />
              </svg>
              <span>Shop Now</span>
            </Link>

            <button
              className="cart-btn cart-btn--dock"
              type="button"
              onClick={onOpenCart}
              aria-label={`View cart, ${totalCount} items`}
              aria-haspopup="dialog"
            >
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M6 6h15l-1.5 9h-12L5 3H2"
                  stroke="currentColor"
                  strokeWidth="2.1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="9" cy="20" r="1.6" fill="currentColor" />
                <circle cx="18" cy="20" r="1.6" fill="currentColor" />
              </svg>
              <span className="cart-btn__label">Bag</span>
              <span className="cart-btn__count">{totalCount}</span>
            </button>

            <Link
              to={authenticated ? '/account?mode=account' : '/account?mode=login'}
              className={`account-btn account-btn--dock${isAccount ? ' is-active' : ''}${authenticated ? ' is-authenticated' : ''}`}
              aria-current={isAccount ? 'page' : undefined}
              title={
                authenticated
                  ? `Signed in as @${user?.username} • Account & Orders`
                  : 'Collector Account • Log In & Orders'
              }
              onClick={closeMenu}
            >
              <span className="account-btn__avatar" aria-hidden="true">
                {authenticated && user?.username ? (
                  <span className="account-btn__initial">
                    {user.username.slice(0, 1).toUpperCase()}
                  </span>
                ) : (
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="8" r="4" />
                    <path d="M20 21a8 8 0 0 0-16 0" />
                  </svg>
                )}
              </span>
              <span className="account-btn__label">
                {authenticated && user?.username ? `@${user.username}` : 'Log In'}
              </span>
            </Link>

            <button
              type="button"
              className={`theme-toggle-btn${isDark ? ' is-dark' : ''}`}
              onClick={toggleTheme}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-pressed={isDark}
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Plum Mode'}
            >
              <span className="theme-toggle-btn__track" aria-hidden="true">
                {isDark ? (
                  <svg
                    className="theme-icon theme-icon--sun"
                    width="17"
                    height="17"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="4.5" />
                    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
                  </svg>
                ) : (
                  <svg
                    className="theme-icon theme-icon--moon"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                )}
              </span>
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
      </div>
    </header>
  );
}
