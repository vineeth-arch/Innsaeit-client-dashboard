// api/storage/delete.js
// Permanently removes a file record and its R2 object. Admin-only.
// R2 is deleted before the DB row so a partial failure never leaves a live row
// pointing at a missing object.
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

    const { fileId } = req.body || {};
    if (!fileId) { res.statusCode = 400; return res.end(JSON.stringify({ error: 'fileId required' })); }

    const supa = serviceClient();
    const { data: file, error: fetchErr } = await supa
      .from('files').select('id, storage_key').eq('id', fileId).single();
    if (fetchErr || !file) { res.statusCode = 404; return res.end(JSON.stringify({ error: 'File not found' })); }

    if (file.storage_key && r2Configured()) {
      await deleteObject(file.storage_key);
    }

    const { error: delErr } = await supa.from('files').delete().eq('id', fileId);
    if (delErr) throw delErr;

    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true }));
  } catch (e) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: e.message }));
  }
}
