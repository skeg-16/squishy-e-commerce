// TEMPORARY ADMIN PREVIEW DATA
// All changes are in-memory only. Nothing is saved to the database.

const products = [
  {
    slug: 'dumpling',
    name: 'Steamed Dumpling Squishy',
    kind: 'single',
    price: 89,
    stock: 5,
    active: true,
    image: 'assets/images/product-dumpling.svg',
    description: 'A soft and squishy dumpling.',
    specs: { Material: 'TPR and memory foam' },
    components: [],
    badge: 'Bestseller',
    badgeClass: 'badge--pink',
  },
  {
    slug: 'cheese',
    name: 'Cheese Cube Squishy',
    kind: 'single',
    price: 89,
    stock: 24,
    active: true,
    image: 'assets/images/product-cheese.svg',
    description: 'A cheesy little stress reliever.',
    specs: {},
    components: [],
    badge: '',
    badgeClass: '',
  },
  {
    slug: 'catpaw',
    name: 'Cat Paw Squishy',
    kind: 'single',
    price: 99,
    stock: 8,
    active: true,
    image: 'assets/images/product-catpaw.svg',
    description: 'A cute paw-shaped squishy.',
    specs: {},
    components: [],
    badge: 'Popular',
    badgeClass: 'badge--purple',
  },
];

const orders = [
  {
    orderNumber: 'SQ-2026-001',
    customerName: 'Alex Santos',
    customerEmail: 'alex@example.com',
    customerPhone: '09171234567',
    shippingAddress: '123 Sample Street',
    barangay: 'Poblacion',
    city: 'Santa Cruz',
    postalCode: '4009',
    region: 'CALABARZON',
    paymentMethod: 'gcash',
    paymentStatus: 'Paid',
    status: 'To Ship',
    createdAt: '2026-11-08T10:30:00',
    subtotal: 178,
    voucherDiscount: 0,
    voucherCode: '',
    shippingFee: 50,
    total: 228,
    cancellationReason: '',
    items: [
      { name: 'Steamed Dumpling Squishy', quantity: 2, price: 89, subtotal: 178 },
    ],
    events: [
      { status: 'To Pay', description: 'Order placed.', timestamp: '2026-11-08T10:30:00' },
      { status: 'To Ship', description: 'Payment confirmed.', timestamp: '2026-11-08T10:35:00' },
    ],
  },
  {
    orderNumber: 'SQ-2026-002',
    customerName: 'Jamie Reyes',
    customerEmail: 'jamie@example.com',
    customerPhone: '09181234567',
    shippingAddress: '45 Sample Avenue',
    barangay: 'San Isidro',
    city: 'Santa Cruz',
    postalCode: '4009',
    region: 'CALABARZON',
    paymentMethod: 'cod',
    paymentStatus: 'Pending',
    status: 'To Pay',
    createdAt: '2026-11-09T14:15:00',
    subtotal: 99,
    voucherDiscount: 0,
    voucherCode: '',
    shippingFee: 50,
    total: 149,
    cancellationReason: '',
    items: [
      { name: 'Cat Paw Squishy', quantity: 1, price: 99, subtotal: 99 },
    ],
    events: [
      { status: 'To Pay', description: 'Order placed.', timestamp: '2026-11-09T14:15:00' },
    ],
  },
  {
    orderNumber: 'SQ-2026-003',
    customerName: 'Taylor Cruz',
    customerEmail: 'taylor@example.com',
    customerPhone: '09191234567',
    shippingAddress: '78 Example Road',
    barangay: 'Pagsawitan',
    city: 'Santa Cruz',
    postalCode: '4009',
    region: 'CALABARZON',
    paymentMethod: 'gcash',
    paymentStatus: 'Paid',
    status: 'Completed',
    createdAt: '2026-11-05T09:00:00',
    subtotal: 89,
    voucherDiscount: 0,
    voucherCode: '',
    shippingFee: 50,
    total: 139,
    cancellationReason: '',
    items: [
      { name: 'Steamed Dumpling Squishy', quantity: 1, price: 89, subtotal: 89 },
    ],
    events: [
      { status: 'Completed', description: 'Order delivered.', timestamp: '2026-11-06T12:00:00' },
    ],
  },
];

const vouchers = [
  {
    code: 'SQUISH10',
    type: 'percentage',
    value: 10,
    minSpend: 200,
    description: '10% off your order',
    active: true,
  },
  {
    code: 'FREESHIP',
    type: 'free_shipping',
    value: 0,
    minSpend: 300,
    description: 'Free shipping on eligible orders',
    active: true,
  },
];

const reviews = [
  {
    id: 1,
    productName: 'Steamed Dumpling Squishy',
    orderNumber: 'SQ-2026-001',
    rating: 5,
    reviewerName: 'Alex Santos',
    comment: 'Super cute and soft! I love it.',
    createdAt: '2026-11-08T16:00:00',
  },
  {
    id: 2,
    productName: 'Cat Paw Squishy',
    orderNumber: 'SQ-2026-003',
    rating: 4,
    reviewerName: 'Taylor Cruz',
    comment: 'Really adorable. Would buy again!',
    createdAt: '2026-11-06T13:00:00',
  },
];

export async function adminPreviewApi(path, { method = 'GET', body = {} } = {}) {
  const url = new URL(path, window.location.origin);
  const route = url.pathname;
  const params = url.searchParams;

  if (route === '/summary' && method === 'GET') {
    const paid = orders.filter((o) => o.paymentStatus === 'Paid');

    return {
      orders: Object.fromEntries(
        ['To Pay', 'To Ship', 'Shipped', 'Completed', 'Cancelled', 'Expired']
          .map((status) => [status, orders.filter((o) => o.status === status).length])
      ),
      paidOrders: paid.length,
      revenue: paid.reduce((sum, o) => sum + o.total, 0),
      products: {
        active: products.filter((p) => p.active).length,
        total: products.length,
      },
      lowStock: products.filter((p) => p.stock <= 10),
    };
  }

  if (route === '/orders' && method === 'GET') {
    return orders.filter((order) => {
      const matchesStatus = !params.get('status') || order.status === params.get('status');
      const q = (params.get('q') || '').toLowerCase();
      const matchesQuery = !q ||
        `${order.orderNumber} ${order.customerName} ${order.customerEmail}`.toLowerCase().includes(q);

      return matchesStatus && matchesQuery;
    });
  }

  const orderMatch = route.match(/^\/orders\/([^/]+)(?:\/action)?$/);

  if (orderMatch) {
    const order = orders.find((o) => o.orderNumber === decodeURIComponent(orderMatch[1]));
    if (!order) throw new Error('Order not found.');

    if (route.endsWith('/action') && method === 'POST') {
      if (body.action === 'ship') order.status = 'Shipped';
      if (body.action === 'complete') order.status = 'Completed';
      if (body.action === 'cancel') {
        order.status = 'Cancelled';
        order.cancellationReason = body.reason || 'Cancelled by the store';
      }
      return order;
    }

    if (method === 'GET') return order;
  }

  if (route === '/products' && method === 'GET') return products;

  if (route === '/products' && method === 'POST') {
    const product = {
      ...body,
      slug: body.slug,
      stock: Number(body.stock || 0),
      active: body.active ?? true,
    };
    products.push(product);
    return product;
  }

  const productMatch = route.match(/^\/products\/([^/]+)(?:\/stock)?$/);

  if (productMatch) {
    const product = products.find((p) => p.slug === decodeURIComponent(productMatch[1]));
    if (!product) throw new Error('Product not found.');

    if (route.endsWith('/stock') && method === 'PATCH') {
      product.stock = Number(body.stock);
      return product;
    }

    if (method === 'PUT') {
      Object.assign(product, body);
      return product;
    }
  }

  if (route === '/vouchers' && method === 'GET') return vouchers;

  if (route === '/vouchers' && method === 'POST') {
    const voucher = { ...body, code: body.code.toUpperCase() };
    vouchers.push(voucher);
    return voucher;
  }

  const voucherMatch = route.match(/^\/vouchers\/([^/]+)$/);

  if (voucherMatch) {
    const index = vouchers.findIndex(
      (v) => v.code === decodeURIComponent(voucherMatch[1])
    );

    if (index < 0) throw new Error('Voucher not found.');

    if (method === 'DELETE') {
      return vouchers.splice(index, 1)[0];
    }

    if (method === 'PUT') {
      Object.assign(vouchers[index], body);
      return vouchers[index];
    }
  }

  if (route === '/reviews' && method === 'GET') return reviews;

  const reviewMatch = route.match(/^\/reviews\/(\d+)$/);

  if (reviewMatch && method === 'DELETE') {
    const index = reviews.findIndex((r) => r.id === Number(reviewMatch[1]));
    if (index < 0) throw new Error('Review not found.');
    return reviews.splice(index, 1)[0];
  }

  throw new Error(`Preview does not support ${method} ${route}.`);
}