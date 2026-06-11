// api/_emails/base.js
// Shared brand layout for all emails. IMPORTANT: NO JSX anywhere under /api —
// Vercel's Node runtime does not transform JSX in .js files, so every template
// builds elements with h() (React.createElement). Plain HTML tags + inline
// styles only: that is also the email-client-safe way to build markup.
import React from 'react';

export const h = React.createElement;

export const C = {
  indigo: '#2C0098',
  inkDeep: '#0D0035',
  ink: '#14004A',
  mint: '#00FFCF',
  text: '#14004A',
  dim: '#5b5470',
  faint: '#8a84a0',
  amber: '#b45309',
  border: '#e8e5f2',
};
const FONT = "'Inter','Helvetica Neue',Helvetica,Arial,sans-serif";

export const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-IN',
  { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
export const fmtDateTime = (iso) => new Date(iso).toLocaleString('en-IN',
  { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });

// Dark indigo header band with "Design Innsaeit", white body card, mint CTA.
export function Base({ title, preview, appUrl, children }) {
  return h('html', { lang: 'en' },
    h('body', { style: { margin: 0, background: '#f4f3fa', fontFamily: FONT, color: C.text } },
      preview ? h('div', { style: { display: 'none', maxHeight: 0, overflow: 'hidden' } }, preview) : null,
      h('table', { width: '100%', cellPadding: 0, cellSpacing: 0, role: 'presentation' },
        h('tbody', null,
          h('tr', null,
            h('td', { align: 'center', style: { padding: '24px 12px' } },
              h('table', { width: 600, cellPadding: 0, cellSpacing: 0, role: 'presentation', style: { maxWidth: 600, width: '100%' } },
                h('tbody', null,
                  h('tr', null,
                    h('td', { style: { background: C.inkDeep, borderRadius: '12px 12px 0 0', padding: '20px 28px' } },
                      h('span', { style: { color: '#ffffff', fontSize: 18, fontWeight: 700, letterSpacing: '0.04em' } }, 'Design Innsaeit'),
                      h('div', { style: { color: C.mint, fontSize: 12, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.12em' } }, title))),
                  h('tr', null,
                    h('td', { style: { background: '#ffffff', padding: '24px 28px', border: `1px solid ${C.border}`, borderTop: 'none' } }, children)),
                  h('tr', null,
                    h('td', { align: 'center', style: { background: '#ffffff', padding: '8px 28px 28px', border: `1px solid ${C.border}`, borderTop: 'none', borderRadius: '0 0 12px 12px' } },
                      h('a', { href: appUrl, style: { display: 'inline-block', background: C.mint, color: C.inkDeep, fontWeight: 700, fontSize: 14, textDecoration: 'none', padding: '12px 28px', borderRadius: 8 } }, 'Open tracker'))),
                  h('tr', null,
                    h('td', { style: { padding: '14px 8px', color: C.dim, fontSize: 11, textAlign: 'center' } },
                      'Automated update from the Design Innsaeit tracker. Reply to this email to reach Vineeth.'))))))))));
}

export const Section = ({ heading, children }) =>
  h('div', { style: { marginBottom: 22 } },
    h('h2', { style: { fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.indigo, margin: '0 0 10px' } }, heading),
    children);

export const Empty = (text = 'Nothing pending.') =>
  h('p', { style: { color: C.faint, fontSize: 13, margin: 0 } }, text);

// Simple bordered table. columns = [{key,label}], rows = array of objects whose
// values are strings or elements.
export function Rows({ columns, rows }) {
  return h('table', { width: '100%', cellPadding: 0, cellSpacing: 0, style: { borderCollapse: 'collapse', fontSize: 13 } },
    h('thead', null,
      h('tr', null, columns.map((c) =>
        h('th', { key: c.key, align: 'left', style: { padding: '6px 8px', borderBottom: `2px solid ${C.border}`, color: C.faint, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' } }, c.label)))),
    h('tbody', null, rows.map((r, i) =>
      h('tr', { key: i }, columns.map((c) =>
        h('td', { key: c.key, style: { padding: '8px', borderBottom: `1px solid ${C.border}`, verticalAlign: 'top' } }, r[c.key] ?? '—'))))));
}

// Plain bullet list of short lines.
export function Lines({ items }) {
  return h('ul', { style: { margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.7 } },
    items.map((t, i) => h('li', { key: i }, t)));
}
