/* Same-origin API client. A network error is never a successful transaction. */
const SquishiesAPI = (() => {
  let sessionPromise;
  async function request(path, { method = 'GET', body, key } = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(`/api${path}`, {
        method, credentials: 'same-origin', signal: controller.signal,
        headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(key ? { 'Idempotency-Key': key } : {}) },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {})
      });
      let result;
      try { result = await response.json(); } catch { throw Object.assign(new Error('The server returned an unreadable response. Please retry.'), { status: response.status, code: 'UNREADABLE_RESPONSE' }); }
      if (!response.ok || !result.success) {
        if (response.status === 401) sessionPromise = null;
        throw Object.assign(new Error(result.error || 'Request failed.'), { status: response.status, code: result.code, fields: result.fields });
      }
      return result.data;
    } catch (error) {
      if (error.status) throw error;
      throw Object.assign(new Error('Unable to reach the store. Your request is unconfirmed. Please retry.'), { status: 0, code: 'NETWORK_ERROR' });
    } finally { clearTimeout(timeout); }
  }
  function session() {
    if (!sessionPromise) sessionPromise = request('/session', { method: 'POST', body: {} }).catch(error => { sessionPromise = null; throw error; });
    return sessionPromise;
  }
  async function protectedRequest(path, options) { await session(); return request(path, options); }
  return {
    session,
    fetchProducts: () => request('/products'),
    fetchProductBySlug: slug => request(`/products/${encodeURIComponent(slug)}`),
    quote: body => protectedRequest('/checkout/quote', { method: 'POST', body }),
    placeOrder: (body, key) => protectedRequest('/orders', { method: 'POST', body, key }),
    getOrder: number => protectedRequest(`/orders/${encodeURIComponent(number)}`),
    cancelOrder: (number, reason) => protectedRequest(`/orders/${encodeURIComponent(number)}/cancel`, { method: 'POST', body: { reason } }),
    createPaymentSession: (orderNumber, key) => protectedRequest('/payments/sessions', { method: 'POST', body: { orderNumber }, key }),
    simulatePayment: (id, outcome) => protectedRequest(`/payments/sessions/${encodeURIComponent(id)}/simulate`, { method: 'POST', body: { outcome } }),
    fetchTrackingLogs: number => protectedRequest(`/tracking/${encodeURIComponent(number)}`),
    fetchProductReviews: slug => request(`/reviews/${encodeURIComponent(slug)}`),
    submitReview: body => protectedRequest('/reviews', { method: 'POST', body })
  };
})();
