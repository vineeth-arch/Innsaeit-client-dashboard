// src/pages/Dashboard.jsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth.jsx';
import ActivityFeed from '../components/ActivityFeed.jsx';
import { fetchClients, fetchProjects, createProject } from '../lib/api.js';

export default function Dashboard() {
  const { profile, isAdmin } = useAuth();
  const [clients, setClients] = useState([]);
  const [clientId, setClientId] = useState(null);
  const [projects, setProjects] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState('');
  const [vendor, setVendor] = useState('');
  const [buyer, setBuyer] = useState('');

  useEffect(() => {
    if (!profile) return;
    if (isAdmin) {
      fetchClients().then((cs) => {
        setClients(cs);
        setClientId((id) => id || cs[0]?.id || null);
      });
    } else {
      setClientId(profile.client_id);
    }
  }, [profile, isAdmin]);

  useEffect(() => {
    if (clientId) fetchProjects(clientId).then(setProjects);
  }, [clientId]);

  async function submitNew() {
    if (!name.trim()) return;
    await createProject(clientId, name.trim(), vendor.trim() || null, buyer.trim() || null);
    setName(''); setVendor(''); setBuyer(''); setShowNew(false);
    fetchProjects(clientId).then(setProjects);
  }

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Packaging pipeline</p>
          <h1 className="display">Projects</h1>
          <p className="sub">
            Every batch of SKUs, its live stage, and every file in one place.
            Nothing lives in an expiring link anymore.
          </p>
        </div>
        <div className="toolrow">
          {isAdmin && clients.length > 1 && (
            <select value={clientId || ''} onChange={(e) => setClientId(e.target.value)} style={{ width: 'auto' }}>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          {isAdmin && (
            <button className="btn primary" onClick={() => setShowNew(true)}>New project</button>
          )}
        </div>
      </div>

      {projects === null && <p className="eyebrow">Loading…</p>}
      {projects?.length === 0 && (
        <div className="empty">No projects yet. {isAdmin ? 'Create the first batch above.' : ''}</div>
      )}

      <div className="grid-cards">
        {projects?.map((p) => (
          <Link to={`/project/${p.id}`} key={p.id} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="card clickable">
              <p className="eyebrow">{p.vendor || 'Vendor TBC'}</p>
              <h3 className="display" style={{ fontSize: 20, margin: '6px 0 10px' }}>{p.name}</h3>
              <p style={{ color: 'var(--text-dim)', fontSize: 12.5, marginBottom: 12 }}>
                {p.skus?.length || 0} SKU{(p.skus?.length || 0) === 1 ? '' : 's'}
                {' · '}updated {new Date(p.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </p>
              {p.buyer && (
                <p style={{ color: 'var(--text-dim)', fontSize: 12.5, marginBottom: 12 }}>Buyer: {p.buyer}</p>
              )}
              <span className={'badge' + (p.status === 'active' ? ' mint' : '')}>{p.status.replace('_', ' ')}</span>
            </div>
          </Link>
        ))}
      </div>

      {clientId && <ActivityFeed clientId={clientId} />}

      {showNew && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setShowNew(false)}>
          <div className="card modal">
            <h2 className="display" style={{ fontSize: 22, marginBottom: 16 }}>New project</h2>
            <div className="field">
              <label className="eyebrow">Project name</label>
              <input type="text" placeholder="e.g. Youreka UNA 7 SKUs" value={name}
                     onChange={(e) => setName(e.target.value)} autoFocus />
            </div>
            <div className="field">
              <label className="eyebrow">Vendor / factory</label>
              <input type="text" placeholder="e.g. ChinaAlpha" value={vendor}
                     onChange={(e) => setVendor(e.target.value)} />
            </div>
            <div className="field">
              <label className="eyebrow">Buyer</label>
              <input type="text" placeholder="e.g. Lydia" value={buyer}
                     onChange={(e) => setBuyer(e.target.value)} />
            </div>
            <div className="toolrow" style={{ justifyContent: 'flex-end' }}>
              <button className="btn ghost" onClick={() => setShowNew(false)}>Cancel</button>
              <button className="btn primary" onClick={submitNew} disabled={!name.trim()}>Create project</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
