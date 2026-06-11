# Setup runbook — Innsaeit Client Dashboard

This is the corrected, copy-paste version of the go-live steps, with the parts
that **can** be scripted separated from the parts that **must** be done by hand.

Project: `https://hocvnneblgsvtujoqhpo.supabase.co`
Live URL: `https://innsaeit-client-dashboard.vercel.app`

> Two corrections to the original instructions are baked in below — read steps
> 2 and 3 carefully.

---

## Step 1 — Apply the database schema (manual; ~3 min)

The schema is **DDL** (creating tables, RLS policies, triggers, functions). A
service role key **cannot** run DDL over the REST API, so this step can't be
scripted with the key alone — do it in the dashboard:

1. Supabase Dashboard → **SQL Editor** → New query.
2. Paste the entire contents of `supabase/schema.sql`.
3. **Run.**

This also seeds the **Hamleys** tenant and the 14-stage pipeline. The user
script in Step 4 depends on this having run.

> Alternatives if you prefer CLI:
> - **psql:** `psql "<your Postgres connection string>" -f supabase/schema.sql`
>   (connection string is under Project Settings → Database, needs the DB
>   password — *not* the service role key).
> - **Management API:** `POST https://api.supabase.com/v1/projects/<ref>/database/query`
>   with a Supabase **personal access token** (different from the service key).

After running, confirm in the SQL editor:
```sql
select count(*) from public.stage_templates;        -- expect 14
select id, name, slug from public.clients;           -- expect one Hamleys row
```

---

## Step 2 — Vercel environment variables (manual; ~3 min)

Project → **Settings → Environment Variables** (apply to all environments):

| Name | Value |
|---|---|
| `SUPABASE_URL` | `https://hocvnneblgsvtujoqhpo.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | **the real service role key** — see note ⚠️ below |
| `MS_CLIENT_ID` | *pending* — set after you create the Azure app (Step 5) |
| `MS_CLIENT_SECRET` | *pending* — set after you create the Azure app (Step 5) |
| `VITE_SUPABASE_URL` | optional — defaults baked into the build |
| `VITE_SUPABASE_ANON_KEY` | optional — defaults baked into the build |

⚠️ **Correction:** the value originally given for `SUPABASE_SERVICE_ROLE_KEY`
was `https://hocvnneblgsvtujoqhpo.supabase.co/rest/v1/` — that's a **URL, not a
key**. The real key is a long token (`eyJ...` JWT, or the newer `sb_secret_...`).
Get it from **Supabase → Project Settings → API → `service_role` secret**. Paste
it **only** into the Vercel field — never into chat, email, or a commit.

After saving, **Deployments → Redeploy** so the serverless functions pick up the
new variables.

---

## Step 3 — Create the 8 users (scripted; ~1 min)

Run the included script from the **repo root**, with the real key in your shell
environment (it's read from env and never printed):

```bash
SUPABASE_URL=https://hocvnneblgsvtujoqhpo.supabase.co \
SUPABASE_SERVICE_ROLE_KEY='<paste the real service role key>' \
node scripts/create_users.mjs
```

Requires Node 18+ (uses built-in `fetch`; no `npm install` needed).

What it does, idempotently:
- creates each user with email confirmed (so they can log in immediately),
- sets `profiles.role` (`admin` for you, `client` for the rest),
- sets `profiles.client_id` to the Hamleys tenant for all client users,
- sets `full_name`.

It generates a strong random password per user, prints them once, and writes
them to `scripts/credentials.local.txt` (git-ignored). **Distribute those
passwords securely, then delete the file.**

Useful flags:
- `--dry-run` — show what it would do, no API calls.
- `--password-from-env` — supply your own via `USER_PASSWORD_1`…`USER_PASSWORD_8`
  instead of generating random ones.

The 8 users it manages:

| Email | Role | Tenant |
|---|---|---|
| vineeth@designinnsaeit.com | admin | — |
| neha.gadia@ril.com | client | Hamleys |
| tonia.nazareth@ril.com | client | Hamleys |
| mansi2.shah@ril.com | client | Hamleys |
| sanket2.kadam@ril.com | client | Hamleys |
| Santosh107.Kumar@ril.com | client | Hamleys |
| lakshmita1.Sethi@ril.com | client | Hamleys |
| Afroz.Hathiyari@ril.com | client | Hamleys |

> Also recommended: Supabase → **Authentication → Sign In / Up → turn OFF
> "Allow new users to sign up"** (users are created by you only).

---

## Step 4 — Verify (manual + optional smoke test)

**Browser:** open `https://innsaeit-client-dashboard.vercel.app`. You should see
the login screen. Sign in as `vineeth@designinnsaeit.com` with the generated
password — the dashboard should load (admin sees the "New project" controls).

**Optional CLI smoke test** (confirms auth without a browser). Uses the public
publishable/anon key, *not* the service role key:

```bash
curl -s "https://hocvnneblgsvtujoqhpo.supabase.co/auth/v1/token?grant_type=password" \
  -H "apikey: sb_publishable_OVEBeyzlyVtNbxqWkdbrDg_B45P9E76" \
  -H "Content-Type: application/json" \
  -d '{"email":"vineeth@designinnsaeit.com","password":"<the generated password>"}'
```
A JSON response containing `access_token` means auth works end-to-end.

---

## Step 5 — OneDrive / Azure (later, not blocking login)

Follow `SETUP_CHECKLIST.md` section 3 to register the Azure app, then fill in
`MS_CLIENT_ID` / `MS_CLIENT_SECRET` in Vercel (Step 2) and redeploy. Finally:
admin → **Settings → Connect OneDrive** once.

---

## Heads-up: repo has no `package.json` / `vercel.json`

This repo currently ships `src/`, `api/`, and `supabase/` but **no
`package.json`, lockfile, or `vercel.json`**. A clean Vercel build from this
repo as-is will likely fail (no dependencies, no build command). If the live
deploy is being built from a different source, you're fine; otherwise these
build files need to be added before the deploy will succeed. Flagged separately
— say the word and I'll add a proper Vite + Vercel build config.
