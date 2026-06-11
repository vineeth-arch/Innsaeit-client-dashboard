// src/components/ActivityFeed.jsx
// Read-only "Recent activity" panel: merges stage completions, comments and
// file additions for one tenant. RLS already scopes what each user can read;
// the explicit clientId keeps an admin's feed in sync with the client selector.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchRecentStageActivity, fetchRecentComments, fetchRecentFiles, fetchStageTemplates,
} from '../lib/api.js';

const KIND_LABEL = {
  brief_text: 'Brief (text)', brief_file: 'Brief', reference: 'Reference',
  draft: 'Draft', compliance_feedback: 'Compliance', mockup: 'Mock-up',
  final_print: 'Final print', external_link: 'Link', other: 'File',
};

export function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

const who = (p) => p?.full_name || p?.email || 'Someone';

export default function ActivityFeed({ clientId }) {
  const [items, setItems] = useState(null);

  useEffect(() => {
    if (!clientId) return;
    let alive = true;
    (async () => {
      try {
        const [stages, comments, files, templates] = await Promise.all([
          fetchRecentStageActivity(clientId),
          fetchRecentComments(clientId),
          fetchRecentFiles(clientId),
          fetchStageTemplates(clientId),
        ]);
        const labelByKey = Object.fromEntries(templates.map((t) => [t.stage_key, t.label]));
        const merged = [
          ...stages.map((r) => ({
            id: `s-${r.id}`, ts: r.done_at, skuId: r.sku_id,
            text: `${who(r.actor)} marked ${labelByKey[r.stage_key] || r.stage_key} done on ${r.skus?.product_name || 'a SKU'}`,
          })),
          ...comments.map((r) => ({
            id: `c-${r.id}`, ts: r.created_at, skuId: r.sku_id,
            text: `${who(r.author)} commented on ${r.skus?.product_name || 'a SKU'}`,
          })),
          ...files.map((r) => ({
            id: `f-${r.id}`, ts: r.created_at, skuId: r.sku_id,
            text: `${who(r.uploader)} added ${KIND_LABEL[r.kind] || r.kind}: ${r.title} on ${r.skus?.product_name || 'a SKU'}`,
          })),
        ].sort((a, b) => new Date(b.ts) - new Date(a.ts)).slice(0, 15);
        if (alive) setItems(merged);
      } catch {
        if (alive) setItems([]);
      }
    })();
    return () => { alive = false; };
  }, [clientId]);

  if (!items?.length) return null;
  return (
    <div className="card activity-feed">
      <span className="eyebrow">Recent activity</span>
      <div style={{ marginTop: 6 }}>
        {items.map((it) => (
          <Link to={`/sku/${it.skuId}`} key={it.id} className="activity-row">
            <span className="activity-text">{it.text}</span>
            <span className="activity-when">{timeAgo(it.ts)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
