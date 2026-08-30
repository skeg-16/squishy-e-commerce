/* ==========================================================================
   SQUISHIES — main.js
   1. Mobile navigation toggle
   2. Cart state (add / update qty / remove)
   3. Cart drawer (open, close, render)
   4. Toast notifications
   5. Shop page — search & category filter
   6. Header shadow on scroll
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
  // Each item: { name, price, image, qty }
  let cart = [];

  const FREE_SHIPPING_THRESHOLD = 500;

  function formatPeso(amount) {
    return '₱' + amount.toLocaleString('en-PH', { maximumFractionDigits: 0 });
  }

  function findItem(name) {
    return cart.find((item) => item.name === name);
  }

  function addToCart(name, price, image) {
    const existing = findItem(name);
    if (existing) {
      existing.qty += 1;
    } else {
      cart.push({ name, price, image, qty: 1 });
    }
    renderCart();
    showToast(`${name} added to cart 🧸`);
  }

  function changeQty(name, delta) {
    const item = findItem(name);
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) {
      cart = cart.filter((i) => i.name !== name);
    }
    renderCart();
  }

  function removeItem(name) {
    cart = cart.filter((i) => i.name !== name);
    renderCart();
  }

  function cartTotalCount() {
    return cart.reduce((sum, item) => sum + item.qty, 0);
  }

  function cartSubtotal() {
    return cart.reduce((sum, item) => sum + item.qty * item.price, 0);
  }

  /* ------------------------------------------------------------------ *
   * 3. Cart drawer
   * ------------------------------------------------------------------ */
  const cartBtn = document.getElementById('cartBtn');
  const cartCountEl = document.getElementById('cartCount');
  const cartDrawer = document.getElementById('cartDrawer');
  const cartOverlay = document.getElementById('cartOverlay');
  const cartItemsEl = document.getElementById('cartItems');
  const cartSubtotalEl = document.getElementById('cartSubtotal');
  const cartFooterEl = document.getElementById('cartFooter');
  const cartCloseBtn = document.getElementById('cartCloseBtn');
  const continueShoppingBtn = document.getElementById('continueShoppingBtn');
  const checkoutBtn = document.getElementById('checkoutBtn');

  function openCart() {
    cartDrawer.classList.add('is-open');
    cartDrawer.setAttribute('aria-hidden', 'false');
    cartOverlay.hidden = false;
    requestAnimationFrame(() => cartOverlay.classList.add('is-visible'));
    document.body.classList.add('cart-open');
    cartCloseBtn.focus();
  }

  function closeCart() {
    cartDrawer.classList.remove('is-open');
    cartDrawer.setAttribute('aria-hidden', 'true');
    cartOverlay.classList.remove('is-visible');
    document.body.classList.remove('cart-open');
    setTimeout(() => { cartOverlay.hidden = true; }, 250);
    cartBtn.focus();
  }

  function renderCart() {
    // Header count badge
    const count = cartTotalCount();
    cartCountEl.textContent = String(count);
    cartBtn.setAttribute('aria-label', `View cart, ${count} item${count === 1 ? '' : 's'}`);

    // Items list
    cartItemsEl.innerHTML = '';

    if (cart.length === 0) {
      cartItemsEl.innerHTML = `
        <div class="cart-drawer__empty">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
            <path d="M6 8h12l-1 12H7L6 8Z" stroke="#B7ADC0" stroke-width="1.6" stroke-linejoin="round"/>
            <path d="M9 8V6a3 3 0 0 1 6 0v2" stroke="#B7ADC0" stroke-width="1.6" stroke-linecap="round"/>
          </svg>
          <span>Your cart is empty.<br>Add a squishy to get started!</span>
        </div>`;
      cartFooterEl.style.display = 'none';
      return;
    }

    cartFooterEl.style.display = 'flex';

    cart.forEach((item) => {
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

      cartItemsEl.appendChild(row);
    });

    // Subtotal + shipping message
    const subtotal = cartSubtotal();
    cartSubtotalEl.textContent = formatPeso(subtotal);

    const shippingEl = cartFooterEl.querySelector('.cart-drawer__shipping');
    const remaining = FREE_SHIPPING_THRESHOLD - subtotal;
    shippingEl.lastChild.textContent = remaining > 0
      ? ` Add ${formatPeso(remaining)} more for free shipping`
      : ' Free shipping unlocked!';
  }

  // Wire up every "Add to Cart" style button on the page
  document.querySelectorAll('.add-to-cart').forEach((btn) => {
    btn.addEventListener('click', () => {
      const name = btn.dataset.name || 'Squishy';
      const price = Number(btn.dataset.price || 0);
      const image = btn.dataset.image || 'assets/images/logo-mark.svg';
      addToCart(name, price, image);
    });
  });

  cartBtn.addEventListener('click', openCart);
  cartCloseBtn.addEventListener('click', closeCart);
  cartOverlay.addEventListener('click', closeCart);
  continueShoppingBtn.addEventListener('click', closeCart);

  checkoutBtn.addEventListener('click', () => {
    if (cart.length === 0) return;
    showToast('Taking you to checkout… 🎀');
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && cartDrawer.classList.contains('is-open')) {
      closeCart();
    }
  });

  // Initial render (shows empty state)
  renderCart();

  /* ------------------------------------------------------------------ *
   * 4. Toast notifications
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
   * 5. Shop page — search & category filter
   * ------------------------------------------------------------------ */
  const shopGrid = document.getElementById('shopGrid');

  if (shopGrid) {
    const searchInput = document.getElementById('shopSearch');
    const filterPills = document.querySelectorAll('.filter-pill');
    const shopEmpty = document.getElementById('shopEmpty');
    const cards = Array.from(shopGrid.querySelectorAll('.product-card'));

    let activeFilter = 'all';

    function applyShopFilters() {
      const query = (searchInput.value || '').trim().toLowerCase();
      let visibleCount = 0;

      cards.forEach((card) => {
        const matchesCategory = activeFilter === 'all' || card.dataset.category === activeFilter;
        const matchesSearch = card.dataset.name.includes(query);
        const show = matchesCategory && matchesSearch;
        card.hidden = !show;
        if (show) visibleCount += 1;
      });

      shopEmpty.hidden = visibleCount !== 0;
    }

    searchInput.addEventListener('input', applyShopFilters);

    filterPills.forEach((pill) => {
      pill.addEventListener('click', () => {
        filterPills.forEach((p) => p.classList.remove('is-active'));
        pill.classList.add('is-active');
        activeFilter = pill.dataset.filter;
        applyShopFilters();
      });
    });

    // "View Item" is a placeholder until individual product pages exist
    shopGrid.querySelectorAll('.view-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        const name = btn.closest('.product-card').querySelector('h3').textContent;
        showToast(`${name} — full product page coming soon!`);
      });
    });
  }

  /* ------------------------------------------------------------------ *
   * 6. Header shadow on scroll
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
