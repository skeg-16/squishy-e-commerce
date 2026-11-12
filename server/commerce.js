const { randomUUID, createHash } = require('node:crypto');
const { transaction } = require('./db');
const { fail } = require('./errors');

const REGIONS = {
  'metro-manila': { rate: 6000, minDays: 1, maxDays: 2, label: 'Metro Manila' },
  luzon: { rate: 8000, minDays: 2, maxDays: 4, label: 'Luzon' },
  visayas: { rate: 11000, minDays: 4, maxDays: 7, label: 'Visayas' },
  mindanao: { rate: 11000, minDays: 4, maxDays: 7, label: 'Mindanao' },
};
const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const money = (p) => ({
  subtotal: p.subtotalMinor / 100,
  shippingFee: p.shippingMinor / 100,
  voucherDiscount: p.discountMinor / 100,
  shippingDiscount: p.shippingDiscountMinor / 100,
  total: p.totalMinor / 100,
  voucherCode: p.voucherCode || null,
  currency: 'PHP',
});

function maskPhone(phone) {
  if (!phone || typeof phone !== 'string' || phone.length < 7) return null;
  return `${phone.slice(0, 4)}••••${phone.slice(-3)}`;
}

function createCommerce(pool, { demoMode = false } = {}) {
  async function event(q, id, status, description) {
    await q.query('INSERT INTO order_events(order_id,status,description) VALUES($1,$2,$3)', [
      id,
      status,
      description,
    ]);
  }

  // Always hold the order lock before reservation/product locks. Lock products in slug order.
  async function release(q, orderId) {
    const { rows } = await q.query(
      "SELECT * FROM reservations WHERE order_id=$1 AND status <> 'released' ORDER BY product_slug",
      [orderId]
    );
    if (!rows.length) return;
    await q.query('SELECT slug FROM products WHERE slug=ANY($1::text[]) ORDER BY slug FOR UPDATE', [
      rows.map((r) => r.product_slug),
    ]);
    for (const r of rows) {
      await q.query('UPDATE products SET stock=stock+$2 WHERE slug=$1', [
        r.product_slug,
        r.quantity,
      ]);
    }
    await q.query(
      "UPDATE reservations SET status='released' WHERE order_id=$1 AND status <> 'released'",
      [orderId]
    );
  }

  async function reconcile(q, order) {
    if (order.status !== 'To Pay') return order;
    const { rows: [clock] } = await q.query('SELECT $1::timestamptz <= clock_timestamp() AS expired', [
      order.expires_at,
    ]);
    if (!clock.expired) return order;
    await release(q, order.id);
    const { rows: [updated] } = await q.query(
      "UPDATE orders SET status='Expired', delivery_stage='expired' WHERE id=$1 RETURNING *",
      [order.id]
    );
    await q.query(
      "UPDATE payment_attempts SET status='expired' WHERE order_id=$1 AND status='pending'",
      [order.id]
    );
    await event(
      q,
      order.id,
      'Expired',
      'The unpaid reservation expired; inventory was released.'
    );
    return updated;
  }

  let lastExpireSweepAt = 0;

  async function expireReservations() {
    lastExpireSweepAt = Date.now();
    const { rows } = await pool.query(
      "SELECT id FROM orders WHERE status='To Pay' AND expires_at <= clock_timestamp() ORDER BY id"
    );
    for (const { id } of rows) {
      await transaction(pool, async (q) => {
        const { rows: [order] } = await q.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE', [
          id,
        ]);
        if (order) await reconcile(q, order);
      });
    }
  }

  async function expireReservationsThrottled() {
    const now = Date.now();
    if (now - lastExpireSweepAt < 4000) return;
    await expireReservations();
  }

  async function priceCart(q, request) {
    const quantities = new Map();
    for (const item of request.items) {
      const quantity = (quantities.get(item.slug) || 0) + item.quantity;
      if (quantity > 99) fail(400, 'INVALID_QUANTITY', 'Limit each product to 99 per order.');
      quantities.set(item.slug, quantity);
    }
    const slugs = [...quantities.keys()].sort();
    const { rows: components } = await q.query(
      'SELECT * FROM bundle_components WHERE bundle_slug=ANY($1::text[]) ORDER BY bundle_slug, product_slug',
      [slugs]
    );
    const lockSlugs = [...new Set([...slugs, ...components.map((c) => c.product_slug)])].sort();
    const { rows } = await q.query(
      'SELECT * FROM products WHERE slug=ANY($1::text[]) ORDER BY slug FOR UPDATE',
      [lockSlugs]
    );
    const products = new Map(rows.map((p) => [p.slug, p]));
    const required = new Map();
    const items = slugs.map((slug) => {
      const product = products.get(slug);
      if (!product?.active)
        fail(400, 'UNKNOWN_PRODUCT', `Product ${slug} is unavailable.`, {
          items: 'Remove unavailable products and try again.',
        });
      const quantity = quantities.get(slug);
      const parts =
        product.kind === 'bundle'
          ? components.filter((c) => c.bundle_slug === slug)
          : [{ product_slug: slug, quantity: 1 }];
      if (!parts.length) fail(409, 'BUNDLE_UNAVAILABLE', 'This bundle is not configured.');
      for (const part of parts) {
        const component = products.get(part.product_slug);
        if (!component?.active || component.kind !== 'single')
          fail(409, 'BUNDLE_UNAVAILABLE', 'A bundle component is unavailable.');
        required.set(
          part.product_slug,
          (required.get(part.product_slug) || 0) + part.quantity * quantity
        );
      }
      return {
        slug,
        name: product.name,
        image: product.content.image,
        quantity,
        priceMinor: product.price_minor,
      };
    });
    for (const [slug, quantity] of required) {
      if (products.get(slug).stock < quantity)
        fail(409, 'OUT_OF_STOCK', `Not enough ${products.get(slug).name} in stock.`, {
          items: 'Reduce the quantity or choose another product.',
        });
    }
    const subtotalMinor = items.reduce((sum, i) => sum + i.priceMinor * i.quantity, 0);
    let shippingMinor = subtotalMinor >= 50000 ? 0 : REGIONS[request.region].rate;
    let discountMinor = 0;
    let shippingDiscountMinor = 0;
    if (request.voucherCode) {
      const { rows: [v] } = await q.query(
        'SELECT * FROM vouchers WHERE code=$1 AND active=true FOR SHARE',
        [request.voucherCode]
      );
      if (!v || subtotalMinor < v.min_spend_minor)
        fail(
          400,
          'INVALID_VOUCHER',
          v ? `This voucher requires ₱${v.min_spend_minor / 100} in merchandise.` : 'Invalid voucher code.',
          { voucherCode: 'Check the voucher and its minimum spend.' }
        );
      if (v.type === 'percentage')
        discountMinor = Math.min(subtotalMinor, Math.round((subtotalMinor * v.value) / 100));
      if (v.type === 'fixed_amount') discountMinor = Math.min(subtotalMinor, v.value);
      if (v.type === 'free_shipping') {
        shippingDiscountMinor = shippingMinor;
        shippingMinor = 0;
      }
    }
    return {
      items,
      components: [...required]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([slug, quantity]) => ({ slug, quantity })),
      region: request.region,
      voucherCode: request.voucherCode,
      subtotalMinor,
      shippingMinor,
      discountMinor,
      shippingDiscountMinor,
      totalMinor: subtotalMinor + shippingMinor - discountMinor,
    };
  }

  async function getProducts(slug, options = {}) {
    await expireReservationsThrottled();
    const { rows } = await pool.query(
      `SELECT p.*,
      CASE WHEN kind='single' THEN stock ELSE COALESCE((
        SELECT min(CASE WHEN c.active THEN floor(c.stock::numeric/b.quantity) ELSE 0 END)
        FROM bundle_components b JOIN products c ON c.slug=b.product_slug WHERE b.bundle_slug=p.slug
      ),0) END AS available,
      (SELECT count(*)::int FROM reviews r WHERE r.product_slug=p.slug) AS review_count,
      (SELECT round(avg(rating)::numeric,1) FROM reviews r WHERE r.product_slug=p.slug) AS rating
      FROM products p WHERE active=true AND ($1::text IS NULL OR slug=$1) ORDER BY slug`,
      [slug || null]
    );
    if (slug && !rows.length) fail(404, 'NOT_FOUND', 'Product not found.');
    let mapped = rows.map((p) => ({
      ...p.content,
      slug: p.slug,
      name: p.name,
      kind: p.kind,
      price: p.price_minor / 100,
      stockQuantity: Number(p.available),
      rating: Number(p.rating || 0),
      reviews: p.review_count,
      reviewsCount: p.review_count,
    }));

    if (
      !slug &&
      options &&
      (options.page !== undefined ||
        options.limit !== undefined ||
        options.category ||
        options.q ||
        options.kind)
    ) {
      if (options.kind) {
        mapped = mapped.filter((item) => item.kind === options.kind);
      }
      if (options.category && options.category !== 'all') {
        mapped = mapped.filter(
          (item) => (item.category || '').toLowerCase() === String(options.category).toLowerCase()
        );
      }
      if (options.q) {
        const q = String(options.q).trim().toLowerCase();
        if (q) {
          mapped = mapped.filter((item) =>
            `${item.name || ''} ${item.description || ''} ${item.slug || ''}`.toLowerCase().includes(q)
          );
        }
      }
      if (options.page !== undefined) {
        const page = Math.max(1, Number.parseInt(options.page, 10) || 1);
        const limit = Math.min(50, Math.max(1, Number.parseInt(options.limit, 10) || 6));
        const total = mapped.length;
        const totalPages = Math.max(1, Math.ceil(total / limit));
        const start = (page - 1) * limit;
        const items = mapped.slice(start, start + limit);
        return {
          items,
          products: items,
          pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
          },
        };
      }
    }

    return mapped;
  }

  async function quote(guestId, request) {
    await expireReservations();
    return transaction(pool, async (q) => {
      const pricing = await priceCart(q, request);
      const { rows: [row] } = await q.query(
        'INSERT INTO quotes(id,guest_id,request,pricing,fingerprint) VALUES($1,$2,$3,$4,$5) RETURNING id,expires_at',
        [randomUUID(), guestId, request, pricing, hash(pricing)]
      );
      return {
        quoteId: row.id,
        expiresAt: row.expires_at,
        ...money(pricing),
        items: pricing.items.map((i) => ({
          ...i,
          price: i.priceMinor / 100,
          subtotal: (i.priceMinor * i.quantity) / 100,
        })),
        delivery: REGIONS[request.region],
        demoMode,
        paymentMethods: demoMode ? ['cod', 'gcash', 'maya', 'card'] : ['cod'],
      };
    });
  }

  async function serialize(q, order) {
    const { rows: events } = await q.query(
      'SELECT status,description,created_at AS timestamp FROM order_events WHERE order_id=$1 ORDER BY id',
      [order.id]
    );
    const { rows: items } = await q.query(
      'SELECT product_slug AS slug, product_name AS name, quantity, price_minor FROM order_items WHERE order_id=$1 ORDER BY product_slug',
      [order.id]
    );
    const { rows: [paidAttempt] } = await q.query(
      "SELECT details FROM payment_attempts WHERE order_id=$1 AND status='success' ORDER BY created_at DESC LIMIT 1",
      [order.id]
    );
    return {
      orderNumber: order.order_number,
      trackingNumber: order.tracking_number,
      ...order.customer,
      ...money(order.pricing),
      region: order.pricing.region,
      delivery: REGIONS[order.pricing.region] || null,
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
      paymentStatus: order.payment_status,
      paymentMethod: order.payment_method,
      paymentReference: order.payment_reference,
      paymentDetails: paidAttempt?.details || {},
      paidAt: order.paid_at,
      createdAt: order.created_at,
      expiresAt: order.expires_at,
      cancellationReason: order.cancellation_reason,
      demoMode,
      canCancel: ['To Pay', 'To Ship'].includes(order.status),
      canPay: demoMode && order.status === 'To Pay',
      canAdvanceDelivery: demoMode && ['To Ship', 'Shipped'].includes(order.status),
      items: items.map((i) => ({
        slug: i.slug,
        name: i.name,
        quantity: i.quantity,
        price: i.price_minor / 100,
        subtotal: (i.price_minor * i.quantity) / 100,
      })),
      events,
    };
  }

  async function createOrder(guestId, input, key, userId = null) {
    if (input.paymentMethod !== 'cod' && !demoMode)
      fail(400, 'PAYMENT_DISABLED', 'Electronic payment simulation is disabled. Choose COD.');
    await expireReservations();
    return transaction(pool, async (q) => {
      // Serialize retries for this guest before inspecting the unique idempotency key.
      await q.query('SELECT id FROM guest_sessions WHERE id=$1 FOR UPDATE', [guestId]);
      const { rows: [existing] } = await q.query(
        'SELECT * FROM orders WHERE guest_id=$1 AND idempotency_key=$2',
        [guestId, key]
      );
      if (existing) {
        if (existing.request_hash !== hash(input))
          fail(409, 'IDEMPOTENCY_CONFLICT', 'This retry key belongs to a different request.');
        return serialize(q, existing);
      }
      const { rows: [quoted] } = await q.query(
        'SELECT *, expires_at <= clock_timestamp() AS expired FROM quotes WHERE id=$1 AND guest_id=$2 FOR UPDATE',
        [input.quoteId, guestId]
      );
      if (!quoted) fail(404, 'NOT_FOUND', 'Quote not found.');
      const { rows: [used] } = await q.query('SELECT * FROM orders WHERE quote_id=$1', [
        quoted.id,
      ]);
      if (used)
        fail(409, 'QUOTE_USED', 'This quote has already been checked out. Open the existing order.');
      if (quoted.expired)
        fail(409, 'QUOTE_EXPIRED', 'Your quote expired. Refresh totals before placing your order.');
      const pricing = await priceCart(q, quoted.request);
      if (hash(pricing) !== quoted.fingerprint)
        fail(409, 'PRICE_CHANGED', 'Prices changed. Review a fresh quote before confirming.');
      const { quoteId, paymentMethod, ...customer } = input;
      const id = randomUUID();
      const reference = id.replaceAll('-', '').toUpperCase();
      const initialStage = paymentMethod === 'cod' ? 'preparing' : 'awaiting_payment';
      const { rows: [order] } = await q.query(
        `INSERT INTO orders
        (id,order_number,guest_id,user_id,quote_id,idempotency_key,request_hash,customer,payment_method,status,payment_status,delivery_stage,pricing,tracking_number,expires_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,CASE WHEN $9='cod' THEN NULL ELSE clock_timestamp()+interval '15 minutes' END) RETURNING *`,
        [
          id,
          `SQ-${reference}`,
          guestId,
          userId || null,
          quoteId,
          key,
          hash(input),
          customer,
          paymentMethod,
          paymentMethod === 'cod' ? 'To Ship' : 'To Pay',
          paymentMethod === 'cod' ? 'Pending COD' : 'Unpaid',
          initialStage,
          pricing,
          `DEMO-${reference}`,
        ]
      );
      for (const i of pricing.items) {
        await q.query(
          'INSERT INTO order_items(order_id,product_slug,product_name,quantity,price_minor) VALUES($1,$2,$3,$4,$5)',
          [id, i.slug, i.name, i.quantity, i.priceMinor]
        );
      }
      for (const part of pricing.components) {
        await q.query('UPDATE products SET stock=stock-$2 WHERE slug=$1', [
          part.slug,
          part.quantity,
        ]);
        await q.query(
          'INSERT INTO reservations(order_id,product_slug,quantity,status) VALUES($1,$2,$3,$4)',
          [id, part.slug, part.quantity, paymentMethod === 'cod' ? 'committed' : 'held']
        );
      }
      await event(
        q,
        id,
        'Order Placed',
        paymentMethod === 'cod'
          ? 'COD order confirmed; seller is preparing your squishy parcel.'
          : 'Inventory reserved for 15 minutes while wallet/card payment is pending.'
      );
      return serialize(q, order);
    });
  }

  async function lockOwned(q, number, guestId, userId = null) {
    const { rows: [order] } = await q.query(
      `SELECT * FROM orders
       WHERE order_number=$1
         AND (guest_id=$2 OR ($3::uuid IS NOT NULL AND user_id=$3))
       FOR UPDATE`,
      [number, guestId, userId || null]
    );
    if (!order) fail(404, 'NOT_FOUND', 'Order not found in this session.');
    return order;
  }

  async function getOrder(guestId, number, userId = null) {
    return transaction(pool, async (q) =>
      serialize(q, await reconcile(q, await lockOwned(q, number, guestId, userId)))
    );
  }

  async function listAccountOrders(userId, guestId = null) {
    await expireReservationsThrottled();
    const { rows: orders } = await pool.query(
      `SELECT * FROM orders
       WHERE user_id = $1 OR ($2::uuid IS NOT NULL AND user_id IS NULL AND guest_id = $2)
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId, guestId || null]
    );
    if (!orders.length) return [];
    const orderIds = orders.map((o) => o.id);
    const { rows: items } = await pool.query(
      'SELECT order_id, product_slug AS slug, product_name AS name, quantity, price_minor FROM order_items WHERE order_id = ANY($1::uuid[]) ORDER BY product_slug',
      [orderIds]
    );
    const itemsByOrder = new Map();
    for (const item of items) {
      if (!itemsByOrder.has(item.order_id)) itemsByOrder.set(item.order_id, []);
      itemsByOrder.get(item.order_id).push({
        slug: item.slug,
        name: item.name,
        quantity: item.quantity,
        price: item.price_minor / 100,
        subtotal: (item.price_minor * item.quantity) / 100,
      });
    }
    return orders.map((o) => ({
      orderNumber: o.order_number,
      trackingNumber: o.tracking_number,
      status: o.status,
      deliveryStage: o.delivery_stage || o.status.toLowerCase(),
      paymentStatus: o.payment_status,
      paymentMethod: o.payment_method,
      paymentReference: o.payment_reference,
      ...money(o.pricing),
      region: o.pricing.region,
      createdAt: o.created_at,
      paidAt: o.paid_at,
      items: itemsByOrder.get(o.id) || [],
    }));
  }

  async function cancel(guestId, number, reason, userId = null) {
    // Expiration is committed separately so an invalid later transition cannot undo cleanup.
    await getOrder(guestId, number, userId);
    return transaction(pool, async (q) => {
      const order = await reconcile(q, await lockOwned(q, number, guestId, userId));
      if (order.status === 'Cancelled') return serialize(q, order);
      if (order.status === 'Expired') return { expired: true };
      if (!['To Pay', 'To Ship'].includes(order.status))
        fail(409, 'INVALID_STATE', 'Only orders awaiting payment or shipment can be cancelled.');
      await release(q, order.id);
      const { rows: [updated] } = await q.query(
        `UPDATE orders SET status='Cancelled',delivery_stage='cancelled',cancellation_reason=$2,
        payment_status=CASE WHEN payment_status='Paid' THEN 'Refunded' ELSE payment_status END WHERE id=$1 RETURNING *`,
        [order.id, reason]
      );
      await q.query(
        "UPDATE payment_attempts SET status='cancelled' WHERE order_id=$1 AND status='pending'",
        [order.id]
      );
      await event(
        q,
        order.id,
        'Cancelled',
        order.payment_status === 'Paid'
          ? 'Order cancelled; simulated refund recorded and inventory restored.'
          : 'Order cancelled; inventory restored.'
      );
      return serialize(q, updated);
    }).then((result) => {
      if (result.expired) fail(409, 'RESERVATION_EXPIRED', 'This unpaid order has expired.');
      return result;
    });
  }

  const paymentView = (p) => ({
    sessionId: p.id,
    status: p.status,
    amount: p.amount_minor / 100,
    currency: 'PHP',
    simulated: true,
    details: p.details || {},
  });
  const assertDemo = () => {
    if (!demoMode) fail(404, 'NOT_FOUND', 'Simulation is disabled.');
  };

  async function createPayment(guestId, number, key, userId = null) {
    assertDemo();
    await getOrder(guestId, number, userId);
    return transaction(pool, async (q) => {
      const order = await reconcile(q, await lockOwned(q, number, guestId, userId));
      const { rows: [existing] } = await q.query(
        'SELECT * FROM payment_attempts WHERE order_id=$1 AND idempotency_key=$2',
        [order.id, key]
      );
      if (existing) return paymentView(existing);
      if (order.status === 'Expired') return { expired: true };
      if (order.status !== 'To Pay')
        fail(409, 'INVALID_STATE', 'This order cannot accept a payment.');
      const { rows: [pending] } = await q.query(
        "SELECT * FROM payment_attempts WHERE order_id=$1 AND status='pending'",
        [order.id]
      );
      if (pending) return paymentView(pending);
      const { rows: [attempt] } = await q.query(
        "INSERT INTO payment_attempts(id,order_id,idempotency_key,status,amount_minor) VALUES($1,$2,$3,'pending',$4) RETURNING *",
        [randomUUID(), order.id, key, order.pricing.totalMinor]
      );
      return paymentView(attempt);
    }).then((result) => {
      if (result.expired) fail(409, 'RESERVATION_EXPIRED', 'This unpaid order has expired.');
      return result;
    });
  }

  async function simulate(guestId, sessionId, payload, userId = null) {
    assertDemo();
    const outcome = typeof payload === 'string' ? payload : payload.outcome;
    const { rows: [owner] } = await pool.query(
      `SELECT o.order_number FROM payment_attempts p
       JOIN orders o ON o.id=p.order_id
       WHERE p.id=$1 AND (o.guest_id=$2 OR ($3::uuid IS NOT NULL AND o.user_id=$3))`,
      [sessionId, guestId, userId || null]
    );
    if (!owner) fail(404, 'NOT_FOUND', 'Payment session not found.');
    await getOrder(guestId, owner.order_number, userId);
    return transaction(pool, async (q) => {
      const order = await lockOwned(q, owner.order_number, guestId, userId);
      const { rows: [attempt] } = await q.query(
        'SELECT * FROM payment_attempts WHERE id=$1 FOR UPDATE',
        [sessionId]
      );
      if (attempt.status === outcome)
        return { ...paymentView(attempt), order: await serialize(q, order) };
      if (attempt.status !== 'pending' || order.status !== 'To Pay')
        fail(409, 'INVALID_STATE', 'This payment session is no longer pending.');
      // Recheck the deadline after obtaining locks, including when the sweep raced this request.
      const { rows: [clock] } = await q.query(
        'SELECT $1::timestamptz <= clock_timestamp() AS expired',
        [order.expires_at]
      );
      if (clock.expired) {
        await reconcile(q, order);
        return { expired: true };
      }

      const maskedDetails =
        typeof payload === 'object' && payload
          ? {
              channel: order.payment_method.toUpperCase(),
              ...(payload.payerMobile ? { maskedAccount: maskPhone(payload.payerMobile) } : {}),
              ...(payload.cardLast4 ? { maskedAccount: `•••• •••• •••• ${payload.cardLast4}` } : {}),
            }
          : {};

      const { rows: [updated] } = await q.query(
        'UPDATE payment_attempts SET status=$2, details=$3 WHERE id=$1 RETURNING *',
        [sessionId, outcome, JSON.stringify(maskedDetails)]
      );

      let current = order;
      if (outcome === 'success') {
        const prefix =
          order.payment_method === 'gcash'
            ? 'GC'
            : order.payment_method === 'maya'
              ? 'MY'
              : order.payment_method === 'card'
                ? 'CD'
                : 'DEMO-PAY';
        const refCode = `${prefix}-${attempt.id.replaceAll('-', '').slice(0, 10).toUpperCase()}`;
        const result = await q.query(
          "UPDATE orders SET status='To Ship',payment_status='Paid',delivery_stage='preparing',payment_reference=$2,paid_at=clock_timestamp() WHERE id=$1 RETURNING *",
          [order.id, refCode]
        );
        current = result.rows[0];
        await q.query(
          "UPDATE reservations SET status='committed' WHERE order_id=$1 AND status='held'",
          [order.id]
        );
      }

      const channelLabel = order.payment_method.toUpperCase();
      const accountSuffix = maskedDetails.maskedAccount ? ` (${maskedDetails.maskedAccount})` : '';
      await event(
        q,
        order.id,
        `Payment ${outcome}`,
        outcome === 'success'
          ? `Simulated ${channelLabel} payment confirmed${accountSuffix}. Seller is now packing your parcel.`
          : `Simulated ${channelLabel} payment ${outcome}. No money was transferred.`
      );
      return { ...paymentView(updated), order: await serialize(q, current) };
    }).then((result) => {
      if (result.expired) fail(409, 'RESERVATION_EXPIRED', 'Payment reservation expired.');
      return result;
    });
  }

  async function advanceOwnedDemoDelivery(guestId, number, targetStage, userId = null) {
    assertDemo();
    return transaction(pool, async (q) => {
      const order = await reconcile(q, await lockOwned(q, number, guestId, userId));
      const stage = order.delivery_stage || (order.status === 'To Ship' ? 'preparing' : order.status === 'Shipped' ? 'in_transit' : '');

      if (targetStage === 'shipped') {
        if (order.status !== 'To Ship') {
          fail(409, 'INVALID_STATE', 'Order must be in To Ship before handing over to courier.');
        }
        const { rows: [updated] } = await q.query(
          `UPDATE orders SET status='Shipped', delivery_stage='in_transit' WHERE id=$1 RETURNING *`,
          [order.id]
        );
        await event(
          q,
          order.id,
          'Shipped',
          'SquishExpress picked up your parcel and dispatched it from Metro Manila Sortation Hub.'
        );
        return serialize(q, updated);
      }

      if (targetStage === 'out_for_delivery') {
        if (order.status !== 'Shipped' || stage === 'out_for_delivery') {
          fail(409, 'INVALID_STATE', 'Parcel must already be Shipped before marking Out for Delivery.');
        }
        const { rows: [updated] } = await q.query(
          `UPDATE orders SET delivery_stage='out_for_delivery' WHERE id=$1 RETURNING *`,
          [order.id]
        );
        await event(
          q,
          order.id,
          'Out for Delivery',
          'Rider Mateo D. (SquishExpress) is out for delivery to your address.'
        );
        return serialize(q, updated);
      }

      if (targetStage === 'completed') {
        if (order.status !== 'Shipped') {
          fail(409, 'INVALID_STATE', 'Order must be Shipped before confirming delivery receipt.');
        }
        const { rows: [updated] } = await q.query(
          `UPDATE orders SET status='Completed', delivery_stage='delivered',
           payment_status=CASE WHEN payment_method='cod' THEN 'Paid' ELSE payment_status END,
           payment_reference=CASE WHEN payment_method='cod' AND payment_reference IS NULL THEN 'COD-' || substr(replace(id::text,'-',''),1,10) ELSE payment_reference END,
           paid_at=CASE WHEN payment_method='cod' AND paid_at IS NULL THEN clock_timestamp() ELSE paid_at END
           WHERE id=$1 RETURNING *`,
          [order.id]
        );
        await event(
          q,
          order.id,
          'Completed',
          order.payment_method === 'cod'
            ? 'Parcel delivered & COD cash payment collected. Order Completed!'
            : 'Parcel delivered and confirmed received by customer. Order Completed!'
        );
        return serialize(q, updated);
      }

      fail(400, 'INVALID_STAGE', 'Unsupported delivery stage.');
    });
  }

  async function tracking(guestId, number, userId = null) {
    const { rows: [row] } = await pool.query(
      `SELECT order_number FROM orders
       WHERE tracking_number=$1 AND (guest_id=$2 OR ($3::uuid IS NOT NULL AND user_id=$3))`,
      [number, guestId, userId || null]
    );
    if (!row) fail(404, 'NOT_FOUND', 'Tracking reference not found.');
    const order = await getOrder(guestId, row.order_number, userId);
    return {
      trackingNumber: number,
      courier: 'SquishExpress Demo Courier',
      deliveryStage: order.deliveryStage,
      checkpointCount: order.events.length,
      checkpoints: order.events,
    };
  }

  async function reviews(slug, options = {}) {
    const products = await getProducts(slug);
    const page = Math.max(1, Number.parseInt(options?.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(options?.limit, 10) || 100));
    const offset = (page - 1) * limit;
    const { rows } = await pool.query(
      'SELECT id,reviewer_name AS "reviewerName",rating,comment,created_at AS "createdAt" FROM reviews WHERE product_slug=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [slug, limit, offset]
    );
    const total = Number(products[0].reviewsCount || 0);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    return {
      productSlug: slug,
      averageRating: products[0].rating,
      reviewsCount: total,
      reviews: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  async function addReview(guestId, input, userId = null) {
    return transaction(pool, async (q) => {
      const order = await lockOwned(q, input.orderNumber, guestId, userId);
      if (order.status !== 'Completed')
        fail(409, 'REVIEW_NOT_ELIGIBLE', 'Reviews open after delivery is completed.');
      const { rowCount } = await q.query(
        'SELECT 1 FROM order_items WHERE order_id=$1 AND product_slug=$2 UNION SELECT 1 FROM reservations WHERE order_id=$1 AND product_slug=$2',
        [order.id, input.productSlug]
      );
      if (!rowCount) fail(400, 'NOT_PURCHASED', 'This product was not part of your order.');
      const { rows: [review] } = await q.query(
        `INSERT INTO reviews(id,order_id,product_slug,rating,comment,reviewer_name) VALUES($1,$2,$3,$4,$5,$6)
        ON CONFLICT(order_id,product_slug) DO NOTHING RETURNING id`,
        [randomUUID(), order.id, input.productSlug, input.rating, input.comment, input.reviewerName]
      );
      if (!review)
        fail(409, 'REVIEW_EXISTS', 'You have already reviewed this product for this order.');
      return { id: review.id };
    });
  }

  // Local-only CLI entry: never registered as a public HTTP route.
  async function advanceDemo(number, status) {
    assertDemo();
    if (!['Shipped', 'Completed'].includes(status))
      fail(400, 'INVALID_STATE', 'Use Shipped or Completed.');
    return transaction(pool, async (q) => {
      const { rows: [order] } = await q.query(
        'SELECT * FROM orders WHERE order_number=$1 FOR UPDATE',
        [number]
      );
      if (!order || !order.tracking_number.startsWith('DEMO-'))
        fail(404, 'NOT_FOUND', 'Demo order not found.');
      if (order.status === status) return serialize(q, order);
      if (order.status !== (status === 'Shipped' ? 'To Ship' : 'Shipped'))
        fail(409, 'INVALID_STATE', 'Orders must progress from To Ship to Shipped to Completed.');
      const nextStage = status === 'Completed' ? 'delivered' : 'in_transit';
      const { rows: [updated] } = await q.query(
        `UPDATE orders SET status=$2, delivery_stage=$3,
        payment_status=CASE WHEN $2='Completed' AND payment_method='cod' THEN 'Paid' ELSE payment_status END,
        paid_at=CASE WHEN $2='Completed' AND payment_method='cod' THEN clock_timestamp() ELSE paid_at END
        WHERE id=$1 RETURNING *`,
        [order.id, status, nextStage]
      );
      await event(
        q,
        order.id,
        status,
        status === 'Shipped'
          ? 'Demo shipment dispatched (no real courier).'
          : 'Demo delivery completed; COD collection simulated where applicable.'
      );
      return serialize(q, updated);
    });
  }

  return {
    getProducts,
    quote,
    createOrder,
    getOrder,
    listAccountOrders,
    cancel,
    createPayment,
    simulate,
    advanceOwnedDemoDelivery,
    tracking,
    reviews,
    addReview,
    advanceDemo,
    expireReservations,
  };
}

module.exports = { createCommerce, REGIONS, hash };
