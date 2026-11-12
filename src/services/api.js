let sessionPromise;

const CACHE_STORAGE_KEY = 'squishies_api_cache_v2';
const FRESH_TTL_MS = 45 * 1000;
const STALE_TTL_MS = 5 * 60 * 1000;

const memoryCache = new Map();
const inflightRequests = new Map();

function hydrateStorageCache() {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    const raw = window.sessionStorage.getItem(CACHE_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    const now = Date.now();
    if (parsed && typeof parsed === 'object') {
      for (const [key, entry] of Object.entries(parsed)) {
        if (entry && now - entry.timestamp < STALE_TTL_MS) {
          memoryCache.set(key, entry);
        }
      }
    }
  } catch {
    // Ignore storage read errors on restricted browsers
  }
}

hydrateStorageCache();

function persistStorageCache() {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    const serializable = {};
    const now = Date.now();
    for (const [key, entry] of memoryCache.entries()) {
      if (now - entry.timestamp < STALE_TTL_MS) {
        serializable[key] = entry;
      }
    }
    window.sessionStorage.setItem(
      CACHE_STORAGE_KEY,
      JSON.stringify(serializable)
    );
  } catch {
    // Ignore quota errors
  }
}

function getCacheEntry(cacheKey) {
  const entry = memoryCache.get(cacheKey);
  if (!entry) return null;
  const age = Date.now() - entry.timestamp;
  if (age > STALE_TTL_MS) {
    memoryCache.delete(cacheKey);
    return null;
  }
  return {
    data: entry.data,
    isFresh: age <= FRESH_TTL_MS,
  };
}

function setCacheEntry(cacheKey, data) {
  memoryCache.set(cacheKey, {
    data,
    timestamp: Date.now(),
  });
  // Seed individual product cache entries whenever full catalog is fetched
  if (cacheKey === '/products') {
    const items = Array.isArray(data)
      ? data
      : Array.isArray(data?.products)
        ? data.products
        : [];
    for (const item of items) {
      if (item?.slug) {
        memoryCache.set(`/products/${encodeURIComponent(item.slug)}`, {
          data: item,
          timestamp: Date.now(),
        });
      }
    }
  }
  persistStorageCache();
}

export function invalidateApiCache(prefix = '') {
  if (!prefix) {
    memoryCache.clear();
  } else {
    for (const key of memoryCache.keys()) {
      if (key.startsWith(prefix)) {
        memoryCache.delete(key);
      }
    }
  }
  persistStorageCache();
}

async function request(path, { method = 'GET', body, key } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      signal: controller.signal,
      headers: {
        ...(body !== undefined
          ? { 'Content-Type': 'application/json' }
          : {}),
        ...(key ? { 'Idempotency-Key': key } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    let result;

    try {
      result = await response.json();
    } catch {
      throw Object.assign(
        new Error('The server returned an unreadable response. Please retry.'),
        { status: response.status, code: 'UNREADABLE_RESPONSE' }
      );
    }

    if (!response.ok || !result.success) {
      if (response.status === 401) sessionPromise = null;

      throw Object.assign(
        new Error(result.error || 'Request failed.'),
        {
          status: response.status,
          code: result.code,
          fields: result.fields,
        }
      );
    }

    return result.data;
  } catch (error) {
    if (error.status !== undefined) throw error;

    throw Object.assign(
      new Error(
        'Unable to reach the store. Your request is unconfirmed. Please retry.'
      ),
      { status: 0, code: 'NETWORK_ERROR' }
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function cachedGet(path, { forceRefresh = false } = {}) {
  if (!forceRefresh) {
    const cached = getCacheEntry(path);
    if (cached) {
      if (!cached.isFresh && !inflightRequests.has(path)) {
        // Stale-while-revalidate background refresh
        const bgPromise = request(path)
          .then((freshData) => {
            setCacheEntry(path, freshData);
            return freshData;
          })
          .catch(() => {})
          .finally(() => {
            inflightRequests.delete(path);
          });
        inflightRequests.set(path, bgPromise);
      }
      return cached.data;
    }
  }

  if (inflightRequests.has(path)) {
    return inflightRequests.get(path);
  }

  const fetchPromise = request(path)
    .then((data) => {
      setCacheEntry(path, data);
      return data;
    })
    .finally(() => {
      inflightRequests.delete(path);
    });

  inflightRequests.set(path, fetchPromise);
  return fetchPromise;
}

async function session() {
  if (!sessionPromise) {
    sessionPromise = request('/session', {
      method: 'POST',
      body: {},
    }).catch((error) => {
      sessionPromise = null;
      throw error;
    });
  }

  return sessionPromise;
}

async function protectedRequest(path, options) {
  await session();
  return request(path, options);
}

function buildQuery(params) {
  if (!params || typeof params !== 'object') return '';
  const searchParams = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') {
      searchParams.set(k, String(v));
    }
  }
  const qs = searchParams.toString();
  return qs ? `?${qs}` : '';
}

export const SquishiesAPI = {
  session,
  invalidateCache: invalidateApiCache,

  getCachedProducts: () => {
    const entry = getCacheEntry('/products');
    if (!entry) return null;
    return Array.isArray(entry.data)
      ? entry.data
      : Array.isArray(entry.data?.products)
        ? entry.data.products
        : null;
  },

  getCachedProduct: (slug) => {
    if (!slug) return null;
    const direct = getCacheEntry(`/products/${encodeURIComponent(slug)}`);
    if (direct?.data) return direct.data;
    const catalog = SquishiesAPI.getCachedProducts();
    return catalog?.find((item) => item.slug === slug) || null;
  },

  prefetchProduct: (slug) => {
    if (!slug) return;
    const path = `/products/${encodeURIComponent(slug)}`;
    if (!getCacheEntry(path) && !inflightRequests.has(path)) {
      cachedGet(path).catch(() => {});
    }
  },

  fetchProducts: (params, options) =>
    cachedGet(`/products${buildQuery(params)}`, options),

  fetchProductBySlug: (slug, options) =>
    cachedGet(`/products/${encodeURIComponent(slug)}`, options),

  quote: (body) =>
    protectedRequest('/checkout/quote', {
      method: 'POST',
      body,
    }),

  placeOrder: async (body, key) => {
    const data = await protectedRequest('/orders', {
      method: 'POST',
      body,
      key,
    });
    invalidateApiCache('/products');
    return data;
  },

  getOrder: (number) =>
    protectedRequest(`/orders/${encodeURIComponent(number)}`),

  cancelOrder: async (number, reason) => {
    const data = await protectedRequest(
      `/orders/${encodeURIComponent(number)}/cancel`,
      {
        method: 'POST',
        body: { reason },
      }
    );
    invalidateApiCache('/products');
    return data;
  },

  createPaymentSession: (orderNumber, key) =>
    protectedRequest('/payments/sessions', {
      method: 'POST',
      body: { orderNumber },
      key,
    }),

  simulatePayment: async (id, payloadOrOutcome) => {
    const body =
      typeof payloadOrOutcome === 'string'
        ? { outcome: payloadOrOutcome }
        : { ...(payloadOrOutcome || {}) };
    const data = await protectedRequest(
      `/payments/sessions/${encodeURIComponent(id)}/simulate`,
      {
        method: 'POST',
        body,
      }
    );
    invalidateApiCache('/products');
    invalidateApiCache('/account/orders');
    return data;
  },

  advanceDemoDelivery: async (orderNumber, stage) => {
    const data = await protectedRequest(
      `/orders/${encodeURIComponent(orderNumber)}/demo-advance`,
      {
        method: 'POST',
        body: { stage },
      }
    );
    invalidateApiCache('/account/orders');
    return data;
  },

  fetchTrackingLogs: (number) =>
    protectedRequest(`/tracking/${encodeURIComponent(number)}`),

  fetchProductReviews: (slug, params, options) =>
    cachedGet(
      `/reviews/${encodeURIComponent(slug)}${buildQuery(params)}`,
      options
    ),

  submitReview: async (body) => {
    const data = await protectedRequest('/reviews', {
      method: 'POST',
      body,
    });
    invalidateApiCache('/reviews');
    invalidateApiCache('/products');
    return data;
  },

  /* ── Account & Authentication ───────────────────────────────── */

  getAuthMe: () => request('/auth/me'),

  registerAccount: async (body) => {
    await session();
    const data = await request('/auth/register', { method: 'POST', body });
    invalidateApiCache('/account/orders');
    return data;
  },

  loginAccount: async (body) => {
    await session();
    const data = await request('/auth/login', { method: 'POST', body });
    invalidateApiCache('/account/orders');
    return data;
  },

  logoutAccount: async () => {
    const data = await request('/auth/logout', { method: 'POST', body: {} });
    invalidateApiCache('/account/orders');
    return data;
  },

  resetPassword: async (body) => {
    await session();
    return request('/auth/reset-password', { method: 'POST', body });
  },

  updateAccountProfile: (body) =>
    request('/account/profile', { method: 'PATCH', body }),

  changeAccountPassword: (body) =>
    request('/account/password', { method: 'POST', body }),

  fetchAccountOrders: (options) =>
    cachedGet('/account/orders', { force: true, ...(options || {}) }),

  deleteAccount: async (body) => {
    const data = await request('/account', { method: 'DELETE', body });
    invalidateApiCache('/account/orders');
    return data;
  },
};
