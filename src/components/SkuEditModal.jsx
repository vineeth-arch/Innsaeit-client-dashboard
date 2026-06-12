// src/components/SkuEditModal.jsx
// The full SKU edit form, shared by the SKU detail page (pencil button) and the
// project view (row Edit action). Mirrors the Add-SKU form field-for-field.
import { useState } from 'react';
import FormModal from './FormModal.jsx';
import SubBrandPicker from './SubBrandPicker.jsx';
import BentoChoice from './BentoChoice.jsx';
import { COMPLIANCE_OPTIONS, IM_OPTIONS, EXPORT_OPTIONS } from '../lib/skuForm.js';
import { updateSkuDetails } from '../lib/api.js';

function draftFrom(sku) {
  return {
    product_name: sku.product_name,
    hamleys_sku: sku.hamleys_sku || '',
    vendor_item_code: sku.vendor_item_code || '',
    sub_brand: sku.sub_brand || '',
    compliance_owner: sku.compliance_owner || 'internal',
    buyer_override: sku.buyer_override || '',
    buyer_email_override: sku.buyer_email_override || '',
    print_vendor: sku.print_vendor || '',
    second_gate: !!sku.second_gate,
    has_im: !!sku.has_im,
  };
}

export default function SkuEditModal({ sku, onClose, onSaved }) {
  const [d, setD] = useState(() => draftFrom(sku));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const dirty = Object.entries(draftFrom(sku)).some(([k, v]) => d[k] !== v);

  async function save() {
    if (!d.product_name.trim()) return;
    setBusy(true); setErr('');
    try {
      await updateSkuDetails(sku.id, {
        ...d,
        product_name: d.product_name.trim(),
        buyer_override: d.buyer_override.trim(),
        buyer_email_override: d.buyer_email_override.trim(),
        print_vendor: d.print_vendor.trim(),
      });
      onSaved?.();
      onClose();
    } catch (e) { setErr(e.message); setBusy(false); }
  }

  return (
    <FormModal
      title="Edit SKU details"
      dirty={dirty}
      onClose={onClose}
      onSave={save}
      saveDisabled={!d.product_name.trim()}
      busy={busy}
      error={err}
    >
      <div className="field">
        <label className="eyebrow">Product name</label>
        <input type="text" value={d.product_name} autoFocus
               onChange={(e) => setD({ ...d, product_name: e.target.value })} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="field">
          <label className="eyebrow">Hamleys SKU</label>
          <input type="text" placeholder="1032883" value={d.hamleys_sku}
                 onChange={(e) => setD({ ...d, hamleys_sku: e.target.value })} />
        </div>
        <div className="field">
          <label className="eyebrow">Vendor item code</label>
          <input type="text" placeholder="SK-901B" value={d.vendor_item_code}
                 onChange={(e) => setD({ ...d, vendor_item_code: e.target.value })} />
        </div>
      </div>
      <div className="field">
        <label className="eyebrow">Sub-brand</label>
        <SubBrandPicker value={d.sub_brand} onChange={(v) => setD({ ...d, sub_brand: v })} />
      </div>
      <div className="field">
        <label className="eyebrow">Compliance</label>
        <BentoChoice options={COMPLIANCE_OPTIONS} value={d.compliance_owner}
                     onChange={(v) => setD({ ...d, compliance_owner: v })} />
      </div>
      <div className="field">
        <label className="eyebrow">Instruction manual</label>
        <BentoChoice options={IM_OPTIONS} value={d.has_im}
                     onChange={(v) => setD({ ...d, has_im: v })} />
      </div>
      <div className="field">
        <label className="eyebrow">Buyer (overrides project buyer)</label>
        <input type="text" placeholder="Leave blank to inherit" value={d.buyer_override}
               onChange={(e) => setD({ ...d, buyer_override: e.target.value })} />
      </div>
      <div className="field">
        <label className="eyebrow">Buyer email (overrides project)</label>
        <input type="email" placeholder="Leave blank to inherit" value={d.buyer_email_override}
               onChange={(e) => setD({ ...d, buyer_email_override: e.target.value })} />
      </div>
      <div className="field">
        <label className="eyebrow">Print vendor</label>
        <input type="text" placeholder="Where final files go for printing" value={d.print_vendor}
               onChange={(e) => setD({ ...d, print_vendor: e.target.value })} />
      </div>
      <div className="field">
        <label className="eyebrow">Export SKU: needs both compliance gates</label>
        <BentoChoice options={EXPORT_OPTIONS} value={d.second_gate}
                     onChange={(v) => setD({ ...d, second_gate: v })} />
      </div>
    </FormModal>
  );
}
