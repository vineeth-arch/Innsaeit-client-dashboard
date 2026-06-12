// src/components/BentoChoice.jsx
// Generic 2-tile (or N-tile) bento selector for discrete form choices —
// compliance market, IM yes/no, export gate. Each option carries a `tone`
// that colours its selected state (mint | green | red | neutral).
export default function BentoChoice({ options, value, onChange }) {
  return (
    <div className="bento-grid" role="radiogroup">
      {options.map((o) => {
        const selected = value === o.value;
        return (
          <button
            type="button"
            key={String(o.value)}
            role="radio"
            aria-checked={selected}
            className={'bento-tile' + (selected ? ` selected tone-${o.tone || 'mint'}` : '')}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
