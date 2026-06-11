// api/onedrive/create-upload-session.js
// Returns a pre-authenticated uploadUrl. The browser PUTs file chunks
// straight to Microsoft, so Vercel's 4.5MB body limit never applies and
// large artwork files (100MB+ .ai) work fine.
// Admin-only: uploads are Vineeth's job by design.
import { graph } from '../_lib/graph.js';
import { getCaller } from '../_lib/supa.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.statusCode = 405; return res.end(); }
  try {
    const caller = await getCaller(req);
    if (!caller || caller.role !== 'admin') {
      res.statusCode = 403;
      return res.end(JSON.stringify({ error: 'Admin only' }));
    }
    const { clientSlug, projectName, skuName, fileName } = req.body || {};
    if (!fileName) { res.statusCode = 400; return res.end(JSON.stringify({ error: 'fileName required' })); }

    const clean = (s) => (s || 'misc').replace(/[\\/:*?"<>|#%]/g, '-').trim();
    const path = `/Innsaeit Tracker/${clean(clientSlug)}/${clean(projectName)}/${clean(skuName)}/${clean(fileName)}`;

    const session = await graph(
      `/me/drive/root:${encodeURI(path)}:/createUploadSession`,
      {
        method: 'POST',
        body: JSON.stringify({
          item: { '@microsoft.graph.conflictBehavior': 'rename', name: fileName },
        }),
      }
    );
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ uploadUrl: session.uploadUrl, drivePath: path }));
  } catch (e) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: e.message }));
  }
}
