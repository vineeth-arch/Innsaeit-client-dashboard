// src/components/SubBrandPicker.jsx
// 2-column bento grid of the fixed sub-brand names, plus "N.A." (no sub-brand)
// and "Other" (type a custom value). sub_brand stays free text — N.A. saves as
// "" (→ null), Other saves whatever is typed. A stored value not in the list
// (e.g. a legacy sub-brand) opens in Other mode so it stays editable.
import { useState } from 'react';
import { SUB_BRANDS } from '../lib/status.js';

export default function SubBrandPicker({ value, onChange }) {
  const [otherMode, setOtherMode] = useState(!!value && !SUB_BRANDS.includes(value));

  const naSelected = !otherMode && !value;

  return (
    <>
      <div className="bento-grid" role="listbox" aria-label="Sub-brand">
        {SUB_BRANDS.map((b) => {
          const selected = !otherMode && value === b;
          return (
            <button
              type="button" key={b} role="option" aria-selected={selected}
              className={'bento-tile' + (selected ? ' selected tone-mint' : '')}
              onClick={() => { setOtherMode(false); onChange(b); }}
            >
              {b}
            </button>
          );
        })}
        <button
          type="button" role="option" aria-selected={naSelected}
          className={'bento-tile' + (naSelected ? ' selected tone-mint' : '')}
          onClick={() => { setOtherMode(false); onChange(''); }}
        >
          N.A.
        </button>
        <button
          type="button" role="option" aria-selected={otherMode}
          className={'bento-tile' + (otherMode ? ' selected tone-mint' : '')}
          onClick={() => { setOtherMode(true); if (SUB_BRANDS.includes(value)) onChange(''); }}
        >
          Other
        </button>
      </div>
      {otherMode && (
        <input
          type="text" placeholder="Type the sub-brand…" value={value}
          onChange={(e) => onChange(e.target.value)} autoFocus
          style={{ marginTop: 8 }}
        />
      )}
    </>
  );
}
