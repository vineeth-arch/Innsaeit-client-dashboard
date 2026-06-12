// src/lib/status.js
// Shared status vocabulary for projects and SKUs, plus the sub-brand list.
// Both tables carry the same five-value status check constraint.
export const STATUS_OPTIONS = [
  ['active', 'Active'],
  ['on_hold', 'On hold'],
  ['done', 'Done'],
  ['archived', 'Archived'],
  ['cancelled', 'Cancelled'],
];

export const STATUS_LABEL = Object.fromEntries(STATUS_OPTIONS);

export function statusBadgeClass(status) {
  if (status === 'active') return 'badge mint';
  if (status === 'on_hold') return 'badge amber';
  if (status === 'cancelled') return 'badge danger';
  return 'badge'; // done, archived
}

// Rows with no status column yet (pre-migration) count as active.
export const isActive = (row) => !row.status || row.status === 'active';

export const SUB_BRANDS = ['', 'Ralleyz', 'Youreka', 'Snapkid', 'Miens', 'KSY', 'Other / none'];
