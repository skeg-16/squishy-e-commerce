/* ==========================================================================
   SQUISHIES — cart.js
   Shared cart state + cart drawer, loaded on every page.
   Cart persists in localStorage so it survives navigation between pages.
   1. Storage helpers
   2. Cart state (add / update qty / remove)
   3. Cart drawer (open, close, render)
   4. Toast notifications
   5. Mobile navigation toggle
   6. Header shadow on scroll
   ========================================================================== */

const Squishies = (() => {

  const CART_KEY = 'siso-squishies-cart';
  const FREE_SHIPPING_THRESHOLD = 500;
  const FLAT_SHIPPING_FEE = 60;

  /* ------------------------------------------------------------------ *
   * 1. Storage helpers
   * ------------------------------------------------------------------ */
  function loadCart() {
    try {
      const raw = localStorage.getItem(CART_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (err) {
      return [];
    }
  }

  function saveCart(cart) {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch (err) {
      /* localStorage unavailable — cart just won't persist across pages */
    }
  }

  /* ------------------------------------------------------------------ *
   * 2. Cart state
   * ------------------------------------------------------------------ */
  let cart = loadCart();
  const listeners = [];

  function onChange(fn) { listeners.push(fn); }
  function notify() { listeners.forEach((fn) => fn(cart)); }

  function formatPeso(amount) {
    return '₱' + Math.round(amount).toLocaleString('en-PH', { maximumFractionDigits: 0 });
  }

  function findItem(name) {
    return cart.find((item) => item.name === name);
  }

  function addToCart(name, price, image, qty = 1) {
    const existing = findItem(name);
    if (existing) {
      existing.qty += qty;
    } else {
      cart.push({ name, price, image, qty });
    }
    saveCart(cart);
    notify();
  }

  function changeQty(name, delta) {
    const item = findItem(name);
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) {
      cart = cart.filter((i) => i.name !== name);
    }
    saveCart(cart);
    notify();
  }

  function removeItem(name) {
    cart = cart.filter((i) => i.name !== name);
    saveCart(cart);
    notify();
  }

  function clearCart() {
    cart = [];
    saveCart(cart);
    notify();
  }

  function getCart() { return cart; }

  function totalCount() {
    return cart.reduce((sum, item) => sum + item.qty, 0);
  }

  function subtotal() {
    return cart.reduce((sum, item) => sum + item.qty * item.price, 0);
  }

  function shippingFee() {
    if (cart.length === 0) return 0;
    return subtotal() >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING_FEE;
  }

  function total() {
    return subtotal() + shippingFee();
  }

  /* ------------------------------------------------------------------ *
   * 3. Cart drawer
   * ------------------------------------------------------------------ */
  let els = {};

  function initDrawer() {
    els = {
      cartBtn: document.getElementById('cartBtn'),
      cartCountEl: document.getElementById('cartCount'),
      cartDrawer: document.getElementById('cartDrawer'),
      cartOverlay: document.getElementById('cartOverlay'),
      cartItemsEl: document.getElementById('cartItems'),
      cartSubtotalEl: document.getElementById('cartSubtotal'),
      cartFooterEl: document.getElementById('cartFooter'),
      cartCloseBtn: document.getElementById('cartCloseBtn'),
      continueShoppingBtn: document.getElementById('continueShoppingBtn'),
      checkoutBtn: document.getElementById('checkoutBtn'),
    };

    if (!els.cartDrawer) return; // page has no cart drawer markup

    els.cartBtn.addEventListener('click', openCart);
    els.cartCloseBtn.addEventListener('click', closeCart);
    els.cartOverlay.addEventListener('click', closeCart);
    if (els.continueShoppingBtn) els.continueShoppingBtn.addEventListener('click', closeCart);

    if (els.checkoutBtn) {
      els.checkoutBtn.addEventListener('click', () => {
        if (cart.length === 0) return;
        const onCheckoutPage = /checkout\.html$/.test(window.location.pathname);
        if (onCheckoutPage) {
          closeCart();
        } else {
          window.location.href = 'checkout.html';
        }
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && els.cartDrawer.classList.contains('is-open')) {
        closeCart();
      }
    });

    onChange(renderDrawer);
    renderDrawer(cart);
  }

  function openCart() {
    if (!els.cartDrawer) return;
    els.cartDrawer.classList.add('is-open');
    els.cartDrawer.setAttribute('aria-hidden', 'false');
    els.cartOverlay.hidden = false;
    requestAnimationFrame(() => els.cartOverlay.classList.add('is-visible'));
    document.body.classList.add('cart-open');
    els.cartCloseBtn.focus();
  }

  function closeCart() {
    if (!els.cartDrawer) return;
    els.cartDrawer.classList.remove('is-open');
    els.cartDrawer.setAttribute('aria-hidden', 'true');
    els.cartOverlay.classList.remove('is-visible');
    document.body.classList.remove('cart-open');
    setTimeout(() => { els.cartOverlay.hidden = true; }, 250);
  }

  function renderDrawer(currentCart) {
    if (!els.cartDrawer) return;

    const count = totalCount();
    els.cartCountEl.textContent = String(count);
    els.cartBtn.setAttribute('aria-label', `View cart, ${count} item${count === 1 ? '' : 's'}`);

    els.cartItemsEl.innerHTML = '';

    if (currentCart.length === 0) {
      els.cartItemsEl.innerHTML = `
        <div class="cart-drawer__empty">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
            <path d="M6 8h12l-1 12H7L6 8Z" stroke="#B7ADC0" stroke-width="1.6" stroke-linejoin="round"/>
            <path d="M9 8V6a3 3 0 0 1 6 0v2" stroke="#B7ADC0" stroke-width="1.6" stroke-linecap="round"/>
          </svg>
          <span>Your cart is empty.<br>Add a squishy to get started!</span>
        </div>`;
      els.cartFooterEl.style.display = 'none';
      return;
    }

    els.cartFooterEl.style.display = 'flex';

    currentCart.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'cart-item';
      row.innerHTML = `
        <img class="cart-item__img" src="${item.image}" alt="" width="60" height="60">
        <div class="cart-item__info">
          <h3>${item.name}</h3>
          <p class="cart-item__price">${formatPeso(item.price)}</p>
          <div class="cart-item__row">
            <div class="qty-stepper">
              <button class="qty-btn qty-minus" aria-label="Decrease quantity of ${item.name}">−</button>
              <span class="qty-value">${item.qty}</span>
              <button class="qty-btn qty-plus" aria-label="Increase quantity of ${item.name}">+</button>
            </div>
            <button class="cart-item__remove">Remove</button>
          </div>
        </div>`;

      row.querySelector('.qty-minus').addEventListener('click', () => changeQty(item.name, -1));
      row.querySelector('.qty-plus').addEventListener('click', () => changeQty(item.name, 1));
      row.querySelector('.cart-item__remove').addEventListener('click', () => removeItem(item.name));

      els.cartItemsEl.appendChild(row);
    });

    els.cartSubtotalEl.textContent = formatPeso(subtotal());

    const shippingEl = els.cartFooterEl.querySelector('.cart-drawer__shipping');
    const remaining = FREE_SHIPPING_THRESHOLD - subtotal();
    if (shippingEl) {
      shippingEl.lastChild.textContent = remaining > 0
        ? ` Add ${formatPeso(remaining)} more for free shipping`
        : ' Free shipping unlocked!';
    }
  }

  /* Wire up any ".add-to-cart" button found on the current page */
  function bindAddToCartButtons(root = document) {
    root.querySelectorAll('.add-to-cart').forEach((btn) => {
      btn.addEventListener('click', () => {
        const name = btn.dataset.name || 'Squishy';
        const price = Number(btn.dataset.price || 0);
        const image = btn.dataset.image || 'assets/images/logo-mark.svg';
        const qty = Number(btn.dataset.qty || 1);
        addToCart(name, price, image, qty);
        showToast(`${name} added to cart 🧸`);
      });
    });
  }

  /* ------------------------------------------------------------------ *
   * 4. Toast notifications
   * ------------------------------------------------------------------ */
  let toastTimer = null;

  function showToast(message) {
    const toastEl = document.getElementById('toast');
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add('is-visible');

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.remove('is-visible');
    }, 2200);
  }

  /* ------------------------------------------------------------------ *
   * 5. Mobile navigation toggle
   * ------------------------------------------------------------------ */
  function initMobileNav() {
    const menuToggle = document.getElementById('menuToggle');
    const mainNav = document.getElementById('mainNav');
    if (!menuToggle || !mainNav) return;

    menuToggle.addEventListener('click', () => {
      const isOpen = mainNav.classList.toggle('is-open');
      menuToggle.setAttribute('aria-expanded', String(isOpen));
      menuToggle.classList.toggle('is-active', isOpen);
    });

    mainNav.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        mainNav.classList.remove('is-open');
        menuToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ------------------------------------------------------------------ *
   * 6. Header shadow on scroll
   * ------------------------------------------------------------------ */
  function initHeaderShadow() {
    const header = document.querySelector('.site-header');
    if (!header) return;
    const onScroll = () => {
      header.style.boxShadow = window.scrollY > 8
        ? '0 8px 20px -14px rgba(45,27,61,0.35)'
        : 'none';
    };
    document.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ------------------------------------------------------------------ *
   * Init — runs on every page that includes this script
   * ------------------------------------------------------------------ */
  function init() {
    initMobileNav();
    initHeaderShadow();
    initDrawer();
    bindAddToCartButtons();
  }

  document.addEventListener('DOMContentLoaded', init);

  // Public API used by page-specific scripts (product.js, checkout.js, shop filters)
  return {
    formatPeso,
    addToCart,
    changeQty,
    removeItem,
    clearCart,
    getCart,
    totalCount,
    subtotal,
    shippingFee,
    total,
    onChange,
    showToast,
    bindAddToCartButtons,
    FREE_SHIPPING_THRESHOLD,
  };

})();
