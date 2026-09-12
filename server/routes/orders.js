const express = require('express');
const router = express.Router();
const db = require('../db');

const FREE_SHIPPING_THRESHOLD = 500;
const REGIONAL_SHIPPING_RATES = {
  'metro-manila': 60,
  'luzon': 80,
  'visayas': 110,
  'mindanao': 110
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PH_PHONE_REGEX = /^09\d{9}$/;
const POSTAL_CODE_REGEX = /^\d{4}$/;

// POST /api/orders — Create new order with strict validation
router.post('/', (req, res) => {
  const {
    customerName,
    customerEmail,
    customerPhone,
    shippingAddress,
    region,
    city,
    barangay,
    postalCode,
    paymentMethod,
    voucherCode,
    items
  } = req.body;

  // Input Validation
  if (!customerName || customerName.trim().length < 3) {
    return res.status(400).json({ success: false, error: 'Please enter a valid full name.' });
  }

  if (!customerEmail || !EMAIL_REGEX.test(customerEmail.trim())) {
    return res.status(400).json({ success: false, error: 'Please enter a valid email address (e.g. name@example.com).' });
  }

  const cleanPhone = (customerPhone || '').replace(/\s+|-/g, '');
  if (!PH_PHONE_REGEX.test(cleanPhone)) {
    return res.status(400).json({ success: false, error: 'Please enter a valid 11-digit Philippine mobile number starting with 09 (e.g. 09171234567).' });
  }

  if (!shippingAddress || shippingAddress.trim().length < 5) {
    return res.status(400).json({ success: false, error: 'Please enter a complete street address.' });
  }

  if (!city || city.trim().length < 2) {
    return res.status(400).json({ success: false, error: 'Please enter a valid city or municipality.' });
  }

  if (!barangay || barangay.trim().length < 2) {
    return res.status(400).json({ success: false, error: 'Please enter a valid barangay.' });
  }

  const cleanPostal = (postalCode || '').trim();
  if (!POSTAL_CODE_REGEX.test(cleanPostal)) {
    return res.status(400).json({ success: false, error: 'Please enter a valid 4-digit postal code (e.g. 1000).' });
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, error: 'Your cart is empty.' });
  }

  try {
    let subtotal = 0;
    const validatedItems = [];
    const products = db.getProducts();

    for (const item of items) {
      const qty = parseInt(item.qty || item.quantity, 10);
      if (isNaN(qty) || qty <= 0) continue;

      let product = products.find(p => p.slug === item.slug || p.name === item.name);
      const itemPrice = product ? product.price : (parseFloat(item.price) || 89);
      const itemSubtotal = itemPrice * qty;
      subtotal += itemSubtotal;

      validatedItems.push({
        productSlug: product ? product.slug : 'custom',
        productName: product ? product.name : (item.name || 'Squishy Product'),
        price: itemPrice,
        quantity: qty,
        subtotal: itemSubtotal
      });
    }

    if (validatedItems.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid items found in order.' });
    }

    const selectedRegion = (region || 'metro-manila').toLowerCase();
    const baseShippingFee = REGIONAL_SHIPPING_RATES[selectedRegion] || 60;
    let shippingFee = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : baseShippingFee;

    // Evaluate Voucher Code
    let voucherDiscount = 0;
    let appliedVoucherCode = null;

    if (voucherCode && voucherCode.trim()) {
      const vResult = db.validateVoucher(voucherCode.trim(), subtotal, shippingFee);
      if (vResult.valid) {
        voucherDiscount = vResult.discountAmount;
        appliedVoucherCode = vResult.code;
        if (vResult.type === 'free_shipping') {
          shippingFee = 0;
        }
      }
    }

    const total = Math.max(0, subtotal + shippingFee - voucherDiscount);

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = `SQ-${dateStr}-${randomSuffix}`;

    const initialStatus = paymentMethod === 'cod' ? 'To Ship' : 'To Pay';

    const orderData = {
      orderNumber,
      customerName: customerName.trim(),
      customerEmail: customerEmail.trim(),
      customerPhone: cleanPhone,
      shippingAddress: shippingAddress.trim(),
      region: selectedRegion,
      city: city.trim(),
      barangay: barangay.trim(),
      postalCode: cleanPostal,
      paymentMethod: paymentMethod || 'cod',
      voucherCode: appliedVoucherCode,
      voucherDiscount,
      subtotal,
      shippingFee,
      total,
      status: initialStatus
    };

    const result = db.createOrder(orderData, validatedItems);

    res.status(201).json({
      success: true,
      message: 'Order placed successfully!',
      data: {
        orderId: result.order.id,
        orderNumber: result.order.orderNumber,
        trackingNumber: result.order.trackingNumber,
        customerName: result.order.customerName,
        customerEmail: result.order.customerEmail,
        customerPhone: result.order.customerPhone,
        shippingAddress: `${result.order.shippingAddress}, Brgy. ${result.order.barangay}, ${result.order.city}, ${result.order.region.toUpperCase()} ${result.order.postalCode}`,
        subtotal: result.order.subtotal,
        shippingFee: result.order.shippingFee,
        voucherCode: result.order.voucherCode,
        voucherDiscount: result.order.voucherDiscount,
        total: result.order.total,
        status: result.order.status,
        paymentMethod: result.order.paymentMethod,
        itemsCount: result.items.length
      }
    });

  } catch (err) {
    console.error('Error placing order:', err);
    res.status(500).json({ success: false, error: 'Internal server error while processing order.' });
  }
});

// POST /api/orders/:orderNumber/cancel — Customer Order Cancellation Endpoint
router.post('/:orderNumber/cancel', (req, res) => {
  const { orderNumber } = req.params;
  const { reason } = req.body;

  try {
    const result = db.cancelOrder(orderNumber, reason);
    if (!result) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    if (result.alreadyCancelled) {
      return res.status(400).json({ success: false, error: 'Order is already cancelled' });
    }

    res.json({
      success: true,
      message: 'Order cancelled successfully and product inventory restored.',
      data: {
        orderNumber: result.order.orderNumber,
        status: result.order.status,
        cancellationReason: result.order.cancellationReason,
        cancelledAt: result.order.cancelledAt
      }
    });
  } catch (err) {
    console.error('Error cancelling order:', err);
    res.status(500).json({ success: false, error: 'Failed to cancel order.' });
  }
});

// GET /api/orders/:orderNumber — Retrieve order details
router.get('/:orderNumber', (req, res) => {
  try {
    const result = db.getOrder(req.params.orderNumber);
    if (!result) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    const { order, items } = result;

    res.json({
      success: true,
      data: {
        orderNumber: order.orderNumber,
        trackingNumber: order.trackingNumber,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        customerPhone: order.customerPhone,
        shippingAddress: `${order.shippingAddress}, Brgy. ${order.barangay || ''}, ${order.city || ''}, ${order.postalCode || ''}`,
        paymentMethod: order.paymentMethod,
        voucherCode: order.voucherCode || null,
        voucherDiscount: order.voucherDiscount || 0,
        subtotal: order.subtotal,
        shippingFee: order.shippingFee,
        total: order.total,
        status: order.status,
        cancellationReason: order.cancellationReason || null,
        createdAt: order.createdAt,
        items: items.map(i => ({
          productSlug: i.productSlug,
          productName: i.productName,
          price: i.price,
          quantity: i.quantity,
          subtotal: i.subtotal
        }))
      }
    });
  } catch (err) {
    console.error('Error fetching order:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch order' });
  }
});

module.exports = router;
