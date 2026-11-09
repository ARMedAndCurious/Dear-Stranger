let token = '';
export async function request(path, options = {}) {
  const response = await fetch(`/api${path}`, { credentials: 'include', ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.method && options.method !== 'GET' ? { 'X-CSRF-Token': token } : {}), ...options.headers } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.details?.map(item => `${item.field || 'Form'}: ${item.message}`).join('; ') || data.error || 'Unable to reach the server.');
  if (data.csrfToken) token = data.csrfToken;
  return data;
}
