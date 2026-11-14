const { randomBytes, randomUUID, createHash, timingSafeEqual } = require('node:crypto');
const { transaction } = require('./db');
const { fail } = require('./errors');
const { hashPassword, verifyPassword, serializeUser } = require('./auth');

const digest = (value) => createHash('sha256').update(String(value)).digest('hex');

const REGIONS = {
  'metro-manila': { rate: 6000, minDays: 1, maxDays: 2, label: 'Metro Manila' },
  luzon: { rate: 8000, minDays: 2, maxDays: 4, label: 'Luzon' },
  visayas: { rate: 11000, minDays: 4, maxDays: 7, label: 'Visayas' },
  mindanao: { rate: 11000, minDays: 4, maxDays: 7, label: 'Mindanao' },
};

function safeComparePassword(candidate, expected) {
  if (!candidate || !expected) return false;
  const a = Buffer.from(digest(candidate), 'hex');
  const b = Buffer.from(digest(expected), 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function serializeVoucher(row) {
  if (!row) return null;
  return {
    code: row.code,
    type: row.type,
    value: row.type === 'fixed_amount' ? row.value / 100 : row.value,
    minSpend: row.min_spend_minor / 100,
    description: row.description,
    active: row.active,
  };
}

function serializeAdminOrder(order, items = [], events = []) {
  const pricing = order.pricing || {};
  const customer = order.customer || {};
  return {
    orderNumber: order.order_number,
    trackingNumber: order.tracking_number,
    userId: order.user_id || null,
    customerName: customer.customerName || '',
    customerEmail: customer.customerEmail || '',
    customerPhone: customer.customerPhone || '',
    shippingAddress: customer.shippingAddress || '',
    barangay: customer.barangay || '',
    city: customer.city || '',
    postalCode: customer.postalCode || '',
    orderNote: customer.orderNote || '',
    region: pricing.region || '',
    delivery: REGIONS[pricing.region] || null,
    paymentMethod: order.payment_method,
    paymentStatus: order.payment_status,
    paymentReference: order.payment_reference || null,
    status: order.status,
    deliveryStage:
      order.delivery_stage ||
      (order.status === 'Completed'
        ? 'delivered'
        : order.status === 'Shipped'
          ? 'in_transit'
          : order.status === 'To Ship'
            ? 'preparing'
            : order.status === 'To Pay'
              ? 'awaiting_payment'
              : order.status.toLowerCase()),
    subtotal: (pricing.subtotalMinor || 0) / 100,
    shippingFee: (pricing.shippingMinor || 0) / 100,
    voucherDiscount: (pricing.discountMinor || 0) / 100,
    shippingDiscount: (pricing.shippingDiscountMinor || 0) / 100,
    total: (pricing.totalMinor || 0) / 100,
    voucherCode: pricing.voucherCode || '',
    cancellationReason: order.cancellation_reason || '',
    createdAt: order.created_at,
    paidAt: order.paid_at || null,
    expiresAt: order.expires_at || null,
    items: items.map((i) => ({
      slug: i.slug || i.product_slug,
      name: i.name || i.product_name,
      quantity: i.quantity,
      price: i.price_minor / 100,
      subtotal: (i.price_minor * i.quantity) / 100,
    })),
    events: events.map((e) => ({
      status: e.status,
      description: e.description,
      timestamp: e.timestamp || e.created_at,
    })),
  };
}

function createAdmin(pool, { commerce, demoMode = false, adminPassword } = {}) {
  function getEffectivePassword() {
    const raw = adminPassword ?? process.env.ADMIN_PASSWORD ?? '';
    if (raw && String(raw).length >= 8) return String(raw);
    return 'squishy-admin';
  }

  async function logAudit(q, actor, action, targetType, targetId, details = {}) {
    await q.query(
      `INSERT INTO admin_audit_logs(actor, action, target_type, target_id, details)
       VALUES($1, $2, $3, $4, $5::jsonb)`,
      [actor || 'admin', action, targetType, String(targetId), JSON.stringify(details)]
    );
  }

  async function isConfigured() {
    if (getEffectivePassword().length >= 8) return true;
    const { rowCount } = await pool.query(
      "SELECT 1 FROM users WHERE role = 'admin' AND active = true LIMIT 1"
    );
    return rowCount > 0;
  }

  async function resolveAdmin(adminToken, userToken = null) {
    if (adminToken && /^[a-f0-9]{64}$/.test(adminToken)) {
      const { rows: [session] } = await pool.query(
        `SELECT s.id AS session_id, s.user_id, u.username, u.email, u.role, u.active
         FROM admin_sessions s
         LEFT JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = $1 AND s.expires_at > clock_timestamp()`,
        [digest(adminToken)]
      );
      if (session) {
        if (session.user_id && (session.active === false || session.role !== 'admin')) {
          return null;
        }
        return {
          id: session.user_id || null,
          userId: session.user_id || null,
          username: session.username || 'admin',
          actor: session.username ? `@${session.username}` : 'admin',
          email: session.email || null,
          role: 'admin',
        };
      }
    }

    if (userToken && /^[a-f0-9]{64}$/.test(userToken)) {
      const { rows: [user] } = await pool.query(
        `SELECT u.id, u.username, u.email, u.role, u.active
         FROM user_sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = $1
           AND s.expires_at > clock_timestamp()
           AND u.active = true
           AND u.role = 'admin'`,
        [digest(userToken)]
      );
      if (user) {
        return {
          id: user.id,
          userId: user.id,
          username: user.username,
          actor: `@${user.username}`,
          email: user.email,
          role: 'admin',
        };
      }
    }

    return null;
  }

  async function getSession(adminToken, userToken = null) {
    const [admin, configured] = await Promise.all([
      resolveAdmin(adminToken, userToken),
      isConfigured(),
    ]);
    return {
      authenticated: Boolean(admin),
      configured,
      admin,
      demoMode,
    };
  }

  async function issueAdminSession(q, userId = null) {
    const token = randomBytes(32).toString('hex');
    await q.query(
      'DELETE FROM admin_sessions WHERE expires_at <= clock_timestamp()'
    );
    await q.query(
      'INSERT INTO admin_sessions(id, user_id, token_hash) VALUES($1, $2, $3)',
      [randomUUID(), userId, digest(token)]
    );
    return token;
  }

  async function login(input) {
    const configured = await isConfigured();
    if (!configured) {
      fail(
        503,
        'ADMIN_NOT_CONFIGURED',
        'Admin is not configured. Set ADMIN_PASSWORD (at least 8 characters) or create an admin user.'
      );
    }

    const identifier = (input.identifier || '').trim();
    const password = input.password;

    // 1. If an identifier is supplied (other than generic 'admin' matching master password), check admin users
    if (identifier) {
      const { rows: [user] } = await pool.query(
        `SELECT * FROM users WHERE lower(username) = lower($1) OR lower(email) = lower($1)`,
        [identifier]
      );
      if (user && verifyPassword(password, user.password_hash)) {
        if (user.active === false) {
          fail(403, 'ACCOUNT_SUSPENDED', 'This admin account is suspended.');
        }
        if (user.role !== 'admin') {
          fail(403, 'ADMIN_REQUIRED', 'This account does not have administrator privileges.');
        }
        return transaction(pool, async (q) => {
          await q.query('UPDATE users SET last_login_at = clock_timestamp() WHERE id = $1', [user.id]);
          const token = await issueAdminSession(q, user.id);
          await logAudit(q, `@${user.username}`, 'admin.login', 'session', user.id);
          return {
            token,
            admin: {
              id: user.id,
              userId: user.id,
              username: user.username,
              actor: `@${user.username}`,
              email: user.email,
              role: 'admin',
            },
          };
        });
      }
    }

    // 2. Check master ADMIN_PASSWORD (when identifier is blank or 'admin')
    const masterPassword = getEffectivePassword();
    if ((!identifier || identifier.toLowerCase() === 'admin') && masterPassword) {
      if (safeComparePassword(password, masterPassword)) {
        return transaction(pool, async (q) => {
          const token = await issueAdminSession(q, null);
          await logAudit(q, 'admin', 'admin.login', 'session', 'master');
          return {
            token,
            admin: {
              id: null,
              userId: null,
              username: 'admin',
              actor: 'admin',
              email: null,
              role: 'admin',
            },
          };
        });
      }
    }

    // 3. If no identifier was given, also check if password matches any active admin user
    if (!identifier) {
      const { rows: admins } = await pool.query(
        "SELECT * FROM users WHERE role = 'admin' AND active = true ORDER BY created_at ASC"
      );
      for (const adminUser of admins) {
        if (verifyPassword(password, adminUser.password_hash)) {
          return transaction(pool, async (q) => {
            await q.query('UPDATE users SET last_login_at = clock_timestamp() WHERE id = $1', [
              adminUser.id,
            ]);
            const token = await issueAdminSession(q, adminUser.id);
            await logAudit(q, `@${adminUser.username}`, 'admin.login', 'session', adminUser.id);
            return {
              token,
              admin: {
                id: adminUser.id,
                userId: adminUser.id,
                username: adminUser.username,
                actor: `@${adminUser.username}`,
                email: adminUser.email,
                role: 'admin',
              },
            };
          });
        }
      }
    }

    fail(401, 'INVALID_CREDENTIALS', 'Incorrect admin credentials. Please try again.', {
      password: 'Verify your admin password and try again.',
    });
  }

  async function logout(token) {
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return { loggedOut: true };
    await pool.query('DELETE FROM admin_sessions WHERE token_hash = $1', [digest(token)]);
    return { loggedOut: true };
  }

  async function getSummary() {
    if (commerce?.expireReservations) {
      await commerce.expireReservations();
    }
    const [statusRes, revenueRes, prodRes, lowStockRes, usersRes, reviewsRes, auditRes] =
      await Promise.all([
        pool.query('SELECT status, count(*)::int AS count FROM orders GROUP BY status'),
        pool.query(
          "SELECT count(*)::int AS paid_orders, COALESCE(sum((pricing->>'totalMinor')::bigint), 0)::bigint AS revenue_minor FROM orders WHERE payment_status = 'Paid'"
        ),
        pool.query(
          'SELECT count(*) FILTER (WHERE active = true)::int AS active, count(*)::int AS total FROM products'
        ),
        pool.query(
          "SELECT slug, name, kind, stock, active FROM products WHERE kind = 'single' AND stock <= 10 ORDER BY stock ASC, name ASC"
        ),
        pool.query(
          "SELECT count(*)::int AS total, count(*) FILTER (WHERE active = true)::int AS active, count(*) FILTER (WHERE role = 'admin')::int AS admins FROM users"
        ),
        pool.query('SELECT count(*)::int AS total FROM reviews'),
        pool.query(
          'SELECT id, actor, action, target_type AS "targetType", target_id AS "targetId", details, created_at AS "createdAt" FROM admin_audit_logs ORDER BY id DESC LIMIT 10'
        ),
      ]);

    const orderCounts = {
      'To Pay': 0,
      'To Ship': 0,
      Shipped: 0,
      Completed: 0,
      Cancelled: 0,
      Expired: 0,
    };
    for (const row of statusRes.rows) {
      orderCounts[row.status] = row.count;
    }

    const revRow = revenueRes.rows[0] || { paid_orders: 0, revenue_minor: 0 };
    const prodRow = prodRes.rows[0] || { active: 0, total: 0 };
    const userRow = usersRes.rows[0] || { total: 0, active: 0, admins: 0 };

    return {
      orders: orderCounts,
      paidOrders: revRow.paid_orders,
      revenue: Number(revRow.revenue_minor || 0) / 100,
      products: {
        active: prodRow.active,
        total: prodRow.total,
      },
      users: {
        total: userRow.total,
        active: userRow.active,
        admins: userRow.admins,
      },
      reviewsCount: reviewsRes.rows[0]?.total || 0,
      lowStock: lowStockRes.rows.map((p) => ({
        slug: p.slug,
        name: p.name,
        kind: p.kind,
        stock: p.stock,
        active: p.active,
      })),
      recentLogs: auditRes.rows,
      recentActivity: auditRes.rows,
    };
  }

  async function listOrders(query = {}) {
    if (commerce?.expireReservations) {
      await commerce.expireReservations();
    }

    const statusFilter = query.status ? String(query.status).trim() : '';
    const search = query.q ? String(query.q).trim().toLowerCase() : '';

    const params = [];
    const conditions = [];

    if (statusFilter) {
      params.push(statusFilter);
      conditions.push(`status = $${params.length}`);
    }

    if (search) {
      params.push(`%${search}%`);
      const idx = params.length;
      conditions.push(
        `(lower(order_number) LIKE $${idx}
          OR lower(tracking_number) LIKE $${idx}
          OR lower(COALESCE(customer->>'customerName', '')) LIKE $${idx}
          OR lower(COALESCE(customer->>'customerEmail', '')) LIKE $${idx}
          OR lower(COALESCE(customer->>'customerPhone', '')) LIKE $${idx})`
      );
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows: orders } = await pool.query(
      `SELECT * FROM orders ${whereClause} ORDER BY created_at DESC LIMIT 200`,
      params
    );

    if (!orders.length) return [];

    const orderIds = orders.map((o) => o.id);
    const [{ rows: allItems }, { rows: allEvents }] = await Promise.all([
      pool.query(
        'SELECT order_id, product_slug AS slug, product_name AS name, quantity, price_minor FROM order_items WHERE order_id = ANY($1::uuid[]) ORDER BY product_slug',
        [orderIds]
      ),
      pool.query(
        'SELECT order_id, status, description, created_at AS timestamp FROM order_events WHERE order_id = ANY($1::uuid[]) ORDER BY id',
        [orderIds]
      ),
    ]);

    const itemsByOrder = new Map();
    for (const item of allItems) {
      if (!itemsByOrder.has(item.order_id)) itemsByOrder.set(item.order_id, []);
      itemsByOrder.get(item.order_id).push(item);
    }

    const eventsByOrder = new Map();
    for (const ev of allEvents) {
      if (!eventsByOrder.has(ev.order_id)) eventsByOrder.set(ev.order_id, []);
      eventsByOrder.get(ev.order_id).push(ev);
    }

    return orders.map((o) =>
      serializeAdminOrder(o, itemsByOrder.get(o.id) || [], eventsByOrder.get(o.id) || [])
    );
  }

  async function getOrder(orderNumber) {
    if (commerce?.expireReservations) {
      await commerce.expireReservations();
    }
    const { rows: [order] } = await pool.query(
      'SELECT * FROM orders WHERE order_number = $1',
      [orderNumber]
    );
    if (!order) fail(404, 'NOT_FOUND', 'Order not found.');

    const [{ rows: items }, { rows: events }] = await Promise.all([
      pool.query(
        'SELECT product_slug AS slug, product_name AS name, quantity, price_minor FROM order_items WHERE order_id = $1 ORDER BY product_slug',
        [order.id]
      ),
      pool.query(
        'SELECT status, description, created_at AS timestamp FROM order_events WHERE order_id = $1 ORDER BY id',
        [order.id]
      ),
    ]);

    return serializeAdminOrder(order, items, events);
  }

  async function releaseReservations(q, orderId) {
    const { rows } = await q.query(
      "SELECT * FROM reservations WHERE order_id = $1 AND status <> 'released' ORDER BY product_slug",
      [orderId]
    );
    if (!rows.length) return;
    await q.query('SELECT slug FROM products WHERE slug = ANY($1::text[]) ORDER BY slug FOR UPDATE', [
      rows.map((r) => r.product_slug),
    ]);
    for (const r of rows) {
      await q.query('UPDATE products SET stock = stock + $2 WHERE slug = $1', [
        r.product_slug,
        r.quantity,
      ]);
    }
    await q.query(
      "UPDATE reservations SET status = 'released' WHERE order_id = $1 AND status <> 'released'",
      [orderId]
    );
  }

  async function orderAction(orderNumber, input, actor = 'admin') {
    if (commerce?.expireReservations) {
      await commerce.expireReservations();
    }
    return transaction(pool, async (q) => {
      const { rows: [order] } = await q.query(
        'SELECT * FROM orders WHERE order_number = $1 FOR UPDATE',
        [orderNumber]
      );
      if (!order) fail(404, 'NOT_FOUND', 'Order not found.');

      const { action, reason } = input;
      let updated = order;

      if (action === 'ship') {
        if (order.status !== 'To Ship') {
          fail(409, 'INVALID_STATE', 'Only orders in "To Ship" status can be marked as shipped.');
        }
        const res = await q.query(
          "UPDATE orders SET status = 'Shipped', delivery_stage = 'in_transit' WHERE id = $1 RETURNING *",
          [order.id]
        );
        updated = res.rows[0];
        await q.query(
          'INSERT INTO order_events(order_id, status, description) VALUES($1, $2, $3)',
          [
            order.id,
            'Shipped',
            'Parcel dispatched by store administrator to SquishExpress courier hub.',
          ]
        );
      } else if (action === 'out_for_delivery') {
        if (order.status !== 'Shipped') {
          fail(409, 'INVALID_STATE', 'Order must be "Shipped" before marking Out for Delivery.');
        }
        const res = await q.query(
          "UPDATE orders SET delivery_stage = 'out_for_delivery' WHERE id = $1 RETURNING *",
          [order.id]
        );
        updated = res.rows[0];
        await q.query(
          'INSERT INTO order_events(order_id, status, description) VALUES($1, $2, $3)',
          [
            order.id,
            'Out for Delivery',
            'Courier rider is out for delivery to the customer address.',
          ]
        );
      } else if (action === 'complete') {
        if (!['Shipped', 'To Ship'].includes(order.status)) {
          fail(409, 'INVALID_STATE', 'Order must be Shipped before marking as delivered.');
        }
        const res = await q.query(
          `UPDATE orders
           SET status = 'Completed',
               delivery_stage = 'delivered',
               payment_status = CASE WHEN payment_method = 'cod' THEN 'Paid' ELSE payment_status END,
               payment_reference = CASE
                 WHEN payment_method = 'cod' AND payment_reference IS NULL
                 THEN 'COD-' || substr(replace(id::text, '-', ''), 1, 10)
                 ELSE payment_reference
               END,
               paid_at = CASE WHEN payment_method = 'cod' AND paid_at IS NULL THEN clock_timestamp() ELSE paid_at END
           WHERE id = $1
           RETURNING *`,
          [order.id]
        );
        updated = res.rows[0];
        await q.query(
          'INSERT INTO order_events(order_id, status, description) VALUES($1, $2, $3)',
          [
            order.id,
            'Completed',
            order.payment_method === 'cod'
              ? 'Order delivered and COD payment collected.'
              : 'Order delivered and marked completed by store administrator.',
          ]
        );
      } else if (action === 'cancel') {
        if (order.status === 'Cancelled') {
          // Idempotent repeat cancel
          updated = order;
        } else {
          if (!['To Pay', 'To Ship'].includes(order.status)) {
            fail(
              409,
              'INVALID_STATE',
              'Only orders awaiting payment or shipment can be cancelled.'
            );
          }
          await releaseReservations(q, order.id);
          const cancelReason = (reason || 'Cancelled by the store').trim();
          const res = await q.query(
            `UPDATE orders
             SET status = 'Cancelled',
                 delivery_stage = 'cancelled',
                 cancellation_reason = $2,
                 payment_status = CASE WHEN payment_status = 'Paid' THEN 'Refunded' ELSE payment_status END
             WHERE id = $1
             RETURNING *`,
            [order.id, cancelReason]
          );
          updated = res.rows[0];
          await q.query(
            "UPDATE payment_attempts SET status = 'cancelled' WHERE order_id = $1 AND status = 'pending'",
            [order.id]
          );
          await q.query(
            'INSERT INTO order_events(order_id, status, description) VALUES($1, $2, $3)',
            [
              order.id,
              'Cancelled',
              order.payment_status === 'Paid'
                ? `Order cancelled by store (${cancelReason}); payment refunded and stock restored.`
                : `Order cancelled by store (${cancelReason}); reserved stock restored.`,
            ]
          );
        }
      }

      await logAudit(q, actor, `order.${action}`, 'order', orderNumber, {
        status: updated.status,
        ...(reason ? { reason } : {}),
      });

      const [{ rows: items }, { rows: events }] = await Promise.all([
        q.query(
          'SELECT product_slug AS slug, product_name AS name, quantity, price_minor FROM order_items WHERE order_id = $1 ORDER BY product_slug',
          [updated.id]
        ),
        q.query(
          'SELECT status, description, created_at AS timestamp FROM order_events WHERE order_id = $1 ORDER BY id',
          [updated.id]
        ),
      ]);

      return serializeAdminOrder(updated, items, events);
    });
  }

  async function serializeProductRow(q, p, allComponents = null) {
    let components = allComponents;
    if (!components) {
      if (p.kind === 'bundle') {
        const { rows } = await q.query(
          'SELECT product_slug AS slug, quantity FROM bundle_components WHERE bundle_slug = $1 ORDER BY product_slug',
          [p.slug]
        );
        components = rows;
      } else {
        components = [];
      }
    }
    const content = p.content || {};
    return {
      slug: p.slug,
      name: p.name,
      kind: p.kind,
      price: p.price_minor / 100,
      stock: Number(p.available ?? p.stock ?? 0),
      physicalStock: Number(p.stock ?? 0),
      active: Boolean(p.active),
      image: content.image || 'assets/images/product-dumpling.svg',
      description: content.description || '',
      badge: content.badge || '',
      badgeClass: content.badgeClass || '',
      specs: content.specs || {},
      category: content.category || 'plush',
      components,
      rating: Number(p.rating || 0),
      reviewsCount: Number(p.review_count || 0),
    };
  }

  async function listProducts(slugFilter = null) {
    const [{ rows: products }, { rows: components }] = await Promise.all([
      pool.query(
        `SELECT p.*,
          CASE WHEN kind = 'single' THEN stock ELSE COALESCE((
            SELECT min(CASE WHEN c.active THEN floor(c.stock::numeric / b.quantity) ELSE 0 END)
            FROM bundle_components b JOIN products c ON c.slug = b.product_slug WHERE b.bundle_slug = p.slug
          ), 0) END AS available,
          (SELECT count(*)::int FROM reviews r WHERE r.product_slug = p.slug) AS review_count,
          (SELECT round(avg(rating)::numeric, 1) FROM reviews r WHERE r.product_slug = p.slug) AS rating
         FROM products p
         WHERE ($1::text IS NULL OR p.slug = $1)
         ORDER BY p.kind ASC, p.slug ASC`,
        [slugFilter]
      ),
      pool.query(
        'SELECT bundle_slug, product_slug AS slug, quantity FROM bundle_components ORDER BY bundle_slug, product_slug'
      ),
    ]);

    const compsByBundle = new Map();
    for (const c of components) {
      if (!compsByBundle.has(c.bundle_slug)) compsByBundle.set(c.bundle_slug, []);
      compsByBundle.get(c.bundle_slug).push({ slug: c.slug, quantity: c.quantity });
    }

    return Promise.all(
      products.map((p) => serializeProductRow(pool, p, compsByBundle.get(p.slug) || []))
    );
  }

  async function validateAndSaveBundleComponents(q, bundleSlug, components = []) {
    const merged = new Map();
    for (const item of components) {
      if (!item.slug) fail(400, 'INVALID_COMPONENT', 'Select a product for every bundle part.');
      if (item.slug === bundleSlug) {
        fail(400, 'INVALID_COMPONENT', 'A bundle cannot contain itself.');
      }
      merged.set(item.slug, (merged.get(item.slug) || 0) + Number(item.quantity || 1));
    }
    if (!merged.size) {
      fail(400, 'INVALID_COMPONENT', 'A bundle must include at least one single product.', {
        components: 'Add at least one single product.',
      });
    }
    const partSlugs = [...merged.keys()].sort();
    const { rows: found } = await q.query(
      'SELECT slug, kind FROM products WHERE slug = ANY($1::text[])',
      [partSlugs]
    );
    const foundMap = new Map(found.map((r) => [r.slug, r]));
    for (const partSlug of partSlugs) {
      const part = foundMap.get(partSlug);
      if (!part) {
        fail(400, 'UNKNOWN_COMPONENT', `Component product "${partSlug}" does not exist.`);
      }
      if (part.kind !== 'single') {
        fail(400, 'INVALID_COMPONENT', `Component "${partSlug}" must be a single product, not a bundle.`);
      }
    }

    await q.query('DELETE FROM bundle_components WHERE bundle_slug = $1', [bundleSlug]);
    for (const [partSlug, qty] of merged.entries()) {
      await q.query(
        'INSERT INTO bundle_components(bundle_slug, product_slug, quantity) VALUES($1, $2, $3)',
        [bundleSlug, partSlug, qty]
      );
    }
  }

  async function createProduct(input, actor = 'admin') {
    const createdSlug = await transaction(pool, async (q) => {
      const { rows: dupSlug } = await q.query('SELECT 1 FROM products WHERE slug = $1', [
        input.slug,
      ]);
      if (dupSlug.length) {
        fail(409, 'SLUG_TAKEN', `A product with slug "${input.slug}" already exists.`, {
          slug: 'Choose a unique product slug.',
        });
      }

      const { rows: dupName } = await q.query(
        'SELECT 1 FROM products WHERE lower(name) = lower($1)',
        [input.name]
      );
      if (dupName.length) {
        fail(409, 'NAME_TAKEN', `A product named "${input.name}" already exists.`, {
          name: 'Choose a unique product name.',
        });
      }

      const content = {
        image: input.image,
        description: input.description || '',
        badge: input.badge || '',
        badgeClass: input.badge ? input.badgeClass || 'badge--pink' : '',
        specs: input.specs || {},
        category: input.category || 'plush',
      };

      const priceMinor = Math.round(input.price * 100);
      const stock = input.kind === 'single' ? Number(input.stock ?? 0) : 0;

      await q.query(
        `INSERT INTO products(slug, name, kind, price_minor, stock, active, content)
         VALUES($1, $2, $3, $4, $5, $6, $7::jsonb)`,
        [input.slug, input.name, input.kind, priceMinor, stock, input.active ?? true, JSON.stringify(content)]
      );

      if (input.kind === 'bundle') {
        await validateAndSaveBundleComponents(q, input.slug, input.components || []);
      }

      await logAudit(q, actor, 'product.create', 'product', input.slug, {
        name: input.name,
        kind: input.kind,
        price: input.price,
      });

      return input.slug;
    });

    const [product] = await listProducts(createdSlug);
    return product;
  }

  async function updateProduct(slug, input, actor = 'admin') {
    await transaction(pool, async (q) => {
      const { rows: [existing] } = await q.query(
        'SELECT * FROM products WHERE slug = $1 FOR UPDATE',
        [slug]
      );
      if (!existing) fail(404, 'NOT_FOUND', 'Product not found.');

      const { rows: dupName } = await q.query(
        'SELECT 1 FROM products WHERE lower(name) = lower($1) AND slug <> $2',
        [input.name, slug]
      );
      if (dupName.length) {
        fail(409, 'NAME_TAKEN', `Another product is already named "${input.name}".`, {
          name: 'Choose a unique product name.',
        });
      }

      const prevContent = existing.content || {};
      const nextContent = {
        ...prevContent,
        image: input.image,
        description: input.description ?? prevContent.description ?? '',
        badge: input.badge ?? '',
        badgeClass: input.badge ? input.badgeClass || 'badge--pink' : '',
        specs: input.specs ?? prevContent.specs ?? {},
        ...(input.category ? { category: input.category } : {}),
      };

      const priceMinor = Math.round(input.price * 100);
      const nextStock =
        existing.kind === 'single' && input.stock !== undefined
          ? Number(input.stock)
          : existing.stock;

      await q.query(
        `UPDATE products
         SET name = $2,
             price_minor = $3,
             stock = $4,
             active = $5,
             content = $6::jsonb
         WHERE slug = $1`,
        [slug, input.name, priceMinor, nextStock, input.active ?? existing.active, JSON.stringify(nextContent)]
      );

      if (existing.kind === 'bundle' && input.components) {
        await validateAndSaveBundleComponents(q, slug, input.components);
      }

      await logAudit(q, actor, 'product.update', 'product', slug, {
        name: input.name,
        price: input.price,
        active: input.active,
      });
    });

    const [product] = await listProducts(slug);
    return product;
  }

  async function updateStock(slug, input, actor = 'admin') {
    await transaction(pool, async (q) => {
      const { rows: [existing] } = await q.query(
        'SELECT * FROM products WHERE slug = $1 FOR UPDATE',
        [slug]
      );
      if (!existing) fail(404, 'NOT_FOUND', 'Product not found.');
      if (existing.kind !== 'single') {
        fail(
          400,
          'BUNDLE_STOCK_DERIVED',
          'Bundle stock is automatically calculated from its component products.'
        );
      }

      await q.query('UPDATE products SET stock = $2 WHERE slug = $1', [slug, input.stock]);
      await logAudit(q, actor, 'product.stock', 'product', slug, {
        previousStock: existing.stock,
        newStock: input.stock,
      });
    });

    const [product] = await listProducts(slug);
    return product;
  }

  async function deleteProduct(slug, actor = 'admin') {
    return transaction(pool, async (q) => {
      const { rows: [existing] } = await q.query(
        'SELECT * FROM products WHERE slug = $1 FOR UPDATE',
        [slug]
      );
      if (!existing) fail(404, 'NOT_FOUND', 'Product not found.');

      const { rowCount: inBundles } = await q.query(
        'SELECT 1 FROM bundle_components WHERE product_slug = $1 LIMIT 1',
        [slug]
      );
      if (inBundles) {
        fail(
          409,
          'PRODUCT_IN_BUNDLE',
          'This product is part of a bundle. Remove it from the bundle first or set it to Hidden.'
        );
      }

      const { rowCount: inOrders } = await q.query(
        'SELECT 1 FROM order_items WHERE product_slug = $1 UNION SELECT 1 FROM reservations WHERE product_slug = $1 LIMIT 1',
        [slug]
      );
      if (inOrders) {
        fail(
          409,
          'PRODUCT_HAS_ORDERS',
          'This product is linked to existing orders. Edit it and uncheck "Visible in the store" instead of deleting.'
        );
      }

      await q.query('DELETE FROM bundle_components WHERE bundle_slug = $1', [slug]);
      await q.query('DELETE FROM reviews WHERE product_slug = $1', [slug]);
      await q.query('DELETE FROM products WHERE slug = $1', [slug]);
      await logAudit(q, actor, 'product.delete', 'product', slug, { name: existing.name });
      return { deleted: true, slug };
    });
  }

  async function listVouchers() {
    const { rows } = await pool.query('SELECT * FROM vouchers ORDER BY code ASC');
    return rows.map(serializeVoucher);
  }

  async function createVoucher(input, actor = 'admin') {
    return transaction(pool, async (q) => {
      const { rows: existing } = await q.query('SELECT 1 FROM vouchers WHERE code = $1', [
        input.code,
      ]);
      if (existing.length) {
        fail(409, 'VOUCHER_EXISTS', `Voucher "${input.code}" already exists.`, {
          code: 'Choose a different voucher code.',
        });
      }

      const dbValue =
        input.type === 'free_shipping'
          ? 0
          : input.type === 'fixed_amount'
            ? Math.round(input.value * 100)
            : Math.round(input.value);
      const minSpendMinor = Math.round((input.minSpend || 0) * 100);

      const { rows: [created] } = await q.query(
        `INSERT INTO vouchers(code, type, value, min_spend_minor, description, active)
         VALUES($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [input.code, input.type, dbValue, minSpendMinor, input.description, input.active ?? true]
      );

      await logAudit(q, actor, 'voucher.create', 'voucher', created.code, {
        type: created.type,
        value: input.value,
      });

      return serializeVoucher(created);
    });
  }

  async function updateVoucher(code, input, actor = 'admin') {
    const normalizedCode = String(code || '').trim().toUpperCase();
    return transaction(pool, async (q) => {
      const { rows: [existing] } = await q.query(
        'SELECT * FROM vouchers WHERE code = $1 FOR UPDATE',
        [normalizedCode]
      );
      if (!existing) fail(404, 'NOT_FOUND', 'Voucher not found.');

      const dbValue =
        input.type === 'free_shipping'
          ? 0
          : input.type === 'fixed_amount'
            ? Math.round(input.value * 100)
            : Math.round(input.value);
      const minSpendMinor = Math.round((input.minSpend || 0) * 100);

      const { rows: [updated] } = await q.query(
        `UPDATE vouchers
         SET type = $2,
             value = $3,
             min_spend_minor = $4,
             description = $5,
             active = $6
         WHERE code = $1
         RETURNING *`,
        [normalizedCode, input.type, dbValue, minSpendMinor, input.description, input.active ?? true]
      );

      await logAudit(q, actor, 'voucher.update', 'voucher', normalizedCode, {
        type: updated.type,
        active: updated.active,
      });

      return serializeVoucher(updated);
    });
  }

  async function deleteVoucher(code, actor = 'admin') {
    const normalizedCode = String(code || '').trim().toUpperCase();
    return transaction(pool, async (q) => {
      const { rows: [deleted] } = await q.query(
        'DELETE FROM vouchers WHERE code = $1 RETURNING *',
        [normalizedCode]
      );
      if (!deleted) fail(404, 'NOT_FOUND', 'Voucher not found.');
      await logAudit(q, actor, 'voucher.delete', 'voucher', normalizedCode);
      return serializeVoucher(deleted);
    });
  }

  async function listReviews() {
    const { rows } = await pool.query(
      `SELECT r.id,
              r.product_slug AS "productSlug",
              COALESCE(p.name, r.product_slug) AS "productName",
              COALESCE(o.order_number, '—') AS "orderNumber",
              r.rating,
              r.reviewer_name AS "reviewerName",
              r.comment,
              r.created_at AS "createdAt"
       FROM reviews r
       LEFT JOIN products p ON p.slug = r.product_slug
       LEFT JOIN orders o ON o.id = r.order_id
       ORDER BY r.created_at DESC`
    );
    return rows;
  }

  async function deleteReview(id, actor = 'admin') {
    return transaction(pool, async (q) => {
      const { rows: [deleted] } = await q.query(
        'DELETE FROM reviews WHERE id = $1 RETURNING id, product_slug, reviewer_name',
        [id]
      );
      if (!deleted) fail(404, 'NOT_FOUND', 'Review not found.');
      await logAudit(q, actor, 'review.delete', 'review', id, {
        productSlug: deleted.product_slug,
        reviewerName: deleted.reviewer_name,
      });
      return { deleted: true, id: deleted.id };
    });
  }

  // =========================================================
  // USER MANAGEMENT
  // =========================================================
  async function listUsers(query = {}) {
    const search = query.q ? String(query.q).trim().toLowerCase() : '';
    const roleFilter = query.role ? String(query.role).trim() : '';
    const statusFilter = query.status ? String(query.status).trim() : '';

    const params = [];
    const conditions = [];

    if (roleFilter && ['customer', 'admin'].includes(roleFilter)) {
      params.push(roleFilter);
      conditions.push(`u.role = $${params.length}`);
    }
    if (statusFilter === 'active') {
      conditions.push('u.active = true');
    } else if (statusFilter === 'suspended') {
      conditions.push('u.active = false');
    }
    if (search) {
      params.push(`%${search}%`);
      const idx = params.length;
      conditions.push(
        `(lower(u.username) LIKE $${idx} OR lower(u.email) LIKE $${idx} OR COALESCE(u.phone, '') LIKE $${idx})`
      );
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await pool.query(
      `SELECT u.*,
         (SELECT count(*)::int FROM orders o WHERE o.user_id = u.id) AS orders_count,
         (SELECT COALESCE(sum((o.pricing->>'totalMinor')::bigint), 0)::bigint FROM orders o WHERE o.user_id = u.id AND o.payment_status = 'Paid') AS total_spent_minor,
         (SELECT count(*)::int FROM user_sessions s WHERE s.user_id = u.id AND s.expires_at > clock_timestamp()) AS active_sessions
       FROM users u
       ${whereClause}
       ORDER BY u.created_at DESC
       LIMIT 200`,
      params
    );

    return rows.map((row) => ({
      ...serializeUser(row),
      fullName: row.default_address?.recipientName || row.username,
      ordersCount: row.orders_count || 0,
      totalSpent: Number(row.total_spent_minor || 0) / 100,
      activeSessions: row.active_sessions || 0,
    }));
  }

  async function getUser(userId) {
    const { rows: [row] } = await pool.query(
      `SELECT u.*,
         (SELECT count(*)::int FROM orders o WHERE o.user_id = u.id) AS orders_count,
         (SELECT COALESCE(sum((o.pricing->>'totalMinor')::bigint), 0)::bigint FROM orders o WHERE o.user_id = u.id AND o.payment_status = 'Paid') AS total_spent_minor,
         (SELECT count(*)::int FROM user_sessions s WHERE s.user_id = u.id AND s.expires_at > clock_timestamp()) AS active_sessions
       FROM users u
       WHERE u.id = $1`,
      [userId]
    );
    if (!row) fail(404, 'NOT_FOUND', 'User not found.');

    const { rows: recentOrders } = await pool.query(
      `SELECT order_number, status, payment_method, payment_status, pricing, created_at
       FROM orders
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 10`,
      [userId]
    );

    return {
      ...serializeUser(row),
      fullName: row.default_address?.recipientName || row.username,
      ordersCount: row.orders_count || 0,
      totalSpent: Number(row.total_spent_minor || 0) / 100,
      activeSessions: row.active_sessions || 0,
      orders: recentOrders.map((o) => ({
        orderNumber: o.order_number,
        status: o.status,
        paymentMethod: o.payment_method,
        paymentStatus: o.payment_status,
        total: (o.pricing?.totalMinor || 0) / 100,
        createdAt: o.created_at,
      })),
    };
  }

  async function createUser(input, actor = 'admin') {
    return transaction(pool, async (q) => {
      const { rows: dupUsername } = await q.query(
        'SELECT 1 FROM users WHERE lower(username) = lower($1)',
        [input.username]
      );
      if (dupUsername.length) {
        fail(409, 'USERNAME_TAKEN', 'This username is already taken.', {
          username: 'Choose a different username.',
        });
      }

      const { rows: dupEmail } = await q.query(
        'SELECT 1 FROM users WHERE lower(email) = lower($1)',
        [input.email]
      );
      if (dupEmail.length) {
        fail(409, 'EMAIL_TAKEN', 'An account with this email already exists.', {
          email: 'Choose another email address.',
        });
      }

      const userId = randomUUID();
      const { rows: [created] } = await q.query(
        `INSERT INTO users(id, username, email, password_hash, phone, birthday, role, active)
         VALUES($1, $2, $3, $4, $5, $6::date, $7, $8)
         RETURNING *`,
        [
          userId,
          input.username,
          input.email.toLowerCase(),
          hashPassword(input.password),
          input.phone,
          input.birthday || '2000-01-01',
          input.role || 'customer',
          input.active ?? true,
        ]
      );

      await logAudit(q, actor, 'user.create', 'user', userId, {
        username: created.username,
        role: created.role,
      });

      return {
        ...serializeUser(created),
        fullName: input.fullName || created.username,
        ordersCount: 0,
        totalSpent: 0,
        activeSessions: 0,
      };
    });
  }

  async function updateUser(userId, input, actorOrAdmin = 'admin', currentAdminId = null) {
    const actor =
      typeof actorOrAdmin === 'object' && actorOrAdmin !== null
        ? actorOrAdmin.actor || (actorOrAdmin.username ? `@${actorOrAdmin.username}` : 'admin')
        : actorOrAdmin || 'admin';
    const effectiveAdminId =
      currentAdminId ??
      (typeof actorOrAdmin === 'object' && actorOrAdmin !== null
        ? actorOrAdmin.id || actorOrAdmin.userId || null
        : null);

    return transaction(pool, async (q) => {
      const { rows: [existing] } = await q.query(
        'SELECT * FROM users WHERE id = $1 FOR UPDATE',
        [userId]
      );
      if (!existing) fail(404, 'NOT_FOUND', 'User not found.');

      if (input.username && input.username.toLowerCase() !== existing.username.toLowerCase()) {
        const { rows: dupU } = await q.query(
          'SELECT 1 FROM users WHERE lower(username) = lower($1) AND id <> $2',
          [input.username, userId]
        );
        if (dupU.length) {
          fail(409, 'USERNAME_TAKEN', 'Username is already taken.', {
            username: 'Choose another username.',
          });
        }
      }

      if (input.email && input.email.toLowerCase() !== existing.email.toLowerCase()) {
        const { rows: dupE } = await q.query(
          'SELECT 1 FROM users WHERE lower(email) = lower($1) AND id <> $2',
          [input.email, userId]
        );
        if (dupE.length) {
          fail(409, 'EMAIL_TAKEN', 'Email is already registered to another user.', {
            email: 'Choose another email.',
          });
        }
      }

      if (effectiveAdminId && effectiveAdminId === userId) {
        if (input.active === false) {
          fail(409, 'SELF_LOCKOUT', 'You cannot suspend your own currently signed-in admin account.');
        }
        if (input.role && input.role !== 'admin') {
          fail(409, 'SELF_LOCKOUT', 'You cannot demote your own currently signed-in admin account.');
        }
      }

      const nextUsername = input.username ?? existing.username;
      const nextEmail = input.email ? input.email.toLowerCase() : existing.email;
      const nextPhone = input.phone !== undefined ? input.phone : existing.phone;
      const nextBirthday = input.birthday ?? existing.birthday;
      const nextRole = input.role ?? existing.role ?? 'customer';
      const nextActive = input.active !== undefined ? input.active : existing.active !== false;

      const shouldClearAddress = input.defaultAddress === null;
      const shouldUpdateAddress =
        input.defaultAddress !== undefined && input.defaultAddress !== null;

      const { rows: [updated] } = await q.query(
        `UPDATE users
         SET username = $2,
             email = $3,
             phone = $4,
             birthday = $5::date,
             role = $6,
             active = $7,
             default_address = CASE
               WHEN $8::boolean THEN '{}'::jsonb
               WHEN $9::jsonb IS NOT NULL THEN $9::jsonb
               ELSE default_address
             END,
             updated_at = clock_timestamp()
         WHERE id = $1
         RETURNING *`,
        [
          userId,
          nextUsername,
          nextEmail,
          nextPhone,
          nextBirthday,
          nextRole,
          nextActive,
          shouldClearAddress,
          shouldUpdateAddress ? JSON.stringify(input.defaultAddress) : null,
        ]
      );

      // If suspended or demoted from admin, revoke sessions appropriately
      if (!nextActive) {
        await q.query('DELETE FROM user_sessions WHERE user_id = $1', [userId]);
        await q.query('DELETE FROM admin_sessions WHERE user_id = $1', [userId]);
      } else if (nextRole !== 'admin') {
        await q.query('DELETE FROM admin_sessions WHERE user_id = $1', [userId]);
      }

      await logAudit(q, actor, 'user.update', 'user', userId, {
        username: updated.username,
        role: updated.role,
        active: updated.active,
      });

      return {
        ...serializeUser(updated),
        fullName: updated.default_address?.recipientName || input.fullName || updated.username,
      };
    });
  }

  async function resetUserPassword(userId, input, actor = 'admin') {
    return transaction(pool, async (q) => {
      const { rows: [existing] } = await q.query(
        'SELECT * FROM users WHERE id = $1 FOR UPDATE',
        [userId]
      );
      if (!existing) fail(404, 'NOT_FOUND', 'User not found.');

      await q.query(
        'UPDATE users SET password_hash = $2, updated_at = clock_timestamp() WHERE id = $1',
        [userId, hashPassword(input.newPassword)]
      );
      await q.query('DELETE FROM user_sessions WHERE user_id = $1', [userId]);
      await q.query('DELETE FROM admin_sessions WHERE user_id = $1', [userId]);

      await logAudit(q, actor, 'user.reset_password', 'user', userId, {
        username: existing.username,
      });

      return { updated: true };
    });
  }

  async function deleteUser(userId, actorOrAdmin = 'admin', currentAdminId = null) {
    const actor =
      typeof actorOrAdmin === 'object' && actorOrAdmin !== null
        ? actorOrAdmin.actor || (actorOrAdmin.username ? `@${actorOrAdmin.username}` : 'admin')
        : actorOrAdmin || 'admin';
    const effectiveAdminId =
      currentAdminId ??
      (typeof actorOrAdmin === 'object' && actorOrAdmin !== null
        ? actorOrAdmin.id || actorOrAdmin.userId || null
        : null);

    return transaction(pool, async (q) => {
      if (effectiveAdminId && effectiveAdminId === userId) {
        fail(409, 'SELF_LOCKOUT', 'You cannot delete your own currently signed-in admin account.');
      }
      const { rows: [existing] } = await q.query(
        'SELECT * FROM users WHERE id = $1 FOR UPDATE',
        [userId]
      );
      if (!existing) fail(404, 'NOT_FOUND', 'User not found.');

      await q.query('DELETE FROM users WHERE id = $1', [userId]);
      await logAudit(q, actor, 'user.delete', 'user', userId, {
        username: existing.username,
        email: existing.email,
      });
      return { deleted: true, id: userId };
    });
  }

  return {
    resolveAdmin,
    getSession,
    login,
    logout,
    getSummary,
    listOrders,
    getOrder,
    orderAction,
    listProducts,
    createProduct,
    updateProduct,
    updateStock,
    deleteProduct,
    listVouchers,
    createVoucher,
    updateVoucher,
    deleteVoucher,
    listReviews,
    deleteReview,
    listUsers,
    getUser,
    createUser,
    updateUser,
    resetUserPassword,
    deleteUser,
  };
}

module.exports = { createAdmin };

