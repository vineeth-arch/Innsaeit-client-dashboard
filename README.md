# Innsaeit Client Dashboard

A multi-tenant artwork & packaging pipeline tracker for a design studio and its
clients. It replaces the scatter of WhatsApp briefs, email threads, and expiring
file-transfer links with one live place where every SKU's artwork is tracked from
the moment files arrive to the moment it goes to print. First tenant: **Hamleys**;
each future client is a new row in the database plus a subdomain, not a new build.

**Stack:** Vite · React · Supabase (Postgres + Auth + RLS) · Vercel (hosting +
serverless) · Cloudflare R2 (file storage) · Resend (email).

---

## What it does

- **Projects → SKUs.** Each project is one batch of products; each SKU is one item
  with its codes, sub-brand, buyer, and compliance owner.
- **A 15-stage pipeline** per SKU, from *Files Received* to *In Production*, shown as
  a visual stage rail you tick as work progresses.
- **Two-track compliance checklists** — an internal admin pre-flight (only the studio
  sees it) and a compliance checklist for the assigned checker. Which items appear is
  driven by the SKU's **power type** (battery, USB-rechargeable, non-electronic,
  ride-on) and whether it ships with an **instruction manual (IM)**.
- **Files, links & briefs** — upload artwork straight to cloud storage (100 MB+ `.ai`
  files are fine), paste WhatsApp briefs as text, or save a transfer link that never expires.
- **Comments & an activity feed** scoped to each tenant.
- **Email, without the noise** — one personalized **daily digest** per person at
  10 AM IST, plus a **single live email** when compliance is approved.
- **Guided onboarding tour** on first login, and a **light/dark** toggle.

## Tech stack

| Piece | What it's for |
|---|---|
| **Vite + React** | Single-page app (the whole UI under `src/`) |
| **react-router-dom** | Client-side routing |
| **Supabase** | Postgres database, email/password auth, and Row Level Security (the browser only ever holds the anon key) |
| **Vercel** | Static hosting for the SPA, serverless functions under `/api`, and the daily-digest cron |
| **Cloudflare R2** | S3-compatible object storage for artwork files, accessed via presigned URLs |
| **Resend** | Transactional email for the digests and the live compliance notice |
| **@react-email/render** | Renders the email templates to HTML |

## Quick start (developers)

```bash
git clone <repo-url>
cd Innsaeit-client-dashboard
npm install
cp .env.example .env       # fill in the values — see HANDOFF.md for the full table
npx vercel dev             # runs the Vite UI *and* the /api functions together
```

- `npm run dev` runs the **UI only** (Vite on port 3000) — the `/api` serverless
  functions won't be available, so uploads and email won't work locally.
- `npm run build` produces the static site in `dist/`.
- Requires Node 18+.

The app needs a Supabase project with `supabase/schema.sql` applied, plus the
environment variables. Full setup and operations live in **[HANDOFF.md](./HANDOFF.md)**.

## Project structure

```
.
├── api/                      # Vercel serverless functions (Node)
│   ├── _lib/                 # shared helpers: r2.js, email.js, supa.js
│   ├── _emails/              # React-email templates (digests + compliance notice)
│   ├── cron/daily-digest.js  # the 10 AM IST daily digest job
│   ├── notify/               # the one live email: compliance-approved
│   ├── storage/              # R2 presigned upload / view / delete
│   ├── settings/flags.js     # admin toggles: test mode, pause digests
│   ├── sku/delete.js         # cascade-delete a SKU + its R2 objects
│   └── health/               # admin reachability probes (supabase, r2, resend)
├── src/                      # React SPA
│   ├── auth/                 # useAuth: Supabase session + profile/role
│   ├── pages/                # Login, Dashboard, ProjectView, SkuDetail, Settings
│   ├── components/           # StageRail, ChecklistCard, FileViewer, modals, …
│   ├── onboarding/           # the guided Tour and its steps
│   └── lib/                  # api.js (data layer), export.js (CSV), skuForm, status
├── supabase/schema.sql       # the entire database: tables, RLS, RPCs, triggers, seed
├── scripts/create_users.mjs  # idempotent Supabase user + profile creation
├── vercel.json               # build, SPA rewrites, cron schedule
└── .env.example              # every environment variable, annotated
```

## Documentation

- **[HANDOFF.md](./HANDOFF.md)** — for a developer inheriting the system:
  architecture, data model & RLS, storage, email, env vars, deployment, multi-tenancy,
  and an operational runbook.
- **[USER_GUIDE.md](./USER_GUIDE.md)** — for the people using the app: roles, the full
  artwork-to-print workflow, how-to steps, the daily digest, and troubleshooting.
