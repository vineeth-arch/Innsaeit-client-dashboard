# GO-LIVE CHECKLIST (personalized)

The frontend is already wired to your Supabase project
(https://hocvnneblgsvtujoqhpo.supabase.co, publishable key baked in).
Four blocks remain. Each is paste-and-click.

---

## 1. Push this code to GitHub  (~2 min)

From the folder where you cloned the repo:

```bash
unzip ~/Downloads/innsaeit-client-dashboard.zip
cp -R innsaeit-client-dashboard/. Innsaeit-client-dashboard/
cd Innsaeit-client-dashboard
git add -A
git commit -m "Tracker v1: schema, app, OneDrive functions"
git push origin main
```

Vercel auto-redeploys on push. https://innsaeit-client-dashboard.vercel.app
will show the login screen after this (login will work after step 2).

## 2. Supabase  (~8 min)

1. Dashboard -> SQL Editor -> paste ALL of `supabase/schema.sql` -> Run.
2. Authentication -> Sign In / Up -> turn OFF "Allow new users to sign up".
3. Authentication -> Users -> Add user (email + password) three times:
   you, Neha Gadia, second Hamleys contact.
4. Table Editor -> `clients` -> copy the Hamleys row `id`.
5. Table Editor -> `profiles`:
   - your row: role = `admin`, full_name = Vineeth Nair
   - both client rows: role = `client`, client_id = the Hamleys id, full_name.

Test now: log in at the Vercel URL with your admin account. Dashboard
should load. Create a test project and SKU; the 14 stage rows appear
automatically.

## 3. Azure app for OneDrive  (~8 min)

portal.azure.com -> Microsoft Entra ID -> App registrations -> New:
- Name: Innsaeit Tracker
- Account types: **Personal Microsoft accounts only**
- Redirect URI (Web):
  `https://innsaeit-client-dashboard.vercel.app/api/onedrive/auth-callback`
  (when you attach hamleys.designinnsaeit.com later, ADD a second URI:
  `https://hamleys.designinnsaeit.com/api/onedrive/auth-callback`)
- Certificates & secrets -> New client secret -> copy the VALUE now.
- API permissions -> Microsoft Graph -> Delegated:
  Files.ReadWrite, offline_access, User.Read.
- Copy the Application (client) ID.

## 4. Vercel environment variables  (~3 min)

Project -> Settings -> Environment Variables (all environments):

| Name | Value |
|---|---|
| SUPABASE_URL | https://hocvnneblgsvtujoqhpo.supabase.co |
| SUPABASE_SERVICE_ROLE_KEY | from Supabase -> Settings -> API. Paste it ONLY here. Never share it in chat, email, or commit it. |
| MS_CLIENT_ID | from step 3 |
| MS_CLIENT_SECRET | from step 3 |
| VITE_SUPABASE_URL | https://hocvnneblgsvtujoqhpo.supabase.co (optional, defaults baked in) |
| VITE_SUPABASE_ANON_KEY | sb_publishable_OVEBeyzlyVtNbxqWkdbrDg_B45P9E76 (optional) |

Then Deployments -> Redeploy so the functions pick up the vars.

## 5. Final wiring  (~1 min)

Log in as admin -> Settings -> **Connect OneDrive** -> sign in with your
Microsoft account once. Upload a test PDF on a test SKU, click View.
If it previews inline, everything is live.

## Later (not blocking)

- Domain: Vercel -> Domains -> add hamleys.designinnsaeit.com, CNAME to
  cname.vercel-dns.com. Then add the second Azure redirect URI above.
- Replace `public/logo.svg` with your real logo (same filename) and push.

## If something fails

- Login error "Invalid login credentials": user not created or wrong password.
- Dashboard empty/no projects button: your profile role is not `admin`.
- Upload error "OneDrive is not connected": do step 5.
- OneDrive consent error AADSTS50011: redirect URI in Azure does not
  exactly match the deployed URL, including https and path.
