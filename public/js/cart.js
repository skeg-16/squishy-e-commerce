/* Cart state and existing drawer presentation. Prices here are display estimates;
   checkout always obtains an authoritative quote from the server. */
const Squishies = (() => {
  const CART_KEY = 'siso-squishies-cart';
  const FREE_SHIPPING_THRESHOLD = 500;
  const legacy = {
    'Steamed Dumpling Squishy': 'dumpling', 'Cheese Cube Squishy': 'cheese', 'Cat Paw Squishy': 'catpaw',
    'Pastel Toast Squishy': 'toast', 'Butter Stick Squishy': 'butter', 'Peanut Squishy': 'peanut',
    'Solo Squish': 'solo-squish', 'Stress-Free Trio': 'stress-free-trio', "Collector's Box": 'collectors-box', 'Wholesale / Party Pack': 'party-pack'
  };
  const names = Object.fromEntries(Object.entries(legacy).map(([name, slug]) => [slug, name]));
  const bundlePrices = { 'solo-squish': 89, 'stress-free-trio': 249, 'collectors-box': 459, 'party-pack': 1400 };
  const bundleImages = { 'solo-squish': 'dumpling', 'stress-free-trio': 'catpaw', 'party-pack': 'peanut' };
  const imageFor = slug => slug === 'collectors-box' ? 'assets/images/hero-collage.svg' : `assets/images/product-${bundleImages[slug] || slug}.svg`;
  let dropped = false;
  function loadCart(fallback = []) {
    try {
      const saved = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
      if (!Array.isArray(saved)) return [];
      const migrated = new Map();
      for (const item of saved) {
        const slug = item && (Object.hasOwn(names, item.slug) ? item.slug : Object.hasOwn(legacy, item.name) ? legacy[item.name] : null);
        if (!slug || !Number.isInteger(item.qty) || item.qty < 1 || item.qty > 99) { dropped = true; continue; }
        const existing = migrated.get(slug);
        if (existing) existing.qty = Math.min(99, existing.qty + item.qty);
        else migrated.set(slug, { slug, name: names[slug], price: bundlePrices[slug] || 89, image: imageFor(slug), qty: item.qty });
      }
      return [...migrated.values()];
    } catch { return fallback; }
  }
  let cart = loadCart();
  let locked = false;
  const listeners = new Set();
  const catalog = new Map();
  function save() { try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch { /* Current-page cart remains usable. */ } }
  const notify = () => { save(); listeners.forEach(fn => fn(getCart())); };
  const onChange = fn => { listeners.add(fn); return () => listeners.delete(fn); };
  const getCart = () => cart.map(i => ({ ...i }));
  const formatPeso = amount => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: Number.isInteger(amount) ? 0 : 2 }).format(amount);
  const totalCount = () => cart.reduce((sum, i) => sum + i.qty, 0);
  const subtotal = () => cart.reduce((sum, i) => sum + i.qty * i.price, 0);
  const shippingFee = () => !cart.length || subtotal() >= FREE_SHIPPING_THRESHOLD ? 0 : 60;
  function addToCart(product, qty = 1) {
    if (locked) return showToast('Please wait for the checkout request to finish.');
    if (!product || !Object.hasOwn(names, product.slug)) return showToast('This product could not be loaded. Please refresh.');
    const existing = cart.find(i => i.slug === product.slug);
    const total = (existing?.qty || 0) + qty;
    if (!Number.isInteger(qty) || qty < 1 || total > Math.min(99, product.stockQuantity ?? 99)) return showToast('That quantity is unavailable.');
    if (existing) existing.qty = total;
    else cart.push({ slug: product.slug, name: product.name, price: product.price, image: imageFor(product.slug), qty });
    notify(); showToast(`${product.name} added to cart.`); return true;
  }
  function changeQty(slug, delta) {
    if (locked) return;
    const item = cart.find(i => i.slug === slug);
    if (!item) return;
    const qty = item.qty + delta;
    if (qty > 99 || (delta > 0 && catalog.has(slug) && qty > catalog.get(slug).stockQuantity)) return showToast('That quantity is unavailable.');
    if (qty <= 0) cart = cart.filter(i => i.slug !== slug); else item.qty = qty;
    notify();
  }
  function removeItem(slug) { if (!locked) { cart = cart.filter(i => i.slug !== slug); notify(); } }
  function clearCart() { cart = []; notify(); }
  function syncProducts(products) {
    if (!locked) cart = loadCart(cart);
    for (const p of products) catalog.set(p.slug, p);
    for (const i of cart) { const p = catalog.get(i.slug); if (p) { i.price = p.price; i.name = p.name; } }
    notify();
  }
  let toastTimer;
  function showToast(message) {
    const toast = document.getElementById('toast'); if (!toast) return;
    toast.textContent = message; toast.classList.add('is-visible');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 4000);
  }
  let els = {}, previousFocus;
  function openCart() {
    if (!els.drawer) return;
    previousFocus = document.activeElement;
    els.drawer.classList.add('is-open'); els.drawer.setAttribute('aria-hidden', 'false'); els.drawer.inert = false;
    els.overlay.hidden = false; requestAnimationFrame(() => els.overlay.classList.add('is-visible'));
    document.body.classList.add('cart-open'); els.close.focus();
  }
  function closeCart() {
    if (!els.drawer) return;
    els.drawer.classList.remove('is-open'); els.drawer.setAttribute('aria-hidden', 'true'); els.drawer.inert = true;
    els.overlay.classList.remove('is-visible'); document.body.classList.remove('cart-open');
    setTimeout(() => { if (!els.drawer.classList.contains('is-open')) els.overlay.hidden = true; }, 250);
    previousFocus?.focus();
  }
  function renderDrawer() {
    if (!els.drawer) return;
    const count = totalCount(); document.getElementById('cartCount').textContent = count;
    els.button.setAttribute('aria-label', `View cart, ${count} items`);
    const items = document.getElementById('cartItems'); items.replaceChildren();
    const footer = document.getElementById('cartFooter'); footer.style.display = cart.length ? 'flex' : 'none';
    if (!cart.length) {
      const empty = document.createElement('div'); empty.className = 'cart-drawer__empty'; empty.textContent = 'Your cart is empty. Add a squishy to get started!'; items.append(empty); return;
    }
    for (const item of cart) {
      const row = document.createElement('div'); row.className = 'cart-item';
      row.innerHTML = '<img class="cart-item__img" alt="" width="60" height="60"><div class="cart-item__info"><h3></h3><p class="cart-item__price"></p><div class="cart-item__row"><div class="qty-stepper"><button class="qty-btn qty-minus">−</button><span class="qty-value"></span><button class="qty-btn qty-plus">+</button></div><button class="cart-item__remove">Remove</button></div></div>';
      row.querySelector('img').src = item.image; row.querySelector('h3').textContent = item.name;
      row.querySelector('.cart-item__price').textContent = formatPeso(item.price); row.querySelector('.qty-value').textContent = item.qty;
      const minus = row.querySelector('.qty-minus'), plus = row.querySelector('.qty-plus');
      minus.setAttribute('aria-label', `Decrease quantity of ${item.name}`); plus.setAttribute('aria-label', `Increase quantity of ${item.name}`);
      minus.onclick = () => changeQty(item.slug, -1); plus.onclick = () => changeQty(item.slug, 1);
      row.querySelector('.cart-item__remove').onclick = () => removeItem(item.slug);
      items.append(row);
    }
    document.getElementById('cartSubtotal').textContent = formatPeso(subtotal());
    const note = footer.querySelector('.cart-drawer__shipping');
    const remaining = FREE_SHIPPING_THRESHOLD - subtotal();
    if (note) note.lastChild.textContent = remaining > 0 ? ` Add ${formatPeso(remaining)} more for free shipping` : ' Free shipping unlocked!';
  }
  function bindAddToCartButtons(root = document) {
    root.querySelectorAll('.add-to-cart').forEach(button => {
      if (button.dataset.bound) return; button.dataset.bound = 'true';
      button.dataset.slug ||= legacy[button.dataset.name] || '';
      button.disabled = true;
      button.onclick = () => addToCart(catalog.get(button.dataset.slug));
    });
  }
  document.addEventListener('DOMContentLoaded', () => {
    const menuToggle = document.getElementById('menuToggle'), mainNav = document.getElementById('mainNav');
    if (menuToggle && mainNav) {
      menuToggle.onclick = () => { const open = mainNav.classList.toggle('is-open'); menuToggle.setAttribute('aria-expanded', String(open)); menuToggle.classList.toggle('is-active', open); };
      mainNav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => { mainNav.classList.remove('is-open'); menuToggle.setAttribute('aria-expanded', 'false'); menuToggle.classList.remove('is-active'); }));
    }
    const header = document.querySelector('.site-header');
    if (header) document.addEventListener('scroll', () => { header.style.boxShadow = window.scrollY > 8 ? '0 8px 20px -14px rgba(45,27,61,0.35)' : 'none'; }, { passive: true });
    els = { drawer: document.getElementById('cartDrawer'), overlay: document.getElementById('cartOverlay'), button: document.getElementById('cartBtn'), close: document.getElementById('cartCloseBtn') };
    if (els.drawer) {
      els.drawer.inert = true; els.button.onclick = openCart; els.close.onclick = closeCart; els.overlay.onclick = closeCart;
      document.getElementById('continueShoppingBtn').onclick = closeCart;
      document.getElementById('checkoutBtn').onclick = () => { if (cart.length && !locked) window.location.href = 'checkout.html'; };
      document.addEventListener('keydown', e => {
        if (!els.drawer.classList.contains('is-open')) return;
        if (e.key === 'Escape') closeCart();
        if (e.key === 'Tab') {
          const focusable = [...els.drawer.querySelectorAll('button:not([disabled]),a[href]')].filter(el => el.offsetParent !== null);
          const first = focusable[0], last = focusable.at(-1);
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      });
      onChange(renderDrawer); renderDrawer();
    }
    bindAddToCartButtons(); save();
    if (dropped) showToast('Unrecognized saved cart items were removed. Please choose them again from the shop.');
  });
  window.addEventListener('storage', event => {
    if (event.key === CART_KEY && !locked) { cart = loadCart(cart); listeners.forEach(fn => fn(getCart())); }
  });
  return { getCart, addToCart, changeQty, removeItem, clearCart, onChange, syncProducts, formatPeso, subtotal, shippingFee,
    total: () => subtotal() + shippingFee(), totalCount, showToast, bindAddToCartButtons, FREE_SHIPPING_THRESHOLD,
    setLocked: value => { locked = value; }, slugForName: name => legacy[name] };
})();
