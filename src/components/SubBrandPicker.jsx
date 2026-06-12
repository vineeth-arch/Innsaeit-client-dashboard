// src/components/SubBrandPicker.jsx
// 2-column bento grid of the fixed sub-brand names. Click selects; clicking
// the selected tile again clears to "" (no sub-brand). A legacy value not in
// the list simply shows nothing selected and is kept until a tile is picked.
import { SUB_BRANDS } from '../lib/status.js';

export default function SubBrandPicker({ value, onChange }) {
  return (
    <div className="subbrand-grid" role="listbox" aria-label="Sub-brand">
      {SUB_BRANDS.map((b) => {
        const selected = value === b;
        return (
          <button
            type="button"
            key={b}
            role="option"
            aria-selected={selected}
            className={'subbrand-tile' + (selected ? ' selected' : '')}
            onClick={() => onChange(selected ? '' : b)}
          >
            {b}
          </button>
        );
      })}
    </div>
  );
}
