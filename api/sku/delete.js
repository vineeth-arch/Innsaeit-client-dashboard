// Permanently removes a SKU: its R2 objects first, then the row — the DB
// cascades clean up stages, versions, files, comments and checklist items.
// R2 is deleted before the DB row (same ordering as api/storage/delete.js) so
// a partial failure never leaves live rows pointing at missing objects.
// Admin-only.
import { deleteObject, r2Configured } from '../_lib/r2.js';
import { getCaller, serviceClient } from '../_lib/supa.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.statusCode = 405; return res.end(); }
  try {
    const caller = await getCaller(req);
    if (!caller || caller.role !== 'admin') {
      res.statusCode = 403;
      return res.end(JSON.stringify({ error: 'Admin only' }));
    }

    const { skuId } = req.body || {};
    if (!skuId) { res.statusCode = 400; return res.end(JSON.stringify({ error: 'skuId required' })); }

    const supa = serviceClient();
    const { data: sku, error: fetchErr } = await supa
      .from('skus').select('id').eq('id', skuId).single();
    if (fetchErr || !sku) { res.statusCode = 404; return res.end(JSON.stringify({ error: 'SKU not found' })); }

    if (r2Configured()) {
      const { data: files } = await supa
        .from('files').select('storage_key')
        .eq('sku_id', skuId)
        .eq('storage_provider', 'r2')
        .not('storage_key', 'is', null);
      for (const f of files || []) await deleteObject(f.storage_key);
    }

    const { error: delErr } = await supa.from('skus').delete().eq('id', skuId);
    if (delErr) throw delErr;

    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true }));
  } catch (e) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: e.message }));
  }
}
