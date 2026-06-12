// api/notify/first-draft.js
// Immediate notification sent when the first-ever draft file is uploaded for a
// SKU. Fire-and-forget from the UI; the server re-verifies a draft file exists
// and dedupes permanently (one send per SKU lifetime, not a rolling window).
// Recipients: all admins + the client's supervisor (if set).
// Auth: admin only (only admins can upload files).
import { serviceClient, getCaller } from '../_lib/supa.js';
import { sendEmail, appUrl } from '../_lib/email.js';
import { FirstDraft, subject } from '../_emails/first-draft.js';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'POST') { res.statusCode = 405; return res.end(); }
  try {
    const caller = await getCaller(req);
    if (!caller || caller.role !== 'admin') {
      res.statusCode = 401;
      return res.end(JSON.stringify({ error: 'Admin login required' }));
    }
    const { skuId } = req.body || {};
    if (!skuId) { res.statusCode = 400; return res.end(JSON.stringify({ error: 'skuId required' })); }

    const supa = serviceClient();
    const { data: sku } = await supa.from('skus')
      .select('id, client_id, product_name, hamleys_sku, vendor_item_code, projects(name)')
      .eq('id', skuId).single();
    if (!sku) { res.statusCode = 404; return res.end(JSON.stringify({ error: 'SKU not found' })); }

    // Re-verify: at least one draft file exists for this SKU.
    const { data: draftFiles } = await supa.from('files')
      .select('id, uploaded_by, created_at')
      .eq('sku_id', skuId).eq('kind', 'draft')
      .order('created_at', { ascending: true })
      .limit(1);
    if (!draftFiles?.length) {
      return res.end(JSON.stringify({ ok: false, reason: 'no_draft_file' }));
    }

    // Permanent dedupe: only send once per SKU, ever.
    const { data: dupe } = await supa.from('digest_log').select('id')
      .eq('kind', 'first_draft_received').eq('sku_id', skuId).limit(1);
    if (dupe?.length) return res.end(JSON.stringify({ ok: true, deduped: true }));

    // Resolve uploader name and recipients.
    const { data: people } = await supa.from('profiles').select('id, email, full_name, role');
    const firstFile = draftFiles[0];
    const uploader = (people || []).find((p) => p.id === firstFile.uploaded_by);
    const uploaderName = uploader?.full_name || uploader?.email || 'an admin';

    const { data: client } = await supa.from('clients')
      .select('supervisor_email').eq('id', sku.client_id).single();
    const recipients = [...new Set([
      ...(people || []).filter((p) => p.role === 'admin').map((p) => p.email),
      client?.supervisor_email,
    ].filter(Boolean).map((e) => e.trim().toLowerCase()))];

    const codes = [sku.hamleys_sku, sku.vendor_item_code].filter(Boolean).join(' · ');
    const element = FirstDraft({
      appUrl: appUrl(), skuName: sku.product_name, codes,
      project: sku.projects?.name || 'a project',
      uploaderName, dateIso: firstFile.created_at,
    });

    const sent = [], errors = [];
    for (const to of recipients) {
      try {
        const r = await sendEmail({ to, subject: subject({ skuName: sku.product_name }), element });
        sent.push(r.skipped ? `${to} (skipped: no key)` : to);
      } catch (e) {
        errors.push({ to, error: e.message });
      }
    }
    await supa.from('digest_log').insert({
      kind: 'first_draft_received', sku_id: skuId,
      recipient: recipients[0] || '(none)', meta: { sent, errors },
    });
    res.end(JSON.stringify({ ok: true, sent, errors }));
  } catch (e) {
    console.error('[notify/first-draft]', e);
    res.statusCode = 500;
    res.end(JSON.stringify({ ok: false, error: e.message }));
  }
}
