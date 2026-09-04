/* ==========================================================================
   SQUISHIES — product.js
   Renders the product detail page from PRODUCTS[slug] (see js/products.js)
   and wires up the quantity stepper, add-to-cart, buy-now, and FAQ accordion.
   Depends on: js/products.js, js/cart.js (loaded first)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('slug') || 'dumpling';
  const product = PRODUCTS[slug] || PRODUCTS.dumpling;

  /* ------------------------------------------------------------------ *
   * Render product content
   * ------------------------------------------------------------------ */
  document.getElementById('pageTitle').textContent = `${product.name} — Squishies`;
  document.getElementById('crumbName').textContent = product.name;

  const badgeEl = document.getElementById('productBadge');
  badgeEl.textContent = product.badge;
  badgeEl.classList.add(product.badgeClass);

  document.getElementById('productName').textContent = product.name;
  document.getElementById('productImage').src = product.image;
  document.getElementById('productImage').alt = product.name;
  document.getElementById('productPrice').textContent = Squishies.formatPeso(product.price);
  document.getElementById('productDesc').textContent = product.description;

  const fullStars = Math.round(product.rating);
  document.querySelector('#productRating .stars').textContent = '★★★★★'.slice(0, fullStars).padEnd(5, '☆');
  document.getElementById('ratingText').textContent = `${product.rating} · ${product.reviews} reviews`;

  // Specifications
  const specsList = document.getElementById('specsList');
  Object.entries(product.specs).forEach(([label, value]) => {
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = value;
    specsList.appendChild(dt);
    specsList.appendChild(dd);
  });

  // FAQ accordion
  const faqList = document.getElementById('faqList');
  PRODUCT_FAQS.forEach((faq, index) => {
    const item = document.createElement('div');
    item.className = 'faq-item';
    item.innerHTML = `
      <button class="faq-item__question" aria-expanded="false">
        <span>${faq.question}</span>
        <span class="faq-item__icon">+</span>
      </button>
      <div class="faq-item__answer"><p>${faq.answer}</p></div>`;

    const questionBtn = item.querySelector('.faq-item__question');
    const answerEl = item.querySelector('.faq-item__answer');

    questionBtn.addEventListener('click', () => {
      const isOpen = item.classList.toggle('is-open');
      questionBtn.setAttribute('aria-expanded', String(isOpen));
      item.querySelector('.faq-item__icon').textContent = isOpen ? '−' : '+';
      answerEl.style.maxHeight = isOpen ? answerEl.scrollHeight + 'px' : null;
    });

    faqList.appendChild(item);
  });

  /* ------------------------------------------------------------------ *
   * Quantity stepper
   * ------------------------------------------------------------------ */
  let qty = 1;
  const qtyValueEl = document.getElementById('pdpQtyValue');

  document.getElementById('pdpQtyMinus').addEventListener('click', () => {
    qty = Math.max(1, qty - 1);
    qtyValueEl.textContent = qty;
  });

  document.getElementById('pdpQtyPlus').addEventListener('click', () => {
    qty += 1;
    qtyValueEl.textContent = qty;
  });

  /* ------------------------------------------------------------------ *
   * Add to Cart / Buy it now
   * ------------------------------------------------------------------ */
  document.getElementById('pdpAddToCart').addEventListener('click', () => {
    Squishies.addToCart(product.name, product.price, product.image, qty);
    Squishies.showToast(`${product.name} added to cart 🧸`);
  });

  document.getElementById('pdpBuyNow').addEventListener('click', () => {
    Squishies.addToCart(product.name, product.price, product.image, qty);
    window.location.href = 'checkout.html';
  });
});
