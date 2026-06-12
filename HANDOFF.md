# HANDOFF — Innsaeit Client Dashboard

For a developer inheriting this system. It explains how the pieces fit, the data
model and its security rules, the storage and email subsystems, every environment
variable, how to deploy, how to onboard a new client, and a day-to-day runbook.

> **Note on legacy:** the app originally stored files in OneDrive via Microsoft
> Graph and was later moved to **Cloudflare R2**. The live code uses R2 only. You
> will still see OneDrive remnants — the `integration_tokens` table, the
> `files.drive_item_id` / `drive_path` columns (marked "pre-R2 rows only"), and the
> older `SETUP_CHECKLIST.md` / `scripts/SETUP_GUIDE.md` which still describe the
> Azure/OneDrive setup. Treat those two setup docs as historical; this file and
> `.env.example` are the current truth.

---

## 1. Architecture overview

A static React SPA talks directly to Supabase for all reads and most writes (the
browser holds only the anon key; Row Level Security does the gatekeeping). Anything
that needs a secret — R2 credentials, the Supabase service role, the Resend key —
runs in Vercel serverless functions under `/api`. Email goes out via Resend, files
live in R2.

```
                       Browser (React SPA, anon key)
                                  │
            ┌─────────────────────┼──────────────────────────┐
            │ supabase-js               fetch('/api/...')      │
            ▼                                                  ▼
   ┌──────────────────┐                         ┌─────────────────────────┐
   │  Supabase         │                        │  Vercel serverless /api │
   │  Postgres + Auth  │◄───service role key────│  (R2 presign, email,    │
   │  + RLS            │                         │   cron, settings,       │
   └──────────────────┘                         │   sku delete, health)   │
            ▲                                    └───────────┬─────────────┘
            │                                       │            │
        RLS-scoped                          presigned PUT/GET   Resend API
        reads/writes                                │            │
                                                    ▼            ▼
                                          ┌──────────────┐ ┌──────────┐
                                          │ Cloudflare   │ │  Resend  │
                                          │ R2 bucket    │ │  email   │
                                          └──────────────┘ └──────────┘

   Vercel Cron ──(daily 04:30 UTC, Bearer CRON_SECRET)──► /api/cron/daily-digest
```

Key consequence: the SPA never holds a privileged credential. Uploads, deletes,
and email all go through `/api`, which verifies the caller's Supabase JWT (and,
for admin-only routes, that their profile role is `admin`).

---

## 2. Data model

The entire schema lives in `supabase/schema.sql` (tables, RLS, RPCs, triggers, and
the Hamleys seed). Apply it in the Supabase SQL Editor on a fresh project. Several
sections are written as additive, idempotent "migration" blocks — re-running the
file is safe.

### Tables

| Table | Purpose | Key columns |
|---|---|---|
| `clients` | One row per tenant | `name`, `slug` (subdomain), `supervisor_email`, `compliance_india_user_id`, `compliance_global_user_id` |
| `profiles` | Mirrors `auth.users`; created by trigger on signup | `id` (= auth uid), `email`, `full_name`, `role` (`admin`\|`client`), `client_id`, `onboarded` |
| `stage_templates` | Per-client pipeline definition (workflow is config, not code) | `stage_key`, `label`, `position`, `is_optional`, `client_can_toggle` |
| `projects` | A batch of SKUs for a client | `name`, `vendor` (factory), `buyer`, `buyer_email`, `status` |
| `skus` | One product item | `product_name`, `hamleys_sku`, `vendor_item_code`, `sub_brand`, `compliance_owner`, `compliance_user_id`, `power_type`, `has_im`/`im_done`, `print_vendor`, `buyer_override`/`buyer_email_override`, `changes_requested`, `second_gate`, `status` |
| `sku_stages` | Per-SKU progress, one row per template stage | `stage_key`, `done`, `done_at`, `done_by` |
| `artwork_versions` | Version labels per SKU (`Draft 1`, `Final`) | `version`, `label` — present in schema, lightly used by the UI |
| `files` | Briefs, drafts, references, links, finals | `kind`, `title`, `text_content` (pasted briefs), `external_url` (saved links), `storage_key` (R2), `file_name`, `mime_type`, `size_bytes` |
| `comments` | Per-SKU discussion, soft-deleted | `body`, `author_id`, `deleted_at`, `deleted_by` |
| `checklist_templates` | Per-tenant checklist item definitions | `audience` (`admin`\|`compliance`), `label`, `condition` (`all`\|power type\|`has_im`), `position` |
| `sku_checklist_items` | Per-SKU checklist rows, copied from templates | `audience`, `label`, `checked`, `checked_at`, `checked_by` |
| `digest_log` | Send ledger / dedupe for all email | `kind`, `recipient`, `sku_id`, `digest_date`, `meta` |
| `integration_tokens` | **Legacy** OneDrive refresh token (server-only) | `id`, `refresh_token` |
| `app_settings` | Server-readable key/value flags | `key` (`test_mode`, `digests_paused`), `value` (jsonb) |

**Enums / constrained values worth knowing:**
- `power_type`: `unknown` (default), `battery`, `rechargeable_usb`, `non_electronic`, `ride_on`.
- `compliance_owner`: `internal` (Santosh – India) or `hamleys_hk_uk` (Emily – Global).
- `projects.status` / `skus.status`: `active`, `on_hold`, `done`, `archived`, `cancelled`.
- `files.kind`: `brief_text`, `brief_file`, `reference`, `draft`, `compliance_feedback`, `mockup`, `final_print`, `external_link`, `other`.

### Row Level Security — in plain English

RLS is enabled on every table. Two SECURITY DEFINER helpers drive the policies:
`is_admin()` (is the caller's profile `role = 'admin'`?) and `my_client_id()` (the
caller's tenant).

- **Admin** — full access to everything (`for all using is_admin()`).
- **Client** — may **read** their own tenant's rows on `clients`, `stage_templates`,
  `projects`, `skus`, `sku_stages`, `artwork_versions`, `files`. On `comments` they
  can read non-deleted rows in their tenant and **insert** their own.
- **The one client stage write:** a client may UPDATE a `sku_stages` row only when the
  stage template has `client_can_toggle = true`. In the seed that is exactly
  `final_approved_for_print` — the client's single sign-off.
- **Assigned checker:** on `sku_checklist_items`, a client may **read** only
  `audience = 'compliance'` rows on SKUs where `compliance_user_id = auth.uid()`.
  Admin-audience items are invisible to all clients; compliance items on someone
  else's SKUs are invisible too.
- **`profiles`:** a user reads their own row; admins read all. Only admins UPDATE
  profiles (so a client can't change their own role).
- **Server-only tables** — `integration_tokens`, `digest_log`, `app_settings` have
  RLS enabled with **zero policies**, so only the service role (the `/api` functions)
  can touch them.

### SECURITY DEFINER RPCs (and why each exists)

Postgres RLS can gate *which rows* an UPDATE touches but **cannot restrict an UPDATE
to specific columns**. A blanket client UPDATE policy would therefore expose every
column on any permitted row. The pattern throughout this schema is to grant clients
*no* write policy and instead expose a narrow SECURITY DEFINER function that only
ever writes the intended columns:

| RPC | Why it exists |
|---|---|
| `is_admin()`, `my_client_id()` | Helpers used by every policy. |
| `handle_new_user()` (trigger) | Inserts a `profiles` row when an auth user is created. |
| `create_sku_stages()` (trigger) | Seeds the stage rows for a new SKU from the templates. |
| `create_sku_checklist()` (trigger) → `generate_sku_checklist()` | Seeds checklist items for a new SKU. |
| `touch_updated_at()` (trigger) | Keeps `projects.updated_at` / `skus.updated_at` fresh. |
| `delete_comment(comment_id)` | Soft-delete; allows admin **or** the comment's own author, writing only `deleted_at`/`deleted_by`. |
| `request_sku_changes(p_sku_id)` | Lets a client flag a SKU, writing only `changes_requested`/`_at`/`_by` — no general client write to `skus`. |
| `toggle_checklist_item(p_item_id, p_checked)` | The only client write to checklist items; admin can tick both lists, the assigned checker can tick compliance items on their SKUs only. Writes just `checked`/`checked_at`/`checked_by`. |
| `generate_sku_checklist(p_sku_id)` | Idempotently (re)builds a SKU's checklist for its current `power_type`/`has_im`; prunes stale unchecked items, never touches checked or admin-added custom items. Admin only. |
| `admin_profile_ids()` | Returns admin UUIDs (no names/emails) so the activity feed can hide admin-actored events even though profiles RLS hides admin rows from clients. |
| `mark_onboarded()` | Flips `profiles.onboarded = true` on the caller's own row (clients can't UPDATE profiles otherwise). |

### Triggers

`on_auth_user_created` (→ profile), `on_sku_created` (→ stage rows),
`on_sku_created_checklist` (→ checklist items), `touch_projects` / `touch_skus`
(→ `updated_at`).

---

## 3. Storage adapter (Cloudflare R2)

R2 is reached through its S3-compatible API (`@aws-sdk/client-s3`) with app-level
credentials in `api/_lib/r2.js`. Nothing R2-related ever reaches the browser.

**Upload (admin only):**
1. The browser calls `POST /api/storage/upload-url` with the client slug, project,
   SKU, file name, and content type. The function verifies the caller is an admin and
   returns a **presigned PUT URL** (valid 15 minutes) plus the object `key`.
2. The browser PUTs the file bytes **straight to R2** (via `XMLHttpRequest` for
   progress). Because the bytes never pass through Vercel, the 4.5 MB serverless body
   limit doesn't apply — 100 MB+ `.ai` files work.
3. The browser then inserts a `files` row recording `storage_key`, `file_name`,
   `mime_type`, `size_bytes`, and `storage_provider = 'r2'`.

Object key layout: `innsaeit/{clientSlug}/{projectName}/{skuName}/{timestamp}-{fileName}`,
with each segment sanitized (path separators and URL-hostile chars stripped).

**View / download:** `POST /api/storage/view` returns a presigned GET URL (valid
1 hour) for any logged-in user. Inline preview is offered for
`pdf, jpg, jpeg, png, gif, webp, txt` and images; everything else (AI, CDR, Office)
is download-only.

**Delete:** `POST /api/storage/delete` (admin) removes the R2 object first, then the
`files` row. `POST /api/sku/delete` does the same for all of a SKU's R2 objects
before deleting the SKU (the DB cascades stages, versions, files, comments, checklist
items).

**Env vars:** `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`.
Endpoint is `https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com`.

**Bucket CORS requirement:** because the browser PUTs directly to R2, the bucket's
CORS policy **must allow the deployment origin** for `PUT` (and `GET`) with the
`Content-Type` header. If a browser upload fails with a network error, this is the
first thing to check — the upload helper's error message says as much.

---

## 4. Email system (Resend)

All email funnels through `api/_lib/email.js` → Resend. There are exactly **two**
paths: a scheduled daily digest and one live event email.

### Daily digest — `api/cron/daily-digest.js`

- **Schedule:** Vercel Cron `30 4 * * *` (04:30 UTC = **10:00 IST**), defined in
  `vercel.json`, `maxDuration` 60 s. Vercel invokes it with `GET`; a manual `POST`
  with the same header is the test trigger.
- **Auth:** the request must carry `Authorization: Bearer $CRON_SECRET`.
- **Recipients** (built from a 24-hour window, service-role data access):
  - **Admin** — one per admin user. "Needs your action" (files received-but-not-checked,
    checked-but-no-brief, or changes requested) plus yesterday's *client* activity
    (admin-actored events are filtered out).
  - **Supervisor** — one per client with a `supervisor_email` (Hamleys → Neha).
    Pre-brief SKUs and in-progress SKUs grouped by project.
  - **Buyer** — one per distinct effective buyer email (`buyer_email_override` → else
    project `buyer_email`), only when there's something to say (new files, stage
    changes, or SKUs awaiting their approval).
  - **Compliance checker** — one per assigned checker, only when they have SKUs at
    *Compliance Check Sent* not yet *Compliance Approved*, with checklist progress.
- **Dedupe:** before sending, each job **claims** a `digest_log` row keyed by the
  unique index `(kind, recipient, digest_date)`. A second run that day is a no-op; a
  failed send releases its claim so a retry can resend.
- **Pause:** an admin can set `app_settings.digests_paused = true` (Settings UI) to
  suspend the cron. The live compliance email is unaffected.

### The one live email — `api/notify/compliance-approved.js`

Fired fire-and-forget by the UI when the **Compliance Approved** stage is ticked, or
when the final compliance checklist item *"Compliance approved — okay to proceed for
print"* is checked. The endpoint is **not** admin-gated (the checker is a `client`);
it requires any logged-in user of the SKU's tenant. The server **re-verifies** the
approval state, **dedupes within 10 minutes** via `digest_log`, then emails — each
recipient isolated in its own try/catch — all admins, the supervisor, the SKU's
effective buyer (skipped silently if none), and the approver.

### TEST_MODE, dedupe ledger, and the no-key rule

- **TEST_MODE** (env `TEST_MODE=true`, or `app_settings.test_mode`, toggled in
  Settings): every send is redirected to `TEST_MODE_RECIPIENT` only; all other
  recipients are dropped and logged (`[TEST_MODE] Suppressed send to …`). Content is
  identical — only the To field changes. If TEST_MODE is on but no recipient is set,
  sends are suppressed entirely (never delivered to real people).
- **Dedupe** for *both* paths is the single `digest_log` table — dailies by
  `(kind, recipient, digest_date)`, the live email by recent `(kind, sku_id, sent_at)`.
  There is **no** separate `notifications_log` table.
- **Graceful degrade:** if `RESEND_API_KEY` is unset, `sendEmail` logs a warning and
  returns `{ skipped: true }` — the app keeps working, no email goes out.

### Resend domain / DNS

`NOTIFY_FROM` (e.g. `"Design Innsaeit <tracker@designinnsaeit.com>"`) must be on a
**Resend-verified domain** for real delivery — set up the domain in Resend and add
its DNS records (SPF/DKIM). If `NOTIFY_FROM` is unset, the code falls back to
`onboarding@resend.dev`, which only delivers to the Resend account owner's own inbox
(fine for testing, useless for real recipients). **[VERIFY]** whether the
`designinnsaeit.com` domain is verified in the live Resend account — until it is, real
digests/notices will not reach external recipients. `GET /api/health/resend` reports
domain-verified status.

---

## 5. Auth & roles

`src/auth/useAuth.jsx` wraps Supabase auth. Login is email + password
(`signInWithPassword`); there is no public signup (disable it in Supabase). On a
session, the app loads the user's `profiles` row. `role` is `admin` or `client`:

- **Admin** sees all tenants, can filter the dashboard by client, and can create,
  edit, multi-edit, and delete.
- **Client** is scoped to their `profiles.client_id`; RLS confines every query to that
  tenant. Their only writes are: insert comments, request changes (RPC), tick the
  *Final Approved for Print* gate, and — if they're the assigned checker — tick
  compliance checklist items (RPC).

A **tenant** is a `clients` row; a user belongs to it via `profiles.client_id`. The
SPA is served from one Vercel deployment; each tenant gets a subdomain (see §7).

---

## 6. Environment variables

Set the server vars in the Vercel project (all environments). The `VITE_*` vars are
bundled into the client and are safe to expose (RLS enforces access).

| Name | What it's for | Where to get it | Surface |
|---|---|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL for the browser client | Supabase → Project Settings → API | Client (Vite) |
| `VITE_SUPABASE_ANON_KEY` | Public anon key; RLS-gated | Supabase → API | Client (Vite) |
| `SUPABASE_URL` | Same URL, for the serverless functions | Supabase → API | Vercel |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role; **bypasses RLS** — never expose to the client | Supabase → API | Vercel |
| `R2_ACCOUNT_ID` | Cloudflare account ID | Cloudflare → R2 | Vercel |
| `R2_ACCESS_KEY_ID` | R2 API access key | Cloudflare → R2 → Manage API Tokens | Vercel |
| `R2_SECRET_ACCESS_KEY` | R2 API secret | same as above (shown once) | Vercel |
| `R2_BUCKET` | Bucket name | Cloudflare → R2 | Vercel |
| `RESEND_API_KEY` | Resend API key (optional; email skipped if unset) | Resend → API Keys | Vercel |
| `NOTIFY_FROM` | Email sender; must be a Resend-verified domain | Resend → Domains | Vercel |
| `APP_URL` | "Open tracker" CTA target in emails | your deployment URL | Vercel |
| `TEST_MODE` | `true` redirects all email to `TEST_MODE_RECIPIENT` | you choose | Vercel / local |
| `TEST_MODE_RECIPIENT` | Single inbox for TEST_MODE | you choose | Vercel / local |
| `CRON_SECRET` | Bearer token authorizing the cron + manual test trigger | generate a long random string | Vercel |

`TEST_MODE` and the digest pause can also be toggled at runtime from the Settings UI
(stored in `app_settings`), without redeploying.

---

## 7. Deployment

- **Build & deploy:** push to GitHub; Vercel auto-builds (`vite build` → `dist/`, per
  `vercel.json`) and redeploys. There are **no GitHub Actions** — Vercel's native
  integration does it. SPA routing is handled by the rewrite in `vercel.json`
  (`/((?!api/).*) → /index.html`).
- **Cron:** the `crons` entry in `vercel.json` runs `daily-digest` at `30 4 * * *`.
  Vercel sends the `CRON_SECRET` bearer token automatically when that env var is set.
- **Custom domain:** add the subdomain (e.g. `hamleys.designinnsaeit.com`) in Vercel →
  Domains and point a CNAME at `cname.vercel-dns.com`. Set `APP_URL` to the canonical
  URL so email links resolve.

---

## 8. Multi-tenancy — onboarding a new client

The system is tenant-agnostic: workflow, checklists, and recipients are all data.
Adding a client needs **no code change**:

1. **`clients` row** — insert `name` + `slug` (the subdomain).
2. **`stage_templates`** — copy the Hamleys block in `schema.sql` and adjust the
   stages/labels/positions to the client's workflow (keep one stage with
   `client_can_toggle = true` for their sign-off).
3. **`checklist_templates`** — copy the Hamleys admin + compliance blocks and tailor
   the items / conditions.
4. **Recipient wiring** — set `supervisor_email`, and after creating the checker
   users, set `compliance_india_user_id` / `compliance_global_user_id` (and per-project
   `buyer_email`).
5. **Users** — create them (see the script in §9) with `role = 'client'` and the new
   `client_id`.
6. **Subdomain** — add it in Vercel and point the CNAME at the same app.

> **Caveat to fix for true multi-tenancy:** the upload call in
> `src/pages/SkuDetail.jsx` currently passes `clientSlug: 'hamleys'` hard-coded for the
> R2 key prefix. It works (it's only a storage path), but a second tenant's files would
> land under the `hamleys/` prefix. Make this derive from the SKU's client before
> onboarding a second client. **[VERIFY]/TODO.**

---

## 9. Operational runbook

**Run a test digest (manually trigger the cron):**
```bash
curl -X POST https://YOUR-DEPLOYMENT/api/cron/daily-digest \
  -H "Authorization: Bearer $CRON_SECRET"
```
Turn on TEST_MODE first (Settings, or `TEST_MODE=true` + `TEST_MODE_RECIPIENT`) so it
only reaches your inbox. The response JSON lists every recipient and a per-job status
(`sent` / `skipped_already_sent` / `skipped_no_key` / `error`).

**Add users:** `scripts/create_users.mjs` idempotently creates Supabase auth users and
their `profiles` rows (sets role + `client_id`). It expects the schema to be applied
first. Supply credentials via env:
```bash
SUPABASE_URL=https://<ref>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY='<service role key>' \
node scripts/create_users.mjs           # add --dry-run to preview
```
Generated passwords print once and are written to the git-ignored
`scripts/credentials.local.txt`; distribute securely and delete it. (The user list and
the Hamleys checker wiring in this script reference real emails — see the [VERIFY]
note on Emily below.)

**Rotate a key:** update the value in its source dashboard (Supabase / R2 / Resend),
update the matching Vercel env var, and redeploy so the functions pick it up. For
`CRON_SECRET`, update Vercel and the value the cron uses (Vercel manages this when the
env var changes). Never commit any of these; `.env` and `scripts/credentials.local.txt`
are git-ignored.

**Common gotchas:**
- *Upload fails in the browser* → R2 bucket CORS doesn't allow the origin for PUT (§3).
- *No emails arrive* → `RESEND_API_KEY` unset, `NOTIFY_FROM` domain not verified,
  digests paused, or TEST_MODE redirecting them. Check `/api/health/resend`.
- *Dashboard empty / no "New project"* → the logged-in profile's `role` isn't `admin`.
- *Checker can't see a checklist* → the SKU's `power_type` is `unknown` (no
  type-specific items) or `compliance_user_id` isn't set to that user.
- *Stale setup docs* → `SETUP_CHECKLIST.md` and `scripts/SETUP_GUIDE.md` predate the
  R2 move and still describe OneDrive/Azure; ignore those storage steps.

**External dashboards:**
- Supabase — <https://supabase.com/dashboard> (database, auth, SQL editor)
- Vercel — <https://vercel.com/dashboard> (deploys, env vars, cron, domains, logs)
- Resend — <https://resend.com> (API keys, domains/DNS, delivery logs)
- Cloudflare R2 — <https://dash.cloudflare.com> (bucket, API tokens, CORS)
- GitHub — the repository (push to deploy)

---

## 10. Known limitations / parked items

Only things actually reflected in the code:

- **Legacy OneDrive remnants** — `integration_tokens` table and `files.drive_item_id` /
  `drive_path` columns remain for pre-R2 rows; the two older setup docs still describe
  the Azure/OneDrive flow.
- **`artwork_versions` and `second_gate`** exist in the schema but are only lightly
  surfaced in the UI — room to build out version history and the dual export-gate flow.
- **Placeholder checker email** — the Hamleys global checker is wired to
  `eliu@hamleys.com.hk`, which the schema marks as a placeholder. **[VERIFY]** Emily's
  real address and update the `clients.compliance_global_user_id` wiring (and the user
  script) before relying on her digests / the live compliance email reaching her.
- **Hard-coded upload slug** — see the multi-tenancy caveat in §8.
