# Innsaeit Client Dashboard

Multi-tenant artwork pipeline tracker for Design Innsaeit clients.
First tenant: Hamleys. Each future client is a new row in `clients` plus a
subdomain, not a new build.

Stack: Vite + React (SPA) · Supabase (auth + Postgres + RLS) · Vercel
(hosting + serverless functions) · OneDrive via Microsoft Graph (file storage).

---

## 1. Supabase setup (~10 min)

1. Create a project at supabase.com (Mumbai region: `ap-south-1`).
2. SQL Editor → paste the whole of `supabase/schema.sql` → Run.
   This creates all tables, RLS policies, the Hamleys tenant, and the
   14-stage pipeline template.
3. Authentication → Providers → Email: ensure Email is enabled.
   Turn OFF "Allow new users to sign up" (users are created by you only).
4. Project Settings → API: copy the URL, the `anon` key, and the
   `service_role` key.

### Create the three users

Authentication → Users → Add user (with password) for:
- you (admin)
- Neha Gadia
- the second Hamleys contact

Then Table Editor → `profiles`:
- set your row: `role = admin`, `full_name`, leave `client_id` null
- set both client rows: `role = client`, `client_id` = the Hamleys row id
  from the `clients` table, plus `full_name`.

Passwords are normal email+password, so browsers offer to save them.
Low friction by design.

## 2. Azure app for OneDrive (~10 min, one time)

Your Microsoft 365 Family plan = consumer OneDrive, so:

1. Go to https://portal.azure.com → Microsoft Entra ID → App registrations
   → New registration.
   - Name: `Innsaeit Tracker`
   - Supported account types: **Personal Microsoft accounts only**
   - Redirect URI (Web): `https://YOUR-DOMAIN/api/onedrive/auth-callback`
     (add `http://localhost:3000/api/onedrive/auth-callback` too for local dev)
2. Certificates & secrets → New client secret → copy the **value** immediately.
3. API permissions → Microsoft Graph → Delegated → add `Files.ReadWrite`,
   `offline_access`, `User.Read`.
4. Copy the Application (client) ID.

## 3. Vercel deploy

1. Push this repo to GitHub, import it in Vercel.
2. Environment variables (all environments):

| Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | anon key |
| `SUPABASE_URL` | same URL |
| `SUPABASE_SERVICE_ROLE_KEY` | service role key (server only) |
| `MS_CLIENT_ID` | Azure app client id |
| `MS_CLIENT_SECRET` | Azure app secret |

3. Deploy. Add the domain `hamleys.designinnsaeit.com` in Vercel → Domains,
   and a CNAME in your DNS pointing to `cname.vercel-dns.com`.
4. Log in as admin → Settings → **Connect OneDrive** → sign in with your
   Microsoft account once. Done. If uploads ever fail with a token error,
   the same button reconnects.

## 4. Local development

```bash
npm install
cp .env.example .env   # fill in values
npx vercel dev          # runs Vite + the /api functions together
```

`npm run dev` alone runs the UI but not the OneDrive functions.

## 5. Daily use

- **New batch arrives** → Dashboard → New project → add SKUs (name + codes +
  sub-brand + compliance owner).
- **WhatsApp brief** → SKU page → Paste brief text. Renders in-browser as text.
- **Smash/Playbook/WeTransfer link in an email** → SKU page → Save a link.
  The link graveyard ends here.
- **Draft ready** → pick the kind, Upload file. Files chunk-upload straight to
  OneDrive under `/Innsaeit Tracker/Hamleys/{project}/{sku}/`, so Vercel's
  upload limits never apply and 100MB+ .ai files are fine.
- **Tick stages** as they happen. Client logins see everything, can comment,
  and can tick exactly one box: **Final Approved for Print**. That tick is
  timestamped with their identity. Keep it; it is your audit trail.
- PDF / JPG / PNG / PPT / DOC / TXT preview inline. AI / CDR are
  download-only by browser nature.

## Adding the next client later

1. Insert a row in `clients` (name + slug).
2. Insert their stage templates (copy the Hamleys block in `schema.sql`,
   adjust stages to their workflow).
3. Create their users, point a new subdomain at the same Vercel app.

No code changes.

## Security posture

- Browser uses the anon key only; every table is RLS-gated by tenant.
- Clients can read their tenant, insert comments, and update only stages
  whose template says `client_can_toggle = true`.
- The OneDrive refresh token lives in `integration_tokens`, which has RLS
  enabled and **zero policies**: only the server (service role) can read it.
- Serverless endpoints verify the caller's Supabase JWT; uploads are
  admin-only, viewing requires any valid login.
