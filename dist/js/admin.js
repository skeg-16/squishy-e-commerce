/* Squishies admin dashboard. Plain JavaScript, no build step. All server/customer text is inserted
   with textContent (via h()) and never as HTML. */
(() => {
  const $ = selector => document.querySelector(selector);
  const peso = n => '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const when = value => new Date(value).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });
  const slugify = text => text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/^[^a-z]+/, '').slice(0, 60);

  // Tiny element builder: h('div', { class: 'x', onclick: fn }, child, 'text', ...)
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs || {})) {
      if (value === false || value == null) continue;
      if (key === 'class') el.className = value;
      else if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
      else if (key in el && key !== 'list') el[key] = value;
      else el.setAttribute(key, value === true ? '' : value);
    }
    el.append(...kids.flat().filter(k => k != null && k !== false));
    return el;
  }

  async function api(path, { method = 'GET', body } = {}) {
    let response;
    try {
      response = await fetch('/api/admin' + path, {
        method, credentials: 'same-origin',
        headers: method === 'GET' ? {} : { 'Content-Type': 'application/json' },
        body: method === 'GET' ? undefined : JSON.stringify(body ?? {})
      });
    } catch { throw Object.assign(new Error('Cannot reach the server. Check your connection and try again.'), { status: 0 }); }
    let json;
    try { json = await response.json(); } catch { throw Object.assign(new Error('The server sent an unreadable response.'), { status: response.status }); }
    if (!response.ok || !json.success) {
      if (response.status === 401 && path !== '/login') showLogin();
      throw Object.assign(new Error(json.error || 'Request failed.'), { status: response.status, fields: json.fields });
    }
    return json.data;
  }
  const errorText = error => error.message + (error.fields ? ' ' + Object.entries(error.fields).map(([k, v]) => `${k}: ${v}`).join(' ') : '');

  let toastTimer;
  function toast(message, isError = false) {
    const el = $('#toast');
    el.textContent = message; el.classList.toggle('is-error', isError); el.classList.add('is-visible');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('is-visible'), 3500);
  }

  const dialog = $('#dialog');
  function openDialog(title, content) {
    $('#dialogTitle').textContent = title;
    $('#dialogBody').replaceChildren(content);
    if (!dialog.open) dialog.showModal();
  }
  const closeDialog = () => dialog.open && dialog.close();
  $('#dialogClose').addEventListener('click', closeDialog);
  dialog.addEventListener('click', event => { if (event.target === dialog) closeDialog(); });

  const state = { products: [], orderStatus: '', orderQuery: '' };
  const STATUSES = ['To Pay', 'To Ship', 'Shipped', 'Completed', 'Cancelled', 'Expired'];
  const TABS = [['dashboard', 'Dashboard'], ['orders', 'Orders'], ['products', 'Products'], ['vouchers', 'Vouchers'], ['reviews', 'Reviews']];
  const pill = (text, extra) => h('span', { class: `adm-pill adm-pill--${(extra || text).toLowerCase().replace(/\s+/g, '-')}` }, text);
  const field = (label, input, hint) => h('label', { class: 'adm-field' }, h('span', {}, label), input, hint && h('small', {}, hint));
  const table = (heads, rows, emptyText) => rows.length
    ? h('div', { class: 'adm-table-wrap' }, h('table', { class: 'adm-table' },
      h('thead', {}, h('tr', {}, heads.map(t => h('th', { class: t.endsWith('#') ? 'num' : '' }, t.replace('#', ''))))), h('tbody', {}, rows)))
    : h('div', { class: 'adm-card adm-empty' }, emptyText);

  // ---------------------------------------------------------------- Dashboard
  async function dashboardView() {
    const s = await api('/summary');
    const count = status => s.orders[status] || 0;
    const goOrders = status => { state.orderStatus = status; location.hash = '#orders'; };
    const card = (label, value, tone, status) => h(status ? 'button' : 'div', { class: `adm-card adm-stat adm-stat--${tone}`, type: status ? 'button' : false, onclick: status ? () => goOrders(status) : false },
      h('strong', {}, String(value)), h('span', {}, label));
    return h('div', {},
      h('div', { class: 'adm-stats' },
        card('To pay', count('To Pay'), 'peach', 'To Pay'), card('To ship', count('To Ship'), 'lavender', 'To Ship'),
        card('Shipped', count('Shipped'), 'pink', 'Shipped'), card('Completed', count('Completed'), 'mint', 'Completed'),
        card(`Paid revenue (${s.paidOrders} orders)`, peso(s.revenue), 'mint'), card('Active products', `${s.products.active} / ${s.products.total}`, 'lavender')),
      h('h2', { class: 'adm-section-title' }, 'Low stock (10 or fewer)'),
      s.lowStock.length
        ? h('ul', { class: 'adm-list' }, s.lowStock.map(p => h('li', {}, h('span', {}, p.name), h('strong', {}, p.stock === 0 ? 'Out of stock' : `${p.stock} left`))))
        : h('p', { class: 'adm-muted' }, 'Everything is comfortably stocked.'),
      s.lowStock.length ? h('p', {}, h('button', { class: 'adm-link', type: 'button', onclick: () => { location.hash = '#products'; } }, 'Update stock →')) : null);
  }

  // ------------------------------------------------------------------- Orders
  async function ordersView() {
    const holder = h('div');
    const select = h('select', { 'aria-label': 'Filter by status', onchange: () => { state.orderStatus = select.value; load(); } },
      h('option', { value: '' }, 'All statuses'), STATUSES.map(s => h('option', { value: s, selected: s === state.orderStatus }, s)));
    const search = h('input', { type: 'search', placeholder: 'Search order #, name or email', value: state.orderQuery, 'aria-label': 'Search orders' });
    const form = h('form', { class: 'adm-toolbar', onsubmit: event => { event.preventDefault(); state.orderQuery = search.value; load(); } },
      select, search, h('button', { class: 'btn btn--outline btn--sm', type: 'submit' }, 'Search'));
    async function load() {
      const params = new URLSearchParams({ status: state.orderStatus, q: state.orderQuery });
      const orders = await api('/orders?' + params).catch(error => { toast(errorText(error), true); return null; });
      if (!orders) return;
      holder.replaceChildren(table(['Order', 'Customer', 'Placed', 'Payment', 'Status', 'Total#'], orders.map(o => h('tr', {},
        h('td', {}, h('button', { class: 'adm-link', type: 'button', onclick: () => openOrder(o.orderNumber) }, o.orderNumber.slice(0, 11) + '…')),
        h('td', {}, o.customerName, h('span', { class: 'adm-sub' }, o.customerEmail)),
        h('td', {}, when(o.createdAt)), h('td', {}, `${o.paymentMethod.toUpperCase()} · ${o.paymentStatus}`),
        h('td', {}, pill(o.status)), h('td', { class: 'num' }, peso(o.total)))), 'No orders match.'));
    }
    const wrap = h('div', {}, form, holder);
    await load();
    return wrap;
  }

  async function openOrder(number) {
    let o;
    try { o = await api('/orders/' + encodeURIComponent(number)); } catch (error) { toast(errorText(error), true); return; }
    const reason = h('input', { type: 'text', value: 'Cancelled by the store', maxLength: 300, 'aria-label': 'Cancel reason' });
    const act = async (action, confirmText) => {
      if (confirmText && !confirm(confirmText)) return;
      try {
        await api(`/orders/${encodeURIComponent(number)}/action`, { method: 'POST', body: { action, reason: action === 'cancel' ? reason.value : undefined } });
        toast('Order updated.'); await openOrder(number); refresh();
      } catch (error) { toast(errorText(error), true); }
    };
    const buttons = [];
    if (o.status === 'To Ship') buttons.push(h('button', { class: 'btn btn--pink btn--sm', type: 'button', onclick: () => act('ship') }, 'Mark as shipped'));
    if (o.status === 'Shipped') buttons.push(h('button', { class: 'btn btn--pink btn--sm', type: 'button', onclick: () => act('complete') }, 'Mark as delivered'));
    const canCancel = ['To Pay', 'To Ship'].includes(o.status);
    if (canCancel) buttons.push(h('button', { class: 'btn btn--danger btn--sm', type: 'button', onclick: () => act('cancel', 'Cancel this order and return its stock?') }, 'Cancel order'));
    const money = (label, value, cls) => h('div', { class: cls }, h('span', {}, label), h('span', {}, value));
    openDialog('Order ' + o.orderNumber, h('div', { class: 'adm-order' },
      h('div', {}, pill(o.status), ' ', h('span', { class: 'adm-muted' }, `${o.paymentMethod.toUpperCase()} · ${o.paymentStatus} · placed ${when(o.createdAt)}`)),
      h('section', {}, h('h3', {}, 'Customer'), h('dl', { class: 'adm-kv' },
        h('dt', {}, 'Name'), h('dd', {}, o.customerName), h('dt', {}, 'Email'), h('dd', {}, o.customerEmail), h('dt', {}, 'Phone'), h('dd', {}, o.customerPhone),
        h('dt', {}, 'Ship to'), h('dd', {}, `${o.shippingAddress}, ${o.barangay}, ${o.city} ${o.postalCode}`), h('dt', {}, 'Region'), h('dd', {}, o.region),
        o.cancellationReason ? [h('dt', {}, 'Cancelled'), h('dd', {}, o.cancellationReason)] : null)),
      h('section', {}, h('h3', {}, 'Items'),
        table(['Product', 'Qty#', 'Price#', 'Subtotal#'], o.items.map(i => h('tr', {}, h('td', {}, i.name), h('td', { class: 'num' }, String(i.quantity)), h('td', { class: 'num' }, peso(i.price)), h('td', { class: 'num' }, peso(i.subtotal)))), 'No items.'),
        h('div', { class: 'adm-totals' }, money('Subtotal', peso(o.subtotal)),
          o.voucherDiscount ? money(`Voucher ${o.voucherCode || ''}`, '−' + peso(o.voucherDiscount)) : null,
          money('Shipping', peso(o.shippingFee)), money('Total', peso(o.total), 'grand'))),
      h('section', {}, h('h3', {}, 'History'), h('ul', { class: 'adm-events' }, o.events.map(e => h('li', {}, h('strong', {}, e.status), ' — ' + e.description, h('small', {}, when(e.timestamp)))))),
      canCancel ? field('Cancel reason', reason) : null,
      buttons.length ? h('div', { class: 'adm-form-actions' }, buttons) : h('p', { class: 'adm-muted' }, 'No further actions for this order.')));
  }

  // ----------------------------------------------------------------- Products
  async function productsView() {
    state.products = await api('/products');
    const rows = state.products.map(p => {
      const stock = h('input', { type: 'number', min: '0', max: '100000', step: '1', value: String(p.stock), 'aria-label': `Stock for ${p.name}` });
      const save = h('button', { class: 'btn btn--outline btn--sm', type: 'button', onclick: async () => {
        save.disabled = true;
        try { await api(`/products/${p.slug}/stock`, { method: 'PATCH', body: { stock: Number(stock.value) } }); toast(`Stock updated for ${p.name}.`); }
        catch (error) { toast(errorText(error), true); }
        save.disabled = false;
      } }, 'Save');
      return h('tr', {},
        h('td', {}, h('img', { src: p.image, alt: '', width: 40, height: 40 })),
        h('td', {}, p.name, h('span', { class: 'adm-sub' }, p.slug)),
        h('td', {}, p.kind === 'bundle' ? 'Bundle' : 'Single'),
        h('td', { class: 'num' }, peso(p.price)),
        h('td', {}, p.kind === 'single' ? h('span', { class: 'adm-stock' }, stock, save) : h('span', { class: 'adm-muted' }, `${p.stock} (from parts)`)),
        h('td', {}, p.active ? pill('Active') : pill('Hidden')),
        h('td', { class: 'actions' }, h('button', { class: 'btn btn--outline btn--sm', type: 'button', onclick: () => openProduct(p) }, 'Edit')));
    });
    return h('div', {},
      h('div', { class: 'adm-toolbar' }, h('span', { class: 'adm-spacer' }), h('button', { class: 'btn btn--pink btn--sm', type: 'button', onclick: () => openProduct(null) }, '+ Add product')),
      table(['', 'Product', 'Type', 'Price#', 'Available stock', 'Status', ''], rows, 'No products yet.'));
  }

  function openProduct(p) {
    const creating = !p;
    const singles = state.products.filter(x => x.kind === 'single');
    const name = h('input', { type: 'text', required: true, minLength: 2, maxLength: 100, value: p?.name || '' });
    const slug = h('input', { type: 'text', required: true, pattern: '[a-z][a-z0-9\\-]{0,59}', value: p?.slug || '', readOnly: !creating });
    let slugTouched = false;
    slug.addEventListener('input', () => { slugTouched = true; });
    if (creating) name.addEventListener('input', () => { if (!slugTouched) slug.value = slugify(name.value); });
    const kind = h('select', { disabled: !creating }, ['single', 'bundle'].map(k => h('option', { value: k, selected: k === (p?.kind || 'single') }, k === 'single' ? 'Single squishy' : 'Bundle of singles')));
    const price = h('input', { type: 'number', required: true, min: '0', step: '0.01', value: p ? String(p.price) : '' });
    const stock = h('input', { type: 'number', min: '0', max: '100000', step: '1', value: String(p?.kind === 'single' ? p.stock : 0) });
    const stockField = field('Available stock', stock, 'Units currently available to sell.');
    const comps = h('div', { class: 'adm-comps' });
    const addRow = (slugValue = '', quantity = 1) => {
      const select = h('select', { required: true, 'aria-label': 'Bundle part' }, h('option', { value: '' }, 'Choose a product…'), singles.map(s => h('option', { value: s.slug, selected: s.slug === slugValue }, s.name)));
      const qty = h('input', { type: 'number', min: '1', max: '99', step: '1', required: true, value: String(quantity), 'aria-label': 'Quantity' });
      const row = h('div', { class: 'adm-comp-row' }, select, qty, h('button', { class: 'btn btn--outline btn--sm', type: 'button', onclick: () => row.remove() }, 'Remove'));
      comps.append(row);
    };
    for (const c of p?.components || []) addRow(c.slug, c.quantity);
    const compSection = h('div', { class: 'adm-field' }, h('span', {}, 'Bundle contents'), comps,
      h('div', {}, h('button', { class: 'btn btn--outline btn--sm', type: 'button', onclick: () => addRow() }, '+ Add product')),
      h('small', {}, 'A bundle’s stock is worked out from its parts.'));
    const syncKind = () => {
      const bundle = kind.value === 'bundle';
      stockField.hidden = bundle; compSection.hidden = !bundle;
      if (bundle && !comps.children.length) addRow();
    };
    kind.addEventListener('change', syncKind);
    const badge = h('input', { type: 'text', maxLength: 30, value: p?.badge || '', placeholder: 'e.g. New Drop' });
    const badgeClass = h('select', {}, [['badge--pink', 'Pink'], ['badge--purple', 'Purple'], ['badge--mint', 'Mint'], ['badge--peach', 'Peach']].map(([v, l]) => h('option', { value: v, selected: v === (p?.badgeClass || 'badge--pink') }, l)));
    const known = [...new Set([...state.products.map(x => x.image).filter(Boolean), 'assets/images/product-dumpling.svg', 'assets/images/hero-collage.svg'])];
    const image = h('input', { type: 'text', required: true, list: 'imageChoices', value: p?.image || known[0] || '', placeholder: 'assets/images/product-dumpling.svg' });
    const imageList = h('datalist', { id: 'imageChoices' }, known.map(v => h('option', { value: v })));
    const description = h('textarea', { maxLength: 1000 }); description.value = p?.description || '';
    const specs = h('textarea', { rows: 5, placeholder: 'Material: TPR and memory foam\nWeight: 45–55 g' }); specs.value = Object.entries(p?.specs || {}).map(([k, v]) => `${k}: ${v}`).join('\n');
    const active = h('input', { type: 'checkbox', checked: p ? p.active : true });
    const error = h('p', { class: 'adm-error', role: 'alert' });
    const submit = h('button', { class: 'btn btn--pink', type: 'submit' }, creating ? 'Create product' : 'Save changes');

    const form = h('form', { class: 'adm-form', onsubmit: async event => {
      event.preventDefault(); error.textContent = '';
      const specMap = {};
      for (const line of specs.value.split('\n').map(l => l.trim()).filter(Boolean)) {
        const at = line.indexOf(':');
        if (at < 1) { error.textContent = `Spec line "${line}" needs the form Label: Value.`; return; }
        specMap[line.slice(0, at).trim()] = line.slice(at + 1).trim();
      }
      const bundle = kind.value === 'bundle';
      const body = {
        name: name.value, price: Number(price.value), active: active.checked, description: description.value, badge: badge.value.trim(),
        badgeClass: badge.value.trim() ? badgeClass.value : '', image: image.value, specs: specMap,
        ...(bundle ? { components: [...comps.children].map(row => ({ slug: row.querySelector('select').value, quantity: Number(row.querySelector('input').value) })) } : { stock: Number(stock.value) || 0 }),
        ...(creating ? { slug: slug.value, kind: kind.value } : {})
      };
      submit.disabled = true;
      try {
        await api(creating ? '/products' : `/products/${p.slug}`, { method: creating ? 'POST' : 'PUT', body });
        closeDialog(); toast(creating ? 'Product created.' : 'Product saved.'); refresh();
      } catch (e) { error.textContent = errorText(e); }
      submit.disabled = false;
    } },
      h('div', { class: 'adm-form-row' }, field('Name', name), field('Slug', slug, creating ? 'Used in the product URL. Lowercase, numbers, dashes.' : 'Cannot be changed.')),
      h('div', { class: 'adm-form-row' }, field('Type', kind), field('Price (₱)', price)),
      stockField, compSection,
      h('div', { class: 'adm-form-row' }, field('Badge text', badge, 'Optional label on the product card.'), field('Badge colour', badgeClass)),
      field('Image path', image, 'Pick an existing image or type a path inside assets/images/.'), imageList,
      field('Description', description),
      field('Specs', specs, 'One per line, as Label: Value.'),
      h('label', { class: 'adm-check' }, active, 'Visible in the store'),
      error, h('div', { class: 'adm-form-actions' }, h('button', { class: 'btn btn--outline', type: 'button', onclick: closeDialog }, 'Cancel'), submit));
    openDialog(creating ? 'Add product' : `Edit ${p.name}`, form);
    syncKind();
  }

  // ----------------------------------------------------------------- Vouchers
  async function vouchersView() {
    const vouchers = await api('/vouchers');
    const valueText = v => v.type === 'percentage' ? `${v.value}% off` : v.type === 'fixed_amount' ? `${peso(v.value)} off` : 'Free shipping';
    const rows = vouchers.map(v => h('tr', {},
      h('td', {}, h('strong', {}, v.code), h('span', { class: 'adm-sub' }, v.description)),
      h('td', {}, valueText(v)), h('td', { class: 'num' }, v.minSpend ? peso(v.minSpend) : '—'),
      h('td', {}, v.active ? pill('Active') : pill('Hidden')),
      h('td', { class: 'actions' },
        h('button', { class: 'btn btn--outline btn--sm', type: 'button', onclick: () => openVoucher(v) }, 'Edit'),
        h('button', { class: 'btn btn--danger btn--sm', type: 'button', onclick: async () => {
          if (!confirm(`Delete voucher ${v.code}? Past orders keep their discount.`)) return;
          try { await api(`/vouchers/${encodeURIComponent(v.code)}`, { method: 'DELETE' }); toast('Voucher deleted.'); refresh(); } catch (error) { toast(errorText(error), true); }
        } }, 'Delete'))));
    return h('div', {},
      h('div', { class: 'adm-toolbar' }, h('span', { class: 'adm-spacer' }), h('button', { class: 'btn btn--pink btn--sm', type: 'button', onclick: () => openVoucher(null) }, '+ Add voucher')),
      table(['Code', 'Discount', 'Min spend#', 'Status', ''], rows, 'No vouchers yet.'));
  }

  function openVoucher(v) {
    const creating = !v;
    const code = h('input', { type: 'text', required: true, pattern: '[A-Za-z0-9_\\-]{3,30}', value: v?.code || '', readOnly: !creating });
    const type = h('select', {}, [['percentage', 'Percentage off'], ['fixed_amount', 'Fixed peso amount off'], ['free_shipping', 'Free shipping']].map(([val, label]) => h('option', { value: val, selected: val === (v?.type || 'percentage') }, label)));
    const value = h('input', { type: 'number', min: '0', step: '0.01', value: v ? String(v.value) : '10' });
    const valueLabel = h('span', {});
    const valueField = h('label', { class: 'adm-field' }, valueLabel, value);
    const minSpend = h('input', { type: 'number', min: '0', step: '0.01', value: String(v?.minSpend ?? 0) });
    const description = h('input', { type: 'text', required: true, minLength: 3, maxLength: 200, value: v?.description || '' });
    const active = h('input', { type: 'checkbox', checked: v ? v.active : true });
    const error = h('p', { class: 'adm-error', role: 'alert' });
    const submit = h('button', { class: 'btn btn--pink', type: 'submit' }, creating ? 'Create voucher' : 'Save changes');
    const sync = () => {
      valueField.hidden = type.value === 'free_shipping';
      valueLabel.textContent = type.value === 'percentage' ? 'Percent off (1–100)' : 'Peso amount off (₱)';
      value.step = type.value === 'percentage' ? '1' : '0.01';
    };
    type.addEventListener('change', sync);
    const form = h('form', { class: 'adm-form', onsubmit: async event => {
      event.preventDefault(); error.textContent = ''; submit.disabled = true;
      const body = { type: type.value, value: type.value === 'free_shipping' ? 0 : Number(value.value), minSpend: Number(minSpend.value) || 0, description: description.value, active: active.checked, ...(creating ? { code: code.value } : {}) };
      try {
        await api(creating ? '/vouchers' : `/vouchers/${encodeURIComponent(v.code)}`, { method: creating ? 'POST' : 'PUT', body });
        closeDialog(); toast(creating ? 'Voucher created.' : 'Voucher saved.'); refresh();
      } catch (e) { error.textContent = errorText(e); }
      submit.disabled = false;
    } },
      field('Code', code, creating ? 'Customers type this at checkout. Letters, numbers, dashes.' : 'Cannot be changed.'),
      field('Type', type), valueField,
      field('Minimum spend (₱)', minSpend, 'Merchandise subtotal needed. Use 0 for none.'),
      field('Description', description, 'Shown to customers.'),
      h('label', { class: 'adm-check' }, active, 'Active'),
      error, h('div', { class: 'adm-form-actions' }, h('button', { class: 'btn btn--outline', type: 'button', onclick: closeDialog }, 'Cancel'), submit));
    openDialog(creating ? 'Add voucher' : `Edit ${v.code}`, form);
    sync();
  }

  // ------------------------------------------------------------------ Reviews
  async function reviewsView() {
    const reviews = await api('/reviews');
    return table(['Product', 'Rating', 'Review', 'Date', ''], reviews.map(r => h('tr', {},
      h('td', {}, r.productName, h('span', { class: 'adm-sub' }, r.orderNumber.slice(0, 11) + '…')),
      h('td', {}, '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating)),
      h('td', {}, h('strong', {}, r.reviewerName), h('span', { class: 'adm-sub' }, r.comment)),
      h('td', {}, when(r.createdAt)),
      h('td', { class: 'actions' }, h('button', { class: 'btn btn--danger btn--sm', type: 'button', onclick: async () => {
        if (!confirm('Delete this review?')) return;
        try { await api(`/reviews/${r.id}`, { method: 'DELETE' }); toast('Review deleted.'); refresh(); } catch (error) { toast(errorText(error), true); }
      } }, 'Delete')))), 'No reviews yet. Customers can review once an order is delivered.');
  }

  // ------------------------------------------------------------------ Routing
  const views = { dashboard: dashboardView, orders: ordersView, products: productsView, vouchers: vouchersView, reviews: reviewsView };
  let run = 0;
  const currentTab = () => TABS.some(t => t[0] === location.hash.slice(1)) ? location.hash.slice(1) : 'dashboard';
  async function refresh() {
    const tab = currentTab(), mine = ++run;
    for (const button of $('#tabs').children) {
      if (button.dataset.tab === tab) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
    }
    $('#viewTitle').textContent = TABS.find(t => t[0] === tab)[1];
    try {
      const node = await views[tab]();
      if (mine === run) $('#view').replaceChildren(node);
    } catch (error) {
      if (error.status !== 401 && mine === run) $('#view').replaceChildren(h('p', { class: 'adm-error' }, errorText(error)));
    }
  }
  $('#tabs').replaceChildren(...TABS.map(([id, label]) => h('button', { class: 'adm-tab', type: 'button', 'data-tab': id, onclick: () => { location.hash = '#' + id; } }, label)));
  window.addEventListener('hashchange', () => { if (!$('#app').hidden) refresh(); });

  function showLogin(message = '') {
    closeDialog(); $('#app').hidden = true; $('#login').hidden = false; $('#loginError').textContent = message; $('#password').focus();
  }
  function showApp() { $('#login').hidden = true; $('#app').hidden = false; refresh(); }

  $('#loginForm').addEventListener('submit', async event => {
    event.preventDefault();
    const password = $('#password');
    try { await api('/login', { method: 'POST', body: { password: password.value } }); password.value = ''; showApp(); }
    catch (error) { $('#loginError').textContent = errorText(error); }
  });
  $('#logout').addEventListener('click', async () => { try { await api('/logout', { method: 'POST' }); } catch { /* cookie expires on its own */ } showLogin(); });

  (async () => {
    try {
      const session = await api('/session');
      if (session.authenticated) showApp();
      else showLogin(session.configured ? '' : 'Admin is not configured. Set ADMIN_PASSWORD (at least 8 characters) and restart the server.');
    } catch (error) { showLogin(errorText(error)); }
  })();
})();
