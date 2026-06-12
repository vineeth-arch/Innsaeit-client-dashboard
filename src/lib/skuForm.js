// src/lib/skuForm.js
// Shared option sets for the SKU form's bento choices, so the Add-SKU form,
// the Edit-SKU modal, and the SKU detail page stay identical.

// Compliance market — defaults to Santosh / India (compliance_owner 'internal').
export const COMPLIANCE_OPTIONS = [
  { value: 'internal', label: 'Santosh – India', tone: 'mint' },
  { value: 'hamleys_hk_uk', label: 'Emily – Global', tone: 'mint' },
];

// Instruction manual present? Red No / green Yes.
export const IM_OPTIONS = [
  { value: false, label: 'No', tone: 'red' },
  { value: true, label: 'Yes', tone: 'green' },
];

// Export SKU needing both compliance gates.
export const EXPORT_OPTIONS = [
  { value: false, label: 'No', tone: 'mint' },
  { value: true, label: 'Yes', tone: 'mint' },
];

// Power type drives which compliance checklist items are generated.
export const POWER_TYPES = [
  ['unknown', 'Unknown'],
  ['battery', 'Battery'],
  ['rechargeable_usb', 'Rechargeable (USB)'],
  ['non_electronic', 'Non-electronic'],
  ['ride_on', 'Ride-on'],
];
