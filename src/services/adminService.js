const ADMIN_API = '/api/admin';
const ADMIN_CACHE_TTL_MS = 15 * 1000;
const adminCache = new Map();
const adminInflight = new Map();

export function invalidateAdminCache() {
  adminCache.clear();
}

export async function adminApi(path, { method = 'GET', body, forceRefresh = false } = {}) {
  const isGet = method === 'GET';

  if (isGet && !forceRefresh) {
    const cached = adminCache.get(path);
    if (cached && Date.now() - cached.timestamp <= ADMIN_CACHE_TTL_MS) {
      return cached.data;
    }
    if (adminInflight.has(path)) {
      return adminInflight.get(path);
    }
  }

  const runFetch = async () => {
    let response;

    try {
      response = await fetch(`${ADMIN_API}${path}`, {
        method,
        credentials: 'same-origin',
        headers: isGet
          ? {}
          : { 'Content-Type': 'application/json' },
        body: isGet
          ? undefined
          : JSON.stringify(body ?? {}),
      });
    } catch {
      throw Object.assign(
        new Error('Cannot reach the server. Check your connection and try again.'),
        { status: 0 }
      );
    }

    let json;

    try {
      json = await response.json();
    } catch {
      throw Object.assign(
        new Error('The server sent an unreadable response.'),
        { status: response.status }
      );
    }

    if (!response.ok || !json.success) {
      if (response.status === 401) {
        adminCache.clear();
      }
      throw Object.assign(
        new Error(json.error || 'Request failed.'),
        {
          status: response.status,
          code: json.code,
          fields: json.fields,
        }
      );
    }

    if (isGet) {
      adminCache.set(path, {
        data: json.data,
        timestamp: Date.now(),
      });
    } else {
      adminCache.clear();
    }

    return json.data;
  };

  const executeWithRetry = async () => {
    const maxRetries = isGet ? 3 : 0;
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await runFetch();
      } catch (err) {
        lastError = err;
        if (
          isGet &&
          attempt < maxRetries &&
          (err.status === 0 ||
            err.status === 502 ||
            err.status === 503 ||
            err.status === 504 ||
            err.code === 'BACKEND_STARTING')
        ) {
          await new Promise((r) => setTimeout(r, 650 * (attempt + 1)));
          continue;
        }
        throw err;
      }
    }
    throw lastError;
  };

  if (isGet) {
    const promise = executeWithRetry().finally(() => {
      adminInflight.delete(path);
    });
    adminInflight.set(path, promise);
    return promise;
  }

  return executeWithRetry();
}

export function errorText(error) {
  if (!error) return 'An unexpected error occurred.';
  const base = error.message || String(error);
  if (error.fields && typeof error.fields === 'object' && !Array.isArray(error.fields)) {
    const details = Object.entries(error.fields)
      .map(([key, value]) => `${key}: ${value}`)
      .join(' ');
    return details ? `${base} ${details}` : base;
  }
  return base;
}
