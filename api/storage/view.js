// api/storage/view.js
// Given an R2 object key, return a presigned GET URL (1 hour) that serves as
// both the inline preview src (PDF/JPG/PNG/TXT in an iframe/img) and the
// download link (the path AI/CDR take). Any logged-in user may view; RLS
// already gates which file rows they can see, and they can only learn keys
// from those rows.
import { presignGetUrl } from '../_lib/r2.js';
import { getCaller } from '../_lib/supa.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.statusCode = 405; return res.end(); }
  try {
    const caller = await getCaller(req);
    if (!caller) { res.statusCode = 401; return res.end(JSON.stringify({ error: 'Login required' })); }

    const { key } = req.body || {};
    if (!key) { res.statusCode = 400; return res.end(JSON.stringify({ error: 'key required' })); }

    const url = await presignGetUrl(key, 3600);
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ downloadUrl: url, embedUrl: url }));
  } catch (e) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: e.message }));
  }
}
