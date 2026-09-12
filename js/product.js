/* ==========================================================================
   SQUISHIES — product.js
   Renders the product detail page from PRODUCTS[slug] (see js/products.js)
   and wires up the quantity stepper, add-to-cart, buy-now, and verified reviews.
   Depends on: js/products.js, js/cart.js, js/api.js
   ========================================================================== */

document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('slug') || 'dumpling';
  let product = PRODUCTS[slug] || PRODUCTS.dumpling;

  // Try fetching dynamic product data from API
  if (typeof getProductBySlugAsync !== 'undefined') {
    const apiP = await getProductBySlugAsync(slug);
    if (apiP) product = apiP;
  }

  /* ------------------------------------------------------------------ *
   * Render product content
   * ------------------------------------------------------------------ */
  const pageTitle = document.getElementById('pageTitle');
  if (pageTitle) pageTitle.textContent = `${product.name} — Squishies`;

  const crumbName = document.getElementById('crumbName');
  if (crumbName) crumbName.textContent = product.name;

  const badgeEl = document.getElementById('productBadge');
  if (badgeEl) {
    badgeEl.textContent = product.badge;
    badgeEl.classList.add(product.badgeClass);
  }

  const pName = document.getElementById('productName');
  if (pName) pName.textContent = product.name;

  const pImg = document.getElementById('productImage');
  if (pImg) {
    pImg.src = product.image;
    pImg.alt = product.name;
  }

  const pPrice = document.getElementById('productPrice');
  if (pPrice) pPrice.textContent = Squishies.formatPeso(product.price);

  const pDesc = document.getElementById('productDesc');
  if (pDesc) pDesc.textContent = product.description;

  const fullStars = Math.round(product.rating);
  const starsEl = document.querySelector('#productRating .stars');
  if (starsEl) starsEl.textContent = '★★★★★'.slice(0, fullStars).padEnd(5, '☆');

  const ratingText = document.getElementById('ratingText');
  if (ratingText) ratingText.textContent = `${product.rating} · ${product.reviews || product.reviewsCount || 0} verified reviews`;

  // Specifications
  const specsList = document.getElementById('specsList');
  if (specsList && product.specs) {
    specsList.innerHTML = '';
    Object.entries(product.specs).forEach(([label, value]) => {
      const dt = document.createElement('dt');
      dt.textContent = label;
      const dd = document.createElement('dd');
      dd.textContent = value;
      specsList.appendChild(dt);
      specsList.appendChild(dd);
    });
  }

  // FAQ accordion
  const faqList = document.getElementById('faqList');
  if (faqList && typeof PRODUCT_FAQS !== 'undefined') {
    faqList.innerHTML = '';
    PRODUCT_FAQS.forEach((faq) => {
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
  }

  // Verified Buyer Reviews
  async function loadVerifiedReviews() {
    if (typeof SquishiesAPI === 'undefined') return;
    const reviewData = await SquishiesAPI.fetchProductReviews(slug);
    if (!reviewData || !reviewData.reviews) return;

    let reviewContainer = document.getElementById('verifiedReviewsContainer');
    if (!reviewContainer) {
      const parent = document.querySelector('.product-page__details') || document.body;
      const box = document.createElement('div');
      box.id = 'verifiedReviewsContainer';
      box.className = 'pdp-section';
      box.style.marginTop = '32px';
      box.innerHTML = `
        <h3>Verified Buyer Reviews (${reviewData.reviewsCount})</h3>
        <div id="reviewList" style="display: flex; flex-direction: column; gap: 12px; margin-top: 16px;"></div>
      `;
      parent.appendChild(box);
      reviewContainer = document.getElementById('reviewList');
    }

    if (reviewContainer && reviewData.reviews) {
      reviewContainer.innerHTML = '';
      reviewData.reviews.forEach((r) => {
        const rEl = document.createElement('div');
        rEl.style.background = '#f8fafc';
        rEl.style.border = '1px solid #e2e8f0';
        rEl.style.borderRadius = '10px';
        rEl.style.padding = '12px 16px';
        rEl.style.fontSize = '13.5px';
        rEl.innerHTML = `
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <strong style="color: #1e293b;">${r.reviewerName} <span style="font-size: 11px; color: #059669; background: #d1fae5; padding: 2px 6px; border-radius: 4px;">Verified Purchase</span></strong>
            <span style="color: #f59e0b;">${'★'.repeat(r.rating)}</span>
          </div>
          <p style="color: #475569; margin: 0;">${r.comment}</p>
        `;
        reviewContainer.appendChild(rEl);
      });
    }
  }

  loadVerifiedReviews();

  /* ------------------------------------------------------------------ *
   * Quantity stepper
   * ------------------------------------------------------------------ */
  let qty = 1;
  const qtyValueEl = document.getElementById('pdpQtyValue');

  const minusBtn = document.getElementById('pdpQtyMinus');
  if (minusBtn) {
    minusBtn.addEventListener('click', () => {
      qty = Math.max(1, qty - 1);
      if (qtyValueEl) qtyValueEl.textContent = qty;
    });
  }

  const plusBtn = document.getElementById('pdpQtyPlus');
  if (plusBtn) {
    plusBtn.addEventListener('click', () => {
      qty += 1;
      if (qtyValueEl) qtyValueEl.textContent = qty;
    });
  }

  /* ------------------------------------------------------------------ *
   * Add to Cart / Buy it now
   * ------------------------------------------------------------------ */
  const addBtn = document.getElementById('pdpAddToCart');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      Squishies.addToCart(product.name, product.price, product.image, qty);
      Squishies.showToast(`${product.name} added to cart.`);
    });
  }

  const buyBtn = document.getElementById('pdpBuyNow');
  if (buyBtn) {
    buyBtn.addEventListener('click', () => {
      Squishies.addToCart(product.name, product.price, product.image, qty);
      window.location.href = 'checkout.html';
    });
  }
});
