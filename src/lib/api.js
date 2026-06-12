// src/lib/api.js
// Single data layer. UI components never touch supabase directly for writes.
import { supabase } from './supabase.js';

// ---------- session helpers ----------
async function authHeader() {
  const { data: { session } } = await supabase.auth.getSession();
  return { Authorization: `Bearer ${session?.access_token || ''}` };
}

// ---------- reads ----------
export async function fetchMyProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  return data;
}

export async function fetchClient(clientId) {
  const { data } = await supabase.from('clients').select('*').eq('id', clientId).single();
  return data;
}

// Onboarding: clients cannot UPDATE their own profile (admin-only policy), so a
// SECURITY DEFINER RPC flips the flag on the caller's own row. Fire-and-forget.
export async function markOnboarded() {
  const { error } = await supabase.rpc('mark_onboarded');
  if (error) throw error;
}

export async function fetchClients() {
  const { data } = await supabase.from('clients').select('*').order('name');
  return data || [];
}

export async function fetchStageTemplates(clientId) {
  const { data } = await supabase
    .from('stage_templates').select('*')
    .eq('client_id', clientId).order('position');
  return data || [];
}

export async function fetchProjects(clientId) {
  // All statuses, including archived — the dashboard groups non-active
  // projects into its own "Done & inactive" section.
  const { data } = await supabase
    .from('projects').select('*, skus(id)')
    .eq('client_id', clientId)
    .order('updated_at', { ascending: false });
  return data || [];
}

export async function updateProjectStatus(projectId, status) { // admin only via RLS
  const { error } = await supabase.from('projects').update({ status }).eq('id', projectId);
  if (error) throw error;
}

export async function fetchProject(projectId) {
  const { data } = await supabase.from('projects').select('*').eq('id', projectId).single();
  return data;
}

export async function fetchSkus(projectId) {
  const { data } = await supabase
    .from('skus')
    .select('*, sku_stages(*)')
    .eq('project_id', projectId)
    .order('created_at');
  return data || [];
}

export async function fetchSku(skuId) {
  const { data, error } = await supabase
    .from('skus')
    .select('*, sku_stages(*, approver:done_by(full_name, email)), projects(name, vendor, buyer, buyer_email)')
    .eq('id', skuId).single();
  if (error) throw error;
  return data;
}

export async function fetchFiles(skuId) {
  const { data } = await supabase
    .from('files').select('*')
    .eq('sku_id', skuId)
    .order('created_at', { ascending: false });
  return data || [];
}

export async function deleteFile(fileId) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch('/api/storage/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ fileId }),
  });
  if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || 'Delete failed'); }
}

export async function fetchComments(skuId) {
  const { data } = await supabase
    .from('comments')
    .select('*, profiles:author_id(full_name, email), deleter:deleted_by(full_name, email)')
    .eq('sku_id', skuId)
    .order('created_at');
  return data || [];
}

// ---------- writes ----------
export async function createProject(clientId, name, vendor, buyer, buyerEmail) {
  const { data, error } = await supabase
    .from('projects')
    .insert({ client_id: clientId, name, vendor, buyer, buyer_email: buyerEmail || null })
    .select().single();
  if (error) throw error;
  return data;
}

// Effective buyer = SKU override if set, else the parent project's buyer (live inherit).
export function effectiveBuyer(sku, projectBuyer) {
  return sku?.buyer_override || projectBuyer || null;
}

// Full project edit — the same fields as the New-project form. An empty buyer
// clears it; SKUs without an override inherit the new value live.
export async function updateProjectDetails(projectId, { name, vendor, buyer, buyer_email }) { // admin only via RLS
  const { error } = await supabase
    .from('projects')
    .update({
      name,
      vendor: vendor || null,
      buyer: buyer || null,
      buyer_email: buyer_email || null,
    })
    .eq('id', projectId);
  if (error) throw error;
}

// Resolve the email checker (compliance_user_id) from the form's compliance
// choice, using the tenant's configured mapping: internal → Santosh (India),
// hamleys_hk_uk → Emily (Global). Returns undefined when the client has no
// mapping yet (email-digests SQL not run) so callers leave the value untouched
// rather than clearing a manually-assigned checker.
async function complianceCheckerId(clientId, complianceOwner) {
  if (!clientId || !complianceOwner) return undefined;
  const { data } = await supabase
    .from('clients')
    .select('compliance_india_user_id, compliance_global_user_id')
    .eq('id', clientId).single();
  if (!data) return undefined;
  const id = complianceOwner === 'hamleys_hk_uk'
    ? data.compliance_global_user_id
    : data.compliance_india_user_id;
  return id || undefined;
}

export async function createSku(clientId, projectId, fields) {
  const row = { client_id: clientId, project_id: projectId, ...fields };
  const checkerId = await complianceCheckerId(clientId, fields.compliance_owner);
  if (checkerId !== undefined) row.compliance_user_id = checkerId;
  const { data, error } = await supabase
    .from('skus').insert(row).select().single();
  if (error) throw error;
  return data;
}

// Copies a SKU's descriptive fields into a fresh row in the same project.
// Progress is deliberately NOT copied: the insert triggers seed clean stages
// and checklist items, and per-state columns (changes_requested, im_done,
// status) reset to their defaults.
export async function duplicateSku(sku) {
  const {
    id, created_at, updated_at, client_id, project_id,
    changes_requested, changes_requested_at, changes_requested_by,
    im_done, im_done_at, status,
    sku_stages, projects, // joined relations from fetchSku, not columns
    ...fields
  } = sku;
  return createSku(client_id, project_id, {
    ...fields,
    product_name: `${sku.product_name} (copy)`,
  });
}

// Full SKU edit — the same fields as the Add-SKU form. Clearing buyer_override
// (or its email) returns the SKU to inheriting the project buyer.
export async function updateSkuDetails(skuId, {
  product_name, hamleys_sku, vendor_item_code, sub_brand,
  compliance_owner, buyer_override, buyer_email_override, print_vendor,
  second_gate, has_im,
}) { // admin only via RLS
  const update = {
    product_name,
    hamleys_sku: hamleys_sku || null,
    vendor_item_code: vendor_item_code || null,
    sub_brand: sub_brand || null,
    compliance_owner,
    buyer_override: buyer_override || null,
    buyer_email_override: buyer_email_override || null,
    print_vendor: print_vendor || null,
    second_gate,
    has_im,
  };
  // Keep the email checker in sync with the compliance choice when the tenant
  // has a mapping configured (leaves it untouched otherwise).
  const { data: row } = await supabase.from('skus').select('client_id').eq('id', skuId).single();
  const checkerId = await complianceCheckerId(row?.client_id, compliance_owner);
  if (checkerId !== undefined) update.compliance_user_id = checkerId;
  const { error } = await supabase.from('skus').update(update).eq('id', skuId);
  if (error) throw error;
}

export async function updateSkuStatus(skuId, status) { // admin only via RLS
  const { error } = await supabase.from('skus').update({ status }).eq('id', skuId);
  if (error) throw error;
}

// Hard delete: server removes the R2 objects first, then the row (DB cascades
// clean stages, versions, files, comments, checklist items). Admin-only.
export async function deleteSku(skuId) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch('/api/sku/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ skuId }),
  });
  if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || 'Delete failed'); }
}

export async function toggleStage(stageRow, done) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('sku_stages')
    .update({
      done,
      done_at: done ? new Date().toISOString() : null,
      done_by: done ? user.id : null,
    })
    .eq('id', stageRow.id);
  if (error) throw error;
}

export async function addTextBrief(clientId, skuId, title, text) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from('files').insert({
    client_id: clientId, sku_id: skuId, kind: 'brief_text',
    title, text_content: text, uploaded_by: user.id,
  });
  if (error) throw error;
}

export async function addExternalLink(clientId, skuId, title, url, kind = 'external_link') {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from('files').insert({
    client_id: clientId, sku_id: skuId, kind,
    title, external_url: url, uploaded_by: user.id,
  });
  if (error) throw error;
}

export async function addComment(clientId, skuId, body) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from('comments').insert({
    client_id: clientId, sku_id: skuId, body, author_id: user.id,
  });
  if (error) throw error;
}

export async function deleteComment(commentId) {
  const { error } = await supabase.rpc('delete_comment', { comment_id: commentId });
  if (error) throw error;
}

// ---------- activity feed (read-only; RLS scopes visibility) ----------
// Admin-actored events must never surface in the feed, for admins or clients.
// Profiles RLS hides admin rows from client users, so we can't detect admin
// actors with a plain profiles query — admin_profile_ids() is a SECURITY DEFINER
// function that returns admin UUIDs (no names/emails) regardless of RLS.
// Cached for the session; the actor sets rarely change.
let _adminIdsPromise = null;
async function getAdminActorIds() {
  if (!_adminIdsPromise) {
    _adminIdsPromise = (async () => {
      const { data, error } = await supabase.rpc('admin_profile_ids');
      if (error) { _adminIdsPromise = null; return new Set(); }
      return new Set((data || []).map((r) => (typeof r === 'string' ? r : r.id)));
    })();
  }
  return _adminIdsPromise;
}

export async function fetchRecentStageActivity(clientId, limit = 30) {
  const [{ data }, adminIds] = await Promise.all([
    supabase
      .from('sku_stages')
      .select('id, stage_key, done_at, sku_id, done_by, skus(id, product_name), actor:done_by(full_name, email)')
      .eq('client_id', clientId)
      .eq('done', true)
      .not('done_at', 'is', null)
      .order('done_at', { ascending: false })
      .limit(limit),
    getAdminActorIds(),
  ]);
  return (data || []).filter((r) => !adminIds.has(r.done_by));
}

export async function fetchRecentComments(clientId, limit = 30) {
  const [{ data }, adminIds] = await Promise.all([
    supabase
      .from('comments')
      .select('id, created_at, sku_id, author_id, skus(id, product_name), author:author_id(full_name, email)')
      .eq('client_id', clientId)
      .is('deleted_at', null)
      .not('sku_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(limit),
    getAdminActorIds(),
  ]);
  return (data || []).filter((r) => !adminIds.has(r.author_id));
}

export async function fetchRecentFiles(clientId, limit = 30) {
  const [{ data }, adminIds] = await Promise.all([
    supabase
      .from('files')
      .select('id, kind, title, created_at, sku_id, uploaded_by, skus(id, product_name), uploader:uploaded_by(full_name, email)')
      .eq('client_id', clientId)
      .not('sku_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(limit),
    getAdminActorIds(),
  ]);
  return (data || []).filter((r) => !adminIds.has(r.uploaded_by));
}

// ---------- request changes ----------
// Sets changes_requested + timestamp + user via the request_sku_changes RPC,
// which is the only client write path on skus (no client UPDATE policy exists).
export async function requestSkuChanges(skuId) {
  const { error } = await supabase.rpc('request_sku_changes', { p_sku_id: skuId });
  if (error) throw error;
}

export async function resolveSkuChanges(skuId) { // admin only (existing RLS enforces)
  const { error } = await supabase
    .from('skus')
    .update({ changes_requested: false, changes_requested_at: null, changes_requested_by: null })
    .eq('id', skuId);
  if (error) throw error;
}

// ---------- email notifications ----------
// The single live email trigger (everything else is the daily digest). The
// final compliance item is identified by audience+label, the codebase's
// checklist-identity convention.
export const FINAL_COMPLIANCE_LABEL = 'Compliance approved — okay to proceed for print';

// Fire-and-forget: never awaited by the UI, never throws — a notify failure
// must not block or surface on the tick that triggered it. The server
// re-verifies approval state and dedupes, so spurious calls are harmless.
export function notifyComplianceApproved(skuId) {
  authHeader()
    .then((h) => fetch('/api/notify/compliance-approved', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...h },
      body: JSON.stringify({ skuId }),
    }))
    .catch((e) => console.warn('compliance-approved notify failed:', e));
}

// ---------- compliance checklists ----------
// Client users of a tenant, for the "Compliance checker" select. Admin-only in
// practice: profiles RLS hides other users' rows from clients, so they get [].
export async function fetchClientUsers(clientId) {
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('client_id', clientId)
    .eq('role', 'client')
    .order('full_name');
  return data || [];
}

// The assigned checker's profile for a SKU (fetchSku stays untouched).
// Admin sees any profile; the assigned client's join target is their own
// profile row, which profiles RLS permits; everyone else gets null.
export async function fetchSkuChecker(skuId) {
  const { data } = await supabase
    .from('skus')
    .select('compliance_user:compliance_user_id(full_name, email)')
    .eq('id', skuId).single();
  return data?.compliance_user || null;
}

// RLS scopes visibility: admins get both audiences, the assigned checker gets
// compliance items only, all other clients get nothing.
export async function fetchChecklistItems(skuId) {
  const { data } = await supabase
    .from('sku_checklist_items')
    .select('*, checker:checked_by(full_name, email)')
    .eq('sku_id', skuId)
    .order('position')
    .order('created_at');
  return data || [];
}

// Tick/untick via RPC — the only client write path on sku_checklist_items
// (stamps/clears checked_at + checked_by server-side).
export async function toggleChecklistItem(itemId, checked) {
  const { error } = await supabase.rpc('toggle_checklist_item', {
    p_item_id: itemId, p_checked: checked,
  });
  if (error) throw error;
}

// Copies missing template items for the SKU's current power_type / has_im.
// Idempotent: never duplicates, never touches checked items. Admin only.
export async function generateSkuChecklist(skuId) {
  const { error } = await supabase.rpc('generate_sku_checklist', { p_sku_id: skuId });
  if (error) throw error;
}

export async function addChecklistItem(clientId, skuId, audience, label, position) { // admin only via RLS
  const { error } = await supabase.from('sku_checklist_items').insert({
    client_id: clientId, sku_id: skuId, audience, label, position,
  });
  if (error) throw error;
}

export async function deleteChecklistItem(itemId) { // admin only via RLS
  const { error } = await supabase.from('sku_checklist_items').delete().eq('id', itemId);
  if (error) throw error;
}

export async function updateSkuPowerType(skuId, powerType) { // admin only via RLS
  const { error } = await supabase.from('skus').update({ power_type: powerType }).eq('id', skuId);
  if (error) throw error;
  await generateSkuChecklist(skuId); // regenerate for the new power type
}

// userId null/empty clears the assignment.
export async function updateSkuComplianceUser(skuId, userId) { // admin only via RLS
  const { error } = await supabase
    .from('skus').update({ compliance_user_id: userId || null }).eq('id', skuId);
  if (error) throw error;
}

export async function updateSkuHasIm(skuId, hasIm) { // admin only via RLS
  const { error } = await supabase.from('skus').update({ has_im: hasIm }).eq('id', skuId);
  if (error) throw error;
  await generateSkuChecklist(skuId); // add or prune the has_im checklist item
}

export async function updateSkuImDone(skuId, done) { // admin only via RLS
  const { error } = await supabase
    .from('skus')
    .update({ im_done: done, im_done_at: done ? new Date().toISOString() : null })
    .eq('id', skuId);
  if (error) throw error;
}

// Apply only the properties the admin explicitly enabled to one SKU. Keys
// absent from `changes` are never written (the "leave unchanged" guarantee).
async function applySkuChanges(sku, changes) {
  const update = {};
  if ('sub_brand' in changes) update.sub_brand = changes.sub_brand || null;
  if ('buyer_override' in changes) update.buyer_override = changes.buyer_override || null;
  if ('buyer_email_override' in changes) update.buyer_email_override = changes.buyer_email_override || null;
  if ('print_vendor' in changes) update.print_vendor = changes.print_vendor || null;
  if ('power_type' in changes) update.power_type = changes.power_type;
  if ('has_im' in changes) update.has_im = changes.has_im;
  if ('compliance_owner' in changes) {
    update.compliance_owner = changes.compliance_owner;
    const checkerId = await complianceCheckerId(sku.client_id, changes.compliance_owner);
    if (checkerId !== undefined) update.compliance_user_id = checkerId;
  }
  if (Object.keys(update).length) {
    const { error } = await supabase.from('skus').update(update).eq('id', sku.id);
    if (error) throw error;
  }
  // Same checklist regeneration the single-SKU power-type / has-IM flow runs.
  if ('power_type' in changes || 'has_im' in changes) {
    await generateSkuChecklist(sku.id);
  }
  // Tick one chosen stage if it isn't already done. Never unticks, never
  // touches other stages.
  if (changes.mark_stage_done) {
    const row = (sku.sku_stages || []).find((r) => r.stage_key === changes.mark_stage_done);
    if (row && !row.done) await toggleStage(row, true);
  }
}

// Bulk multi-edit. Runs every SKU independently so one failure doesn't block
// the rest; returns a per-batch result summary. Admin only (RLS enforces it).
export async function bulkUpdateSkus(skus, changes) {
  const results = await Promise.allSettled(skus.map((s) => applySkuChanges(s, changes)));
  const errors = results.filter((r) => r.status === 'rejected').map((r) => r.reason?.message || 'failed');
  return { total: skus.length, updated: skus.length - errors.length, failed: errors.length, errors };
}

// Compliance progress for project rows (fetchSkus stays untouched). RLS scopes
// rows: clients only see compliance items on SKUs assigned to them.
export async function fetchProjectChecklistSummary(skuIds) {
  if (!skuIds?.length) return [];
  const { data } = await supabase
    .from('sku_checklist_items')
    .select('sku_id, checked')
    .eq('audience', 'compliance')
    .in('sku_id', skuIds);
  return data || [];
}

// ---------- Cloudflare R2 upload (presigned PUT, direct to R2) ----------
export async function uploadToR2({ file, clientSlug, projectName, skuName, onProgress }) {
  const headers = { 'Content-Type': 'application/json', ...(await authHeader()) };
  const res = await fetch('/api/storage/upload-url', {
    method: 'POST', headers,
    body: JSON.stringify({
      clientSlug, projectName, skuName,
      fileName: file.name,
      contentType: file.type || 'application/octet-stream',
    }),
  });
  const session = await res.json();
  if (!res.ok) throw new Error(session.error || 'Could not get upload URL');

  // XHR rather than fetch: it's the only way to get upload progress events.
  await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', session.uploadUrl);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300)
      ? resolve()
      : reject(new Error(`Upload failed (${xhr.status})`));
    xhr.onerror = () => reject(new Error('Upload failed — check the R2 bucket CORS policy allows this origin'));
    xhr.send(file);
  });

  return { key: session.key, size: file.size };
}

export async function registerUploadedFile({ clientId, skuId, versionId, kind, title, file, upload }) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from('files').insert({
    client_id: clientId, sku_id: skuId, version_id: versionId || null, kind,
    title: title || file.name,
    storage_key: upload.key,
    storage_provider: 'r2',
    file_name: file.name,
    mime_type: file.type || null,
    size_bytes: upload.size,
    uploaded_by: user.id,
  });
  if (error) throw error;
}

export async function getViewLinks(key) {
  const headers = { 'Content-Type': 'application/json', ...(await authHeader()) };
  const res = await fetch('/api/storage/view', {
    method: 'POST', headers, body: JSON.stringify({ key }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Could not get view link');
  return json;
}

// Files that preview inline; everything else is download-only.
// PPT/DOC dropped with the move to R2 — there's no Office renderer, so they
// take the download path like AI/CDR.
export function isPreviewable(fileName = '', mime = '') {
  const ext = fileName.split('.').pop()?.toLowerCase();
  return ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'txt'].includes(ext)
    || (mime || '').startsWith('image/');
}

// ---------- Integrations panel (admin-only health checks) ----------
// Hits /api/health/{service}; the endpoint returns only booleans/safe metadata
// (never any secret). Callers wrap this in their own try/catch.
export async function checkIntegration(service) {
  const res = await fetch(`/api/health/${service}`, { headers: await authHeader() });
  if (!res.ok) return { ok: false };
  return res.json();
}

// ---------- App settings flags (admin-only) ----------
export async function getFlags() { // { testMode, digestsPaused, recipient }
  const res = await fetch('/api/settings/flags', { headers: await authHeader() });
  if (!res.ok) throw new Error('Failed to fetch settings');
  return res.json();
}
export async function setFlag(key, value) {
  const res = await fetch('/api/settings/flags', {
    method: 'POST',
    headers: { ...(await authHeader()), 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value }),
  });
  if (!res.ok) throw new Error('Failed to update settings');
  return res.json();
}
