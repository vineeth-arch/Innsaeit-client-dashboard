// api/_emails/checker-digest.js — daily compliance-checker digest (only sent
// when there is pending work). NO JSX (see base.js).
import { h, Base, Section, Rows } from './base.js';

export const subject = ({ date }) => `Compliance checks pending (${date})`;

// pending: [{ sku, codes, project, checklist, sentOn }]
export function CheckerDigest({ appUrl, date, checkerName, pending }) {
  return Base({
    title: `Compliance · ${date}`,
    preview: `${pending.length} SKU(s) awaiting your compliance check`,
    appUrl,
    children: [
      checkerName
        ? h('p', { key: 'hi', style: { fontSize: 13, margin: '0 0 18px' } }, `Hi ${checkerName},`)
        : null,
      h(Section, { key: 'a', heading: 'Awaiting your compliance check' },
        h(Rows, {
          columns: [
            { key: 'sku', label: 'SKU' }, { key: 'codes', label: 'Codes' },
            { key: 'project', label: 'Project' }, { key: 'checklist', label: 'Checklist' },
            { key: 'sentOn', label: 'Sent on' },
          ],
          rows: pending,
        })),
    ],
  });
}
