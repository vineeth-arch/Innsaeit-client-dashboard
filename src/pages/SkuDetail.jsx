// src/pages/SkuDetail.jsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth/useAuth.jsx';
import FileViewer from '../components/FileViewer.jsx';
import ChecklistCard from '../components/ChecklistCard.jsx';
import {
  fetchSku, fetchStageTemplates, fetchFiles, fetchComments, fetchClient,
  toggleStage, addTextBrief, addExternalLink, addComment, deleteComment,
  uploadToOneDrive, registerUploadedFile,
  updateSkuBuyer, effectiveBuyer, updateSkuPrintVendor,
  requestSkuChanges, resolveSkuChanges,
  fetchChecklistItems, fetchSkuChecker,
  toggleChecklistItem, generateSkuChecklist, addChecklistItem, deleteChecklistItem,
  updateSkuPowerType, updateSkuComplianceUser, updateSkuHasIm, updateSkuImDone,
  notifyComplianceApproved, FINAL_COMPLIANCE_LABEL,
} from '../lib/api.js';

const PINK_STAGES = new Set([
  'final_approved_for_print', 'sent_to_vendor', 'mockup_received', 'in_production',
]);

const POWER_TYPES = [
  ['unknown', 'Unknown'],
  ['battery', 'Battery'],
  ['rechargeable_usb', 'Rechargeable (USB)'],
  ['non_electronic', 'Non-electronic'],
  ['ride_on', 'Ride-on'],
];

const KIND_LABEL = {
  brief_text: 'Brief (text)', brief_file: 'Brief', reference: 'Reference',
  draft: 'Draft', compliance_feedback: 'Compliance', mockup: 'Mock-up',
  final_print: 'Final print', external_link: 'Link', other: 'File',
};

export default function SkuDetail() {
  const { skuId } = useParams();
  const { profile, isAdmin } = useAuth();
  const [sku, setSku] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [files, setFiles] = useState([]);
  const [comments, setComments] = useState([]);
  const [viewing, setViewing] = useState(null);
  const [loadErr, setLoadErr] = useState('');

  // add-content state
  const [mode, setMode] = useState(null); // 'text' | 'link' | null
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [kind, setKind] = useState('brief_text');
  const [progress, setProgress] = useState(null);
  const [uploadKind, setUploadKind] = useState('draft');
  const [err, setErr] = useState('');
  const fileInput = useRef(null);

  const [newComment, setNewComment] = useState('');

  // buyer override edit state
  const [editingBuyer, setEditingBuyer] = useState(false);
  const [buyerDraft, setBuyerDraft] = useState('');
  const [buyerEmailDraft, setBuyerEmailDraft] = useState('');

  // print vendor edit state
  const [editingPrintVendor, setEditingPrintVendor] = useState(false);
  const [printVendorDraft, setPrintVendorDraft] = useState('');

  // request-changes state
  const [showRequest, setShowRequest] = useState(false);
  const [reason, setReason] = useState('');
  const [reqErr, setReqErr] = useState('');
  const [reqBusy, setReqBusy] = useState(false);

  // compliance checklists state
  const [checklist, setChecklist] = useState([]);
  const [checker, setChecker] = useState(null);
  const [client, setClient] = useState(null); // tenant row: compliance market → checker mapping

  async function load() {
    setLoadErr('');
    try {
      const s = await fetchSku(skuId);
      setSku(s);
      if (s) {
        const [t, f, c, items, chk, cl] = await Promise.all([
          fetchStageTemplates(s.client_id),
          fetchFiles(skuId),
          fetchComments(skuId),
          fetchChecklistItems(skuId),
          fetchSkuChecker(skuId),
          fetchClient(s.client_id), // for the compliance-market → checker mapping
        ]);
        setTemplates(t); setFiles(f); setComments(c);
        setChecklist(items); setChecker(chk); setClient(cl);
      }
    } catch (e) {
      setLoadErr(e.message || 'Could not load this SKU.');
    }
  }
  useEffect(() => { load(); }, [skuId]);

  const stageByKey = useMemo(
    () => Object.fromEntries((sku?.sku_stages || []).map((r) => [r.stage_key, r])),
    [sku]
  );

  async function onToggle(tpl) {
    const row = stageByKey[tpl.stage_key];
    if (!row) return;
    await toggleStage(row, !row.done);
    // The single live email: compliance approval. Fire-and-forget — the
    // server re-verifies and dedupes, a failure never blocks the toggle.
    if (!row.done && tpl.stage_key === 'compliance_approved') notifyComplianceApproved(sku.id);
    load();
  }

  async function saveText() {
    if (!body.trim()) return;
    setErr('');
    try {
      await addTextBrief(sku.client_id, sku.id, title.trim() || 'WhatsApp brief', body.trim());
      setMode(null); setTitle(''); setBody('');
      load();
    } catch (e) { setErr(e.message); }
  }

  async function saveLink() {
    if (!body.trim()) return;
    setErr('');
    try {
      await addExternalLink(sku.client_id, sku.id, title.trim() || body.trim(), body.trim(), kind === 'brief_text' ? 'external_link' : kind);
      setMode(null); setTitle(''); setBody('');
      load();
    } catch (e) { setErr(e.message); }
  }

  async function onUpload(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErr(''); setProgress(0);
    try {
      const drive = await uploadToOneDrive({
        file,
        clientSlug: 'hamleys',
        projectName: sku.projects?.name,
        skuName: sku.product_name,
        onProgress: setProgress,
      });
      await registerUploadedFile({
        clientId: sku.client_id, skuId: sku.id, kind: uploadKind, title: file.name, file, drive,
      });
      setProgress(null);
      load();
    } catch (e2) {
      setProgress(null);
      setErr(e2.message.includes('ONEDRIVE_NOT_CONNECTED')
        ? 'OneDrive is not connected yet. Go to Settings and click Connect OneDrive.'
        : e2.message);
    }
  }

  function startEditBuyer() {
    setBuyerDraft(sku.buyer_override || '');
    setBuyerEmailDraft(sku.buyer_email_override || '');
    setEditingBuyer(true);
  }

  async function saveBuyer() {
    await updateSkuBuyer(sku.id, buyerDraft.trim() || null, buyerEmailDraft.trim() || null);
    setEditingBuyer(false);
    load();
  }

  async function resetBuyer() {
    await updateSkuBuyer(sku.id, null, null);
    setEditingBuyer(false);
    load();
  }

  function startEditPrintVendor() {
    setPrintVendorDraft(sku.print_vendor || '');
    setEditingPrintVendor(true);
  }

  async function savePrintVendor() {
    await updateSkuPrintVendor(sku.id, printVendorDraft.trim() || null);
    setEditingPrintVendor(false);
    load();
  }

  async function submitRequestChanges() {
    if (!reason.trim()) return;
    setReqErr(''); setReqBusy(true);
    try {
      await requestSkuChanges(sku.id);
      await addComment(sku.client_id, sku.id, `CHANGES REQUESTED: ${reason.trim()}`);
      setShowRequest(false); setReason('');
      load();
    } catch (e) {
      setReqErr(e.message || 'Could not request changes.');
    } finally {
      setReqBusy(false);
    }
  }

  async function onResolveChanges() {
    try {
      await resolveSkuChanges(sku.id);
      load();
    } catch (e) { setErr(e.message); }
  }

  // ----- compliance checklist handlers -----
  async function onPowerType(value) {
    try { await updateSkuPowerType(sku.id, value); load(); } catch (e) { setErr(e.message); }
  }

  // The checker is one of two fixed roles per tenant (India / Global), mapped
  // on the clients row — not a free pick among all client users.
  async function onMarket(market) {
    const userId = market === 'india' ? client?.compliance_india_user_id
      : market === 'global' ? client?.compliance_global_user_id
      : null;
    if (market && !userId) {
      setErr('No checker mapped for this market yet — run the email-digests setup SQL.');
      return;
    }
    try { await updateSkuComplianceUser(sku.id, userId); load(); } catch (e) { setErr(e.message); }
  }

  async function onHasIm(checked) {
    try { await updateSkuHasIm(sku.id, checked); load(); } catch (e) { setErr(e.message); }
  }

  async function onImDone(checked) {
    try { await updateSkuImDone(sku.id, checked); load(); } catch (e) { setErr(e.message); }
  }

  async function onLoadChecklist() {
    try { await generateSkuChecklist(sku.id); load(); } catch (e) { setErr(e.message); }
  }

  async function onToggleItem(item) {
    try {
      await toggleChecklistItem(item.id, !item.checked);
      // The single live email: ticking the final compliance item. Fire-and-
      // forget — the server re-verifies and dedupes, never blocks the tick.
      if (!item.checked && item.audience === 'compliance' && item.label === FINAL_COMPLIANCE_LABEL) {
        notifyComplianceApproved(sku.id);
      }
      load();
    } catch (e) { setErr(e.message); }
  }

  async function onAddItem(audience, label) {
    const positions = checklist.filter((i) => i.audience === audience).map((i) => i.position);
    const nextPos = positions.length ? Math.max(...positions) + 1 : 1;
    try { await addChecklistItem(sku.client_id, sku.id, audience, label, nextPos); load(); } catch (e) { setErr(e.message); }
  }

  async function onDeleteItem(item) {
    try { await deleteChecklistItem(item.id); load(); } catch (e) { setErr(e.message); }
  }

  async function onDeleteComment(id) {
    try {
      await deleteComment(id);
      setComments(await fetchComments(skuId));
    } catch (e) { setErr(e.message); }
  }

  async function submitComment() {
    if (!newComment.trim()) return;
    await addComment(sku.client_id, sku.id, newComment.trim());
    setNewComment('');
    setComments(await fetchComments(skuId));
  }

  if (loadErr) return <main className="page"><p className="error-text">Couldn't load this SKU: {loadErr}</p></main>;
  if (!sku) return <main className="page"><p className="eyebrow">Loading…</p></main>;

  const adminItems = checklist.filter((i) => i.audience === 'admin');
  const complianceItems = checklist.filter((i) => i.audience === 'compliance');
  const isChecker = !!profile?.id && sku.compliance_user_id === profile.id;
  // Market is derived from which mapped checker holds the assignment; a legacy
  // assignment that matches neither mapped user shows as a disabled "custom".
  const marketValue = !sku.compliance_user_id ? ''
    : sku.compliance_user_id === client?.compliance_india_user_id ? 'india'
    : sku.compliance_user_id === client?.compliance_global_user_id ? 'global'
    : 'custom';
  const powerHint = isAdmin && sku.power_type === 'unknown'
    ? 'Power type not set — only general items loaded. Set a power type above to load type-specific checks.'
    : null;

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">
            <Link to="/">Projects</Link> / <Link to={`/project/${sku.project_id}`}>{sku.projects?.name}</Link>
          </p>
          <h1 className="display">{sku.product_name}</h1>
          <p className="sub">
            {[sku.hamleys_sku, sku.vendor_item_code].filter(Boolean).join(' · ')}
            {sku.sub_brand ? ` · ${sku.sub_brand}` : ''}
            {' · '}{sku.compliance_owner === 'internal' ? 'Compliance: Santosh' : 'Compliance: Hamleys HK/UK'}
            {sku.second_gate ? ' (+ second gate)' : ''}
            {sku.print_vendor ? ` · Print: ${sku.print_vendor}` : ''}
          </p>
          {editingBuyer ? (
            <div className="toolrow" style={{ marginTop: 10 }}>
              <input type="text" placeholder="Buyer (overrides project)" value={buyerDraft} autoFocus
                     onChange={(e) => setBuyerDraft(e.target.value)} style={{ width: 200 }} />
              <input type="email" placeholder="Buyer email (overrides project)" value={buyerEmailDraft}
                     onChange={(e) => setBuyerEmailDraft(e.target.value)} style={{ width: 220 }} />
              <button className="btn primary sm" onClick={saveBuyer}>Save</button>
              <button className="btn ghost sm" onClick={() => setEditingBuyer(false)}>Cancel</button>
            </div>
          ) : (
            (effectiveBuyer(sku, sku.projects?.buyer) || isAdmin) && (
              <div className="toolrow" style={{ marginTop: 10 }}>
                {effectiveBuyer(sku, sku.projects?.buyer)
                  ? <span className="badge">Buyer: {effectiveBuyer(sku, sku.projects?.buyer)}</span>
                  : <span style={{ color: 'var(--text-faint)', fontSize: 13 }}>No buyer set</span>}
                {isAdmin && (
                  <button className="btn ghost sm" onClick={startEditBuyer}>
                    {sku.buyer_override ? 'Edit override' : 'Override buyer'}
                  </button>
                )}
                {isAdmin && sku.buyer_override && (
                  <button className="btn ghost sm" onClick={resetBuyer}>Reset to project buyer</button>
                )}
              </div>
            )
          )}
          {editingPrintVendor ? (
            <div className="toolrow" style={{ marginTop: 10 }}>
              <input type="text" placeholder="Print vendor" value={printVendorDraft} autoFocus
                     onChange={(e) => setPrintVendorDraft(e.target.value)} style={{ width: 200 }} />
              <button className="btn primary sm" onClick={savePrintVendor}>Save</button>
              <button className="btn ghost sm" onClick={() => setEditingPrintVendor(false)}>Cancel</button>
            </div>
          ) : (
            (sku.print_vendor || isAdmin) && (
              <div className="toolrow" style={{ marginTop: 10 }}>
                {sku.print_vendor
                  ? <span className="badge">Print vendor: {sku.print_vendor}</span>
                  : <span style={{ color: 'var(--text-faint)', fontSize: 13 }}>No print vendor set</span>}
                {isAdmin && (
                  <button className="btn ghost sm" onClick={startEditPrintVendor}>
                    {sku.print_vendor ? 'Edit print vendor' : 'Set print vendor'}
                  </button>
                )}
              </div>
            )
          )}
          <div className="toolrow" style={{ marginTop: 10 }}>
            {sku.changes_requested ? (
              <>
                <span className="badge amber">Changes requested</span>
                {isAdmin && <button className="btn sm" onClick={onResolveChanges}>Resolve</button>}
              </>
            ) : (
              <button className="btn sm" onClick={() => { setReason(''); setReqErr(''); setShowRequest(true); }}>
                Request changes
              </button>
            )}
          </div>
          {isAdmin && (
            <div className="toolrow" style={{ marginTop: 10 }}>
              <label className="eyebrow" htmlFor="power-type">Power type</label>
              <select id="power-type" value={sku.power_type} onChange={(e) => onPowerType(e.target.value)}
                      style={{ width: 'auto', padding: '5px 10px', fontSize: 12 }}>
                {POWER_TYPES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
              </select>
              <label className="eyebrow" htmlFor="compliance-market">Compliance market</label>
              <select id="compliance-market" value={marketValue} onChange={(e) => onMarket(e.target.value)}
                      style={{ width: 'auto', padding: '5px 10px', fontSize: 12 }}>
                <option value="">— none —</option>
                <option value="india">India (Santosh)</option>
                <option value="global">Global / Export (Emily)</option>
                {marketValue === 'custom' && (
                  <option value="custom" disabled>Custom: {checker?.full_name || checker?.email || 'assigned'}</option>
                )}
              </select>
              {sku.second_gate && (
                <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                  2nd-gate SKU — second approval may need manual checker reassignment after the first gate.
                </span>
              )}
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
                <input type="checkbox" checked={sku.has_im} style={{ width: 'auto' }}
                       onChange={(e) => onHasIm(e.target.checked)} />
                <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>Has Instruction Manual</span>
              </label>
              {sku.has_im && (
                <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
                  <input type="checkbox" checked={sku.im_done} style={{ width: 'auto' }}
                         onChange={(e) => onImDone(e.target.checked)} />
                  <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>IM artwork done</span>
                  {sku.im_done && sku.im_done_at && (
                    <span className="stamp" style={{ color: 'var(--text-faint)', fontSize: 11.5 }}>
                      {new Date(sku.im_done_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </span>
                  )}
                </label>
              )}
              <button className="btn ghost sm" onClick={onLoadChecklist}>Load checklist</button>
            </div>
          )}
        </div>
      </div>

      <div className="detail-grid">
        <div>
          {/* ---------- Files ---------- */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="toolrow" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
              <span className="eyebrow">Briefs, drafts & links</span>
              {isAdmin && (
                <div className="toolrow">
                  <button className="btn sm" onClick={() => { setMode('text'); setErr(''); }}>Paste brief text</button>
                  <button className="btn sm" onClick={() => { setMode('link'); setErr(''); setKind('external_link'); }}>Save a link</button>
                  <select value={uploadKind} onChange={(e) => setUploadKind(e.target.value)}
                          style={{ width: 'auto', padding: '5px 10px', fontSize: 12 }}>
                    <option value="brief_file">Brief file</option>
                    <option value="reference">Reference</option>
                    <option value="draft">Draft</option>
                    <option value="compliance_feedback">Compliance</option>
                    <option value="mockup">Mock-up</option>
                    <option value="final_print">Final print</option>
                  </select>
                  <button className="btn primary sm" onClick={() => fileInput.current?.click()}
                          disabled={progress !== null}>
                    {progress !== null ? `Uploading ${progress}%` : 'Upload file'}
                  </button>
                  <input ref={fileInput} type="file" hidden onChange={onUpload} />
                </div>
              )}
            </div>

            {err && <p className="error-text" style={{ marginBottom: 10 }}>{err}</p>}
            {progress !== null && (
              <div className="progress" style={{ marginBottom: 12 }}><span style={{ width: `${progress}%` }} /></div>
            )}

            {mode === 'text' && (
              <div style={{ marginBottom: 16 }}>
                <div className="field">
                  <input type="text" placeholder="Title (e.g. WhatsApp brief 11 Jun)" value={title}
                         onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div className="field">
                  <textarea placeholder="Paste the WhatsApp brief here…" value={body}
                            onChange={(e) => setBody(e.target.value)} autoFocus />
                </div>
                <div className="toolrow" style={{ justifyContent: 'flex-end' }}>
                  <button className="btn ghost sm" onClick={() => setMode(null)}>Cancel</button>
                  <button className="btn primary sm" onClick={saveText} disabled={!body.trim()}>Save brief</button>
                </div>
              </div>
            )}

            {mode === 'link' && (
              <div style={{ marginBottom: 16 }}>
                <div className="field">
                  <input type="text" placeholder="Label (e.g. Playbook final files)" value={title}
                         onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div className="field">
                  <input type="text" placeholder="https://fromsmash.com/… or playbook.com/…" value={body}
                         onChange={(e) => setBody(e.target.value)} autoFocus />
                </div>
                <div className="toolrow" style={{ justifyContent: 'flex-end' }}>
                  <button className="btn ghost sm" onClick={() => setMode(null)}>Cancel</button>
                  <button className="btn primary sm" onClick={saveLink} disabled={!body.trim()}>Save link</button>
                </div>
              </div>
            )}

            {files.length === 0 && <div className="empty">Nothing here yet. The inbox graveyard ends now.</div>}
            {files.map((fl) => (
              <div className="file-row" key={fl.id}>
                <span className="kind">{KIND_LABEL[fl.kind] || fl.kind}</span>
                <span className="fname">{fl.title}</span>
                <span className="eyebrow" style={{ flex: 'none' }}>
                  {new Date(fl.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </span>
                <button className="btn sm" onClick={() => setViewing(fl)}>View</button>
              </div>
            ))}
          </div>

          {/* ---------- Comments ---------- */}
          <div className="card">
            <span className="eyebrow">Comments</span>
            <div style={{ marginTop: 10 }}>
              {comments.length === 0 && <p style={{ color: 'var(--text-faint)', fontSize: 13 }}>No comments yet.</p>}
              {comments.map((c) => {
                const isDeleted = !!c.deleted_at;
                const canDelete = !isDeleted && (isAdmin || c.author_id === profile?.id);
                return (
                  <div className={'comment' + (isDeleted ? ' deleted' : '')} key={c.id}>
                    <span className="who">{c.profiles?.full_name || c.profiles?.email}</span>
                    <span className="when">{new Date(c.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    {isDeleted
                      ? <span className="deleted-pill">deleted{c.deleter ? ` by ${c.deleter.full_name || c.deleter.email}` : ''}</span>
                      : canDelete && (
                        <button className="btn ghost sm comment-delete" onClick={() => onDeleteComment(c.id)} aria-label="Delete comment">×</button>
                      )
                    }
                    <p className="body">{c.body}</p>
                  </div>
                );
              })}
            </div>
            <hr className="sep" />
            <div className="field">
              <textarea style={{ minHeight: 70 }} placeholder="Add a comment…" value={newComment}
                        onChange={(e) => setNewComment(e.target.value)} />
            </div>
            <div className="toolrow" style={{ justifyContent: 'flex-end' }}>
              <button className="btn primary sm" onClick={submitComment} disabled={!newComment.trim()}>Post comment</button>
            </div>
          </div>
        </div>

        <div>
        {/* ---------- Stage checklist ---------- */}
        <div className="card">
          <span className="eyebrow">Pipeline</span>
          <ul className="stage-list" style={{ marginTop: 8 }}>
            {templates.map((t) => {
              const row = stageByKey[t.stage_key];
              const done = !!row?.done;
              const allowed = isAdmin || t.client_can_toggle;
              return (
                <li key={t.stage_key} className={[
                  t.client_can_toggle ? 'gate' : '',
                  PINK_STAGES.has(t.stage_key) ? 'pink-stage' : '',
                ].filter(Boolean).join(' ')}>
                  <button
                    className={'check' + (done ? ' done' : '')}
                    disabled={!allowed}
                    onClick={() => onToggle(t)}
                    aria-label={`${t.label}: mark ${done ? 'not done' : 'done'}`}
                  >
                    {done ? '✓' : ''}
                  </button>
                  <span className="stage-label" style={{ color: done ? 'var(--text)' : 'var(--text-dim)' }}>
                    {t.label}
                  </span>
                  {done && row?.done_at && (
                    <span className="stamp">
                      {new Date(row.done_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </span>
                  )}
                  {done && t.client_can_toggle && row?.approver && (
                    <span className="stamp" style={{ color: '#FF006C' }}>
                      ✓ {row.approver.full_name || row.approver.email}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          {!isAdmin && (
            <p style={{ color: 'var(--text-faint)', fontSize: 12, marginTop: 12 }}>
              You can approve the highlighted "Final Approved for Print" stage and comment on drafts.
              All other stages update automatically as work progresses.
            </p>
          )}
        </div>

        {/* ---------- Internal (admin) checklist ---------- */}
        {isAdmin && (
          <ChecklistCard
            accent="amber"
            title="Internal checklist"
            chip={<span className="badge amber">INTERNAL — only you see this</span>}
            items={adminItems}
            canTick
            canEdit
            onToggle={onToggleItem}
            onAdd={(label) => onAddItem('admin', label)}
            onDelete={onDeleteItem}
            hint={powerHint}
          />
        )}

        {/* ---------- Compliance checklist ---------- */}
        {(isAdmin || isChecker) && (
          <ChecklistCard
            accent="mint"
            title="Compliance checklist"
            chip={checker
              ? <span className="badge mint">Checker: {checker.full_name || checker.email}</span>
              : <span className="badge">No checker assigned</span>}
            items={complianceItems}
            canTick={isAdmin || isChecker}
            canEdit={isAdmin}
            onToggle={onToggleItem}
            onAdd={(label) => onAddItem('compliance', label)}
            onDelete={onDeleteItem}
            hint={powerHint}
          />
        )}
        </div>
      </div>

      {showRequest && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setShowRequest(false)}>
          <div className="card modal">
            <h2 className="display" style={{ fontSize: 22, marginBottom: 6 }}>Request changes</h2>
            <p style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 14 }}>
              Flags this SKU and posts your reason as a comment. No stages are changed.
            </p>
            <div className="field">
              <label className="eyebrow">What needs changing?</label>
              <textarea placeholder="e.g. Barcode panel uses the old logo — please swap to the 2026 version."
                        value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
            </div>
            {reqErr && <p className="error-text" style={{ marginBottom: 10 }}>{reqErr}</p>}
            <div className="toolrow" style={{ justifyContent: 'flex-end' }}>
              <button className="btn ghost" onClick={() => setShowRequest(false)}>Cancel</button>
              <button className="btn primary" onClick={submitRequestChanges} disabled={!reason.trim() || reqBusy}>
                {reqBusy ? 'Sending…' : 'Request changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewing && <FileViewer file={viewing} onClose={() => setViewing(null)} />}
    </main>
  );
}
