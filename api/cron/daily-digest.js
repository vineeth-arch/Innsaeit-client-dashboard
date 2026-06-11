// api/cron/daily-digest.js
// One personalized digest per recipient per day at 04:30 UTC (10:00 IST) via
// Vercel Cron (GET); POST with the same Authorization header is the manual
// test trigger. Service-role data access (bypasses RLS). Email is fully
// isolated: per-recipient try/catch, missing RESEND_API_KEY skips sends.
// digest_log claims (kind, recipient, digest_date) BEFORE sending so a cron
// retry can never double-send; a failed send releases its claim so a later
// retry works.
import { serviceClient } from '../_lib/supa.js';
import { sendEmail, sleep, appUrl, emailEnabled } from '../_lib/email.js';
import { fmtDate, fmtDateTime } from '../_emails/base.js';
import { AdminDigest, subject as adminSubject } from '../_emails/admin-digest.js';
import { SupervisorDigest, subject as supervisorSubject } from '../_emails/supervisor-digest.js';
import { BuyerDigest, subject as buyerSubject } from '../_emails/buyer-digest.js';
import { CheckerDigest, subject as checkerSubject } from '../_emails/checker-digest.js';

const KIND_LABEL = {
  brief_text: 'Brief (text)', brief_file: 'Brief', reference: 'Reference',
  draft: 'Draft', compliance_feedback: 'Compliance', mockup: 'Mock-up',
  final_print: 'Final print', external_link: 'Link', other: 'File',
};

const codesOf = (s) => [s.hamleys_sku, s.vendor_item_code].filter(Boolean).join(' · ');
const stageMap = (s) => Object.fromEntries((s.sku_stages || []).map((r) => [r.stage_key, r]));
const isDone = (byKey, key) => !!byKey[key]?.done;

// Last done template by position — the app's "furthest stage" pattern.
function furthestStage(byKey, tpls) {
  let last = null;
  for (const t of tpls) if (byKey[t.stage_key]?.done) last = t;
  return last;
}

function lastUpdated(sku, byKey) {
  let max = sku.updated_at;
  for (const r of Object.values(byKey)) {
    if (r.done_at && (!max || r.done_at > max)) max = r.done_at;
  }
  return max;
}

async function gather(supa, since) {
  const q = async (p) => {
    const { data, error } = await p;
    if (error) throw new Error(error.message);
    return data || [];
  };
  return Promise.all([
    q(supa.from('clients').select('id, name, slug, supervisor_email')),
    q(supa.from('profiles').select('id, email, full_name, role, client_id')),
    q(supa.from('stage_templates').select('client_id, stage_key, label, position').order('position')),
    q(supa.from('skus')
      .select('id, client_id, project_id, product_name, hamleys_sku, vendor_item_code, changes_requested, buyer_override, buyer_email_override, compliance_user_id, second_gate, updated_at, projects!inner(id, name, status, buyer, buyer_email), sku_stages(stage_key, done, done_at, done_by)')
      .neq('projects.status', 'archived')),
    q(supa.from('files').select('id, sku_id, client_id, kind, title, created_at, uploaded_by')
      .gte('created_at', since).not('sku_id', 'is', null)),
    q(supa.from('comments').select('id, sku_id, client_id, author_id, created_at')
      .gte('created_at', since).is('deleted_at', null).not('sku_id', 'is', null)),
    q(supa.from('sku_checklist_items')
      .select('sku_id, client_id, audience, label, checked, checked_at, checked_by')
      .eq('audience', 'compliance')),
  ]);
}

function buildJobs({ clients, profiles, templates, skus, files, comments, checklist, now, since }) {
  const url = appUrl();
  const date = fmtDate(now.toISOString());
  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const who = (id) => {
    const p = id ? profileById.get(id) : null;
    return p?.full_name || p?.email || 'Someone';
  };
  const adminIds = new Set(profiles.filter((p) => p.role === 'admin').map((p) => p.id));
  const skuById = new Map(skus.map((s) => [s.id, s]));
  const byKeyOf = new Map(skus.map((s) => [s.id, stageMap(s)]));
  const tplsByClient = new Map();
  for (const t of templates) {
    if (!tplsByClient.has(t.client_id)) tplsByClient.set(t.client_id, []);
    tplsByClient.get(t.client_id).push(t);
  }
  const labelOf = (clientId, key) =>
    (tplsByClient.get(clientId) || []).find((t) => t.stage_key === key)?.label || key;
  const checklistBySku = new Map();
  for (const i of checklist) {
    if (!checklistBySku.has(i.sku_id)) checklistBySku.set(i.sku_id, []);
    checklistBySku.get(i.sku_id).push(i);
  }

  const jobs = [];

  // ---- ADMIN: always sent, one per admin user ----
  const needsAction = [];
  for (const s of skus) {
    const byKey = byKeyOf.get(s.id);
    const reasons = [];
    if (isDone(byKey, 'files_received') && !isDone(byKey, 'files_checked')) reasons.push('Files received — not checked');
    if (isDone(byKey, 'files_checked') && !isDone(byKey, 'brief_received')) reasons.push('Checked — brief pending');
    if (s.changes_requested) reasons.push('Changes requested');
    if (reasons.length) {
      needsAction.push({ sku: s.product_name, codes: codesOf(s), project: s.projects?.name, reason: reasons.join(' · ') });
    }
  }
  const activity = [];
  for (const s of skus) {
    for (const r of s.sku_stages || []) {
      if (r.done && r.done_at && r.done_at >= since && r.done_by && !adminIds.has(r.done_by)) {
        activity.push({ ts: r.done_at, who: who(r.done_by), what: `marked ${labelOf(s.client_id, r.stage_key)} done`, sku: s.product_name, when: fmtDateTime(r.done_at) });
      }
    }
  }
  for (const c of comments) {
    if (adminIds.has(c.author_id)) continue;
    const s = skuById.get(c.sku_id);
    if (!s) continue; // SKU of an archived project
    activity.push({ ts: c.created_at, who: who(c.author_id), what: 'commented', sku: s.product_name, when: fmtDateTime(c.created_at) });
  }
  for (const i of checklist) {
    if (!i.checked || !i.checked_at || i.checked_at < since || !i.checked_by || adminIds.has(i.checked_by)) continue;
    const s = skuById.get(i.sku_id);
    if (!s) continue;
    activity.push({ ts: i.checked_at, who: who(i.checked_by), what: `ticked "${i.label}"`, sku: s.product_name, when: fmtDateTime(i.checked_at) });
  }
  activity.sort((a, b) => (a.ts < b.ts ? 1 : -1));
  const tally = { activeSkus: skus.length, awaiting: needsAction.length };
  for (const admin of profiles.filter((p) => p.role === 'admin' && p.email)) {
    jobs.push({
      kind: 'admin_digest', to: admin.email.toLowerCase(),
      subject: adminSubject({ date }),
      element: AdminDigest({ appUrl: url, date, needsAction, activity, tally }),
    });
  }

  // ---- SUPERVISOR: always sent, per client with supervisor_email ----
  for (const client of clients.filter((c) => c.supervisor_email)) {
    const tpls = tplsByClient.get(client.id) || [];
    const clientSkus = skus.filter((s) => s.client_id === client.id);
    const preBrief = [];
    const groups = new Map();
    for (const s of clientSkus) {
      const byKey = byKeyOf.get(s.id);
      const furthest = furthestStage(byKey, tpls);
      const row = {
        sku: s.product_name, codes: codesOf(s),
        furthest: furthest?.label || 'Not started',
        updated: fmtDate(lastUpdated(s, byKey)),
      };
      if (!isDone(byKey, 'brief_received')) {
        preBrief.push({ ...row, project: s.projects?.name });
      } else if (!isDone(byKey, 'in_production')) {
        const key = s.projects?.name || 'Project';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push({ ...row, changesRequested: s.changes_requested });
      }
    }
    const inProgress = [...groups.entries()].map(([project, rows]) => ({ project, rows }));
    jobs.push({
      kind: 'supervisor_digest', to: client.supervisor_email.toLowerCase(),
      subject: supervisorSubject({ date }),
      element: SupervisorDigest({ appUrl: url, date, preBrief, inProgress }),
    });
  }

  // ---- BUYERS: per distinct effective buyer email, only if content ----
  const buyers = new Map(); // emailLower -> { name, skus: [] }
  for (const s of skus) {
    const email = (s.buyer_email_override || s.projects?.buyer_email || '').trim().toLowerCase();
    if (!email) continue;
    if (!buyers.has(email)) buyers.set(email, { name: s.buyer_override || s.projects?.buyer || '', skus: [] });
    buyers.get(email).skus.push(s);
  }
  for (const [email, b] of buyers) {
    const ids = new Set(b.skus.map((s) => s.id));
    const newFiles = files.filter((f) => ids.has(f.sku_id)).map((f) => ({
      kind: KIND_LABEL[f.kind] || f.kind, title: f.title, sku: skuById.get(f.sku_id)?.product_name,
    }));
    const stageChanges = [];
    const awaiting = [];
    for (const s of b.skus) {
      const byKey = byKeyOf.get(s.id);
      for (const r of s.sku_stages || []) {
        if (r.done && r.done_at && r.done_at >= since) {
          stageChanges.push({ stage: labelOf(s.client_id, r.stage_key), sku: s.product_name, when: fmtDate(r.done_at) });
        }
      }
      if (isDone(byKey, 'compliance_approved') && !isDone(byKey, 'final_approved_for_print')) {
        awaiting.push({ sku: s.product_name, codes: codesOf(s), project: s.projects?.name });
      }
    }
    if (!newFiles.length && !stageChanges.length && !awaiting.length) continue;
    jobs.push({
      kind: 'buyer_digest', to: email,
      subject: buyerSubject({ date }),
      element: BuyerDigest({ appUrl: url, date, buyerName: b.name, newFiles, stageChanges, awaiting }),
    });
  }

  // ---- COMPLIANCE CHECKERS: per assigned user, only if pending work ----
  const byChecker = new Map();
  for (const s of skus) {
    if (!s.compliance_user_id) continue;
    if (!byChecker.has(s.compliance_user_id)) byChecker.set(s.compliance_user_id, []);
    byChecker.get(s.compliance_user_id).push(s);
  }
  for (const [userId, list] of byChecker) {
    const checker = profileById.get(userId);
    if (!checker?.email) continue;
    const pending = [];
    for (const s of list) {
      const byKey = byKeyOf.get(s.id);
      if (!isDone(byKey, 'compliance_sent') || isDone(byKey, 'compliance_approved')) continue;
      const items = checklistBySku.get(s.id) || [];
      const done = items.filter((i) => i.checked).length;
      pending.push({
        sku: s.product_name, codes: codesOf(s), project: s.projects?.name,
        checklist: `${done}/${items.length}`,
        sentOn: byKey.compliance_sent?.done_at ? fmtDate(byKey.compliance_sent.done_at) : '—',
      });
    }
    if (!pending.length) continue;
    jobs.push({
      kind: 'checker_digest', to: checker.email.toLowerCase(),
      subject: checkerSubject({ date }),
      element: CheckerDigest({ appUrl: url, date, checkerName: checker.full_name || '', pending }),
    });
  }

  return jobs;
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  // Vercel cron invokes with GET; manual testing uses POST. Same secret.
  if (req.method !== 'GET' && req.method !== 'POST') { res.statusCode = 405; return res.end(); }
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers['authorization'] !== `Bearer ${secret}`) {
    res.statusCode = 401;
    return res.end(JSON.stringify({ error: 'Unauthorized' }));
  }

  const now = new Date();
  const since = new Date(now.getTime() - 24 * 3600 * 1000).toISOString(); // "yesterday" = 24h window
  const digestDate = now.toISOString().slice(0, 10);                      // UTC date keys the daily dedupe
  const results = [];
  try {
    const supa = serviceClient();
    // Admin can pause all daily digests on demand via the Settings toggle
    // (app_settings.digests_paused). The live compliance-approved email is
    // unaffected — only this scheduled cron is suspended.
    const { data: paused } = await supa
      .from('app_settings').select('value').eq('key', 'digests_paused').maybeSingle();
    if (paused?.value === true || paused?.value === 'true') {
      console.log('[daily-digest] paused via app_settings — no digests sent');
      return res.end(JSON.stringify({ ok: true, paused: true, date: digestDate, results: [] }));
    }
    const [clients, profiles, templates, skus, files, comments, checklist] = await gather(supa, since);
    const jobs = buildJobs({ clients, profiles, templates, skus, files, comments, checklist, now, since });

    for (const job of jobs) {
      const id = { kind: job.kind, to: job.to };
      try {
        // Claim before sending: the unique index on (kind, recipient, digest_date)
        // makes retries no-ops. ignoreDuplicates returns [] on conflict.
        const { data: claim, error: claimErr } = await supa.from('digest_log')
          .upsert(
            { kind: job.kind, recipient: job.to, digest_date: digestDate },
            { onConflict: 'kind,recipient,digest_date', ignoreDuplicates: true }
          )
          .select('id');
        if (claimErr) throw new Error(claimErr.message);
        if (!claim?.length) { results.push({ ...id, status: 'skipped_already_sent' }); continue; }

        const r = await sendEmail({ to: job.to, subject: job.subject, element: job.element });
        results.push({ ...id, status: r.skipped ? 'skipped_no_key' : 'sent' });
        await sleep(600); // Resend free tier: 2 req/s
      } catch (e) {
        // Release the claim so a retry can resend this recipient.
        await supa.from('digest_log').delete()
          .match({ kind: job.kind, recipient: job.to, digest_date: digestDate });
        console.error(`[daily-digest] ${job.kind} -> ${job.to}:`, e.message);
        results.push({ ...id, status: 'error', error: e.message });
      }
    }

    res.end(JSON.stringify({ ok: true, date: digestDate, emailEnabled: emailEnabled(), results }));
  } catch (e) {
    console.error('[daily-digest]', e);
    res.statusCode = 500;
    res.end(JSON.stringify({ ok: false, error: e.message, results }));
  }
}
