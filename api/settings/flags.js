// api/settings/flags.js
// Admin-only app settings flags, stored in the generic app_settings table.
// GET  — returns { testMode, digestsPaused, recipient }
// POST — body { key, value:boolean }; key in ALLOWED; upserts one flag.
import { serviceClient, getCaller } from '../_lib/supa.js';

const ALLOWED = new Set(['test_mode', 'digests_paused']);

const truthy = (v) => v === true || v === 'true';

async function readFlags(supa) {
  const { data } = await supa
    .from('app_settings').select('key, value').in('key', [...ALLOWED]);
  const byKey = Object.fromEntries((data || []).map((r) => [r.key, r.value]));
  return {
    testMode: truthy(byKey.test_mode),
    digestsPaused: truthy(byKey.digests_paused),
    recipient: process.env.TEST_MODE_RECIPIENT || null,
  };
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  try {
    const caller = await getCaller(req);
    if (!caller || caller.role !== 'admin') {
      res.statusCode = 403;
      return res.end(JSON.stringify({ error: 'Admin only' }));
    }

    const supa = serviceClient();

    if (req.method === 'GET') {
      return res.end(JSON.stringify(await readFlags(supa)));
    }

    if (req.method === 'POST') {
      const { key, value } = req.body || {};
      if (!ALLOWED.has(key) || typeof value !== 'boolean') {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: 'key (allowed) and value (boolean) required' }));
      }
      await supa.from('app_settings')
        .upsert({ key, value }, { onConflict: 'key' });
      return res.end(JSON.stringify(await readFlags(supa)));
    }

    res.statusCode = 405;
    res.end();
  } catch (e) {
    console.error('[settings/flags]', e);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: e.message }));
  }
}
