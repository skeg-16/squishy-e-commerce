import { useCallback, useEffect, useState } from 'react';
import { adminApi, errorText } from '../../services/adminService';

const STATUSES = [
  'To Pay',
  'To Ship',
  'Shipped',
  'Completed',
  'Cancelled',
  'Expired',
];

const peso = (amount) =>
  '₱' +
  Number(amount || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const when = (value) =>
  new Date(value).toLocaleString('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

const slugify = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/^[^a-z]+/, '')
    .slice(0, 60);

// function useAdminRequest(onSessionExpired) {
//   return useCallback(
//     async (path, options) => {
//       try {
//         return await adminApi(path, options);
//       } catch (error) {
//         if (error.status === 401) {
//           onSessionExpired?.();
//         }

//         throw error;
//       }
//     },
//     [onSessionExpired]
//   );
// }

function AdminPill({ children }) {
  const className = String(children)
    .toLowerCase()
    .replace(/\s+/g, '-');

  return (
    <span className={`ad-pill ad-pill--${className}`}>
      {children}
    </span>
  );
}

function AdminTable({ headings, rows, emptyText }) {
  if (!rows.length) {
    return <div className="ad-card ad-empty">{emptyText}</div>;
  }

  return (
    <div className="ad-table-wrap">
      <table className="ad-table">
        <thead>
          <tr>
            {headings.map((heading, index) => (
              <th
                key={`${heading}-${index}`}
                className={heading.endsWith('#') ? 'num' : ''}
              >
                {heading.replace('#', '')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
    </div>
  );
}

function AdminField({ label, hint, children, ...props }) {
  return (
    <label className="ad-field" {...props}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

export default function AdminViews({
  activeTab,
  request,
  refreshKey,
  refresh,
  openDialog,
  closeDialog,
  showToast,
}) {
//   const request = useAdminRequest(onSessionExpired);
//   const [refreshKey, setRefreshKey] = useState(0);

//   const refresh = useCallback(() => {
//     setRefreshKey((value) => value + 1);
//   }, []);

  switch (activeTab) {
    case 'dashboard':
      return (
        <Dashboard
          request={request}
          refresh={refresh}
        />
      );

    case 'orders':
        return (
            <Orders
            request={request}
            refresh={refresh}
            openDialog={openDialog}
            closeDialog={closeDialog}
            showToast={showToast}
            />
        );

    case 'products':
      return (
        <Products
          request={request}
          refreshKey={refreshKey}
          refresh={refresh}
          openDialog={openDialog}
          closeDialog={closeDialog}
          showToast={showToast}
        />
      );

    case 'vouchers':
      return (
        <Vouchers
          request={request}
          refreshKey={refreshKey}
          refresh={refresh}
          openDialog={openDialog}
          closeDialog={closeDialog}
          showToast={showToast}
        />
      );

    case 'reviews':
      return (
        <Reviews
          request={request}
          refreshKey={refreshKey}
          showToast={showToast}
        />
      );

    default:
      return <p>Page not found.</p>;
  }
}

// ---------------------------------------------------------------- Dashboard

function Dashboard({ request }) {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    request('/summary')
      .then((data) => {
        if (active) setSummary(data);
      })
      .catch((err) => {
        if (active) setError(errorText(err));
      });

    return () => {
      active = false;
    };
  }, [request]);

  if (error) return <p className="ad-error">{error}</p>;
  if (!summary) return <p className="ad-muted">Loading dashboard...</p>;

  const count = (status) => summary.orders?.[status] || 0;

  const cards = [
    ['To pay', count('To Pay'), 'peach', 'To Pay'],
    ['To ship', count('To Ship'), 'lavender', 'To Ship'],
    ['Shipped', count('Shipped'), 'pink', 'Shipped'],
    ['Completed', count('Completed'), 'mint', 'Completed'],
    [
      `Paid revenue (${summary.paidOrders} orders)`,
      peso(summary.revenue),
      'mint',
    ],
    [
      'Active products',
      `${summary.products.active} / ${summary.products.total}`,
      'lavender',
    ],
  ];

  return (
    <>
      <div className="ad-stats">
        {cards.map(([label, value, tone, status]) => (
          <div
            className={`ad-card ad-stat ad-stat--${tone}`}
            key={label}
          >
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>

      <h2 className="ad-section-title">
        Low stock (10 or fewer)
      </h2>

      {summary.lowStock.length ? (
        <>
          <ul className="ad-list">
            {summary.lowStock.map((product) => (
              <li key={product.slug}>
                <span>{product.name}</span>
                <strong>
                  {product.stock === 0
                    ? 'Out of stock'
                    : `${product.stock} left`}
                </strong>
              </li>
            ))}
          </ul>
          <p className="ad-muted">
            Remember to update stock in the Products tab.
          </p>
        </>
      ) : (
        <p className="ad-muted">
          Everything is comfortably stocked.
        </p>
      )}
    </>
  );
}

// ------------------------------------------------------------------- Orders

function Orders({ request, refresh, openDialog, closeDialog, showToast }) {
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({
        status,
        q: query,
      });

      const data = await request('/orders?' + params);
      setOrders(data);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, [request, status, query]);

  useEffect(() => {
    load();
  }, [load]);

  async function openOrder(number) {
    let order;

    try {
      order = await request(
        '/orders/' + encodeURIComponent(number)
      );
    } catch (err) {
      showToast(errorText(err), true);
      return;
    }

    const canCancel = ['To Pay', 'To Ship'].includes(order.status);

    async function performAction(action, reason) {
      if (
        action === 'cancel' &&
        !window.confirm(
          'Cancel this order and return its stock?'
        )
      ) {
        return;
      }

      try {
        await request(
          `/orders/${encodeURIComponent(number)}/action`,
          {
            method: 'POST',
            body: {
              action,
              ...(action === 'cancel' ? { reason } : {}),
            },
          }
        );

        showToast('Order updated.');
        closeDialog();
        refresh();
        load();
      } catch (err) {
        showToast(errorText(err), true);
      }
    }

    const money = (label, value, className = '') => (
      <div className={className}>
        <span>{label}</span>
        <span>{value}</span>
      </div>
    );

    const content = (
      <div className="ad-order">
        <div>
          <AdminPill>{order.status}</AdminPill>{' '}
          <span className="ad-muted">
            {order.paymentMethod.toUpperCase()} ·{' '}
            {order.paymentStatus} · placed {when(order.createdAt)}
          </span>
        </div>

        <section>
          <h3>Customer</h3>
          <dl className="ad-kv">
            <dt>Name</dt><dd>{order.customerName}</dd>
            <dt>Email</dt><dd>{order.customerEmail}</dd>
            <dt>Phone</dt><dd>{order.customerPhone}</dd>
            <dt>Ship to</dt>
            <dd>
              {order.shippingAddress}, {order.barangay},{' '}
              {order.city} {order.postalCode}
            </dd>
            <dt>Region</dt><dd>{order.region}</dd>
            {order.cancellationReason && (
              <>
                <dt>Cancelled</dt>
                <dd>{order.cancellationReason}</dd>
              </>
            )}
          </dl>
        </section>

        <section>
          <h3>Items</h3>
          <AdminTable
            headings={['Product', 'Qty#', 'Price#', 'Subtotal#']}
            rows={order.items.map((item, index) => (
              <tr key={`${item.name}-${index}`}>
                <td>{item.name}</td>
                <td className="num">{item.quantity}</td>
                <td className="num">{peso(item.price)}</td>
                <td className="num">{peso(item.subtotal)}</td>
              </tr>
            ))}
            emptyText="No items."
          />

          <div className="ad-totals">
            {money('Subtotal', peso(order.subtotal))}
            {order.voucherDiscount
              ? money(
                  `Voucher ${order.voucherCode || ''}`,
                  '−' + peso(order.voucherDiscount)
                )
              : null}
            {money('Shipping', peso(order.shippingFee))}
            {money('Total', peso(order.total), 'grand')}
          </div>
        </section>

        <section>
          <h3>History</h3>
          <ul className="ad-events">
            {order.events.map((event, index) => (
              <li key={`${event.timestamp}-${index}`}>
                <strong>{event.status}</strong>
                {' — '}{event.description}
                <small>{when(event.timestamp)}</small>
              </li>
            ))}
          </ul>
        </section>

        {canCancel && (
          <CancelOrderAction
            onCancel={(reason) => performAction('cancel', reason)}
          />
        )}

        <div className="ad-form-actions">
          {order.status === 'To Ship' && (
            <button
              className="btn btn--pink btn--sm"
              type="button"
              onClick={() => performAction('ship')}
            >
              Mark as shipped
            </button>
          )}

          {order.status === 'Shipped' && (
            <button
              className="btn btn--pink btn--sm"
              type="button"
              onClick={() => performAction('complete')}
            >
              Mark as delivered
            </button>
          )}
        </div>

        {!canCancel && order.status !== 'To Ship' &&
          order.status !== 'Shipped' && (
            <p className="ad-muted">
              No further actions for this order.
            </p>
          )}
      </div>
    );

    openDialog('Order ' + order.orderNumber, content);
  }

  return (
    <>
      <form
        className="ad-toolbar"
        onSubmit={(event) => {
          event.preventDefault();
          setQuery(searchInput);
        }}
      >
        <select
          aria-label="Filter by status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="">All statuses</option>
          {STATUSES.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>

        <input
          type="search"
          placeholder="Search order #, name or email"
          aria-label="Search orders"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
        />

        <button className="btn btn--outline btn--sm" type="submit">
          Search
        </button>
      </form>

      {error && <p className="ad-error">{error}</p>}
      {loading && <p className="ad-muted">Loading orders...</p>}

      {!loading && !error && (
        <AdminTable
          headings={[
            'Order',
            'Customer',
            'Placed',
            'Payment',
            'Status',
            'Total#',
          ]}
          rows={orders.map((order) => (
            <tr key={order.orderNumber}>
              <td>
                <button
                  className="ad-link"
                  type="button"
                  onClick={() => openOrder(order.orderNumber)}
                >
                  {order.orderNumber.slice(0, 11)}…
                </button>
              </td>
              <td>
                {order.customerName}
                <span className="ad-sub">{order.customerEmail}</span>
              </td>
              <td>{when(order.createdAt)}</td>
              <td>
                {order.paymentMethod.toUpperCase()} ·{' '}
                {order.paymentStatus}
              </td>
              <td><AdminPill>{order.status}</AdminPill></td>
              <td className="num">{peso(order.total)}</td>
            </tr>
          ))}
          emptyText="No orders match."
        />
      )}
    </>
  );
}

function CancelOrderAction({ onCancel }) {
  const [reason, setReason] = useState('Cancelled by the store');

  return (
    <section>
      <AdminField label="Cancel reason">
        <input
          type="text"
          value={reason}
          maxLength={300}
          onChange={(event) => setReason(event.target.value)}
        />
      </AdminField>

      <button
        className="btn btn--danger btn--sm"
        type="button"
        onClick={() => onCancel(reason)}
      >
        Cancel order
      </button>
    </section>
  );
}

// ----------------------------------------------------------------- Products

function Products({
  request,
  refreshKey,
  refresh,
  openDialog,
  closeDialog,
  showToast,
}) {
  const [products, setProducts] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      setProducts(await request('/products'));
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  async function saveStock(product, stock) {
    try {
      await request(`/products/${product.slug}/stock`, {
        method: 'PATCH',
        body: { stock: Number(stock) },
      });

      showToast(`Stock updated for ${product.name}.`);
      load();
    } catch (err) {
      showToast(errorText(err), true);
    }
  }

  return (
    <>
      <div className="ad-toolbar">
        <span className="ad-spacer" />
        <button
          className="btn btn--pink btn--sm"
          type="button"
          onClick={() => openProductForm({
            products,
            product: null,
            request,
            openDialog,
            closeDialog,
            showToast,
            refresh,
          })}
        >
          + Add product
        </button>
      </div>

      {error && <p className="ad-error">{error}</p>}
      {loading && <p className="ad-muted">Loading products...</p>}

      {!loading && !error && (
        <AdminTable
          headings={['', 'Product', 'Type', 'Price#', 'Available stock', 'Status', '']}
          rows={products.map((product) => (
            <ProductRow
              key={product.slug}
              product={product}
              onSaveStock={saveStock}
              onEdit={() => openProductForm({
                products,
                product,
                request,
                openDialog,
                closeDialog,
                showToast,
                refresh,
              })}
            />
          ))}
          emptyText="No products yet."
        />
      )}
    </>
  );
}

function ProductRow({ product, onSaveStock, onEdit }) {
  const [stock, setStock] = useState(String(product.stock));

  useEffect(() => {
    setStock(String(product.stock));
  }, [product.stock]);

  return (
    <tr>
      <td>
        <img src={product.image} alt="" width="40" height="40" />
      </td>
      <td>
        {product.name}
        <span className="ad-sub">{product.slug}</span>
      </td>
      <td>{product.kind === 'bundle' ? 'Bundle' : 'Single'}</td>
      <td className="num">{peso(product.price)}</td>
      <td>
        {product.kind === 'single' ? (
          <span className="ad-stock">
            <input
              type="number"
              min="0"
              max="100000"
              step="1"
              value={stock}
              aria-label={`Stock for ${product.name}`}
              onChange={(event) => setStock(event.target.value)}
            />
            <button
              className="btn btn--outline btn--sm"
              type="button"
              onClick={() => onSaveStock(product, stock)}
            >
              Save
            </button>
          </span>
        ) : (
          <span className="ad-muted">
            {product.stock} (from parts)
          </span>
        )}
      </td>
      <td>
        <AdminPill>{product.active ? 'Active' : 'Hidden'}</AdminPill>
      </td>
      <td className="actions">
        <button
          className="btn btn--outline btn--sm"
          type="button"
          onClick={onEdit}
        >
          Edit
        </button>
      </td>
    </tr>
  );
}

function openProductForm({
  products,
  product,
  request,
  openDialog,
  closeDialog,
  showToast,
  refresh,
}) {
  const creating = !product;

  function ProductForm() {
    const singles = products.filter((item) => item.kind === 'single');

    const [name, setName] = useState(product?.name || '');
    const [slug, setSlug] = useState(product?.slug || '');
    const [kind, setKind] = useState(product?.kind || 'single');
    const [price, setPrice] = useState(product ? String(product.price) : '');
    const [stock, setStock] = useState(
      String(product?.kind === 'single' ? product.stock : 0)
    );
    const [components, setComponents] = useState(
      product?.components || []
    );
    const [badge, setBadge] = useState(product?.badge || '');
    const [badgeClass, setBadgeClass] = useState(
      product?.badgeClass || 'badge--pink'
    );
    const [image, setImage] = useState(product?.image || '');
    const [description, setDescription] = useState(
      product?.description || ''
    );
    const [specs, setSpecs] = useState(
      Object.entries(product?.specs || {})
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n')
    );
    const [active, setActive] = useState(
      product ? product.active : true
    );
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    const knownImages = [
      ...new Set([
        ...products.map((item) => item.image).filter(Boolean),
        'assets/images/product-dumpling.svg',
        'assets/images/hero-collage.svg',
      ]),
    ];

    function updateComponent(index, key, value) {
      setComponents((current) =>
        current.map((item, i) =>
          i === index ? { ...item, [key]: value } : item
        )
      );
    }

    function addComponent() {
      setComponents((current) => [
        ...current,
        { slug: '', quantity: 1 },
      ]);
    }

    function removeComponent(index) {
      setComponents((current) =>
        current.filter((_, i) => i !== index)
      );
    }

    async function submit(event) {
      event.preventDefault();
      setError('');

      const specMap = {};

      for (const line of specs.split('\n').map((item) => item.trim()).filter(Boolean)) {
        const separator = line.indexOf(':');

        if (separator < 1) {
          setError(`Spec line "${line}" needs the form Label: Value.`);
          return;
        }

        specMap[line.slice(0, separator).trim()] =
          line.slice(separator + 1).trim();
      }

      const body = {
        name,
        price: Number(price),
        active,
        description,
        badge: badge.trim(),
        badgeClass: badge.trim() ? badgeClass : '',
        image,
        specs: specMap,
        ...(kind === 'bundle'
          ? {
              components: components.map((item) => ({
                slug: item.slug,
                quantity: Number(item.quantity),
              })),
            }
          : { stock: Number(stock) || 0 }),
        ...(creating ? { slug, kind } : {}),
      };

      setSaving(true);

      try {
        await request(
          creating ? '/products' : `/products/${product.slug}`,
          {
            method: creating ? 'POST' : 'PUT',
            body,
          }
        );

        closeDialog();
        showToast(creating ? 'Product created.' : 'Product saved.');
        refresh();
      } catch (err) {
        setError(errorText(err));
      } finally {
        setSaving(false);
      }
    }

    return (
      <form className="ad-form" onSubmit={submit}>
        <div className="ad-form-row">
          <AdminField label="Name">
            <input
              type="text"
              required
              minLength="2"
              maxLength="100"
              value={name}
              onChange={(event) => {
                const value = event.target.value;
                setName(value);
                if (creating) setSlug(slugify(value));
              }}
            />
          </AdminField>

          <AdminField
            label="Slug"
            hint={creating
              ? 'Used in the product URL. Lowercase, numbers, dashes.'
              : 'Cannot be changed.'}
          >
            <input
              type="text"
              required
              pattern="[a-z][a-z0-9-]{0,59}"
              value={slug}
              readOnly={!creating}
              onChange={(event) => setSlug(event.target.value)}
            />
          </AdminField>
        </div>

        <div className="ad-form-row">
          <AdminField label="Type">
            <select
              value={kind}
              disabled={!creating}
              onChange={(event) => {
                const nextKind = event.target.value;
                setKind(nextKind);
                if (nextKind === 'bundle' && !components.length) {
                  setComponents([{ slug: '', quantity: 1 }]);
                }
              }}
            >
              <option value="single">Single squishy</option>
              <option value="bundle">Bundle of singles</option>
            </select>
          </AdminField>

          <AdminField label="Price (₱)">
            <input
              type="number"
              required
              min="0"
              step="0.01"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
            />
          </AdminField>
        </div>

        {kind === 'single' ? (
          <AdminField
            label="Available stock"
            hint="Units currently available to sell."
          >
            <input
              type="number"
              min="0"
              max="100000"
              step="1"
              value={stock}
              onChange={(event) => setStock(event.target.value)}
            />
          </AdminField>
        ) : (
          <div className="ad-field">
            <span>Bundle contents</span>

            <div className="ad-comps">
              {components.map((component, index) => (
                <div className="ad-comp-row" key={index}>
                  <select
                    required
                    aria-label="Bundle part"
                    value={component.slug}
                    onChange={(event) =>
                      updateComponent(index, 'slug', event.target.value)
                    }
                  >
                    <option value="">Choose a product…</option>
                    {singles.map((item) => (
                      <option key={item.slug} value={item.slug}>
                        {item.name}
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    min="1"
                    max="99"
                    step="1"
                    required
                    aria-label="Quantity"
                    value={component.quantity}
                    onChange={(event) =>
                      updateComponent(index, 'quantity', event.target.value)
                    }
                  />

                  <button
                    className="btn btn--outline btn--sm"
                    type="button"
                    onClick={() => removeComponent(index)}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <button
              className="btn btn--outline btn--sm"
              type="button"
              onClick={addComponent}
            >
              + Add product
            </button>
            <small>A bundle’s stock is worked out from its parts.</small>
          </div>
        )}

        <div className="ad-form-row">
          <AdminField label="Badge text" hint="Optional label on the product card.">
            <input
              type="text"
              maxLength="30"
              placeholder="e.g. New Drop"
              value={badge}
              onChange={(event) => setBadge(event.target.value)}
            />
          </AdminField>

          <AdminField label="Badge colour">
            <select
              value={badgeClass}
              onChange={(event) => setBadgeClass(event.target.value)}
            >
              <option value="badge--pink">Pink</option>
              <option value="badge--purple">Purple</option>
              <option value="badge--mint">Mint</option>
              <option value="badge--peach">Peach</option>
            </select>
          </AdminField>
        </div>

        <AdminField
          label="Image path"
          hint="Pick an existing image or type a path inside assets/images/."
        >
          <input
            type="text"
            required
            list="admin-image-choices"
            placeholder="assets/images/product-dumpling.svg"
            value={image}
            onChange={(event) => setImage(event.target.value)}
          />
          <datalist id="admin-image-choices">
            {knownImages.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </AdminField>

        <AdminField label="Description">
          <textarea
            maxLength="1000"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </AdminField>

        <AdminField
          label="Specs"
          hint="One per line, as Label: Value."
        >
          <textarea
            rows="5"
            placeholder={'Material: TPR and memory foam\nWeight: 45–55 g'}
            value={specs}
            onChange={(event) => setSpecs(event.target.value)}
          />
        </AdminField>

        <label className="ad-check">
          <input
            type="checkbox"
            checked={active}
            onChange={(event) => setActive(event.target.checked)}
          />
          Visible in the store
        </label>

        {error && <p className="ad-error" role="alert">{error}</p>}

        <div className="ad-form-actions">
          <button
            className="btn btn--outline"
            type="button"
            onClick={closeDialog}
          >
            Cancel
          </button>
          <button className="btn btn--pink" type="submit" disabled={saving}>
            {saving
              ? 'Saving...'
              : creating
                ? 'Create product'
                : 'Save changes'}
          </button>
        </div>
      </form>
    );
  }

  openDialog(
    creating ? 'Add product' : `Edit ${product.name}`,
    <ProductForm />
  );
}

// ----------------------------------------------------------------- Vouchers

function Vouchers({
  request,
  refreshKey,
  refresh,
  openDialog,
  closeDialog,
  showToast,
}) {
  const [vouchers, setVouchers] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      setVouchers(await request('/vouchers'));
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  async function deleteVoucher(voucher) {
    if (
      !window.confirm(
        `Delete voucher ${voucher.code}? Past orders keep their discount.`
      )
    ) {
      return;
    }

    try {
      await request(
        `/vouchers/${encodeURIComponent(voucher.code)}`,
        { method: 'DELETE' }
      );

      showToast('Voucher deleted.');
      refresh();
    } catch (err) {
      showToast(errorText(err), true);
    }
  }

  return (
    <>
      <div className="ad-toolbar">
        <span className="ad-spacer" />
        <button
          className="btn btn--pink btn--sm"
          type="button"
          onClick={() => openVoucherForm({
            voucher: null,
            request,
            openDialog,
            closeDialog,
            showToast,
            refresh,
          })}
        >
          + Add voucher
        </button>
      </div>

      {error && <p className="ad-error">{error}</p>}
      {loading && <p className="ad-muted">Loading vouchers...</p>}

      {!loading && !error && (
        <AdminTable
          headings={['Code', 'Discount', 'Min spend#', 'Status', '']}
          rows={vouchers.map((voucher) => {
            const valueText =
              voucher.type === 'percentage'
                ? `${voucher.value}% off`
                : voucher.type === 'fixed_amount'
                  ? `${peso(voucher.value)} off`
                  : 'Free shipping';

            return (
              <tr key={voucher.code}>
                <td>
                  <strong>{voucher.code}</strong>
                  <span className="ad-sub">{voucher.description}</span>
                </td>
                <td>{valueText}</td>
                <td className="num">
                  {voucher.minSpend ? peso(voucher.minSpend) : '—'}
                </td>
                <td>
                  <AdminPill>
                    {voucher.active ? 'Active' : 'Hidden'}
                  </AdminPill>
                </td>
                <td className="actions">
                  <button
                    className="btn btn--outline btn--sm"
                    type="button"
                    onClick={() => openVoucherForm({
                      voucher,
                      request,
                      openDialog,
                      closeDialog,
                      showToast,
                      refresh,
                    })}
                  >
                    Edit
                  </button>
                  <button
                    className="btn btn--danger btn--sm"
                    type="button"
                    onClick={() => deleteVoucher(voucher)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            );
          })}
          emptyText="No vouchers yet."
        />
      )}
    </>
  );
}

function openVoucherForm({
  voucher,
  request,
  openDialog,
  closeDialog,
  showToast,
  refresh,
}) {
  const creating = !voucher;

  function VoucherForm() {
    const [code, setCode] = useState(voucher?.code || '');
    const [type, setType] = useState(voucher?.type || 'percentage');
    const [value, setValue] = useState(
      voucher ? String(voucher.value) : '10'
    );
    const [minSpend, setMinSpend] = useState(
      String(voucher?.minSpend ?? 0)
    );
    const [description, setDescription] = useState(
      voucher?.description || ''
    );
    const [active, setActive] = useState(
      voucher ? voucher.active : true
    );
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    async function submit(event) {
      event.preventDefault();
      setError('');
      setSaving(true);

      const body = {
        type,
        value: type === 'free_shipping' ? 0 : Number(value),
        minSpend: Number(minSpend) || 0,
        description,
        active,
        ...(creating ? { code } : {}),
      };

      try {
        await request(
          creating
            ? '/vouchers'
            : `/vouchers/${encodeURIComponent(voucher.code)}`,
          {
            method: creating ? 'POST' : 'PUT',
            body,
          }
        );

        closeDialog();
        showToast(creating ? 'Voucher created.' : 'Voucher saved.');
        refresh();
      } catch (err) {
        setError(errorText(err));
      } finally {
        setSaving(false);
      }
    }

    return (
      <form className="ad-form" onSubmit={submit}>
        <AdminField
          label="Code"
          hint={creating
            ? 'Customers type this at checkout. Letters, numbers, dashes.'
            : 'Cannot be changed.'}
        >
          <input
            type="text"
            required
            pattern="[A-Za-z0-9_-]{3,30}"
            value={code}
            readOnly={!creating}
            onChange={(event) => setCode(event.target.value)}
          />
        </AdminField>

        <AdminField label="Type">
          <select
            value={type}
            onChange={(event) => setType(event.target.value)}
          >
            <option value="percentage">Percentage off</option>
            <option value="fixed_amount">Fixed peso amount off</option>
            <option value="free_shipping">Free shipping</option>
          </select>
        </AdminField>

        {type !== 'free_shipping' && (
          <AdminField
            label={type === 'percentage' ? 'Percent off (1–100)' : 'Peso amount off (₱)'}
          >
            <input
              type="number"
              min="0"
              step={type === 'percentage' ? '1' : '0.01'}
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          </AdminField>
        )}

        <AdminField
          label="Minimum spend (₱)"
          hint="Merchandise subtotal needed. Use 0 for none."
        >
          <input
            type="number"
            min="0"
            step="0.01"
            value={minSpend}
            onChange={(event) => setMinSpend(event.target.value)}
          />
        </AdminField>

        <AdminField label="Description" hint="Shown to customers.">
          <input
            type="text"
            required
            minLength="3"
            maxLength="200"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </AdminField>

        <label className="ad-check">
          <input
            type="checkbox"
            checked={active}
            onChange={(event) => setActive(event.target.checked)}
          />
          Active
        </label>

        {error && <p className="ad-error" role="alert">{error}</p>}

        <div className="ad-form-actions">
          <button
            className="btn btn--outline"
            type="button"
            onClick={closeDialog}
          >
            Cancel
          </button>
          <button className="btn btn--pink" type="submit" disabled={saving}>
            {saving
              ? 'Saving...'
              : creating
                ? 'Create voucher'
                : 'Save changes'}
          </button>
        </div>
      </form>
    );
  }

  openDialog(
    creating ? 'Add voucher' : `Edit ${voucher.code}`,
    <VoucherForm />
  );
}

// ------------------------------------------------------------------ Reviews

function Reviews({ request, refreshKey, showToast }) {
  const [reviews, setReviews] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      setReviews(await request('/reviews'));
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  async function deleteReview(review) {
    if (!window.confirm('Delete this review?')) return;

    try {
      await request(`/reviews/${review.id}`, {
        method: 'DELETE',
      });

      showToast('Review deleted.');
      load();
    } catch (err) {
      showToast(errorText(err), true);
    }
  }

  return (
    <>
      {error && <p className="ad-error">{error}</p>}
      {loading && <p className="ad-muted">Loading reviews...</p>}

      {!loading && !error && (
        <AdminTable
          headings={['Product', 'Rating', 'Review', 'Date', '']}
          rows={reviews.map((review) => (
            <tr key={review.id}>
              <td>
                {review.productName}
                <span className="ad-sub">
                  {review.orderNumber.slice(0, 11)}…
                </span>
              </td>
              <td>
                {'★'.repeat(review.rating)}
                {'☆'.repeat(5 - review.rating)}
              </td>
              <td>
                <strong>{review.reviewerName}</strong>
                <span className="ad-sub">{review.comment}</span>
              </td>
              <td>{when(review.createdAt)}</td>
              <td className="actions">
                <button
                  className="btn btn--danger btn--sm"
                  type="button"
                  onClick={() => deleteReview(review)}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
          emptyText="No reviews yet. Customers can review once an order is delivered."
        />
      )}
    </>
  );
}
