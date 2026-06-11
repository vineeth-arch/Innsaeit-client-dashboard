// api/_emails/supervisor-digest.js — daily supervisor digest. NO JSX (see base.js).
import { h, Base, Section, Rows, Empty, C } from './base.js';

export const subject = ({ date }) => `Artwork pipeline status (${date})`;

// preBrief:   [{ sku, codes, project, furthest, updated }]
// inProgress: [{ project, rows: [{ sku, codes, furthest, updated, changesRequested }] }]
export function SupervisorDigest({ appUrl, date, preBrief, inProgress }) {
  return Base({
    title: `Pipeline status · ${date}`,
    preview: `${preBrief.length} pre-brief · ${inProgress.reduce((n, g) => n + g.rows.length, 0)} in progress`,
    appUrl,
    children: [
      h(Section, { key: 'a', heading: 'Pending — pre-brief' },
        preBrief.length
          ? h(Rows, {
              columns: [
                { key: 'sku', label: 'SKU' }, { key: 'codes', label: 'Codes' },
                { key: 'project', label: 'Project' }, { key: 'furthest', label: 'Stage' },
                { key: 'updated', label: 'Last updated' },
              ],
              rows: preBrief,
            })
          : Empty()),
      h(Section, { key: 'b', heading: 'In progress' },
        inProgress.length
          ? inProgress.map((g, i) => h('div', { key: i, style: { marginBottom: 14 } },
              h('h3', { style: { fontSize: 13, margin: '0 0 6px', color: C.ink } }, g.project),
              h(Rows, {
                columns: [
                  { key: 'sku', label: 'SKU' }, { key: 'codes', label: 'Codes' },
                  { key: 'furthest', label: 'Stage' }, { key: 'updated', label: 'Last updated' },
                  { key: 'flag', label: '' },
                ],
                rows: g.rows.map((r) => ({
                  ...r,
                  flag: r.changesRequested
                    ? h('span', { style: { color: C.amber, fontWeight: 700, fontSize: 12 } }, 'Changes requested')
                    : '',
                })),
              })))
          : Empty()),
    ],
  });
}
