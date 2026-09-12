const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/tracking/:trackingNumber — Retrieve live courier tracking logs
router.get('/:trackingNumber', (req, res) => {
  const { trackingNumber } = req.params;

  try {
    const logs = db.getTrackingLogs(trackingNumber);
    res.json({
      success: true,
      data: {
        trackingNumber,
        courier: 'SPX Express (Shopee Express)',
        checkpointCount: logs.length,
        checkpoints: logs
      }
    });
  } catch (err) {
    console.error('Error fetching tracking logs:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch tracking details.' });
  }
});

module.exports = router;
