const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/reviews/:productSlug — Retrieve verified buyer reviews for a product
router.get('/:productSlug', (req, res) => {
  const { productSlug } = req.params;

  try {
    const reviews = db.getProductReviews(productSlug);
    const product = db.getProductBySlug(productSlug);

    res.json({
      success: true,
      data: {
        productSlug,
        averageRating: product ? product.rating : 5.0,
        reviewsCount: reviews.length,
        reviews
      }
    });
  } catch (err) {
    console.error('Error fetching product reviews:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch product reviews.' });
  }
});

// POST /api/reviews — Submit verified buyer review
router.post('/', (req, res) => {
  const { orderNumber, productSlug, rating, comment, reviewerName } = req.body;

  if (!orderNumber || !productSlug || !comment) {
    return res.status(400).json({ success: false, error: 'Order reference, product, and review comment are required.' });
  }

  const ratingVal = parseInt(rating, 10);
  if (isNaN(ratingVal) || ratingVal < 1 || ratingVal > 5) {
    return res.status(400).json({ success: false, error: 'Rating must be a number between 1 and 5 stars.' });
  }

  try {
    const result = db.addReview({ orderNumber, productSlug, rating: ratingVal, comment, reviewerName });
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    res.status(201).json({
      success: true,
      message: 'Thank you! Your verified product review has been submitted.',
      data: result.data
    });
  } catch (err) {
    console.error('Error submitting review:', err);
    res.status(500).json({ success: false, error: 'Failed to submit product review.' });
  }
});

module.exports = router;
