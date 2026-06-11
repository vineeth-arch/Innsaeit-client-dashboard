// api/health/supabase.js
// Admin-only health probe for Supabase. A cheap authenticated count round-trip
// confirms the service-role connection is live. Returns booleans only — the
// service role key is never echoed.
import { getCaller, serviceClient } from '../_lib/supa.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') { res.statusCode = 405; return res.end(); }
  res.setHeader('Content-Type', 'application/json');

  const caller = await getCaller(req).catch(() => null);
  if (!caller || caller.role !== 'admin') {
    res.statusCode = 403;
    return res.end(JSON.stringify({ error: 'Admin only' }));
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.end(JSON.stringify({ ok: false, configured: false }));
  }

  try {
    const supa = serviceClient();
    const { error } = await supa.from('clients').select('id', { head: true, count: 'exact' });
    res.end(JSON.stringify({ ok: !error, configured: true }));
  } catch {
    res.end(JSON.stringify({ ok: false, configured: true }));
  }
}
