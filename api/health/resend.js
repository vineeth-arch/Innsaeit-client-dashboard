// api/health/resend.js
// Admin-only health probe for Resend. Lists domains with the server key to
// confirm the key is valid, and reports whether at least one sending domain is
// verified. Returns booleans only — the API key is never echoed.
import { getCaller } from '../_lib/supa.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') { res.statusCode = 405; return res.end(); }
  res.setHeader('Content-Type', 'application/json');

  const caller = await getCaller(req).catch(() => null);
  if (!caller || caller.role !== 'admin') {
    res.statusCode = 403;
    return res.end(JSON.stringify({ error: 'Admin only' }));
  }

  if (!process.env.RESEND_API_KEY) return res.end(JSON.stringify({ ok: false, configured: false }));

  try {
    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data, error } = await resend.domains.list();
    if (error) return res.end(JSON.stringify({ ok: false, configured: true }));
    // SDK shape: { data: { data: Domain[] } } — normalise to a flat array.
    const domains = Array.isArray(data) ? data : (data?.data || []);
    const domainVerified = domains.some((d) => d.status === 'verified');
    res.end(JSON.stringify({ ok: true, configured: true, domainVerified }));
  } catch {
    res.end(JSON.stringify({ ok: false, configured: true }));
  }
}
