// api/_emails/buyer-digest.js — daily buyer digest (only sent when non-empty).
// NO JSX (see base.js).
import { h, Base, Section, Rows, Lines, Empty } from './base.js';

export const subject = ({ date }) => `Your artwork update (${date})`;

// newFiles:     [{ kind, title, sku }]
// stageChanges: [{ stage, sku, when }]
// awaiting:     [{ sku, codes, project }]   (compliance approved, your approval pending)
export function BuyerDigest({ appUrl, date, buyerName, newFiles, stageChanges, awaiting }) {
  return Base({
    title: `Artwork update · ${date}`,
    preview: awaiting.length ? `${awaiting.length} SKU(s) awaiting your approval` : 'Updates on your SKUs',
    appUrl,
    children: [
      buyerName
        ? h('p', { key: 'hi', style: { fontSize: 13, margin: '0 0 18px' } }, `Hi ${buyerName},`)
        : null,
      h(Section, { key: 'a', heading: 'Awaiting your approval' },
        awaiting.length
          ? h(Rows, {
              columns: [
                { key: 'sku', label: 'SKU' }, { key: 'codes', label: 'Codes' },
                { key: 'project', label: 'Project' },
              ],
              rows: awaiting,
            })
          : Empty('Nothing awaiting approval.')),
      h(Section, { key: 'b', heading: 'New files yesterday' },
        newFiles.length
          ? h(Lines, { items: newFiles.map((f) => `${f.kind}: ${f.title} — ${f.sku}`) })
          : Empty('No new files.')),
      h(Section, { key: 'c', heading: 'Stage updates yesterday' },
        stageChanges.length
          ? h(Lines, { items: stageChanges.map((s) => `${s.stage} done — ${s.sku} (${s.when})`) })
          : Empty('No stage updates.')),
    ],
  });
}
