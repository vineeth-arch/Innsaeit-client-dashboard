// src/components/StageRail.jsx
// The signature element: each SKU rendered as a production line.
// Mint nodes are done, the pulsing node is the current frontier,
// dashed nodes are optional stages, the larger node is the client gate.
import { useMemo } from 'react';

const SHORT_LABELS = {
  files_received: 'Files', brief_received: 'Brief', sub_brand_assigned: 'Sub-brand',
  buyer_reference: 'Buyer ref', callouts_finalized: 'Callouts', draft_1: 'Draft 1',
  corrections_received: 'Corrections', final_draft: 'Final draft',
  compliance_sent: 'Compliance', compliance_approved: 'Approved',
  final_approved_for_print: 'For print', sent_to_vendor: 'To vendor',
  mockup_received: 'Mock-up', in_production: 'Production',
};

const PINK_STAGES = new Set([
  'final_approved_for_print', 'sent_to_vendor', 'mockup_received', 'in_production',
]);

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

  const lastDoneIdx = useMemo(() => {
    let last = -1;
    for (let i = 0; i < templates.length; i++) {
      if (byKey[templates[i].stage_key]?.done) last = i;
    }
    return last;
  }, [templates, byKey]);

  return (
    <div className="rail" role="group" aria-label="Pipeline stages">
      {templates.map((t, i) => {
        const row = byKey[t.stage_key];
        const done = !!row?.done;
        const allowed = canToggle(t);
        return (
          <span key={t.stage_key} style={{ display: 'contents' }}>
            {i > 0 && (
              <span className={[
                'link',
                done ? 'done' : '',
                done && PINK_STAGES.has(t.stage_key) ? 'pink' : '',
              ].filter(Boolean).join(' ')} />
            )}
            <button
              type="button"
              className={[
                'node',
                done ? 'done' : '',
                done && PINK_STAGES.has(t.stage_key) ? 'pink' : '',
                i === frontierIdx ? 'frontier' : '',
                t.is_optional ? 'optional' : '',
                t.client_can_toggle ? 'client-gate' : '',
              ].filter(Boolean).join(' ')}
              disabled={!allowed}
              onClick={(e) => { e.stopPropagation(); allowed && row && onToggle(row, !done); }}
              aria-label={`${t.label}: ${done ? 'done' : 'pending'}`}
            >
              <span className="tip">
                {t.label}
                {done && row?.done_at
                  ? ' · ' + new Date(row.done_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                  : ''}
              </span>
              {i === lastDoneIdx && row?.done_at && (
                <span className="node-date">
                  {new Date(row.done_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </span>
              )}
              {i === lastDoneIdx && lastDoneIdx >= 0 && (
                <span className="node-label">{SHORT_LABELS[t.stage_key] ?? t.label}</span>
              )}
            </button>
          </span>
        );
      })}
    </div>
  );
}
