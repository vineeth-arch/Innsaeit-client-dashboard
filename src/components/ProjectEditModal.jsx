// src/components/ProjectEditModal.jsx
// The project edit form, shared by the project view (title pencil) and the
// dashboard project cards (card Edit action). Mirrors the New-project form.
import { useState } from 'react';
import FormModal from './FormModal.jsx';
import { updateProjectDetails } from '../lib/api.js';

function draftFrom(project) {
  return {
    name: project.name,
    vendor: project.vendor || '',
    buyer: project.buyer || '',
    buyer_email: project.buyer_email || '',
  };
}

export default function ProjectEditModal({ project, onClose, onSaved }) {
  const [pd, setPd] = useState(() => draftFrom(project));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const dirty = Object.entries(draftFrom(project)).some(([k, v]) => pd[k] !== v);

  async function save() {
    if (!pd.name.trim()) return;
    setBusy(true); setErr('');
    try {
      await updateProjectDetails(project.id, {
        ...pd,
        name: pd.name.trim(),
        vendor: pd.vendor.trim(),
        buyer: pd.buyer.trim(),
        buyer_email: pd.buyer_email.trim(),
      });
      onSaved?.();
      onClose();
    } catch (e) { setErr(e.message || 'Could not save project.'); setBusy(false); }
  }

  return (
    <FormModal
      title="Edit project"
      dirty={dirty}
      onClose={onClose}
      onSave={save}
      saveDisabled={!pd.name.trim()}
      busy={busy}
      error={err}
    >
      <div className="field">
        <label className="eyebrow">Project name</label>
        <input type="text" placeholder="e.g. Youreka UNA 7 SKUs" value={pd.name} autoFocus
               onChange={(e) => setPd({ ...pd, name: e.target.value })} />
      </div>
      <div className="field">
        <label className="eyebrow">Vendor / factory</label>
        <input type="text" placeholder="e.g. ChinaAlpha" value={pd.vendor}
               onChange={(e) => setPd({ ...pd, vendor: e.target.value })} />
      </div>
      <div className="field">
        <label className="eyebrow">Buyer</label>
        <input type="text" placeholder="e.g. Lydia" value={pd.buyer}
               onChange={(e) => setPd({ ...pd, buyer: e.target.value })} />
      </div>
      <div className="field">
        <label className="eyebrow">Buyer email (for daily digests)</label>
        <input type="email" placeholder="e.g. lydia@hamleys.com" value={pd.buyer_email}
               onChange={(e) => setPd({ ...pd, buyer_email: e.target.value })} />
      </div>
    </FormModal>
  );
}
