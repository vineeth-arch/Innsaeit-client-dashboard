-- ============================================================
-- Innsaeit Client Dashboard : Supabase schema
-- Multi-tenant artwork pipeline tracker
-- Run this in Supabase SQL Editor on a fresh project.
-- Security posture: anon key + RLS only. No service role in client code.
-- ============================================================

-- ---------- TENANTS ----------
create table public.clients (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,          -- subdomain, e.g. 'hamleys'
  theme       jsonb not null default '{}',   -- per-client theme overrides
  created_at  timestamptz not null default now()
);

-- ---------- USERS ----------
-- Mirrors auth.users. Created by trigger on signup; role assigned by admin.
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  role        text not null default 'client' check (role in ('admin','client')),
  client_id   uuid references public.clients(id),
  created_at  timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper: is current user an admin?
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Helper: current user's client_id
create or replace function public.my_client_id()
returns uuid language sql stable security definer set search_path = public as $$
  select client_id from public.profiles where id = auth.uid();
$$;

-- ---------- STAGE TEMPLATES (per client, so workflow is config not code) ----------
create table public.stage_templates (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid not null references public.clients(id) on delete cascade,
  stage_key         text not null,
  label             text not null,
  position          int  not null,
  is_optional       boolean not null default false,
  client_can_toggle boolean not null default false,
  unique (client_id, stage_key)
);

-- ---------- WORK ----------
create table public.projects (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete cascade,
  name        text not null,                 -- e.g. 'Youreka UNA 7 SKUs'
  vendor      text,                          -- factory / vendor name
  status      text not null default 'active' check (status in ('active','on_hold','done','archived')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.skus (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references public.projects(id) on delete cascade,
  client_id           uuid not null references public.clients(id),
  product_name        text not null,
  hamleys_sku         text,                  -- e.g. 1032883
  vendor_item_code    text,                  -- e.g. SK-901B, ZN66
  sub_brand           text,                  -- Ralleyz, Youreka, Snapkid, or null
  compliance_owner    text not null default 'internal'
                       check (compliance_owner in ('internal','hamleys_hk_uk')),
  second_gate         boolean not null default false,  -- export SKUs needing both gates
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table public.sku_stages (
  id          uuid primary key default gen_random_uuid(),
  sku_id      uuid not null references public.skus(id) on delete cascade,
  client_id   uuid not null references public.clients(id),
  stage_key   text not null,
  done        boolean not null default false,
  done_at     timestamptz,
  done_by     uuid references public.profiles(id),
  unique (sku_id, stage_key)
);

create table public.artwork_versions (
  id          uuid primary key default gen_random_uuid(),
  sku_id      uuid not null references public.skus(id) on delete cascade,
  client_id   uuid not null references public.clients(id),
  version     int not null,                  -- 1, 2, 3...
  label       text,                          -- 'Draft 1', 'Final'
  created_at  timestamptz not null default now(),
  unique (sku_id, version)
);

-- ---------- FILES, LINKS, TEXT BRIEFS ----------
create table public.files (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.clients(id),
  sku_id        uuid references public.skus(id) on delete cascade,
  project_id    uuid references public.projects(id) on delete cascade,
  version_id    uuid references public.artwork_versions(id) on delete cascade,
  kind          text not null check (kind in
                  ('brief_text','brief_file','reference','draft',
                   'compliance_feedback','mockup','final_print','external_link','other')),
  title         text not null,
  text_content  text,                        -- WhatsApp briefs pasted here
  external_url  text,                        -- Playbook / Smash / WeTransfer links vault
  drive_item_id text,                        -- OneDrive item id
  drive_path    text,
  file_name     text,
  mime_type     text,
  size_bytes    bigint,
  uploaded_by   uuid references public.profiles(id),
  created_at    timestamptz not null default now()
);

create table public.comments (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id),
  sku_id      uuid references public.skus(id) on delete cascade,
  file_id     uuid references public.files(id) on delete cascade,
  body        text not null,
  author_id   uuid not null references public.profiles(id),
  created_at  timestamptz not null default now()
);

-- ---------- ONEDRIVE TOKENS (server-side only; no client policies at all) ----------
create table public.integration_tokens (
  id            text primary key,            -- 'onedrive'
  refresh_token text not null,
  updated_at    timestamptz not null default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.clients            enable row level security;
alter table public.profiles           enable row level security;
alter table public.stage_templates    enable row level security;
alter table public.projects           enable row level security;
alter table public.skus               enable row level security;
alter table public.sku_stages         enable row level security;
alter table public.artwork_versions   enable row level security;
alter table public.files              enable row level security;
alter table public.comments           enable row level security;
alter table public.integration_tokens enable row level security;
-- integration_tokens: NO policies -> only service role (server) can touch it.

-- profiles
create policy "read own profile or admin reads all" on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy "admin updates profiles" on public.profiles
  for update using (public.is_admin());

-- clients
create policy "admin full access clients" on public.clients
  for all using (public.is_admin()) with check (public.is_admin());
create policy "client reads own client" on public.clients
  for select using (id = public.my_client_id());

-- generic pattern: admin = everything, client = read own tenant
create policy "admin all stage_templates" on public.stage_templates
  for all using (public.is_admin()) with check (public.is_admin());
create policy "client reads stage_templates" on public.stage_templates
  for select using (client_id = public.my_client_id());

create policy "admin all projects" on public.projects
  for all using (public.is_admin()) with check (public.is_admin());
create policy "client reads projects" on public.projects
  for select using (client_id = public.my_client_id());

create policy "admin all skus" on public.skus
  for all using (public.is_admin()) with check (public.is_admin());
create policy "client reads skus" on public.skus
  for select using (client_id = public.my_client_id());

create policy "admin all sku_stages" on public.sku_stages
  for all using (public.is_admin()) with check (public.is_admin());
create policy "client reads sku_stages" on public.sku_stages
  for select using (client_id = public.my_client_id());

-- The single client-actionable checkbox: 'final_approved_for_print'
-- (and any future stage where the template marks client_can_toggle = true)
create policy "client toggles approved stages only" on public.sku_stages
  for update using (
    client_id = public.my_client_id()
    and exists (
      select 1 from public.stage_templates t
      where t.client_id = sku_stages.client_id
        and t.stage_key = sku_stages.stage_key
        and t.client_can_toggle = true
    )
  ) with check (
    client_id = public.my_client_id()
  );

create policy "admin all versions" on public.artwork_versions
  for all using (public.is_admin()) with check (public.is_admin());
create policy "client reads versions" on public.artwork_versions
  for select using (client_id = public.my_client_id());

create policy "admin all files" on public.files
  for all using (public.is_admin()) with check (public.is_admin());
create policy "client reads files" on public.files
  for select using (client_id = public.my_client_id());

create policy "admin all comments" on public.comments
  for all using (public.is_admin()) with check (public.is_admin());
create policy "client reads comments" on public.comments
  for select using (client_id = public.my_client_id());
create policy "client writes comments" on public.comments
  for insert with check (client_id = public.my_client_id() and author_id = auth.uid());

-- ============================================================
-- SEED : Hamleys tenant + 14-stage pipeline
-- ============================================================
insert into public.clients (name, slug) values ('Hamleys', 'hamleys');

insert into public.stage_templates (client_id, stage_key, label, position, is_optional, client_can_toggle)
select c.id, s.stage_key, s.label, s.position, s.is_optional, s.client_can_toggle
from public.clients c,
(values
  ('files_received',          'Files Received',                1,  false, false),
  ('brief_received',          'Brief Received',                2,  false, false),
  ('sub_brand_assigned',      'Sub-brand Assigned',            3,  false, false),
  ('buyer_reference',         'Buyer Reference Received',      4,  true,  false),
  ('callouts_finalized',      'Callouts Finalized',            5,  false, false),
  ('draft_1',                 'Draft 1 Uploaded',              6,  false, false),
  ('corrections_received',    'Corrections Received',          7,  false, false),
  ('final_draft',             'Final Draft Uploaded',          8,  false, false),
  ('compliance_sent',         'Compliance Check Sent',         9,  false, false),
  ('compliance_approved',     'Compliance Approved',           10, false, false),
  ('final_approved_for_print','Final Approved for Print',      11, false, true ),
  ('sent_to_vendor',          'Sent to Vendor for Printing',   12, false, false),
  ('mockup_received',         'Mock-up Photos Received',       13, true,  false),
  ('in_production',           'In Production',                 14, false, false)
) as s(stage_key, label, position, is_optional, client_can_toggle)
where c.slug = 'hamleys';

-- Auto-create stage rows whenever a SKU is created
create or replace function public.create_sku_stages()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.sku_stages (sku_id, client_id, stage_key)
  select new.id, new.client_id, t.stage_key
  from public.stage_templates t
  where t.client_id = new.client_id;
  return new;
end; $$;

create trigger on_sku_created
  after insert on public.skus
  for each row execute function public.create_sku_stages();

-- Keep updated_at fresh
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger touch_projects before update on public.projects
  for each row execute function public.touch_updated_at();
create trigger touch_skus before update on public.skus
  for each row execute function public.touch_updated_at();
