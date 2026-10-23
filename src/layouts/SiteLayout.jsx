import { useCallback, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Header from '../components/Header';
import CartDrawer from '../components/CartDrawer';
import { useCart } from '../context/CartContext';

export default function SiteLayout() {
  const [cartOpen, setCartOpen] = useState(false);
  const { toast } = useCart();

  const openCart = useCallback(() => setCartOpen(true), []);
  const closeCart = useCallback(() => setCartOpen(false), []);

  return (
    <>
      <Header onOpenCart={openCart} />

      <main>
        <Outlet />
      </main>

      <footer className="site-footer" id="about">
        <div className="container footer__inner">
          <div className="footer__brand">
            <a href="/#top" className="logo logo--footer">
              <img
                src="/assets/images/logo-mark.svg"
                alt=""
                className="logo__mark"
                width="32"
                height="32"
              />
              <span className="logo__text">Squishies</span>
            </a>

            <p>
              Soft, slow-rising, and impossibly cute. Made to squeeze the
              stress away — one satisfying squish at a time.
            </p>
            <p className="footer__by">By Team SISO · Philippines</p>
          </div>

          <div className="footer__col">
            <h4>Quick Links</h4>
            <a href="/shop.html">Shop</a>
            <a href="/about.html">About</a>
          </div>

          <div className="footer__col">
            <h4>Get in Touch</h4>
            <a href="mailto:siso@gmail.com" className="footer__email">
              siso@gmail.com
            </a>
            <p className="footer__note">
              Orders dispatched within 1–3 business days.
              <br />
              Philippines-wide delivery available.
            </p>
          </div>
        </div>

        <div className="container footer__bottom">
          <p>© 2026 Squishies by Team SISO. All rights reserved.</p>
          <p>Ultra-soft. Slow-rising. Always cute.</p>
        </div>
      </footer>

      <CartDrawer isOpen={cartOpen} onClose={closeCart} />

      <div
        className={`toast${toast ? ' is-visible' : ''}`}
        role="status"
        aria-live="polite"
      >
        {toast || ''}
      </div>
    </>
  );
}
