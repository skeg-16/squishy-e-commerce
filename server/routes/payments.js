const express = require('express');
const router = express.Router();
const db = require('../db');

// POST /api/payments/create-checkout-session — Create payment gateway checkout session
router.post('/create-checkout-session', (req, res) => {
  const { orderNumber, paymentMethod, amount } = req.body;

  if (!orderNumber) {
    return res.status(400).json({ success: false, error: 'Order number is required' });
  }

  const { order } = db.getOrder(orderNumber) || {};
  if (!order) {
    return res.status(404).json({ success: false, error: 'Order not found' });
  }

  const sessionId = `ps_${paymentMethod || 'pay'}_${Date.now().toString().slice(-8)}`;
  const sessionData = {
    sessionId,
    orderNumber,
    paymentMethod: paymentMethod || order.paymentMethod,
    amount: amount || order.total,
    currency: 'PHP',
    status: 'pending',
    createdAt: new Date().toISOString()
  };

  db.createPaymentSession(sessionData);

  res.json({
    success: true,
    data: sessionData
  });
});

// POST /api/payments/confirm — Process payment confirmation (GCash, Maya, Card)
router.post('/confirm', (req, res) => {
  const { orderNumber, paymentMethod, accountOrCard } = req.body;

  if (!orderNumber) {
    return res.status(400).json({ success: false, error: 'Order number is required' });
  }

  const methodPrefix = (paymentMethod || 'pay').toUpperCase();
  const randomRef = Math.floor(100000 + Math.random() * 900000);
  const paymentReference = `PAY-${methodPrefix}-${randomRef}`;

  const updatedOrder = db.confirmPayment(orderNumber, paymentReference, paymentMethod);

  if (!updatedOrder) {
    return res.status(404).json({ success: false, error: 'Order not found or update failed' });
  }

  res.json({
    success: true,
    message: 'Payment confirmed successfully!',
    data: {
      orderNumber: updatedOrder.orderNumber,
      paymentStatus: updatedOrder.paymentStatus,
      status: updatedOrder.status,
      paymentReference: updatedOrder.paymentReference,
      paidAt: updatedOrder.paidAt,
      amount: updatedOrder.total,
      paymentMethod: updatedOrder.paymentMethod
    }
  });
});

// POST /api/payments/webhook — PayMongo / Stripe simulation webhook
router.post('/webhook', (req, res) => {
  const { type, data } = req.body;
  console.log(`Received payment webhook event: ${type}`);

  if (type === 'payment.paid' && data && data.orderNumber) {
    const paymentRef = data.paymentReference || `PAY-WEBHOOK-${Date.now().toString().slice(-6)}`;
    db.confirmPayment(data.orderNumber, paymentRef, data.paymentMethod || 'card');
    return res.json({ received: true, status: 'processed' });
  }

  res.json({ received: true, status: 'ignored' });
});

module.exports = router;
