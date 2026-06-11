// api/_lib/graph.js
// Microsoft Graph access for a consumer (Microsoft 365 Family) OneDrive.
// Delegated auth: the admin connects once; we keep the refresh token in
// integration_tokens (service-role only) and mint access tokens on demand.
import { serviceClient } from './supa.js';

const TOKEN_URL = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token';
export const AUTH_URL = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize';
export const SCOPES = 'Files.ReadWrite offline_access User.Read';

export async function getAccessToken() {
  const supa = serviceClient();
  const { data: row, error } = await supa
    .from('integration_tokens').select('*').eq('id', 'onedrive').single();
  if (error || !row) throw new Error('ONEDRIVE_NOT_CONNECTED');

  const body = new URLSearchParams({
    client_id: process.env.MS_CLIENT_ID,
    client_secret: process.env.MS_CLIENT_SECRET,
    grant_type: 'refresh_token',
    refresh_token: row.refresh_token,
    scope: SCOPES,
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const json = await res.json();
  if (!res.ok) throw new Error('ONEDRIVE_REFRESH_FAILED: ' + JSON.stringify(json));

  // Microsoft rotates refresh tokens; persist the new one.
  if (json.refresh_token) {
    await supa.from('integration_tokens')
      .update({ refresh_token: json.refresh_token, updated_at: new Date().toISOString() })
      .eq('id', 'onedrive');
  }
  return json.access_token;
}

export async function exchangeCode(code, redirectUri) {
  const body = new URLSearchParams({
    client_id: process.env.MS_CLIENT_ID,
    client_secret: process.env.MS_CLIENT_SECRET,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    scope: SCOPES,
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const json = await res.json();
  if (!res.ok) throw new Error('ONEDRIVE_EXCHANGE_FAILED: ' + JSON.stringify(json));
  return json;
}

export async function graph(path, opts = {}) {
  const token = await getAccessToken();
  const res = await fetch('https://graph.microsoft.com/v1.0' + path, {
    ...opts,
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  const json = res.status === 204 ? {} : await res.json();
  if (!res.ok) throw new Error('GRAPH_ERROR ' + res.status + ': ' + JSON.stringify(json));
  return json;
}
