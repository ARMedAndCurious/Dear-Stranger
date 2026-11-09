let token = '';
export async function request(path, options = {}) {
  const response = await fetch(`/api${path}`, { credentials: 'include', ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.method && options.method !== 'GET' ? { 'X-CSRF-Token': token } : {}), ...options.headers } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.details?.map(item => `${item.field || 'Form'}: ${item.message}`).join('; ') || data.error || 'Unable to reach the server.');
  if (data.csrfToken) token = data.csrfToken;
  return data;
}
export async function requestAudio(path, body, signal) {
  const response = await fetch(`/api${path}`, { method: 'POST', credentials: 'include', signal, headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token }, body: JSON.stringify(body) });
  if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || 'Read Aloud is unavailable.'); }
  if (!response.headers.get('Content-Type')?.includes('audio/wav')) throw new Error('Unexpected audio format.');
  return response.blob();
}
