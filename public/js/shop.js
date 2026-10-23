/* ==========================================================================
   SQUISHIES — shop.js
   Page-specific behaviour for shop.html: live search + category filter pills.
   Depends on: js/cart.js (loaded first)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  const shopGrid = document.getElementById('shopGrid');
  if (!shopGrid) return;

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
});
