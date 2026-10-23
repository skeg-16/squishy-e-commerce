document.addEventListener('DOMContentLoaded', async () => {
  const slug = new URLSearchParams(location.search).get('slug') || 'dumpling';
  const add = document.getElementById('pdpAddToCart'), buy = document.getElementById('pdpBuyNow');
  add.disabled = buy.disabled = true;
  let product;
  try { product = await SquishiesAPI.fetchProductBySlug(slug); }
  catch (error) {
    document.getElementById('productName').textContent = error.status === 404 ? 'Product not found' : 'Product temporarily unavailable';
    document.getElementById('productDesc').textContent = error.message;
    document.querySelector('.stock-pill').textContent = 'Please return to the shop or refresh to retry.';
    return;
  }
  Squishies.syncProducts([product]);
  document.title = `${product.name} — Squishies`;
  for (const [id, text] of Object.entries({ crumbName: product.name, productName: product.name, productPrice: Squishies.formatPeso(product.price), productDesc: product.description || '', productBadge: product.badge || 'Squishies' })) document.getElementById(id).textContent = text;
  const image = document.getElementById('productImage'); image.src = product.image; image.alt = product.name;
  const badge = document.getElementById('productBadge'); if (/^badge--[a-z]+$/.test(product.badgeClass || '')) badge.classList.add(product.badgeClass);
  const setRating = (rating, count) => {
    document.querySelector('#productRating .stars').textContent = '★'.repeat(Math.round(rating)).padEnd(5, '☆');
    document.getElementById('ratingText').textContent = count ? `${rating} · ${count} verified review${count === 1 ? '' : 's'}` : 'No reviews yet';
  };
  setRating(product.rating, product.reviewsCount);
  document.querySelector('.stock-pill').textContent = product.stockQuantity ? `✓ ${product.stockQuantity} available · school demo inventory` : 'Out of stock';
  const specs = document.getElementById('specsList'); specs.replaceChildren();
  for (const [label, value] of Object.entries(product.specs || {})) {
    const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = label; dd.textContent = value; specs.append(dt, dd);
  }
  const faqs = document.getElementById('faqList');
  for (const faq of PRODUCT_FAQS) {
    const item = document.createElement('div'); item.className = 'faq-item';
    item.innerHTML = '<button class="faq-item__question" aria-expanded="false"><span></span><span class="faq-item__icon" aria-hidden="true">+</span></button><div class="faq-item__answer"><p></p></div>';
    item.querySelector('.faq-item__question span').textContent = faq.question; item.querySelector('p').textContent = faq.answer;
    const button = item.querySelector('button'); button.onclick = () => {
      const open = item.classList.toggle('is-open'); button.setAttribute('aria-expanded', String(open));
      item.querySelector('.faq-item__icon').textContent = open ? '−' : '+';
      const answer = item.querySelector('.faq-item__answer'); answer.style.maxHeight = open ? `${answer.scrollHeight}px` : null;
    };
    faqs.append(item);
  }
  let quantity = 1;
  const quantityText = document.getElementById('pdpQtyValue');
  document.getElementById('pdpQtyMinus').onclick = () => { quantity = Math.max(1, quantity - 1); quantityText.textContent = quantity; };
  document.getElementById('pdpQtyPlus').onclick = () => { quantity = Math.min(99, product.stockQuantity, quantity + 1); quantityText.textContent = quantity; };
  add.disabled = buy.disabled = product.stockQuantity < 1;
  add.onclick = () => Squishies.addToCart(product, quantity);
  buy.onclick = () => { if (Squishies.addToCart(product, quantity)) location.href = 'checkout.html'; };
  const section = document.createElement('section'); section.className = 'product-page__specs'; section.id = 'verifiedReviewsContainer';
  const heading = document.createElement('h2'); heading.textContent = 'Verified Buyer Reviews'; section.append(heading);
  document.querySelector('.product-page').append(section);
  try {
    const data = await SquishiesAPI.fetchProductReviews(slug); setRating(data.averageRating, data.reviewsCount);
    if (!data.reviews.length) { const empty = document.createElement('p'); empty.textContent = 'Be the first to review after a completed demo delivery.'; section.append(empty); }
    for (const review of data.reviews) {
      const article = document.createElement('article'); article.className = 'checkout-card';
      const title = document.createElement('strong'), stars = document.createElement('p'), comment = document.createElement('p');
      title.textContent = `${review.reviewerName} · Verified Purchase`; stars.textContent = `${'★'.repeat(review.rating)} (${review.rating}/5)`; comment.textContent = review.comment;
      article.append(title, stars, comment); section.append(article);
    }
  } catch { const error = document.createElement('p'); error.textContent = 'Reviews could not load. Please refresh to retry.'; section.append(error); }
});
