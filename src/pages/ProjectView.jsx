// src/pages/ProjectView.jsx
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth/useAuth.jsx';
import StageRail from '../components/StageRail.jsx';
import {
  fetchProject, fetchSkus, fetchStageTemplates, createSku, toggleStage,
} from '../lib/api.js';

const SUB_BRANDS = ['', 'Ralleyz', 'Youreka', 'Snapkid', 'Miens', 'KSY', 'Other / none'];

export default function ProjectView() {
  const { projectId } = useParams();
  const { isAdmin } = useAuth();
  const [project, setProject] = useState(null);
  const [skus, setSkus] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [filter, setFilter] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [f, setF] = useState({ product_name: '', hamleys_sku: '', vendor_item_code: '', sub_brand: '', compliance_owner: 'internal', second_gate: false });

  async function load() {
    const p = await fetchProject(projectId);
    setProject(p);
    if (p) {
      setTemplates(await fetchStageTemplates(p.client_id));
      setSkus(await fetchSkus(projectId));
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
    await toggleStage(stageRow, done);
    setSkus(await fetchSkus(projectId));
  }

  async function submitNew() {
    if (!f.product_name.trim()) return;
    await createSku(project.client_id, projectId, {
      ...f,
      sub_brand: f.sub_brand === 'Other / none' ? null : f.sub_brand || null,
    });
    setF({ product_name: '', hamleys_sku: '', vendor_item_code: '', sub_brand: '', compliance_owner: 'internal', second_gate: false });
    setShowNew(false);
    setSkus(await fetchSkus(projectId));
  }

  function doneCount(s) {
    const required = templates.filter((t) => !t.is_optional).map((t) => t.stage_key);
    const done = (s.sku_stages || []).filter((r) => r.done && required.includes(r.stage_key)).length;
    return { done, total: required.length };
  }

  if (!project) return <main className="page"><p className="eyebrow">Loading…</p></main>;

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow"><Link to="/">Projects</Link> / {project.vendor || 'Vendor TBC'}</p>
          <h1 className="display">{project.name}</h1>
        </div>
        <div className="toolrow">
          <input type="text" placeholder="Search SKU, code, sub-brand…" value={filter}
                 onChange={(e) => setFilter(e.target.value)} style={{ width: 240 }} />
          {isAdmin && <button className="btn primary" onClick={() => setShowNew(true)}>Add SKU</button>}
        </div>
      </div>

      {visible?.length === 0 && <div className="empty">No SKUs match.</div>}

      {visible?.map((s) => {
        const c = doneCount(s);
        return (
          <div className="sku-row" key={s.id}>
            <div>
              <Link to={`/sku/${s.id}`} className="name" style={{ color: 'var(--text)' }}>{s.product_name}</Link>
              <div className="codes">
                {[s.hamleys_sku, s.vendor_item_code].filter(Boolean).join(' · ') || 'No codes yet'}
              </div>
              <div style={{ marginTop: 6 }}>
                {s.sub_brand && <span className="badge mint">{s.sub_brand}</span>}
                <span className="badge">{s.compliance_owner === 'internal' ? 'Compliance: Santosh' : 'Compliance: Hamleys HK/UK'}</span>
                {s.second_gate && <span className="badge">2nd gate</span>}
              </div>
            </div>
            <StageRail templates={templates} stages={s.sku_stages} canToggle={canToggle} onToggle={onToggle} />
            <div className="meta">
              {c.done}/{c.total} stages
              <div className="progress" style={{ width: 90, marginTop: 6 }}>
                <span style={{ width: `${(c.done / c.total) * 100}%` }} />
              </div>
            </div>
          </div>
        );
      })}

      {showNew && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setShowNew(false)}>
          <div className="card modal">
            <h2 className="display" style={{ fontSize: 22, marginBottom: 16 }}>Add SKU</h2>
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
              <select value={f.sub_brand} onChange={(e) => setF({ ...f, sub_brand: e.target.value })}>
                {SUB_BRANDS.map((b) => <option key={b} value={b}>{b || 'Select…'}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="eyebrow">Compliance owner</label>
              <select value={f.compliance_owner} onChange={(e) => setF({ ...f, compliance_owner: e.target.value })}>
                <option value="internal">Santosh (internal)</option>
                <option value="hamleys_hk_uk">Hamleys HK / UK QA</option>
              </select>
            </div>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, cursor: 'pointer' }}>
              <input type="checkbox" checked={f.second_gate}
                     onChange={(e) => setF({ ...f, second_gate: e.target.checked })}
                     style={{ width: 'auto' }} />
              <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>Export SKU: needs both compliance gates</span>
            </label>
            <div className="toolrow" style={{ justifyContent: 'flex-end' }}>
              <button className="btn ghost" onClick={() => setShowNew(false)}>Cancel</button>
              <button className="btn primary" onClick={submitNew} disabled={!f.product_name.trim()}>Add SKU</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
