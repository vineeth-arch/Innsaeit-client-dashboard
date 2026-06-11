// api/onedrive/auth-start.js
// Admin clicks "Connect OneDrive" -> redirect to Microsoft consent.
import { AUTH_URL, SCOPES } from '../_lib/graph.js';

export default async function handler(req, res) {
  const redirectUri = `https://${req.headers.host}/api/onedrive/auth-callback`;
  const url = new URL(AUTH_URL);
  url.searchParams.set('client_id', process.env.MS_CLIENT_ID);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', SCOPES);
  url.searchParams.set('response_mode', 'query');
  res.writeHead(302, { Location: url.toString() });
  res.end();
}
