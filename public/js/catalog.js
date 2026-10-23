/* Hydrate the existing cards in place; their layout and styling remain unchanged. */
document.addEventListener('DOMContentLoaded', async () => {
  const buttons = [...document.querySelectorAll('.add-to-cart')];
  if (!buttons.length) return;
  try {
    const products = await SquishiesAPI.fetchProducts();
    Squishies.syncProducts(products);
    for (const button of buttons) {
      const p = products.find(p => p.slug === button.dataset.slug);
      button.disabled = !p || p.stockQuantity === 0;
      if (!p) { button.textContent = 'Unavailable'; continue; }
      button.dataset.price = p.price;
      if (!p.stockQuantity) button.textContent = 'Out of stock';
      const card = button.closest('.product-card, .promo-card');
      const price = card?.querySelector('.price, .promo-card__price');
      if (price) {
        if (price.firstChild?.nodeType === Node.TEXT_NODE) price.firstChild.textContent = `${Squishies.formatPeso(p.price)} `;
        else price.textContent = Squishies.formatPeso(p.price);
      }
    }
  } catch {
    for (const button of buttons) { button.disabled = true; button.textContent = 'Temporarily unavailable'; }
    Squishies.showToast('The store could not load live inventory. Please refresh to try again.');
  }
});
