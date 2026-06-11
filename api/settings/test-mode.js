// api/settings/test-mode.js
// GET  — returns { testMode: bool, recipient: string|null }
// POST — admin-only; body { testMode: bool }; upserts app_settings row.
import { serviceClient, getCaller } from '../_lib/supa.js';

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
      const { data } = await supa
        .from('app_settings').select('value').eq('key', 'test_mode').maybeSingle();
      const testMode = data?.value === true || data?.value === 'true';
      return res.end(JSON.stringify({
        testMode,
        recipient: process.env.TEST_MODE_RECIPIENT || null,
      }));
    }

    if (req.method === 'POST') {
      const { testMode } = req.body || {};
      if (typeof testMode !== 'boolean') {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: 'testMode (boolean) required' }));
      }
      await supa.from('app_settings')
        .upsert({ key: 'test_mode', value: testMode }, { onConflict: 'key' });
      return res.end(JSON.stringify({
        testMode,
        recipient: process.env.TEST_MODE_RECIPIENT || null,
      }));
    }

    res.statusCode = 405;
    res.end();
  } catch (e) {
    console.error('[settings/test-mode]', e);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: e.message }));
  }
}
