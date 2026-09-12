/* ==========================================================================
   SQUISHIES — api.js
   Centralized API service for communicating with the backend server.
   ========================================================================== */

const SquishiesAPI = (() => {
  const API_BASE_URL = 'http://localhost:5000/api';

  async function fetchProducts() {
    try {
      const res = await fetch(`${API_BASE_URL}/products`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const json = await res.json();
      return json.success ? json.data : null;
    } catch (err) {
      console.warn('Backend API unavailable, falling back to local dataset:', err.message);
      return null;
    }
  }

  async function fetchProductBySlug(slug) {
    try {
      const res = await fetch(`${API_BASE_URL}/products/${encodeURIComponent(slug)}`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const json = await res.json();
      return json.success ? json.data : null;
    } catch (err) {
      console.warn(`Backend API unavailable for ${slug}, falling back to local dataset:`, err.message);
      return null;
    }
  }

  async function placeOrder(orderPayload) {
    try {
      const res = await fetch(`${API_BASE_URL}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP error ${res.status}`);
      return json;
    } catch (err) {
      console.warn('Backend order submission error:', err.message);
      throw err;
    }
  }

  async function cancelOrder(orderNumber, reason) {
    try {
      const res = await fetch(`${API_BASE_URL}/orders/${encodeURIComponent(orderNumber)}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP error ${res.status}`);
      return json;
    } catch (err) {
      console.warn('Backend order cancellation error:', err.message);
      throw err;
    }
  }

  async function createCheckoutSession(orderNumber, paymentMethod, amount) {
    try {
      const res = await fetch(`${API_BASE_URL}/payments/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber, paymentMethod, amount })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP error ${res.status}`);
      return json;
    } catch (err) {
      console.warn('Failed to create payment session:', err.message);
      throw err;
    }
  }

  async function confirmPayment(orderNumber, paymentMethod, accountOrCard) {
    try {
      const res = await fetch(`${API_BASE_URL}/payments/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber, paymentMethod, accountOrCard })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP error ${res.status}`);
      return json;
    } catch (err) {
      console.warn('Payment confirmation failed:', err.message);
      throw err;
    }
  }

  // Voucher API
  async function applyVoucher(code, subtotal, shippingFee) {
    try {
      const res = await fetch(`${API_BASE_URL}/vouchers/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, subtotal, shippingFee })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP error ${res.status}`);
      return json;
    } catch (err) {
      console.warn('Voucher validation failed:', err.message);
      throw err;
    }
  }

  async function fetchAvailableVouchers() {
    try {
      const res = await fetch(`${API_BASE_URL}/vouchers/available`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const json = await res.json();
      return json.success ? json.data : [];
    } catch (err) {
      return [];
    }
  }

  // Logistics & Live Tracking API
  async function fetchTrackingLogs(trackingNumber) {
    try {
      const res = await fetch(`${API_BASE_URL}/tracking/${encodeURIComponent(trackingNumber)}`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const json = await res.json();
      return json.success ? json.data : null;
    } catch (err) {
      console.warn('Tracking fetch failed:', err.message);
      return null;
    }
  }

  // Verified Buyer Reviews API
  async function fetchProductReviews(productSlug) {
    try {
      const res = await fetch(`${API_BASE_URL}/reviews/${encodeURIComponent(productSlug)}`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const json = await res.json();
      return json.success ? json.data : null;
    } catch (err) {
      return null;
    }
  }

  async function submitReview(reviewPayload) {
    try {
      const res = await fetch(`${API_BASE_URL}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reviewPayload)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP error ${res.status}`);
      return json;
    } catch (err) {
      console.warn('Review submission failed:', err.message);
      throw err;
    }
  }

  return {
    fetchProducts,
    fetchProductBySlug,
    placeOrder,
    cancelOrder,
    createCheckoutSession,
    confirmPayment,
    applyVoucher,
    fetchAvailableVouchers,
    fetchTrackingLogs,
    fetchProductReviews,
    submitReview
  };
})();
