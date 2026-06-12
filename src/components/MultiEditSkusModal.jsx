// src/components/MultiEditSkusModal.jsx
// Admin bulk multi-edit dialog. Every field starts in a "leave unchanged" state
// — only fields whose enable checkbox is ticked are written. Untouched fields
// are never added to `changes`, so they never overwrite anything.
import { useState } from 'react';
import FormModal from './FormModal.jsx';
import SubBrandPicker from './SubBrandPicker.jsx';
import BentoChoice from './BentoChoice.jsx';
import { COMPLIANCE_OPTIONS, IM_OPTIONS, POWER_TYPES } from '../lib/skuForm.js';
import { bulkUpdateSkus } from '../lib/api.js';

function Field({ enabled, onToggle, label, children }) {
  return (
    <div className="field" style={{ opacity: enabled ? 1 : 0.55 }}>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer', marginBottom: 6 }}>
        <input type="checkbox" checked={enabled} onChange={onToggle} style={{ width: 'auto' }} />
        <span className="eyebrow" style={{ display: 'inline' }}>{label}</span>
      </label>
      {enabled && <div>{children}</div>}
    </div>
  );
}

export default function MultiEditSkusModal({ skus, templates, onClose, onApplied }) {
  const n = skus.length;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // Per-field enable flags + values.
  const [on, setOn] = useState({});
  const [v, setV] = useState({
    sub_brand: '', compliance_owner: 'internal', buyer_override: '',
    buyer_email_override: '', print_vendor: '', power_type: 'unknown',
    has_im: false, mark_stage_done: templates[0]?.stage_key || '',
  });
  const toggle = (k) => setOn((o) => ({ ...o, [k]: !o[k] }));
  const set = (k, val) => setV((s) => ({ ...s, [k]: val }));

  const anyEnabled = Object.values(on).some(Boolean);

  function buildChanges() {
    const c = {};
    if (on.sub_brand) c.sub_brand = v.sub_brand;
    if (on.compliance_owner) c.compliance_owner = v.compliance_owner;
    if (on.buyer) { c.buyer_override = v.buyer_override; c.buyer_email_override = v.buyer_email_override; }
    if (on.print_vendor) c.print_vendor = v.print_vendor;
    if (on.power_type) c.power_type = v.power_type;
    if (on.has_im) c.has_im = v.has_im;
    if (on.mark_stage_done && v.mark_stage_done) c.mark_stage_done = v.mark_stage_done;
    return c;
  }

  async function apply() {
    const changes = buildChanges();
    if (!Object.keys(changes).length) return;
    setBusy(true); setErr('');
    try {
      const result = await bulkUpdateSkus(skus, changes);
      onApplied(result);
      onClose();
    } catch (e) { setErr(e.message || 'Bulk update failed.'); setBusy(false); }
  }

  return (
    <FormModal
      title={`Multi-edit ${n} SKU${n === 1 ? '' : 's'}`}
      dirty={anyEnabled}
      onClose={onClose}
      onSave={apply}
      saveLabel={`Apply to ${n} SKU${n === 1 ? '' : 's'}`}
      saveDisabled={!anyEnabled}
      busy={busy}
      error={err}
    >
      <p style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 14 }}>
        Tick a field to change it on all {n} selected SKUs. Unticked fields are left exactly as they are.
      </p>

      <Field enabled={!!on.sub_brand} onToggle={() => toggle('sub_brand')} label="Sub-brand">
        <SubBrandPicker value={v.sub_brand} onChange={(val) => set('sub_brand', val)} />
      </Field>

      <Field enabled={!!on.compliance_owner} onToggle={() => toggle('compliance_owner')} label="Compliance market">
        <BentoChoice options={COMPLIANCE_OPTIONS} value={v.compliance_owner}
                     onChange={(val) => set('compliance_owner', val)} />
      </Field>

      <Field enabled={!!on.buyer} onToggle={() => toggle('buyer')} label="Buyer override (blank clears it)">
        <input type="text" placeholder="Buyer name" value={v.buyer_override}
               onChange={(e) => set('buyer_override', e.target.value)} style={{ marginBottom: 8 }} />
        <input type="email" placeholder="Buyer email" value={v.buyer_email_override}
               onChange={(e) => set('buyer_email_override', e.target.value)} />
      </Field>

      <Field enabled={!!on.print_vendor} onToggle={() => toggle('print_vendor')} label="Print vendor">
        <input type="text" placeholder="Where final files go for printing" value={v.print_vendor}
               onChange={(e) => set('print_vendor', e.target.value)} />
      </Field>

      <Field enabled={!!on.power_type} onToggle={() => toggle('power_type')} label="Power type (regenerates checklists)">
        <select value={v.power_type} onChange={(e) => set('power_type', e.target.value)}>
          {POWER_TYPES.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
        </select>
      </Field>

      <Field enabled={!!on.has_im} onToggle={() => toggle('has_im')} label="Instruction manual (regenerates checklists)">
        <BentoChoice options={IM_OPTIONS} value={v.has_im} onChange={(val) => set('has_im', val)} />
      </Field>

      <Field enabled={!!on.mark_stage_done} onToggle={() => toggle('mark_stage_done')} label="Mark stage as done (only ticks, never unticks)">
        <select value={v.mark_stage_done} onChange={(e) => set('mark_stage_done', e.target.value)}>
          {templates.map((t) => <option key={t.stage_key} value={t.stage_key}>{t.label}</option>)}
        </select>
      </Field>
    </FormModal>
  );
}
