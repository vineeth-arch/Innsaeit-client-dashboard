// api/notify/compliance-approved.js
// The ONLY live (non-digest) email path. Fired (fire-and-forget) by the UI
// after the assigned checker ticks the final compliance checklist item or an
// admin marks the Compliance Approved stage done. The server re-verifies the
// approval state, dedupes both triggers within 10 minutes via digest_log, and
// sends individually to: all admins + the client's supervisor + the SKU's
// effective buyer email (skipped silently if none) + the approving checker.
// Auth: any logged-in user of the SKU's tenant (the checker is role='client'
// — this endpoint must NOT be admin-gated). A failure here never blocks the
// tick: the caller ignores the response.
import { serviceClient, getCaller } from '../_lib/supa.js';
import { sendEmail, appUrl } from '../_lib/email.js';
import { ComplianceApproved, subject } from '../_emails/compliance-approved.js';

const FINAL_LABEL = 'Compliance approved — okay to proceed for print';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'POST') { res.statusCode = 405; return res.end(); }
  try {
    const caller = await getCaller(req);
    if (!caller) { res.statusCode = 401; return res.end(JSON.stringify({ error: 'Login required' })); }
    const { skuId } = req.body || {};
    if (!skuId) { res.statusCode = 400; return res.end(JSON.stringify({ error: 'skuId required' })); }

    const supa = serviceClient();
    const { data: sku } = await supa.from('skus')
      .select('id, client_id, product_name, hamleys_sku, vendor_item_code, buyer_email_override, compliance_user_id, projects(name, buyer_email), sku_stages(stage_key, done, done_at, done_by)')
      .eq('id', skuId).single();
    if (!sku) { res.statusCode = 404; return res.end(JSON.stringify({ error: 'SKU not found' })); }
    // Tenant guard: caller must be admin or belong to the SKU's client.
    if (caller.role !== 'admin' && caller.client_id !== sku.client_id) {
      res.statusCode = 403;
      return res.end(JSON.stringify({ error: 'Not authorized' }));
    }

    // Re-verify approval server-side: stage done OR final checklist item checked.
    const stage = (sku.sku_stages || []).find((r) => r.stage_key === 'compliance_approved');
    const { data: finalItem } = await supa.from('sku_checklist_items')
      .select('checked, checked_at, checked_by')
      .eq('sku_id', skuId).eq('audience', 'compliance').eq('label', FINAL_LABEL)
      .maybeSingle();
    if (!(stage?.done || finalItem?.checked)) {
      return res.end(JSON.stringify({ ok: false, reason: 'not_approved' })); // 200: caller is fire-and-forget
    }

    // Dedupe both triggers within 10 minutes.
    const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: dupe } = await supa.from('digest_log').select('id')
      .eq('kind', 'compliance_approved').eq('sku_id', skuId).gt('sent_at', cutoff).limit(1);
    if (dupe?.length) return res.end(JSON.stringify({ ok: true, deduped: true }));

    // Resolve approver and recipients.
    const approverId = finalItem?.checked_by || stage?.done_by || sku.compliance_user_id;
    const { data: people } = await supa.from('profiles').select('id, email, full_name, role');
    const approver = (people || []).find((p) => p.id === approverId);
    const { data: client } = await supa.from('clients')
      .select('supervisor_email').eq('id', sku.client_id).single();
    const buyerEmail = sku.buyer_email_override || sku.projects?.buyer_email || null; // skip silently if none
    const recipients = [...new Set([
      ...(people || []).filter((p) => p.role === 'admin').map((p) => p.email),
      client?.supervisor_email,
      buyerEmail,
      approver?.email,
    ].filter(Boolean).map((e) => e.trim().toLowerCase()))];

    const codes = [sku.hamleys_sku, sku.vendor_item_code].filter(Boolean).join(' · ');
    const dateIso = finalItem?.checked_at || stage?.done_at || new Date().toISOString();
    const checkerName = approver?.full_name || approver?.email || 'the compliance checker';
    const element = ComplianceApproved({
      appUrl: appUrl(), skuName: sku.product_name, codes,
      project: sku.projects?.name || 'a project', checkerName, dateIso,
    });

    const sent = [], errors = [];
    for (const to of recipients) {
      try {
        const r = await sendEmail({ to, subject: subject({ skuName: sku.product_name }), element });
        sent.push(r.skipped ? `${to} (skipped: no key)` : to);
      } catch (e) {
        errors.push({ to, error: e.message }); // per-recipient isolation
      }
    }
    // Log even on partial success so the 10-min dedupe holds for both triggers.
    await supa.from('digest_log').insert({
      kind: 'compliance_approved', sku_id: skuId,
      recipient: recipients[0] || '(none)', meta: { sent, errors },
    });
    res.end(JSON.stringify({ ok: true, sent, errors }));
  } catch (e) {
    console.error('[notify/compliance-approved]', e);
    res.statusCode = 500;
    res.end(JSON.stringify({ ok: false, error: e.message }));
  }
}
