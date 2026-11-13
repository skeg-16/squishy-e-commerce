import { useCallback, useEffect, useState } from 'react';
import { adminApi, errorText } from '../../services/adminService';
import PaginationBar from '../../components/PaginationBar';
import {
  sanitizePersonName,
  sanitizePhPhone,
  sanitizeUsername,
  sanitizeEmail,
  getPasswordStrength,
  PERSON_NAME_REGEX,
  USERNAME_REGEX,
  PH_MOBILE_REGEX,
  EMAIL_REGEX,
} from '../../utils/validators';

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
    <span className={`adm-pill adm-pill--${className}`}>
      {children}
    </span>
  );
}

function AdminTable({ headings, rows, emptyText }) {
  if (!rows.length) {
    return <div className="adm-card adm-empty">{emptyText}</div>;
  }

  return (
    <div className="adm-table-wrap">
      <table className="adm-table">
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

function AdminField({
  label,
  hint,
  error,
  attention,
  children,
  id,
  className = '',
  ...props
}) {
  return (
    <label
      className={`adm-field ${error ? 'is-invalid' : ''} ${attention ? 'is-error-attention' : ''} ${className}`.trim()}
      htmlFor={id}
      {...props}
    >
      <span>{label}</span>
      {children}
      {error ? (
        <small className="adm-field-error" role="alert">
          {error}
        </small>
      ) : hint ? (
        <small>{hint}</small>
      ) : null}
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
  adminUser,
}) {
  switch (activeTab) {
    case 'dashboard':
      return (
        <Dashboard
          request={request}
          refreshKey={refreshKey}
          refresh={refresh}
        />
      );

    case 'orders':
      return (
        <Orders
          request={request}
          refreshKey={refreshKey}
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

    case 'users':
      return (
        <Users
          request={request}
          refreshKey={refreshKey}
          refresh={refresh}
          openDialog={openDialog}
          closeDialog={closeDialog}
          showToast={showToast}
          adminUser={adminUser}
        />
      );

    default:
      return <p>Page not found.</p>;
  }
}

// ---------------------------------------------------------------- Dashboard

function Dashboard({ request, refreshKey }) {
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
  }, [request, refreshKey]);

  if (error) return <p className="adm-error">{error}</p>;
  if (!summary) return <p className="adm-muted">Loading dashboard...</p>;

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
    ...(summary.users
      ? [
          [
            `Registered users (${summary.users.admins || 0} admins)`,
            `${summary.users.active} / ${summary.users.total}`,
            'pink',
          ],
        ]
      : []),
    ...(typeof summary.reviewsCount === 'number'
      ? [['Verified reviews', summary.reviewsCount, 'peach']]
      : []),
  ];

  return (
    <>
      <div className="adm-stats">
        {cards.map(([label, value, tone]) => (
          <div
            className={`adm-card adm-stat adm-stat--${tone}`}
            key={label}
          >
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>

      <h2 className="adm-section-title">
        Low stock (10 or fewer)
      </h2>

      {summary.lowStock.length ? (
        <>
          <ul className="adm-list">
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
          <p className="adm-muted">
            Remember to update stock in the Products tab.
          </p>
        </>
      ) : (
        <p className="adm-muted">
          Everything is comfortably stocked.
        </p>
      )}

      {Array.isArray(summary.recentLogs) && summary.recentLogs.length > 0 && (
        <>
          <h2 className="adm-section-title">Recent admin activity</h2>
          <ul className="adm-list">
            {summary.recentLogs.map((log, idx) => (
              <li key={`${log.createdAt}-${idx}`}>
                <span>
                  <strong>{log.actor}</strong> · {log.action} ({log.targetType}: {log.targetId})
                </span>
                <small className="adm-muted">{when(log.createdAt)}</small>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

// ------------------------------------------------------------------- Orders

function Orders({ request, refreshKey, refresh, openDialog, closeDialog, showToast }) {
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 8;

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
  }, [load, refreshKey]);

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
      <div className="adm-order">
        <div>
          <AdminPill>{order.status}</AdminPill>{' '}
          <span className="adm-muted">
            {order.paymentMethod.toUpperCase()} ·{' '}
            {order.paymentStatus} · placed {when(order.createdAt)}
          </span>
        </div>

        <section>
          <h3>Customer</h3>
          <dl className="adm-kv">
            <dt>Name</dt><dd>{order.customerName}</dd>
            <dt>Email</dt><dd>{order.customerEmail}</dd>
            <dt>Phone</dt><dd>{order.customerPhone}</dd>
            <dt>Ship to</dt>
            <dd>
              {order.shippingAddress}, {order.barangay},{' '}
              {order.city} {order.postalCode}
            </dd>
            <dt>Region</dt><dd>{order.region}</dd>
            {order.trackingNumber && (
              <>
                <dt>Tracking #</dt>
                <dd>{order.trackingNumber}</dd>
              </>
            )}
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

          <div className="adm-totals">
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
          <ul className="adm-events">
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

        <div className="adm-form-actions">
          {order.status === 'To Ship' && (
            <button
              className="btn btn--pink btn--sm"
              type="button"
              onClick={() => performAction('ship')}
            >
              Mark as shipped
            </button>
          )}

          {order.status === 'Shipped' && order.deliveryStage !== 'out_for_delivery' && (
            <button
              className="btn btn--outline btn--sm"
              type="button"
              onClick={() => performAction('out_for_delivery')}
            >
              Mark out for delivery
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
            <p className="adm-muted">
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
        className="adm-toolbar"
        onSubmit={(event) => {
          event.preventDefault();
          setQuery(searchInput);
          setPage(1);
        }}
      >
        <select
          aria-label="Filter by status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
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

      {error && <p className="adm-error">{error}</p>}
      {loading && <p className="adm-muted">Loading orders...</p>}

      {!loading && !error && (
        <>
          <AdminTable
            headings={[
              'Order',
              'Customer',
              'Placed',
              'Payment',
              'Status',
              'Total#',
            ]}
            rows={orders
              .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
              .map((order) => (
                <tr key={order.orderNumber}>
                  <td>
                    <button
                      className="adm-link"
                      type="button"
                      onClick={() => openOrder(order.orderNumber)}
                    >
                      {order.orderNumber.slice(0, 11)}…
                    </button>
                  </td>
                  <td>
                    {order.customerName}
                    <span className="adm-sub">{order.customerEmail}</span>
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
          {orders.length > 0 && (
            <PaginationBar
              page={page}
              totalPages={Math.max(1, Math.ceil(orders.length / PAGE_SIZE))}
              totalItems={orders.length}
              pageSize={PAGE_SIZE}
              onPageChange={(nextPage) => setPage(nextPage)}
              itemLabel="orders"
              compact
            />
          )}
        </>
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
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 5;

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

  async function deleteProduct(product) {
    if (
      !window.confirm(
        `Delete product "${product.name}"? Products with past orders cannot be deleted (hide them instead).`
      )
    ) {
      return;
    }

    try {
      await request(`/products/${encodeURIComponent(product.slug)}`, {
        method: 'DELETE',
      });
      showToast(`Deleted ${product.name}.`);
      refresh();
    } catch (err) {
      showToast(errorText(err), true);
    }
  }

  return (
    <>
      <div className="adm-toolbar">
        <span className="adm-spacer" />
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

      {error && <p className="adm-error">{error}</p>}
      {loading && <p className="adm-muted">Loading products...</p>}

      {!loading && !error && (
        <>
          <AdminTable
            headings={['', 'Product', 'Type', 'Price#', 'Available stock', 'Status', '']}
            rows={products
              .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
              .map((product) => (
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
                  onDelete={() => deleteProduct(product)}
                />
              ))}
            emptyText="No products yet."
          />
          {products.length > 0 && (
            <PaginationBar
              page={page}
              totalPages={Math.max(1, Math.ceil(products.length / PAGE_SIZE))}
              totalItems={products.length}
              pageSize={PAGE_SIZE}
              onPageChange={(nextPage) => setPage(nextPage)}
              itemLabel="products"
              compact
            />
          )}
        </>
      )}
    </>
  );
}

function ProductRow({ product, onSaveStock, onEdit, onDelete }) {
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
        <span className="adm-sub">{product.slug}</span>
      </td>
      <td>{product.kind === 'bundle' ? 'Bundle' : 'Single'}</td>
      <td className="num">{peso(product.price)}</td>
      <td>
        {product.kind === 'single' ? (
          <span className="adm-stock">
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
          <span className="adm-muted">
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
        <button
          className="btn btn--danger btn--sm"
          type="button"
          onClick={onDelete}
        >
          Delete
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
      <form className="adm-form" onSubmit={submit}>
        <div className="adm-form-row">
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

        <div className="adm-form-row">
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
          <div className="adm-field">
            <span>Bundle contents</span>

            <div className="adm-comps">
              {components.map((component, index) => (
                <div className="adm-comp-row" key={index}>
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

        <div className="adm-form-row">
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

        <label className="adm-check">
          <input
            type="checkbox"
            checked={active}
            onChange={(event) => setActive(event.target.checked)}
          />
          Visible in the store
        </label>

        {error && <p className="adm-error" role="alert">{error}</p>}

        <div className="adm-form-actions">
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
      <div className="adm-toolbar">
        <span className="adm-spacer" />
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

      {error && <p className="adm-error">{error}</p>}
      {loading && <p className="adm-muted">Loading vouchers...</p>}

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
                  <span className="adm-sub">{voucher.description}</span>
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
      <form className="adm-form" onSubmit={submit}>
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

        <label className="adm-check">
          <input
            type="checkbox"
            checked={active}
            onChange={(event) => setActive(event.target.checked)}
          />
          Active
        </label>

        {error && <p className="adm-error" role="alert">{error}</p>}

        <div className="adm-form-actions">
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
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 8;

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
      {error && <p className="adm-error">{error}</p>}
      {loading && <p className="adm-muted">Loading reviews...</p>}

      {!loading && !error && (
        <>
          <AdminTable
            headings={['Product', 'Rating', 'Review', 'Date', '']}
            rows={reviews
              .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
              .map((review) => (
                <tr key={review.id}>
                  <td>
                    {review.productName}
                    <span className="adm-sub">
                      {review.orderNumber.slice(0, 11)}…
                    </span>
                  </td>
                  <td>
                    {'★'.repeat(review.rating)}
                    {'☆'.repeat(5 - review.rating)}
                  </td>
                  <td>
                    <strong>{review.reviewerName}</strong>
                    <span className="adm-sub">{review.comment}</span>
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
          {reviews.length > 0 && (
            <PaginationBar
              page={page}
              totalPages={Math.max(1, Math.ceil(reviews.length / PAGE_SIZE))}
              totalItems={reviews.length}
              pageSize={PAGE_SIZE}
              onPageChange={(nextPage) => setPage(nextPage)}
              itemLabel="reviews"
              compact
            />
          )}
        </>
      )}
    </>
  );
}

// -------------------------------------------------------------------- Users

function Users({
  request,
  refreshKey,
  refresh,
  openDialog,
  closeDialog,
  showToast,
  adminUser,
}) {
  const [users, setUsers] = useState([]);
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 8;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({
        role,
        status,
        q: query,
      });
      setUsers(await request('/users?' + params));
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, [request, role, status, query]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  async function toggleUserStatus(user) {
    const nextActive = !user.active;
    const actionLabel = nextActive ? 'Activate' : 'Suspend';
    if (
      !window.confirm(
        `${actionLabel} account @${user.username}?${
          !nextActive ? ' Any active sessions will be signed out immediately.' : ''
        }`
      )
    ) {
      return;
    }

    try {
      await request(`/users/${encodeURIComponent(user.id)}`, {
        method: 'PATCH',
        body: { active: nextActive },
      });
      showToast(
        nextActive
          ? `Activated @${user.username}.`
          : `Suspended @${user.username}.`
      );
      refresh();
    } catch (err) {
      showToast(errorText(err), true);
    }
  }

  async function deleteUser(user) {
    if (
      !window.confirm(
        `Delete user @${user.username} (${user.email})? Historical orders will remain in the store ledger.`
      )
    ) {
      return;
    }

    try {
      await request(`/users/${encodeURIComponent(user.id)}`, {
        method: 'DELETE',
      });
      showToast(`Deleted @${user.username}.`);
      refresh();
    } catch (err) {
      showToast(errorText(err), true);
    }
  }

  return (
    <>
      <form
        className="adm-toolbar"
        onSubmit={(event) => {
          event.preventDefault();
          setQuery(searchInput);
          setPage(1);
        }}
      >
        <select
          aria-label="Filter by role"
          value={role}
          onChange={(event) => {
            setRole(event.target.value);
            setPage(1);
          }}
        >
          <option value="">All roles</option>
          <option value="customer">Customers</option>
          <option value="admin">Admins</option>
        </select>

        <select
          aria-label="Filter by account status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>

        <input
          type="search"
          placeholder="Search username, email, name or phone"
          aria-label="Search users"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
        />

        <button className="btn btn--outline btn--sm" type="submit">
          Search
        </button>

        <span className="adm-spacer" />

        <button
          className="btn btn--pink btn--sm"
          type="button"
          onClick={() =>
            openUserForm({
              user: null,
              request,
              openDialog,
              closeDialog,
              showToast,
              refresh,
              adminUser,
            })
          }
        >
          + Add user
        </button>
      </form>

      {error && <p className="adm-error">{error}</p>}
      {loading && <p className="adm-muted">Loading users...</p>}

      {!loading && !error && (
        <>
          <AdminTable
            headings={[
              'User',
              'Contact',
              'Role',
              'Status',
              'Orders#',
              'Total spent#',
              'Joined',
              '',
            ]}
            rows={users
              .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
              .map((user) => {
                const isSelf = adminUser?.userId && adminUser.userId === user.id;
                return (
                  <tr key={user.id}>
                    <td>
                      <button
                        className="adm-link"
                        type="button"
                        onClick={() =>
                          openUserForm({
                            user,
                            request,
                            openDialog,
                            closeDialog,
                            showToast,
                            refresh,
                            adminUser,
                          })
                        }
                      >
                        {user.fullName}
                      </button>
                      <span className="adm-sub">@{user.username}</span>
                    </td>
                    <td>
                      {user.email}
                      <span className="adm-sub">{user.phone}</span>
                    </td>
                    <td>
                      <AdminPill>
                        {user.role === 'admin' ? 'Admin' : 'Customer'}
                      </AdminPill>
                    </td>
                    <td>
                      <AdminPill>
                        {user.active ? 'Active' : 'Suspended'}
                      </AdminPill>
                    </td>
                    <td className="num">{user.ordersCount || 0}</td>
                    <td className="num">{peso(user.totalSpent || 0)}</td>
                    <td>{when(user.createdAt)}</td>
                    <td className="actions">
                      <button
                        className="btn btn--outline btn--sm"
                        type="button"
                        onClick={() =>
                          openUserForm({
                            user,
                            request,
                            openDialog,
                            closeDialog,
                            showToast,
                            refresh,
                            adminUser,
                          })
                        }
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn--outline btn--sm"
                        type="button"
                        onClick={() =>
                          openResetPasswordForm({
                            user,
                            request,
                            openDialog,
                            closeDialog,
                            showToast,
                          })
                        }
                      >
                        Reset password
                      </button>
                      {!isSelf && (
                        <button
                          className="btn btn--outline btn--sm"
                          type="button"
                          onClick={() => toggleUserStatus(user)}
                        >
                          {user.active ? 'Suspend' : 'Activate'}
                        </button>
                      )}
                      {!isSelf && (
                        <button
                          className="btn btn--danger btn--sm"
                          type="button"
                          onClick={() => deleteUser(user)}
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            emptyText="No users match."
          />
          {users.length > 0 && (
            <PaginationBar
              page={page}
              totalPages={Math.max(1, Math.ceil(users.length / PAGE_SIZE))}
              totalItems={users.length}
              pageSize={PAGE_SIZE}
              onPageChange={(nextPage) => setPage(nextPage)}
              itemLabel="users"
              compact
            />
          )}
        </>
      )}
    </>
  );
}

function validateAdminUserFields({ username, fullName, email, phone, password, creating }) {
  const errors = {};
  const cleanUsername = String(username || '').trim();
  const cleanFullName = String(fullName || '').trim();
  const cleanEmail = String(email || '').trim();
  const cleanPhone = String(phone || '').trim();
  const cleanPass = String(password || '');

  // Username
  if (!cleanUsername) {
    errors.username = 'Username is required.';
  } else if (cleanUsername.length < 3) {
    errors.username = 'Username must be at least 3 characters.';
  } else if (cleanUsername.length > 28) {
    errors.username = 'Username cannot exceed 28 characters.';
  } else if (!USERNAME_REGEX.test(cleanUsername)) {
    errors.username = 'Username can only contain letters, numbers, and underscores.';
  }

  // Full name
  if (!cleanFullName) {
    errors.fullName = 'Full name is required.';
  } else if (cleanFullName.length < 2) {
    errors.fullName = 'Full name must be at least 2 characters.';
  } else if (cleanFullName.length > 60) {
    errors.fullName = 'Full name cannot exceed 60 characters.';
  } else if (!PERSON_NAME_REGEX.test(cleanFullName)) {
    errors.fullName = 'Use letters only (no numbers or special characters).';
  }

  // Email
  if (!cleanEmail) {
    errors.email = 'Email address is required.';
  } else if (cleanEmail.length > 80) {
    errors.email = 'Email address cannot exceed 80 characters.';
  } else if (!EMAIL_REGEX.test(cleanEmail)) {
    errors.email = 'Enter a valid email address (e.g. name@domain.com).';
  }

  // Phone
  if (!cleanPhone) {
    errors.phone = 'Mobile number is required.';
  } else if (!PH_MOBILE_REGEX.test(cleanPhone)) {
    errors.phone = 'Contact number must be strictly 11 digits starting with 09.';
  }

  // Password (on create)
  if (creating) {
    if (!cleanPass) {
      errors.password = 'Initial password is required.';
    } else if (cleanPass.length < 8) {
      errors.password = 'Password must be at least 8 characters.';
    } else if (cleanPass.length > 72) {
      errors.password = 'Password cannot exceed 72 characters.';
    } else if (!/[A-Za-z]/.test(cleanPass)) {
      errors.password = 'Password must contain at least one letter.';
    } else if (!/\d/.test(cleanPass)) {
      errors.password = 'Password must contain at least one number.';
    }
  }

  return errors;
}

function openUserForm({
  user,
  request,
  openDialog,
  closeDialog,
  showToast,
  refresh,
  adminUser,
}) {
  const creating = !user;

  function UserForm() {
    const [username, setUsername] = useState(user?.username || '');
    const [fullName, setFullName] = useState(user?.fullName || '');
    const [email, setEmail] = useState(user?.email || '');
    const [phone, setPhone] = useState(user?.phone || '');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState(user?.role || 'customer');
    const [active, setActive] = useState(user ? user.active : true);
    const [orders, setOrders] = useState([]);
    const [loadingOrders, setLoadingOrders] = useState(!creating);
    const [error, setError] = useState('');
    const [fieldErrors, setFieldErrors] = useState({});
    const [attentionField, setAttentionField] = useState('');
    const [saving, setSaving] = useState(false);

    const isSelf = Boolean(user && adminUser?.userId === user.id);
    const pwdStrength = getPasswordStrength(password);

    const clearError = (field) => {
      setFieldErrors((prev) => {
        if (!prev[field]) return prev;
        const next = { ...prev };
        delete next[field];
        return next;
      });
      if (attentionField === field) setAttentionField('');
      if (error) setError('');
    };

    useEffect(() => {
      if (creating || !user?.id) return;
      let mounted = true;
      request(`/users/${encodeURIComponent(user.id)}`, { forceRefresh: true })
        .then((data) => {
          if (mounted) {
            setOrders(data.orders || []);
          }
        })
        .catch(() => {})
        .finally(() => {
          if (mounted) setLoadingOrders(false);
        });
      return () => {
        mounted = false;
      };
    }, []);

    async function submit(event) {
      event.preventDefault();
      setError('');
      setAttentionField('');

      const clientErrors = validateAdminUserFields({
        username,
        fullName,
        email,
        phone,
        password,
        creating,
      });

      if (Object.keys(clientErrors).length > 0) {
        setFieldErrors(clientErrors);
        const firstField = Object.keys(clientErrors)[0];
        setAttentionField(firstField);
        const inputEl = document.getElementById(`adm-user-${firstField}`);
        if (inputEl) {
          inputEl.focus();
          inputEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        setError('Please resolve the highlighted validation errors before saving.');
        return;
      }

      setSaving(true);

      try {
        if (creating) {
          await request('/users', {
            method: 'POST',
            body: {
              username: username.trim(),
              fullName: fullName.trim(),
              email: email.trim().toLowerCase(),
              phone: phone.trim(),
              password,
              role,
              active,
            },
          });
          showToast(`Created user @${username.trim()}.`);
        } else {
          await request(`/users/${encodeURIComponent(user.id)}`, {
            method: 'PATCH',
            body: {
              username: username.trim(),
              fullName: fullName.trim(),
              email: email.trim().toLowerCase(),
              phone: phone.trim(),
              role,
              active,
            },
          });
          showToast(`Saved changes for @${username.trim()}.`);
        }
        closeDialog();
        refresh();
      } catch (err) {
        if (err.fields && typeof err.fields === 'object') {
          setFieldErrors(err.fields);
          const firstField = Object.keys(err.fields)[0];
          setAttentionField(firstField);
          const inputEl = document.getElementById(`adm-user-${firstField}`);
          if (inputEl) {
            inputEl.focus();
            inputEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
        setError(errorText(err));
      } finally {
        setSaving(false);
      }
    }

    return (
      <form className="adm-form" onSubmit={submit} noValidate>
        <div className="adm-form-row">
          <AdminField
            id="adm-user-username"
            label="Username"
            hint="3–28 letters, numbers, or underscores."
            error={fieldErrors.username}
            attention={attentionField === 'username'}
          >
            <input
              id="adm-user-username"
              type="text"
              required
              minLength={3}
              maxLength={28}
              autoComplete="off"
              value={username}
              placeholder="e.g. jdelacruz"
              className={fieldErrors.username ? 'is-invalid' : ''}
              onChange={(event) => {
                setUsername(sanitizeUsername(event.target.value));
                clearError('username');
              }}
            />
          </AdminField>

          <AdminField
            id="adm-user-fullName"
            label="Full name"
            hint="Letters only (2–60 characters)."
            error={fieldErrors.fullName}
            attention={attentionField === 'fullName'}
          >
            <input
              id="adm-user-fullName"
              type="text"
              required
              minLength={2}
              maxLength={60}
              autoComplete="name"
              value={fullName}
              placeholder="e.g. Juan Dela Cruz"
              className={fieldErrors.fullName ? 'is-invalid' : ''}
              onChange={(event) => {
                setFullName(sanitizePersonName(event.target.value));
                clearError('fullName');
              }}
            />
          </AdminField>
        </div>

        <div className="adm-form-row">
          <AdminField
            id="adm-user-email"
            label="Email address"
            hint="Valid email address up to 80 characters."
            error={fieldErrors.email}
            attention={attentionField === 'email'}
          >
            <input
              id="adm-user-email"
              type="email"
              required
              maxLength={80}
              autoComplete="email"
              value={email}
              placeholder="name@example.com"
              className={fieldErrors.email ? 'is-invalid' : ''}
              onChange={(event) => {
                setEmail(sanitizeEmail(event.target.value));
                clearError('email');
              }}
            />
          </AdminField>

          <AdminField
            id="adm-user-phone"
            label="Mobile number (PH)"
            hint="Strictly 11 digits starting with 09."
            error={fieldErrors.phone}
            attention={attentionField === 'phone'}
          >
            <input
              id="adm-user-phone"
              type="tel"
              inputMode="numeric"
              required
              maxLength={11}
              placeholder="09171234567"
              autoComplete="tel"
              value={phone}
              className={fieldErrors.phone ? 'is-invalid' : ''}
              onChange={(event) => {
                setPhone(sanitizePhPhone(event.target.value));
                clearError('phone');
              }}
            />
          </AdminField>
        </div>

        {creating && (
          <AdminField
            id="adm-user-password"
            label="Initial password"
            hint="At least 8 characters with letters and numbers."
            error={fieldErrors.password}
            attention={attentionField === 'password'}
          >
            <input
              id="adm-user-password"
              type="password"
              required
              minLength={8}
              maxLength={72}
              autoComplete="new-password"
              value={password}
              placeholder="Create initial password"
              className={fieldErrors.password ? 'is-invalid' : ''}
              onChange={(event) => {
                setPassword(event.target.value.slice(0, 72));
                clearError('password');
              }}
            />
            {password.length > 0 && (
              <div className="adm-password-meter" aria-hidden="true">
                <div
                  className={`adm-password-meter__bar is-${pwdStrength.tone}`}
                  style={{
                    width: `${Math.min(100, Math.max(15, pwdStrength.score * 20))}%`,
                  }}
                />
                <span className={`adm-password-meter__label is-${pwdStrength.tone}`}>
                  Strength: {pwdStrength.label}
                </span>
              </div>
            )}
          </AdminField>
        )}

        <div className="adm-form-row">
          <AdminField label="Account role">
            <select
              value={role}
              disabled={isSelf}
              onChange={(event) => setRole(event.target.value)}
            >
              <option value="customer">Customer</option>
              <option value="admin">Admin</option>
            </select>
          </AdminField>

          <AdminField label="Account status">
            <label className="adm-check" style={{ marginTop: '10px' }}>
              <input
                type="checkbox"
                checked={active}
                disabled={isSelf}
                onChange={(event) => setActive(event.target.checked)}
              />
              Active account (can log in)
            </label>
          </AdminField>
        </div>

        {!creating && user?.defaultAddress && (
          <section className="adm-order">
            <h3>Saved default address</h3>
            <p className="adm-muted" style={{ margin: 0 }}>
              {user.defaultAddress.shippingAddress}, {user.defaultAddress.barangay},{' '}
              {user.defaultAddress.city} {user.defaultAddress.postalCode} ({user.defaultAddress.region})
            </p>
          </section>
        )}

        {!creating && (
          <section className="adm-order">
            <h3>Order history ({user.ordersCount || 0})</h3>
            {loadingOrders ? (
              <p className="adm-muted">Loading user orders...</p>
            ) : orders.length > 0 ? (
              <AdminTable
                headings={['Order #', 'Placed', 'Payment', 'Status', 'Total#']}
                rows={orders.slice(0, 6).map((ord) => (
                  <tr key={ord.orderNumber}>
                    <td>{ord.orderNumber.slice(0, 14)}…</td>
                    <td>{when(ord.createdAt)}</td>
                    <td>
                      {ord.paymentMethod.toUpperCase()} · {ord.paymentStatus}
                    </td>
                    <td>
                      <AdminPill>{ord.status}</AdminPill>
                    </td>
                    <td className="num">{peso(ord.total)}</td>
                  </tr>
                ))}
                emptyText="No orders yet."
              />
            ) : (
              <p className="adm-muted" style={{ margin: 0 }}>
                No orders placed by this user yet.
              </p>
            )}
          </section>
        )}

        {error && (
          <div className="adm-error-alert" role="alert">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <div className="adm-form-actions">
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
                ? 'Create user'
                : 'Save changes'}
          </button>
        </div>
      </form>
    );
  }

  openDialog(
    creating ? 'Add user account' : `Manage @${user.username}`,
    <UserForm />
  );
}

function openResetPasswordForm({
  user,
  request,
  openDialog,
  closeDialog,
  showToast,
}) {
  function ResetPasswordForm() {
    const [newPassword, setNewPassword] = useState('');
    const [fieldError, setFieldError] = useState('');
    const [attention, setAttention] = useState(false);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    const pwdStrength = getPasswordStrength(newPassword);

    async function submit(event) {
      event.preventDefault();
      setError('');
      setFieldError('');
      setAttention(false);

      const pass = newPassword.trim();
      if (!pass) {
        setFieldError('Password is required.');
        setAttention(true);
        const inputEl = document.getElementById('adm-reset-password');
        if (inputEl) inputEl.focus();
        return;
      }
      if (pass.length < 8) {
        setFieldError('Password must be at least 8 characters.');
        setAttention(true);
        const inputEl = document.getElementById('adm-reset-password');
        if (inputEl) inputEl.focus();
        return;
      }
      if (pass.length > 72) {
        setFieldError('Password cannot exceed 72 characters.');
        setAttention(true);
        const inputEl = document.getElementById('adm-reset-password');
        if (inputEl) inputEl.focus();
        return;
      }
      if (!/[A-Za-z]/.test(pass)) {
        setFieldError('Password must contain at least one letter.');
        setAttention(true);
        const inputEl = document.getElementById('adm-reset-password');
        if (inputEl) inputEl.focus();
        return;
      }
      if (!/\d/.test(pass)) {
        setFieldError('Password must contain at least one number.');
        setAttention(true);
        const inputEl = document.getElementById('adm-reset-password');
        if (inputEl) inputEl.focus();
        return;
      }

      setSaving(true);

      try {
        await request(`/users/${encodeURIComponent(user.id)}/reset-password`, {
          method: 'POST',
          body: { newPassword: pass },
        });
        closeDialog();
        showToast(`Password reset for @${user.username}.`);
      } catch (err) {
        if (err.fields?.newPassword) {
          setFieldError(err.fields.newPassword);
          setAttention(true);
          const inputEl = document.getElementById('adm-reset-password');
          if (inputEl) inputEl.focus();
        }
        setError(errorText(err));
      } finally {
        setSaving(false);
      }
    }

    return (
      <form className="adm-form" onSubmit={submit} noValidate>
        <p className="adm-muted" style={{ margin: 0 }}>
          Set a new password for <strong>{user.fullName || `@${user.username}`}</strong> (@{user.username}).
          All active sessions for this user will be signed out immediately.
        </p>

        <AdminField
          id="adm-reset-password"
          label="New password"
          hint="At least 8 characters with letters and numbers."
          error={fieldError}
          attention={attention}
        >
          <input
            id="adm-reset-password"
            type="password"
            required
            minLength={8}
            maxLength={72}
            value={newPassword}
            placeholder="Enter new password"
            className={fieldError ? 'is-invalid' : ''}
            onChange={(event) => {
              setNewPassword(event.target.value.slice(0, 72));
              if (fieldError) setFieldError('');
              if (attention) setAttention(false);
              if (error) setError('');
            }}
          />
          {newPassword.length > 0 && (
            <div className="adm-password-meter" aria-hidden="true">
              <div
                className={`adm-password-meter__bar is-${pwdStrength.tone}`}
                style={{
                  width: `${Math.min(100, Math.max(15, pwdStrength.score * 20))}%`,
                }}
              />
              <span className={`adm-password-meter__label is-${pwdStrength.tone}`}>
                Strength: {pwdStrength.label}
              </span>
            </div>
          )}
        </AdminField>

        {error && (
          <div className="adm-error-alert" role="alert">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <div className="adm-form-actions">
          <button
            className="btn btn--outline"
            type="button"
            onClick={closeDialog}
          >
            Cancel
          </button>
          <button className="btn btn--pink" type="submit" disabled={saving}>
            {saving ? 'Updating...' : 'Reset password'}
          </button>
        </div>
      </form>
    );
  }

  openDialog(`Reset password for @${user.username}`, <ResetPasswordForm />);
}

