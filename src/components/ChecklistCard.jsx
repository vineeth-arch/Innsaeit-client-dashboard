// src/components/ChecklistCard.jsx
// One card per checklist audience. Used twice on SkuDetail: the admin-only
// "internal" list (amber) and the compliance list (mint). Visibility is decided
// by the parent; this component only renders what it is given.
import { useState } from 'react';

export default function ChecklistCard({
  accent,    // 'amber' | 'mint'
  title,
  chip,      // ReactNode shown next to the title
  items,
  canTick,
  canEdit,   // admin: add custom items + delete items
  onToggle,  // (item) => Promise
  onAdd,     // (label) => Promise
  onDelete,  // (item) => Promise
  hint,      // optional helper line (e.g. power type not set)
}) {
  const [newLabel, setNewLabel] = useState('');
  const done = items.filter((i) => i.checked).length;

  async function submitAdd() {
    if (!newLabel.trim()) return;
    await onAdd(newLabel.trim());
    setNewLabel('');
  }

  return (
    <div className={`card checklist-card ${accent}`}>
      <div className="toolrow" style={{ justifyContent: 'space-between' }}>
        <div className="toolrow">
          <span className="eyebrow">{title}</span>
          {chip}
        </div>
        <span className="checklist-progress">{done}/{items.length}</span>
      </div>

      {hint && <p className="checklist-hint">{hint}</p>}

      {items.length === 0 ? (
        <p style={{ color: 'var(--text-faint)', fontSize: 13, marginTop: 10 }}>
          No items yet — use Load checklist.
        </p>
      ) : (
        <ul className="stage-list" style={{ marginTop: 8 }}>
          {items.map((item) => (
            <li key={item.id}>
              <button
                className={'check' + (item.checked ? ' done' : '')}
                disabled={!canTick}
                onClick={() => onToggle(item)}
                aria-label={`${item.label}: mark ${item.checked ? 'not done' : 'done'}`}
              >
                {item.checked ? '✓' : ''}
              </button>
              <span className="stage-label" style={{ color: item.checked ? 'var(--text)' : 'var(--text-dim)' }}>
                {item.label}
              </span>
              {item.checked && item.checked_at && (
                <span className="stamp">
                  {new Date(item.checked_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  {item.checker ? ` · ${item.checker.full_name || item.checker.email}` : ''}
                </span>
              )}
              {canEdit && (
                <button className="btn ghost sm comment-delete" onClick={() => onDelete(item)}
                        aria-label={`Delete "${item.label}"`}>×</button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <div className="checklist-add">
          <input type="text" placeholder="Add a custom item…" value={newLabel}
                 onChange={(e) => setNewLabel(e.target.value)}
                 onKeyDown={(e) => e.key === 'Enter' && submitAdd()} />
          <button className="btn sm" onClick={submitAdd} disabled={!newLabel.trim()}>Add</button>
        </div>
      )}
    </div>
  );
}
