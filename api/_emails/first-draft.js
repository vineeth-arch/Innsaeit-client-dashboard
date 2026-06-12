// api/_emails/first-draft.js — live (non-digest) notification sent when the
// first draft file is uploaded for a SKU. NO JSX (see base.js).
import { h, Base, fmtDateTime, C } from './base.js';

export const subject = ({ skuName }) => `First draft received — ${skuName}`;

export function FirstDraft({ appUrl, skuName, codes, project, uploaderName, dateIso }) {
  return Base({
    title: 'First draft received',
    preview: `${skuName} — first draft uploaded by ${uploaderName}`,
    appUrl,
    children: [
      h('h1', { key: 'h', style: { fontSize: 20, margin: '0 0 12px', color: C.ink } }, 'First draft received'),
      h('p', { key: 'p', style: { fontSize: 14, lineHeight: 1.6, margin: 0 } },
        h('strong', null, skuName),
        codes ? ` (${codes})` : '',
        ` in ${project} — first draft uploaded by ${uploaderName} on ${fmtDateTime(dateIso)}.`),
    ],
  });
}
