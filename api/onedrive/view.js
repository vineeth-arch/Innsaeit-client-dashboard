// api/onedrive/view.js
// Given a OneDrive item id, return:
//  - embedUrl: in-browser preview (PDF / JPG / PNG / PPT / DOC render inline;
//    consumer OneDrive supports createLink type "embed")
//  - downloadUrl: direct download (the path AI / CDR files take)
// Any logged-in user (admin or client) may view; RLS already gates which
// file rows they can see, and they can only learn item ids from those rows.
import { graph } from '../_lib/graph.js';
import { getCaller } from '../_lib/supa.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.statusCode = 405; return res.end(); }
  try {
    const caller = await getCaller(req);
    if (!caller) { res.statusCode = 401; return res.end(JSON.stringify({ error: 'Login required' })); }

    const { itemId } = req.body || {};
    if (!itemId) { res.statusCode = 400; return res.end(JSON.stringify({ error: 'itemId required' })); }

    const [item, embed] = await Promise.all([
      graph(`/me/drive/items/${itemId}?select=id,name,size,file,@microsoft.graph.downloadUrl`),
      graph(`/me/drive/items/${itemId}/createLink`, {
        method: 'POST',
        body: JSON.stringify({ type: 'embed' }),
      }).catch(() => null),
    ]);

    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      name: item.name,
      size: item.size,
      mime: item.file?.mimeType || null,
      downloadUrl: item['@microsoft.graph.downloadUrl'] || null,
      embedUrl: embed?.link?.webUrl || null,
    }));
  } catch (e) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: e.message }));
  }
}
