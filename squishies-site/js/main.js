/* ==========================================================================
   SQUISHIES — main.js
   1. Mobile navigation toggle
   2. Cart state (add to cart + counter)
   3. Toast notifications
   4. Header shadow on scroll
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

  /* ------------------------------------------------------------------ *
   * 1. Mobile navigation toggle
   * ------------------------------------------------------------------ */
  const menuToggle = document.getElementById('menuToggle');
  const mainNav = document.getElementById('mainNav');

  if (menuToggle && mainNav) {
    menuToggle.addEventListener('click', () => {
      const isOpen = mainNav.classList.toggle('is-open');
      menuToggle.setAttribute('aria-expanded', String(isOpen));
      menuToggle.classList.toggle('is-active', isOpen);
    });

    // Close menu when a nav link is tapped (mobile)
    mainNav.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        mainNav.classList.remove('is-open');
        menuToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ------------------------------------------------------------------ *
   * 2. Cart state
   * ------------------------------------------------------------------ */
  const cartCountEl = document.getElementById('cartCount');
  const cartBtn = document.getElementById('cartBtn');
  const addToCartButtons = document.querySelectorAll('.add-to-cart');

  let cart = {
    items: [],   // { name, price, qty }
    count: 0,
  };

  function updateCartUI() {
    cartCountEl.textContent = String(cart.count);
    cartBtn.setAttribute('aria-label', `View cart, ${cart.count} item${cart.count === 1 ? '' : 's'}`);
  }

  function addToCart(name, price) {
    const existing = cart.items.find((item) => item.name === name);
    if (existing) {
      existing.qty += 1;
    } else {
      cart.items.push({ name, price, qty: 1 });
    }
    cart.count += 1;
    updateCartUI();
    showToast(`${name} added to cart 🧸`);
  }

  addToCartButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const name = btn.dataset.name || 'Squishy';
      const price = Number(btn.dataset.price || 0);
      addToCart(name, price);
    });
  });

  /* ------------------------------------------------------------------ *
   * 3. Toast notifications
   * ------------------------------------------------------------------ */
  const toastEl = document.getElementById('toast');
  let toastTimer = null;

  function showToast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add('is-visible');

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.remove('is-visible');
    }, 2200);
  }

  /* ------------------------------------------------------------------ *
   * 4. Header shadow on scroll
   * ------------------------------------------------------------------ */
  const header = document.querySelector('.site-header');
  const onScroll = () => {
    if (window.scrollY > 8) {
      header.style.boxShadow = '0 8px 20px -14px rgba(45,27,61,0.35)';
    } else {
      header.style.boxShadow = 'none';
    }
  };
  document.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

});
