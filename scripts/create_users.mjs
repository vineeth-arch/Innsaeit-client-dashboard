#!/usr/bin/env node
// scripts/create_users.mjs
//
// Creates the 8 Supabase auth users for the Hamleys tenant and sets each
// profile's role / client_id / full_name. Idempotent: safe to re-run.
//
// Zero dependencies — uses Node 18+ global fetch. No package.json / npm install
// needed. Run it from the repo root.
//
//   SUPABASE_URL=https://hocvnneblgsvtujoqhpo.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=<the real service role key> \
//   node scripts/create_users.mjs
//
// The service role key is read from the environment and never printed. Do NOT
// paste it into chat, commit it, or hard-code it here.
//
// Prerequisite: supabase/schema.sql must already be applied (so the Hamleys
// client row and the profiles trigger exist). See scripts/SETUP_GUIDE.md.
//
// Flags:
//   --password-from-env   Use USER_PASSWORD_<n> env vars (1..8) instead of
//                         generating random passwords. Useful if you want to
//                         set your own. Any unset slot falls back to random.
//   --dry-run             Print what would happen without calling the API.

import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';

// ---------- user roster (from the request) ----------
const HAMLEYS_SLUG = 'hamleys';
const USERS = [
  { email: 'vineeth@designinnsaeit.com', role: 'admin',  full_name: 'Vineeth Nair',     tenant: false },
  { email: 'neha.gadia@ril.com',         role: 'client', full_name: 'Neha Gadia',        tenant: true  },
  { email: 'tonia.nazareth@ril.com',     role: 'client', full_name: 'Tonia Nazareth',    tenant: true  },
  { email: 'mansi2.shah@ril.com',        role: 'client', full_name: 'Mansi Shah',        tenant: true  },
  { email: 'sanket2.kadam@ril.com',      role: 'client', full_name: 'Sanket Kadam',      tenant: true  },
  { email: 'Santosh107.Kumar@ril.com',   role: 'client', full_name: 'Santosh Kumar',     tenant: true  },
  { email: 'lakshmita1.Sethi@ril.com',   role: 'client', full_name: 'Lakshmita Sethi',   tenant: true  },
  { email: 'Afroz.Hathiyari@ril.com',    role: 'client', full_name: 'Afroz Hathiyari',   tenant: true  },
];

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const PASSWORD_FROM_ENV = args.has('--password-from-env');

// ---------- env + guards ----------
const URL = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
const KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

function die(msg) {
  console.error(`\n  ERROR: ${msg}\n`);
  process.exit(1);
}

if (!URL) die('SUPABASE_URL is not set.');
if (!/^https:\/\/[^/]+\.supabase\.co$/.test(URL)) {
  die(`SUPABASE_URL looks wrong: "${URL}"\n         Expected something like https://<ref>.supabase.co`);
}
if (!KEY) die('SUPABASE_SERVICE_ROLE_KEY is not set.');
// Guard against blocker #2: a URL pasted where the key belongs.
if (/^https?:\/\//i.test(KEY)) {
  die('SUPABASE_SERVICE_ROLE_KEY looks like a URL, not a key.\n' +
      '         The real key is a long token (eyJ... JWT or sb_secret_...).\n' +
      '         Get it from Supabase -> Project Settings -> API -> service_role.');
}
if (!(KEY.startsWith('eyJ') || KEY.startsWith('sb_secret_'))) {
  console.warn('  WARNING: SUPABASE_SERVICE_ROLE_KEY does not look like a service role key\n' +
               '           (expected eyJ... or sb_secret_...). Continuing anyway.\n');
}

const H = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
};

// ---------- helpers ----------
function strongPassword() {
  // 24 url-safe chars; plenty for a login that browsers will store.
  return randomBytes(18).toString('base64').replace(/[+/=]/g, '').slice(0, 20) + 'Aa1!';
}

function passwordFor(index) {
  if (PASSWORD_FROM_ENV) {
    const fromEnv = process.env[`USER_PASSWORD_${index + 1}`];
    if (fromEnv) return fromEnv;
  }
  return strongPassword();
}

async function api(path, init = {}) {
  const res = await fetch(`${URL}${path}`, { ...init, headers: { ...H, ...(init.headers || {}) } });
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { ok: res.ok, status: res.status, body };
}

async function getHamleysClientId() {
  const r = await api(`/rest/v1/clients?slug=eq.${HAMLEYS_SLUG}&select=id`);
  if (!r.ok) die(`Could not query clients (HTTP ${r.status}). ${JSON.stringify(r.body)}`);
  if (!Array.isArray(r.body) || r.body.length === 0) {
    die(`No "${HAMLEYS_SLUG}" client row found.\n` +
        '         Run supabase/schema.sql in the SQL Editor first (it seeds the Hamleys tenant).');
  }
  return r.body[0].id;
}

// Find an existing auth user by email (admin API paginates; one page of 1000
// is plenty here). Returns the user object or null.
async function findUserByEmail(email) {
  const r = await api(`/auth/v1/admin/users?per_page=1000`);
  if (!r.ok) return null;
  const list = r.body?.users || r.body || [];
  const lower = email.toLowerCase();
  return list.find((u) => (u.email || '').toLowerCase() === lower) || null;
}

async function createUser(email, password) {
  const r = await api(`/auth/v1/admin/users`, {
    method: 'POST',
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  if (r.ok) return { user: r.body, created: true, password };

  // Already exists -> fetch it. Supabase returns 422 with email_exists.
  const msg = JSON.stringify(r.body).toLowerCase();
  if (r.status === 422 || msg.includes('already') || msg.includes('exists') || msg.includes('registered')) {
    const existing = await findUserByEmail(email);
    if (existing) return { user: existing, created: false, password: null };
  }
  die(`Failed to create ${email} (HTTP ${r.status}). ${JSON.stringify(r.body)}`);
}

async function updateProfile(id, { role, full_name, client_id }) {
  const r = await api(`/rest/v1/profiles?id=eq.${id}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ role, full_name, client_id }),
  });
  if (!r.ok) die(`Failed to update profile for ${id} (HTTP ${r.status}). ${JSON.stringify(r.body)}`);
  if (!Array.isArray(r.body) || r.body.length === 0) {
    die(`Profile row for ${id} not found. The handle_new_user trigger from ` +
        'schema.sql should create it on signup — is the schema fully applied?');
  }
  return r.body[0];
}

// ---------- main ----------
console.log(`\n  Target: ${URL}`);
console.log(`  Mode:   ${DRY_RUN ? 'DRY RUN (no API calls)' : 'live'}\n`);

if (DRY_RUN) {
  for (const u of USERS) {
    console.log(`  would create ${u.email.padEnd(32)} role=${u.role} tenant=${u.tenant ? 'hamleys' : '-'}`);
  }
  console.log('\n  Dry run complete. Re-run without --dry-run to apply.\n');
  process.exit(0);
}

const hamleysId = await getHamleysClientId();
console.log(`  Hamleys client_id: ${hamleysId}\n`);

const results = [];
for (let i = 0; i < USERS.length; i++) {
  const u = USERS[i];
  const password = passwordFor(i);
  const { user, created, password: usedPassword } = await createUser(u.email, password);
  const client_id = u.tenant ? hamleysId : null;
  await updateProfile(user.id, { role: u.role, full_name: u.full_name, client_id });
  results.push({
    email: u.email,
    role: u.role,
    client: u.tenant ? 'hamleys' : '-',
    status: created ? 'created' : 'existed',
    password: created ? usedPassword : '(unchanged)',
  });
  console.log(`  ${created ? '+ created' : '= existed'}  ${u.email.padEnd(32)} role=${u.role}`);
}

// ---------- credentials output ----------
const newlyCreated = results.filter((r) => r.status === 'created');
if (newlyCreated.length > 0) {
  const lines = [
    '# Innsaeit Client Dashboard — generated logins',
    `# Project: ${URL}`,
    `# Generated: ${new Date().toISOString()}`,
    '# KEEP THIS FILE SAFE. It is git-ignored. Distribute passwords securely,',
    '# then delete it. Users can change passwords later if email reset is on.',
    '',
    ...newlyCreated.map((r) => `${r.email}\t${r.password}\trole=${r.role}\tclient=${r.client}`),
    '',
  ];
  const out = 'scripts/credentials.local.txt';
  writeFileSync(out, lines.join('\n'));
  console.log(`\n  Wrote ${newlyCreated.length} new password(s) to ${out} (git-ignored).`);
  console.log('  ---------------------------------------------------------------');
  for (const r of newlyCreated) {
    console.log(`  ${r.email.padEnd(32)} ${r.password}`);
  }
  console.log('  ---------------------------------------------------------------');
  console.log('  Share these securely, then delete the file.');
} else {
  console.log('\n  All 8 users already existed — roles/profiles re-applied. No new passwords.');
}

console.log('\n  Done. Verify by signing in as vineeth@designinnsaeit.com at the app URL.\n');
