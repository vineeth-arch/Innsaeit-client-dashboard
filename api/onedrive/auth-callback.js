// api/onedrive/auth-callback.js
import { exchangeCode } from '../_lib/graph.js';
import { serviceClient } from '../_lib/supa.js';

export default async function handler(req, res) {
  try {
    const code = req.query.code;
    if (!code) throw new Error('Missing code');
    const redirectUri = `https://${req.headers.host}/api/onedrive/auth-callback`;
    const tokens = await exchangeCode(code, redirectUri);

    const supa = serviceClient();
    await supa.from('integration_tokens').upsert({
      id: 'onedrive',
      refresh_token: tokens.refresh_token,
      updated_at: new Date().toISOString(),
    });
    res.writeHead(302, { Location: '/settings?onedrive=connected' });
    res.end();
  } catch (e) {
    res.statusCode = 500;
    res.end('OneDrive connection failed: ' + e.message);
  }
}
