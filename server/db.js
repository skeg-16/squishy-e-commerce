const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'squishies-db.json');

const defaultVouchers = [
  {
    code: 'WELCOME10',
    type: 'percentage',
    value: 10,
    minSpend: 150,
    description: '10% off subtotal for new customers (Min spend ₱150)'
  },
  {
    code: 'FREESHIP',
    type: 'free_shipping',
    value: 60,
    minSpend: 0,
    description: 'Free shipping voucher'
  },
  {
    code: 'SQUISHY50',
    type: 'fixed_amount',
    value: 50,
    minSpend: 300,
    description: '₱50 flat discount (Min spend ₱300)'
  }
];

const defaultData = {
  products: [],
  orders: [],
  orderItems: [],
  paymentSessions: [],
  vouchers: defaultVouchers,
  reservations: [],
  trackingLogs: [],
  reviews: [
    {
      id: 1,
      orderNumber: 'SQ-DEMO-001',
      productSlug: 'dumpling',
      reviewerName: 'Mary R.',
      rating: 5,
      comment: 'Extremely soft and slow rising. Smells pleasant and well-packaged.',
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString()
    },
    {
      id: 2,
      orderNumber: 'SQ-DEMO-002',
      productSlug: 'catpaw',
      reviewerName: 'Alyssa G.',
      rating: 5,
      comment: 'Super cute desk companion. Great quality memory foam.',
      createdAt: new Date(Date.now() - 86400000 * 4).toISOString()
    }
  ]
};

function readDb() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      writeDb(defaultData);
      return defaultData;
    }
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(raw);

    // Ensure all collections exist
    if (!parsed.vouchers || parsed.vouchers.length === 0) parsed.vouchers = defaultVouchers;
    if (!parsed.reservations) parsed.reservations = [];
    if (!parsed.trackingLogs) parsed.trackingLogs = [];
    if (!parsed.reviews) parsed.reviews = defaultData.reviews;

    return parsed;
  } catch (err) {
    console.error('Error reading database file:', err);
    return defaultData;
  }
}

function writeDb(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing database file:', err);
  }
}

const db = {
  getProducts() {
    const data = readDb();
    return data.products || [];
  },

  getProductBySlug(slug) {
    const products = this.getProducts();
    return products.find(p => p.slug === slug);
  },

  seedProducts(initialProducts) {
    const data = readDb();
    data.products = initialProducts;
    writeDb(data);
    return data.products;
  },

  // 1. Voucher Engine
  getAvailableVouchers() {
    const data = readDb();
    return data.vouchers || defaultVouchers;
  },

  validateVoucher(code, subtotal, shippingFee) {
    const vouchers = this.getAvailableVouchers();
    const voucher = vouchers.find(v => v.code.toUpperCase() === (code || '').trim().toUpperCase());

    if (!voucher) {
      return { valid: false, error: 'Invalid voucher code.' };
    }

    if (subtotal < voucher.minSpend) {
      return { valid: false, error: `Voucher requires a minimum spend of ₱${voucher.minSpend}.` };
    }

    let discountAmount = 0;
    if (voucher.type === 'percentage') {
      discountAmount = Math.round((subtotal * voucher.value) / 100);
    } else if (voucher.type === 'fixed_amount') {
      discountAmount = Math.min(subtotal, voucher.value);
    } else if (voucher.type === 'free_shipping') {
      discountAmount = shippingFee;
    }

    return {
      valid: true,
      code: voucher.code,
      type: voucher.type,
      discountAmount,
      description: voucher.description
    };
  },

  // 2. 15-Minute Inventory Reservation Timer
  cleanExpiredReservations() {
    const data = readDb();
    const now = Date.now();
    let modified = false;

    data.reservations = (data.reservations || []).filter((res) => {
      if (res.status === 'active' && new Date(res.expiresAt).getTime() < now) {
        // Return reserved stock to inventory
        const product = data.products.find(p => p.slug === res.productSlug);
        if (product) {
          product.stockQuantity = (product.stockQuantity || 0) + res.quantity;
        }
        modified = true;
        return false;
      }
      return true;
    });

    if (modified) writeDb(data);
  },

  createOrder(orderData, items) {
    this.cleanExpiredReservations();
    const data = readDb();

    // Reserve stock with 15-minute expiration timer
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const orderId = data.orders.length + 1;
    const trackingNumber = `SPXPH${Date.now().toString().slice(-6)}${Math.floor(100 + Math.random() * 900)}`;

    for (const item of items) {
      const product = data.products.find(p => p.slug === item.productSlug || p.name === item.productName);
      if (product) {
        product.stockQuantity = Math.max(0, (product.stockQuantity || 100) - item.quantity);
      }

      data.reservations.push({
        id: data.reservations.length + 1,
        orderNumber: orderData.orderNumber,
        productSlug: item.productSlug,
        quantity: item.quantity,
        expiresAt,
        status: 'active'
      });
    }

    const orderRecord = {
      id: orderId,
      ...orderData,
      trackingNumber,
      paymentStatus: orderData.paymentMethod === 'cod' ? 'Pending COD' : 'Unpaid',
      paymentReference: null,
      paidAt: null,
      createdAt: new Date().toISOString()
    };

    data.orders.push(orderRecord);

    const itemRecords = items.map((item, idx) => ({
      id: (data.orderItems || []).length + idx + 1,
      orderId,
      ...item
    }));

    if (!data.orderItems) data.orderItems = [];
    data.orderItems.push(...itemRecords);

    // Create Initial SPX Logistics Tracking Checkpoints
    data.trackingLogs.push(
      {
        trackingNumber,
        status: 'Order Placed',
        location: 'Seller Warehouse (Manila Hub)',
        description: 'Order details received and package prepared for pickup.',
        timestamp: new Date().toISOString()
      },
      {
        trackingNumber,
        status: 'Handed to Courier',
        location: 'SPX Express Sorting Center',
        description: 'Parcel transferred to SPX Express logistics network.',
        timestamp: new Date(Date.now() + 1800000).toISOString()
      }
    );

    writeDb(data);

    return {
      order: orderRecord,
      items: itemRecords
    };
  },

  getOrder(orderNumber) {
    const data = readDb();
    const order = data.orders.find(o => o.orderNumber === orderNumber);
    if (!order) return null;

    const items = (data.orderItems || []).filter(i => i.orderId === order.id);
    return { order, items };
  },

  // 3. Logistics & Live Tracking API
  getTrackingLogs(trackingNumber) {
    const data = readDb();
    const logs = (data.trackingLogs || []).filter(t => t.trackingNumber === trackingNumber);

    if (logs.length === 0) {
      return [
        {
          trackingNumber,
          status: 'Order Placed',
          location: 'Seller Warehouse (Manila Hub)',
          description: 'Package details registered in logistics system.',
          timestamp: new Date().toISOString()
        }
      ];
    }
    return logs;
  },

  confirmPayment(orderNumber, paymentReference, paymentMethod) {
    const data = readDb();
    const order = data.orders.find(o => o.orderNumber === orderNumber);
    if (!order) return null;

    order.paymentStatus = 'Paid';
    order.status = 'To Ship';
    order.paymentReference = paymentReference;
    order.paidAt = new Date().toISOString();

    // Confirm stock reservations permanently
    (data.reservations || []).forEach(r => {
      if (r.orderNumber === orderNumber) r.status = 'confirmed';
    });

    writeDb(data);
    return order;
  },

  cancelOrder(orderNumber, reason) {
    const data = readDb();
    const order = data.orders.find(o => o.orderNumber === orderNumber);
    if (!order) return null;

    if (order.status === 'Cancelled') {
      return { order, alreadyCancelled: true };
    }

    order.status = 'Cancelled';
    order.cancellationReason = reason || 'Customer requested cancellation';
    order.cancelledAt = new Date().toISOString();

    // Release reservations & restore inventory stock
    const items = (data.orderItems || []).filter(i => i.orderId === order.id);
    for (const item of items) {
      const product = data.products.find(p => p.slug === item.productSlug || p.name === item.productName);
      if (product) {
        product.stockQuantity = (product.stockQuantity || 0) + item.quantity;
      }
    }

    writeDb(data);
    return { order, items };
  },

  // 4. Verified Buyer Reviews System
  getProductReviews(productSlug) {
    const data = readDb();
    return (data.reviews || []).filter(r => r.productSlug === productSlug);
  },

  addReview(reviewData) {
    const data = readDb();

    // Verify order exists
    const order = data.orders.find(o => o.orderNumber === reviewData.orderNumber);
    if (!order) {
      return { success: false, error: 'Order reference not found.' };
    }

    const reviewId = (data.reviews || []).length + 1;
    const record = {
      id: reviewId,
      orderNumber: reviewData.orderNumber,
      productSlug: reviewData.productSlug,
      reviewerName: reviewData.reviewerName || order.customerName,
      rating: parseInt(reviewData.rating, 10) || 5,
      comment: reviewData.comment.trim(),
      createdAt: new Date().toISOString()
    };

    if (!data.reviews) data.reviews = [];
    data.reviews.push(record);

    // Update product rating and reviews count dynamically
    const product = data.products.find(p => p.slug === reviewData.productSlug);
    if (product) {
      const allProductReviews = data.reviews.filter(r => r.productSlug === reviewData.productSlug);
      const totalRating = allProductReviews.reduce((sum, r) => sum + r.rating, 0);
      product.rating = Number((totalRating / allProductReviews.length).toFixed(1));
      product.reviewsCount = allProductReviews.length;
    }

    writeDb(data);
    return { success: true, data: record };
  }
};

module.exports = db;
