const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/products — Retrieve all products
router.get('/', (req, res) => {
  try {
    const products = db.getProducts();
    res.json({ success: true, count: products.length, data: products });
  } catch (err) {
    console.error('Error fetching products:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch products' });
  }
});

// GET /api/products/:slug — Retrieve single product by slug
router.get('/:slug', (req, res) => {
  try {
    const product = db.getProductBySlug(req.params.slug);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    res.json({ success: true, data: product });
  } catch (err) {
    console.error('Error fetching product:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch product' });
  }
});

module.exports = router;
