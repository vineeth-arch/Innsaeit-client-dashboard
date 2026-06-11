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
  const { data } = await supabase
    .from('projects').select('*, skus(id)')
    .eq('client_id', clientId)
    .neq('status', 'archived')
    .order('updated_at', { ascending: false });
  return data || [];
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
    .select('*, sku_stages(*, approver:done_by(full_name, email)), projects(name, vendor, buyer)')
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

export async function fetchComments(skuId) {
  const { data } = await supabase
    .from('comments')
    .select('*, profiles:author_id(full_name, email)')
    .eq('sku_id', skuId)
    .order('created_at');
  return data || [];
}

// ---------- writes ----------
export async function createProject(clientId, name, vendor, buyer) {
  const { data, error } = await supabase
    .from('projects').insert({ client_id: clientId, name, vendor, buyer })
    .select().single();
  if (error) throw error;
  return data;
}

// Effective buyer = SKU override if set, else the parent project's buyer (live inherit).
export function effectiveBuyer(sku, projectBuyer) {
  return sku?.buyer_override || projectBuyer || null;
}

export async function updateProjectBuyer(projectId, buyer) {
  const { error } = await supabase
    .from('projects').update({ buyer: buyer || null }).eq('id', projectId);
  if (error) throw error;
}

// value null/empty clears the override → SKU goes back to inheriting the project buyer.
export async function updateSkuBuyer(skuId, value) {
  const { error } = await supabase
    .from('skus').update({ buyer_override: value || null }).eq('id', skuId);
  if (error) throw error;
}

export async function createSku(clientId, projectId, fields) {
  const { data, error } = await supabase
    .from('skus').insert({ client_id: clientId, project_id: projectId, ...fields })
    .select().single();
  if (error) throw error;
  return data;
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

// ---------- OneDrive upload (chunked, direct to Microsoft) ----------
const CHUNK = 10 * 1024 * 1024; // 10 MB chunks, multiple of 320 KiB

export async function uploadToOneDrive({ file, clientSlug, projectName, skuName, onProgress }) {
  const headers = { 'Content-Type': 'application/json', ...(await authHeader()) };
  const res = await fetch('/api/onedrive/create-upload-session', {
    method: 'POST', headers,
    body: JSON.stringify({ clientSlug, projectName, skuName, fileName: file.name }),
  });
  const session = await res.json();
  if (!res.ok) throw new Error(session.error || 'Upload session failed');

  let item = null;
  for (let start = 0; start < file.size; start += CHUNK) {
    const end = Math.min(start + CHUNK, file.size);
    const blob = file.slice(start, end);
    const put = await fetch(session.uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Range': `bytes ${start}-${end - 1}/${file.size}`,
      },
      body: blob,
    });
    if (!put.ok && put.status !== 202) {
      throw new Error('Chunk upload failed at byte ' + start);
    }
    if (put.status === 200 || put.status === 201) item = await put.json();
    onProgress?.(Math.round((end / file.size) * 100));
  }
  if (!item) throw new Error('Upload did not complete');
  return { driveItemId: item.id, drivePath: session.drivePath, size: item.size };
}

export async function registerUploadedFile({ clientId, skuId, versionId, kind, title, file, drive }) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from('files').insert({
    client_id: clientId, sku_id: skuId, version_id: versionId || null, kind,
    title: title || file.name,
    drive_item_id: drive.driveItemId,
    drive_path: drive.drivePath,
    file_name: file.name,
    mime_type: file.type || null,
    size_bytes: drive.size,
    uploaded_by: user.id,
  });
  if (error) throw error;
}

export async function getViewLinks(itemId) {
  const headers = { 'Content-Type': 'application/json', ...(await authHeader()) };
  const res = await fetch('/api/onedrive/view', {
    method: 'POST', headers, body: JSON.stringify({ itemId }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Could not get view link');
  return json;
}

// Files that preview inline; everything else is download-only.
export function isPreviewable(fileName = '', mime = '') {
  const ext = fileName.split('.').pop()?.toLowerCase();
  return ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'ppt', 'pptx', 'doc', 'docx', 'txt'].includes(ext)
    || (mime || '').startsWith('image/');
}
