// api/health/r2.js
// Admin-only health probe for Cloudflare R2. Returns booleans only — never the
// access key, secret, account id, or bucket name. The browser uses this to light
// the status dot on the Settings → Integrations panel.
import { getCaller } from '../_lib/supa.js';
import { r2Configured, bucketReachable } from '../_lib/r2.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') { res.statusCode = 405; return res.end(); }
  res.setHeader('Content-Type', 'application/json');

  const caller = await getCaller(req).catch(() => null);
  if (!caller || caller.role !== 'admin') {
    res.statusCode = 403;
    return res.end(JSON.stringify({ error: 'Admin only' }));
  }

  if (!r2Configured()) return res.end(JSON.stringify({ ok: false, configured: false }));

  try {
    await bucketReachable();
    res.end(JSON.stringify({ ok: true, configured: true }));
  } catch {
    res.end(JSON.stringify({ ok: false, configured: true }));
  }
}
