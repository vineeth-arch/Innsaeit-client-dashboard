// src/pages/SkuDetail.jsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth/useAuth.jsx';
import FileViewer from '../components/FileViewer.jsx';
import {
  fetchSku, fetchStageTemplates, fetchFiles, fetchComments,
  toggleStage, addTextBrief, addExternalLink, addComment,
  uploadToOneDrive, registerUploadedFile,
  updateSkuBuyer, effectiveBuyer,
} from '../lib/api.js';

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

  async function load() {
    const s = await fetchSku(skuId);
    setSku(s);
    if (s) {
      setTemplates(await fetchStageTemplates(s.client_id));
      setFiles(await fetchFiles(skuId));
      setComments(await fetchComments(skuId));
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
    setEditingBuyer(true);
  }

  async function saveBuyer() {
    await updateSkuBuyer(sku.id, buyerDraft.trim() || null);
    setEditingBuyer(false);
    load();
  }

  async function resetBuyer() {
    await updateSkuBuyer(sku.id, null);
    setEditingBuyer(false);
    load();
  }

  async function submitComment() {
    if (!newComment.trim()) return;
    await addComment(sku.client_id, sku.id, newComment.trim());
    setNewComment('');
    setComments(await fetchComments(skuId));
  }

  if (!sku) return <main className="page"><p className="eyebrow">Loading…</p></main>;

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
          </p>
          {editingBuyer ? (
            <div className="toolrow" style={{ marginTop: 10 }}>
              <input type="text" placeholder="Buyer (overrides project)" value={buyerDraft} autoFocus
                     onChange={(e) => setBuyerDraft(e.target.value)} style={{ width: 200 }} />
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
              {comments.map((c) => (
                <div className="comment" key={c.id}>
                  <span className="who">{c.profiles?.full_name || c.profiles?.email}</span>
                  <span className="when">{new Date(c.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  <p className="body">{c.body}</p>
                </div>
              ))}
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

        {/* ---------- Stage checklist ---------- */}
        <div className="card">
          <span className="eyebrow">Pipeline</span>
          <ul className="stage-list" style={{ marginTop: 8 }}>
            {templates.map((t) => {
              const row = stageByKey[t.stage_key];
              const done = !!row?.done;
              const allowed = isAdmin || t.client_can_toggle;
              return (
                <li key={t.stage_key} className={t.client_can_toggle ? 'gate' : ''}>
                  <button
                    className={'check' + (done ? ' done' : '')}
                    disabled={!allowed}
                    onClick={() => onToggle(t)}
                    aria-label={`${t.label}: mark ${done ? 'not done' : 'done'}`}
                  >
                    {done ? '✓' : ''}
                  </button>
                  <span className="stage-label" style={{ color: done ? 'var(--text)' : 'var(--text-dim)' }}>
                    {t.label}{t.is_optional ? <span className="eyebrow" style={{ marginLeft: 6 }}>optional</span> : ''}
                  </span>
                  {done && row?.done_at && (
                    <span className="stamp">
                      {new Date(row.done_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
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
      </div>

      {viewing && <FileViewer file={viewing} onClose={() => setViewing(null)} />}
    </main>
  );
}
