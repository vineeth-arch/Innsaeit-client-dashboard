// src/pages/ProjectView.jsx
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/useAuth.jsx';
import StageRail from '../components/StageRail.jsx';
import FormModal from '../components/FormModal.jsx';
import SubBrandPicker from '../components/SubBrandPicker.jsx';
import BentoChoice from '../components/BentoChoice.jsx';
import SkuEditModal from '../components/SkuEditModal.jsx';
import ProjectEditModal from '../components/ProjectEditModal.jsx';
import { PencilIcon, CopyIcon } from '../components/icons.jsx';
import { COMPLIANCE_OPTIONS, IM_OPTIONS, EXPORT_OPTIONS } from '../lib/skuForm.js';
import {
  fetchProject, fetchSkus, fetchStageTemplates, createSku, toggleStage,
  effectiveBuyer, fetchProjectChecklistSummary,
  updateProjectStatus, notifyComplianceApproved, duplicateSku,
} from '../lib/api.js';
import { STATUS_OPTIONS, STATUS_LABEL, statusBadgeClass, isActive } from '../lib/status.js';
import { buildProjectCsv, downloadCsv, projectCsvFilename, buildProjectSummary } from '../lib/export.js';

export default function ProjectView() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [project, setProject] = useState(null);
  const [skus, setSkus] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [filter, setFilter] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [f, setF] = useState({ product_name: '', hamleys_sku: '', vendor_item_code: '', sub_brand: '', compliance_owner: 'internal', second_gate: false, buyer_override: '', buyer_email_override: '', has_im: false, print_vendor: '' });
  // project edit + per-row SKU edit/duplicate state
  const [editingProject, setEditingProject] = useState(false);
  const [editingSku, setEditingSku] = useState(null);
  const [dupBusyId, setDupBusyId] = useState(null);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState('');
  const [checklistSummary, setChecklistSummary] = useState({});

  // { sku_id: { done, total } } for the compliance checklist chip. RLS scopes
  // rows, so clients only ever get counts for SKUs assigned to them.
  async function loadChecklistSummary(list) {
    const rows = await fetchProjectChecklistSummary((list || []).map((s) => s.id));
    setChecklistSummary(rows.reduce((acc, r) => {
      const c = acc[r.sku_id] || (acc[r.sku_id] = { done: 0, total: 0 });
      c.total += 1;
      if (r.checked) c.done += 1;
      return acc;
    }, {}));
  }

  async function load() {
    const p = await fetchProject(projectId);
    setProject(p);
    if (p) {
      setTemplates(await fetchStageTemplates(p.client_id));
      const list = await fetchSkus(projectId);
      setSkus(list);
      loadChecklistSummary(list);
    }
  }
  useEffect(() => { load(); }, [projectId]);

  const visible = useMemo(() => {
    if (!skus) return null;
    const q = filter.toLowerCase();
    if (!q) return skus;
    return skus.filter((s) =>
      [s.product_name, s.hamleys_sku, s.vendor_item_code, s.sub_brand]
        .filter(Boolean).some((v) => v.toLowerCase().includes(q))
    );
  }, [skus, filter]);

  const canToggle = (tpl) => isAdmin || tpl.client_can_toggle;

  async function onToggle(stageRow, done) {
    setErr('');
    try {
      await toggleStage(stageRow, done);
      // The single live email: compliance approval. Fire-and-forget — the
      // server re-verifies and dedupes, a failure never blocks the toggle.
      if (done && stageRow.stage_key === 'compliance_approved') notifyComplianceApproved(stageRow.sku_id);
      setSkus(await fetchSkus(projectId));
    } catch (e) {
      setErr(e.message || 'Could not update stage.');
    }
  }

  async function submitNew() {
    if (!f.product_name.trim()) return;
    setErr('');
    try {
      await createSku(project.client_id, projectId, {
        ...f,
        sub_brand: f.sub_brand || null,
        buyer_override: f.buyer_override.trim() || null,
        buyer_email_override: f.buyer_email_override.trim() || null,
        print_vendor: f.print_vendor.trim() || null,
      });
      setF({ product_name: '', hamleys_sku: '', vendor_item_code: '', sub_brand: '', compliance_owner: 'internal', second_gate: false, buyer_override: '', buyer_email_override: '', has_im: false, print_vendor: '' });
      setShowNew(false);
      const list = await fetchSkus(projectId);
      setSkus(list);
      loadChecklistSummary(list);
    } catch (e) {
      setErr(e.message || 'Could not add SKU.');
    }
  }

  async function refreshSkus() {
    const list = await fetchSkus(projectId);
    setSkus(list);
    loadChecklistSummary(list);
  }

  async function onDuplicateSku(e, s) {
    e.stopPropagation();
    setDupBusyId(s.id); setErr('');
    try {
      await duplicateSku(s);
      await refreshSkus();
    } catch (e2) {
      setErr(e2.message || 'Could not duplicate SKU.');
    } finally {
      setDupBusyId(null);
    }
  }

  async function onProjectStatus(status) {
    setErr('');
    try {
      await updateProjectStatus(project.id, status);
      setProject(await fetchProject(projectId));
    } catch (e) {
      setErr(e.message || 'Could not update status.');
    }
  }

  function onExportCsv() {
    const csv = buildProjectCsv(project, skus, templates, effectiveBuyer);
    downloadCsv(projectCsvFilename(project), csv);
  }

  async function onCopySummary() {
    setErr('');
    try {
      await navigator.clipboard.writeText(buildProjectSummary(project, skus, templates));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setErr('Could not copy to clipboard.');
    }
  }

  function doneCount(s) {
    const required = templates.filter((t) => !t.is_optional).map((t) => t.stage_key);
    const done = (s.sku_stages || []).filter((r) => r.done && required.includes(r.stage_key)).length;
    return { done, total: required.length };
  }

  if (!project) return <main className="page"><p className="eyebrow">Loading…</p></main>;

  function renderSkuRow(s, inactive = false) {
    const c = doneCount(s);
    return (
      <div
        className={'sku-row' + (inactive ? ' inactive' : '')}
        key={s.id}
        onClick={() => navigate(`/sku/${s.id}`)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && navigate(`/sku/${s.id}`)}
        aria-label={`Open ${s.product_name}`}
      >
        <div>
          <Link to={`/sku/${s.id}`} className="name" style={{ color: 'var(--text)' }}>{s.product_name}</Link>
          <div className="codes">
            {[s.hamleys_sku, s.vendor_item_code].filter(Boolean).join(' · ') || 'No codes yet'}
          </div>
          <div style={{ marginTop: 6 }}>
            {s.status && s.status !== 'active' && (
              <span className={statusBadgeClass(s.status) + ' xs'}>{STATUS_LABEL[s.status] || s.status}</span>
            )}
            {s.sub_brand && <span className="badge mint xs">{s.sub_brand}</span>}
            <span className="badge xs">{s.compliance_owner === 'internal' ? 'Santosh – India' : 'Emily – Global'}</span>
            <span className={'badge xs' + (s.has_im ? (s.im_done ? ' mint-solid' : ' mint') : ' danger')}
                  title={s.has_im ? (s.im_done ? 'Instruction manual artwork done' : 'Instruction manual present') : 'No instruction manual'}>
              IM {s.has_im ? 'Yes' : 'No'}
            </span>
            {(() => {
              const cs = checklistSummary[s.id];
              return cs && cs.total > 0 && cs.done === cs.total
                ? <span className="badge mint xs">✓ Compliance</span>
                : null;
            })()}
            {s.second_gate && <span className="badge xs">2nd gate</span>}
            {s.changes_requested && <span className="badge amber xs">Changes requested</span>}
            {effectiveBuyer(s, project.buyer) && (
              <span className="badge xs">Buyer: {effectiveBuyer(s, project.buyer)}</span>
            )}
          </div>
        </div>
        <StageRail templates={templates} stages={s.sku_stages} canToggle={canToggle} onToggle={onToggle} />
        <div className="meta">
          {isAdmin && (
            <div className="row-actions">
              <button className="btn ghost sm icon"
                      onClick={(e) => { e.stopPropagation(); setEditingSku(s); }}
                      aria-label={`Edit ${s.product_name}`} title="Edit SKU">
                <PencilIcon />
              </button>
              <button className="btn ghost sm icon"
                      onClick={(e) => onDuplicateSku(e, s)} disabled={dupBusyId === s.id}
                      aria-label={`Duplicate ${s.product_name}`} title="Duplicate SKU">
                <CopyIcon />
              </button>
            </div>
          )}
          {c.done}/{c.total} stages
          <div className="progress" style={{ width: 90, marginTop: 6 }}>
            <span style={{ width: `${(c.done / c.total) * 100}%` }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow"><Link to="/">Projects</Link> / {project.vendor || 'Vendor TBC'}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 className="display">{project.name}</h1>
            {isAdmin && (
              <button className="btn ghost sm icon" onClick={() => setEditingProject(true)}
                      aria-label="Edit project details" title="Edit project details">
                <PencilIcon />
              </button>
            )}
          </div>
          {(project.buyer || isAdmin) && (
            <p className="sub" style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
              {project.buyer ? <span>Buyer: {project.buyer}</span> : <span style={{ color: 'var(--text-faint)' }}>No buyer set</span>}
              {project.buyer_email && (
                <span style={{ color: 'var(--text-faint)', fontSize: 12.5 }}>({project.buyer_email})</span>
              )}
            </p>
          )}
        </div>
        <div className="toolrow">
          {isAdmin ? (
            <select value={project.status} onChange={(e) => onProjectStatus(e.target.value)}
                    aria-label="Project status" style={{ width: 'auto' }}>
              {STATUS_OPTIONS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
            </select>
          ) : (
            project.status !== 'active' && (
              <span className={statusBadgeClass(project.status)}>{STATUS_LABEL[project.status] || project.status}</span>
            )
          )}
          <input type="text" placeholder="Search SKU, code, sub-brand…" value={filter}
                 onChange={(e) => setFilter(e.target.value)} style={{ width: 240 }} />
          <button className="btn" onClick={onExportCsv} disabled={!skus || !templates.length}>Export CSV</button>
          <button className="btn" onClick={onCopySummary} disabled={!skus || !templates.length}>
            {copied ? 'Copied' : 'Copy summary'}
          </button>
          {isAdmin && <button className="btn primary" onClick={() => { setErr(''); setShowNew(true); }}>Add SKU</button>}
        </div>
      </div>

      {visible?.length === 0 && <div className="empty">No SKUs match.</div>}

      {visible?.filter(isActive).map((s) => renderSkuRow(s))}

      {(visible?.filter((s) => !isActive(s)).length ?? 0) > 0 && (
        <>
          <p className="eyebrow" style={{ margin: '24px 0 10px' }}>Done &amp; inactive</p>
          {visible.filter((s) => !isActive(s)).map((s) => renderSkuRow(s, true))}
        </>
      )}

      {showNew && (
        <FormModal
          title="Add SKU"
          dirty={!!(f.product_name || f.hamleys_sku || f.vendor_item_code || f.sub_brand
            || f.buyer_override || f.buyer_email_override || f.print_vendor
            || f.second_gate || f.has_im || f.compliance_owner !== 'internal')}
          onClose={() => { setErr(''); setShowNew(false); }}
          onSave={submitNew}
          saveLabel="Add SKU"
          saveDisabled={!f.product_name.trim()}
          error={err}
        >
            <div className="field">
              <label className="eyebrow">Product name</label>
              <input type="text" placeholder="e.g. Color Reveal Mystery" value={f.product_name}
                     onChange={(e) => setF({ ...f, product_name: e.target.value })} autoFocus />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="field">
                <label className="eyebrow">Hamleys SKU</label>
                <input type="text" placeholder="1032883" value={f.hamleys_sku}
                       onChange={(e) => setF({ ...f, hamleys_sku: e.target.value })} />
              </div>
              <div className="field">
                <label className="eyebrow">Vendor item code</label>
                <input type="text" placeholder="SK-901B" value={f.vendor_item_code}
                       onChange={(e) => setF({ ...f, vendor_item_code: e.target.value })} />
              </div>
            </div>
            <div className="field">
              <label className="eyebrow">Sub-brand</label>
              <SubBrandPicker value={f.sub_brand} onChange={(v) => setF({ ...f, sub_brand: v })} />
            </div>
            <div className="field">
              <label className="eyebrow">Compliance</label>
              <BentoChoice options={COMPLIANCE_OPTIONS} value={f.compliance_owner}
                           onChange={(v) => setF({ ...f, compliance_owner: v })} />
            </div>
            <div className="field">
              <label className="eyebrow">Instruction manual</label>
              <BentoChoice options={IM_OPTIONS} value={f.has_im}
                           onChange={(v) => setF({ ...f, has_im: v })} />
            </div>
            <div className="field">
              <label className="eyebrow">Buyer (overrides project buyer)</label>
              <input type="text" placeholder="Leave blank to inherit" value={f.buyer_override}
                     onChange={(e) => setF({ ...f, buyer_override: e.target.value })} />
            </div>
            <div className="field">
              <label className="eyebrow">Buyer email (overrides project)</label>
              <input type="email" placeholder="Leave blank to inherit" value={f.buyer_email_override}
                     onChange={(e) => setF({ ...f, buyer_email_override: e.target.value })} />
            </div>
            <div className="field">
              <label className="eyebrow">Print vendor</label>
              <input type="text" placeholder="Where final files go for printing" value={f.print_vendor}
                     onChange={(e) => setF({ ...f, print_vendor: e.target.value })} />
            </div>
            <div className="field">
              <label className="eyebrow">Export SKU: needs both compliance gates</label>
              <BentoChoice options={EXPORT_OPTIONS} value={f.second_gate}
                           onChange={(v) => setF({ ...f, second_gate: v })} />
            </div>
        </FormModal>
      )}

      {editingProject && (
        <ProjectEditModal
          project={project}
          onClose={() => setEditingProject(false)}
          onSaved={load}
        />
      )}

      {editingSku && (
        <SkuEditModal
          sku={editingSku}
          onClose={() => setEditingSku(null)}
          onSaved={refreshSkus}
        />
      )}
    </main>
  );
}
