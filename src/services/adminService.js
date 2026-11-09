const ADMIN_API = '/api/admin';

export async function adminApi(path, { method = 'GET', body } = {}) {
  let response;

  try {
    response = await fetch(`${ADMIN_API}${path}`, {
      method,
      credentials: 'same-origin',
      headers: method === 'GET'
        ? {}
        : { 'Content-Type': 'application/json' },
      body: method === 'GET'
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
    throw Object.assign(
      new Error(json.error || 'Request failed.'),
      {
        status: response.status,
        fields: json.fields,
      }
    );
  }

  return json.data;
}

export function errorText(error) {
  return error.message +
    (error.fields
      ? ' ' + Object.entries(error.fields)
          .map(([key, value]) => `${key}: ${value}`)
          .join(' ')
      : '');
}
