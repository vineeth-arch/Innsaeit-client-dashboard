// api/_emails/admin-digest.js — daily admin digest. NO JSX (see base.js).
import { h, Base, Section, Rows, Lines, Empty, C } from './base.js';

export const subject = ({ date }) => `Tracker digest — needs your action (${date})`;

// needsAction: [{ sku, codes, project, reason }]
// activity:   [{ who, what, sku, when }]   (yesterday, non-admin actors only)
// tally:      { activeSkus, awaiting }
export function AdminDigest({ appUrl, date, needsAction, activity, tally }) {
  return Base({
    title: `Daily digest · ${date}`,
    preview: `${needsAction.length} SKU(s) need your action`,
    appUrl,
    children: [
      h(Section, { key: 'a', heading: 'Needs your action' },
        needsAction.length
          ? h(Rows, {
              columns: [
                { key: 'sku', label: 'SKU' }, { key: 'codes', label: 'Codes' },
                { key: 'project', label: 'Project' }, { key: 'reason', label: 'Why' },
              ],
              rows: needsAction,
            })
          : Empty('Nothing needs your action.')),
      h(Section, { key: 'b', heading: 'Client activity yesterday' },
        activity.length
          ? h(Lines, { items: activity.map((a) => `${a.who} ${a.what} — ${a.sku} (${a.when})`) })
          : Empty('No client activity yesterday.')),
      h('p', { key: 'c', style: { fontSize: 13, color: C.dim, margin: 0 } },
        `${tally.activeSkus} active SKU(s) · ${tally.awaiting} awaiting admin action.`),
    ],
  });
}
