// api/storage/upload-url.js
// Returns a presigned PUT URL (15 min). The browser PUTs the file bytes
// straight to R2, so Vercel's 4.5MB body limit never applies and large
// artwork files (100MB+ .ai) work fine — same shape as the old OneDrive
// upload-session flow. Admin-only: uploads are Vineeth's job by design.
import { presignPutUrl, sanitizeSegment } from '../_lib/r2.js';
import { getCaller } from '../_lib/supa.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.statusCode = 405; return res.end(); }
  try {
    const caller = await getCaller(req);
    if (!caller || caller.role !== 'admin') {
      res.statusCode = 403;
      return res.end(JSON.stringify({ error: 'Admin only' }));
    }
    const { clientSlug, projectName, skuName, fileName, contentType } = req.body || {};
    if (!fileName) { res.statusCode = 400; return res.end(JSON.stringify({ error: 'fileName required' })); }

    const key = [
      'innsaeit',
      sanitizeSegment(clientSlug),
      sanitizeSegment(projectName),
      sanitizeSegment(skuName),
      `${Date.now()}-${sanitizeSegment(fileName)}`,
    ].join('/');

    const uploadUrl = await presignPutUrl(key, contentType || 'application/octet-stream');
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ uploadUrl, key }));
  } catch (e) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: e.message }));
  }
}
