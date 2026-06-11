// src/lib/export.js
// Client-side project exports: CSV download + plain-text summary.
// Pure functions over already-fetched data — no network, no dependencies.

const COMPLIANCE_LABEL = { internal: 'Internal (Santosh)', hamleys_hk_uk: 'Hamleys HK/UK' };

export function csvEscape(v) {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const stageMap = (sku) =>
  Object.fromEntries((sku.sku_stages || []).map((r) => [r.stage_key, r]));

export function buildProjectCsv(project, skus, templates, effectiveBuyer) {
  const header = [
    'Product Name', 'Hamleys SKU', 'Vendor Item Code', 'Sub-brand', 'Buyer', 'Compliance Owner',
    ...templates.map((t) => t.label),
    'Stages Done', 'Last Updated',
  ];
  const required = templates.filter((t) => !t.is_optional).map((t) => t.stage_key);
  const rows = skus.map((s) => {
    const byKey = stageMap(s);
    const done = required.filter((k) => byKey[k]?.done).length;
    return [
      s.product_name, s.hamleys_sku, s.vendor_item_code, s.sub_brand,
      effectiveBuyer(s, project.buyer),
      COMPLIANCE_LABEL[s.compliance_owner] || s.compliance_owner,
      ...templates.map((t) => (byKey[t.stage_key]?.done ? fmtDate(byKey[t.stage_key].done_at) : '')),
      `${done}/${required.length}`,
      fmtDate(s.updated_at),
    ];
  });
  // BOM so Excel detects UTF-8.
  return '\ufeff' + [header, ...rows].map((r) => r.map(csvEscape).join(',')).join('\r\n');
}

export function downloadCsv(filename, csv) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function projectCsvFilename(project) {
  const slug = (project.name || 'project').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `${slug}-${new Date().toISOString().slice(0, 10)}.csv`;
}

// Plain text, WhatsApp-paste friendly — no markdown.
export function buildProjectSummary(project, skus, templates) {
  const lines = [`${project.name} — status as of ${fmtDate(new Date().toISOString())}`];
  for (const s of skus) {
    const byKey = stageMap(s);
    const codes = [s.hamleys_sku, s.vendor_item_code].filter(Boolean).join(' · ');
    const doneTpls = templates.filter((t) => byKey[t.stage_key]?.done);
    const current = doneTpls[doneTpls.length - 1]; // templates are position-sorted
    let status = 'Not started';
    if (current) {
      const at = byKey[current.stage_key].done_at;
      status = current.label + (at ? `, ${fmtDate(at)}` : '');
    }
    const awaiting = byKey.compliance_approved?.done && !byKey.final_approved_for_print?.done;
    lines.push(
      `- ${s.product_name}${codes ? ` (${codes})` : ''} — ${status}${awaiting ? '; AWAITING CLIENT APPROVAL' : ''}`
    );
  }
  return lines.join('\n');
}
