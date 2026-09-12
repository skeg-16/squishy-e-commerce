const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/vouchers/available — Retrieve public promotional vouchers
router.get('/available', (req, res) => {
  try {
    const vouchers = db.getAvailableVouchers();
    res.json({ success: true, count: vouchers.length, data: vouchers });
  } catch (err) {
    console.error('Error fetching vouchers:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch vouchers.' });
  }
});

// POST /api/vouchers/apply — Validate and apply promotional code
router.post('/apply', (req, res) => {
  const { code, subtotal, shippingFee } = req.body;

  if (!code || typeof code !== 'string') {
    return res.status(400).json({ success: false, error: 'Please enter a voucher code.' });
  }

  const sub = parseFloat(subtotal) || 0;
  const ship = parseFloat(shippingFee) || 0;

  const result = db.validateVoucher(code, sub, ship);

  if (!result.valid) {
    return res.status(400).json({ success: false, error: result.error });
  }

  res.json({
    success: true,
    message: 'Voucher applied successfully!',
    data: {
      code: result.code,
      type: result.type,
      discountAmount: result.discountAmount,
      description: result.description
    }
  });
});

module.exports = router;
