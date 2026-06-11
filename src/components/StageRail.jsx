// src/components/StageRail.jsx
// The signature element: each SKU rendered as a production line.
// Mint nodes are done, the pulsing node is the current frontier,
// dashed nodes are optional stages, the larger node is the client gate.
import { useMemo } from 'react';

export default function StageRail({ templates, stages, canToggle, onToggle }) {
  const byKey = useMemo(
    () => Object.fromEntries((stages || []).map((s) => [s.stage_key, s])),
    [stages]
  );

  const frontierIdx = useMemo(() => {
    for (let i = 0; i < templates.length; i++) {
      const row = byKey[templates[i].stage_key];
      if (!row?.done && !templates[i].is_optional) return i;
    }
    return -1;
  }, [templates, byKey]);

  return (
    <div className="rail" role="group" aria-label="Pipeline stages">
      {templates.map((t, i) => {
        const row = byKey[t.stage_key];
        const done = !!row?.done;
        const allowed = canToggle(t);
        return (
          <span key={t.stage_key} style={{ display: 'contents' }}>
            {i > 0 && <span className={'link' + (done ? ' done' : '')} />}
            <button
              type="button"
              className={[
                'node',
                done ? 'done' : '',
                i === frontierIdx ? 'frontier' : '',
                t.is_optional ? 'optional' : '',
                t.client_can_toggle ? 'client-gate' : '',
              ].join(' ')}
              disabled={!allowed}
              onClick={() => allowed && row && onToggle(row, !done)}
              aria-label={`${t.label}: ${done ? 'done' : 'pending'}`}
            >
              <span className="tip">
                {t.label}
                {done && row?.done_at
                  ? ' · ' + new Date(row.done_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                  : ''}
              </span>
            </button>
          </span>
        );
      })}
    </div>
  );
}
