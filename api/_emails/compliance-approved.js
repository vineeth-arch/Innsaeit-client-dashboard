// api/_emails/compliance-approved.js — the ONLY live (non-digest) email.
// NO JSX (see base.js).
import { h, Base, fmtDate, C } from './base.js';

export const subject = ({ skuName }) => `Compliance approved — ${skuName}`;

export function ComplianceApproved({ appUrl, skuName, codes, project, checkerName, dateIso }) {
  return Base({
    title: 'Compliance approved',
    preview: `${skuName} approved by ${checkerName}`,
    appUrl,
    children: [
      h('h1', { key: 'h', style: { fontSize: 20, margin: '0 0 12px', color: C.ink } }, 'Compliance approved'),
      h('p', { key: 'p', style: { fontSize: 14, lineHeight: 1.6, margin: 0 } },
        h('strong', null, skuName),
        codes ? ` (${codes})` : '',
        ` in ${project} approved by ${checkerName} on ${fmtDate(dateIso)}.`),
    ],
  });
}
