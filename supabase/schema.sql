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
  drive_item_id text,                        -- legacy OneDrive item id (pre-R2 rows only)
  drive_path    text,                        -- legacy OneDrive path (pre-R2 rows only)
  storage_key   text,                        -- R2 object key: innsaeit/{client}/{project}/{sku}/{ts}-{file}
  storage_provider text default 'r2',
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
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz,                                   -- soft delete: set, never hard-deleted
  deleted_by  uuid references public.profiles(id)            -- who removed it (author or admin)
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
-- Clients only see non-deleted comments in their tenant.
create policy "client reads comments" on public.comments
  for select using (client_id = public.my_client_id() and deleted_at is null);
create policy "client writes comments" on public.comments
  for insert with check (client_id = public.my_client_id() and author_id = auth.uid());

-- Soft-delete function enforces: admin OR the comment's own author may delete.
-- Runs as SECURITY DEFINER so it can bypass RLS to update deleted_at/deleted_by.
create or replace function public.delete_comment(comment_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_author uuid;
begin
  select author_id into v_author from public.comments where id = comment_id;
  if v_author is null then
    raise exception 'comment not found';
  end if;
  if not (public.is_admin() or v_author = auth.uid()) then
    raise exception 'not authorized';
  end if;
  update public.comments
    set deleted_at = now(), deleted_by = auth.uid()
    where id = comment_id;
end; $$;

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

-- ===== Migration: Buyer field (project + SKU override) =====
-- The projects/skus tables already exist live, so apply just this block in the
-- Supabase SQL Editor. The columns inherit the existing RLS policies (admin write,
-- client read), so no new policies are required.
-- A SKU's effective buyer is computed at read time: buyer_override if set,
-- otherwise the parent project's buyer (null buyer_override = inherit).
alter table public.projects add column if not exists buyer text;
alter table public.skus add column if not exists buyer_override text;

-- ===== Migration: Comment soft-delete =====
-- Run this block in the Supabase SQL Editor against the live project.
-- 1. Add soft-delete columns to comments.
alter table public.comments add column if not exists deleted_at  timestamptz;
alter table public.comments add column if not exists deleted_by  uuid references public.profiles(id);

-- 2. Tighten the client read policy to hide deleted comments.
drop policy if exists "client reads comments" on public.comments;
create policy "client reads comments" on public.comments
  for select using (client_id = public.my_client_id() and deleted_at is null);

-- 3. Create the security-definer soft-delete function.
create or replace function public.delete_comment(comment_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_author uuid;
begin
  select author_id into v_author from public.comments where id = comment_id;
  if v_author is null then
    raise exception 'comment not found';
  end if;
  if not (public.is_admin() or v_author = auth.uid()) then
    raise exception 'not authorized';
  end if;
  update public.comments
    set deleted_at = now(), deleted_by = auth.uid()
    where id = comment_id;
end; $$;

-- ===== Migration: Client "Request changes" flag =====
-- Run this block in the Supabase SQL Editor against the live project.
-- 1. Flag columns on skus. They inherit existing RLS (admin write, client read).
alter table public.skus add column if not exists changes_requested boolean not null default false;
alter table public.skus add column if not exists changes_requested_at timestamptz;
alter table public.skus add column if not exists changes_requested_by uuid references public.profiles(id);

-- 2. Postgres RLS cannot restrict an UPDATE policy to specific columns, so a
--    client UPDATE policy on skus would expose every column on permitted rows.
--    Instead, reuse the delete_comment pattern: a SECURITY DEFINER function
--    that only ever sets these three columns. No existing policy is touched;
--    the client write surface on skus stays zero outside this function.
--    Admin "Resolve" clears the flag via the existing "admin all skus" policy.
create or replace function public.request_sku_changes(p_sku_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_client uuid;
begin
  select client_id into v_client from public.skus where id = p_sku_id;
  if v_client is null then
    raise exception 'sku not found';
  end if;
  if not (public.is_admin() or v_client = public.my_client_id()) then
    raise exception 'not authorized';
  end if;
  update public.skus
     set changes_requested    = true,
         changes_requested_at = now(),
         changes_requested_by = auth.uid()
   where id = p_sku_id;
end; $$;

-- ===== Migration: Two-track compliance checklists + power type + IM tracking =====
-- Run this whole block in the Supabase SQL Editor against the live project.
-- Additive only: no existing table, policy, trigger or function is modified.

-- 1. New SKU columns. They inherit existing skus RLS (admin write, client read).
alter table public.skus add column if not exists power_type text not null default 'unknown'
  check (power_type in ('unknown','battery','rechargeable_usb','non_electronic','ride_on'));
alter table public.skus add column if not exists compliance_user_id uuid references public.profiles(id);
alter table public.skus add column if not exists has_im boolean not null default false;
alter table public.skus add column if not exists im_done boolean not null default false;
alter table public.skus add column if not exists im_done_at timestamptz;

-- 2. Checklist templates (per tenant). Admin-only: clients get zero policies here.
--    NOTE: unique key includes condition — the same label can legitimately appear
--    under two conditions (e.g. the bin-symbol item for battery AND rechargeable_usb).
create table public.checklist_templates (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients(id) on delete cascade,
  audience   text not null check (audience in ('admin','compliance')),
  label      text not null,
  condition  text not null default 'all'
              check (condition in ('all','battery','rechargeable_usb','non_electronic','ride_on','has_im')),
  position   int not null,
  unique (client_id, audience, condition, label)
);

-- 3. Per-SKU checklist items (copied from templates; admins may add custom rows).
create table public.sku_checklist_items (
  id          uuid primary key default gen_random_uuid(),
  sku_id      uuid not null references public.skus(id) on delete cascade,
  client_id   uuid not null references public.clients(id),
  audience    text not null check (audience in ('admin','compliance')),
  label       text not null,
  checked     boolean not null default false,
  checked_at  timestamptz,
  checked_by  uuid references public.profiles(id),
  position    int not null default 0,
  created_at  timestamptz not null default now()
);
create index sku_checklist_items_sku_idx on public.sku_checklist_items (sku_id);

-- 4. RLS.
alter table public.checklist_templates enable row level security;
alter table public.sku_checklist_items enable row level security;

create policy "admin all checklist_templates" on public.checklist_templates
  for all using (public.is_admin()) with check (public.is_admin());
-- Deliberately NO client policy on checklist_templates: the internal checklist
-- definitions are never readable by client users.

create policy "admin all sku_checklist_items" on public.sku_checklist_items
  for all using (public.is_admin()) with check (public.is_admin());

-- The ONE assigned compliance checker reads compliance-audience items on their
-- assigned SKUs. audience='admin' rows are invisible to every client, as are
-- compliance rows on SKUs assigned to someone else (or to nobody).
create policy "assigned checker reads compliance items" on public.sku_checklist_items
  for select using (
    audience = 'compliance'
    and client_id = public.my_client_id()
    and exists (
      select 1 from public.skus s
      where s.id = sku_checklist_items.sku_id
        and s.compliance_user_id = auth.uid()
    )
  );
-- No client insert/update/delete policies: ticking goes through the RPC below
-- (RLS cannot restrict an UPDATE to specific columns — same reasoning as
-- request_sku_changes above).

-- 5. Idempotent item generation — single source of truth for all three paths:
--    SKU creation (trigger below), power_type / has_im changes, and the
--    "Load checklist" button. Copies templates where condition='all', or
--    condition = the SKU's power_type ('unknown' matches nothing extra), or
--    condition='has_im' when the SKU has an instruction manual.
--    Idempotency key: (sku_id, audience, label) — re-running only adds missing
--    items and never touches checked ones. Stale UNCHECKED template items whose
--    condition no longer applies are pruned; checked items and admin-added
--    custom items (labels with no template) always survive.
create or replace function public.generate_sku_checklist(p_sku_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_sku public.skus%rowtype;
begin
  select * into v_sku from public.skus where id = p_sku_id;
  if v_sku.id is null then
    raise exception 'sku not found';
  end if;
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  delete from public.sku_checklist_items i
   where i.sku_id = p_sku_id
     and i.checked = false
     and exists (
       select 1 from public.checklist_templates t
        where t.client_id = v_sku.client_id
          and t.audience  = i.audience
          and t.label     = i.label)
     and not exists (
       select 1 from public.checklist_templates t
        where t.client_id = v_sku.client_id
          and t.audience  = i.audience
          and t.label     = i.label
          and (t.condition = 'all'
               or t.condition = v_sku.power_type
               or (t.condition = 'has_im' and v_sku.has_im)));

  insert into public.sku_checklist_items (sku_id, client_id, audience, label, position)
  select p_sku_id, v_sku.client_id, t.audience, t.label, t.position
  from public.checklist_templates t
  where t.client_id = v_sku.client_id
    and (t.condition = 'all'
         or t.condition = v_sku.power_type
         or (t.condition = 'has_im' and v_sku.has_im))
    and not exists (
      select 1 from public.sku_checklist_items i
       where i.sku_id   = p_sku_id
         and i.audience = t.audience
         and i.label    = t.label);
end; $$;

-- 6. Auto-generate checklist items when a SKU is created (additive trigger;
--    on_sku_created / create_sku_stages are untouched). SKU inserts are
--    admin-only via RLS, so the is_admin() guard inside always passes.
create or replace function public.create_sku_checklist()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.generate_sku_checklist(new.id);
  return new;
end; $$;

create trigger on_sku_created_checklist
  after insert on public.skus
  for each row execute function public.create_sku_checklist();

-- 7. Tick/untick RPC — the only client write path on sku_checklist_items.
--    Only ever sets checked / checked_at / checked_by. Admins can tick both
--    lists; the assigned checker can tick compliance items on their SKUs only.
create or replace function public.toggle_checklist_item(p_item_id uuid, p_checked boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_audience text;
  v_checker  uuid;
begin
  select i.audience, s.compliance_user_id into v_audience, v_checker
  from public.sku_checklist_items i
  join public.skus s on s.id = i.sku_id
  where i.id = p_item_id;
  if v_audience is null then
    raise exception 'item not found';
  end if;
  if not (public.is_admin()
          or (v_audience = 'compliance' and v_checker = auth.uid())) then
    raise exception 'not authorized';
  end if;
  update public.sku_checklist_items
     set checked    = p_checked,
         checked_at = case when p_checked then now() else null end,
         checked_by = case when p_checked then auth.uid() else null end
   where id = p_item_id;
end; $$;

-- 8. SEED: Hamleys ADMIN checklist (the designer's pre-send routine).
insert into public.checklist_templates (client_id, audience, condition, label, position)
select c.id, 'admin', t.condition, t.label, t.position
from public.clients c,
(values
  ('all',              'Product name & callouts match approved brief',                              1),
  ('all',              'Sub-brand logo & lockup correct',                                           2),
  ('all',              'Hamleys SKU & vendor item code on dieline correct',                         3),
  ('all',              'Age grading present in full format ("X+ years" or range) and value confirmed', 4),
  ('all',              'MRP / importer / manufacturer block complete',                              5),
  ('all',              'Barcode present, correct number, scannable size',                           6),
  ('all',              'Net/pack contents list matches product',                                    7),
  ('all',              'Artwork resolution print-ready (no pixelated images)',                      8),
  ('all',              'Dieline & dimensions match vendor die',                                     9),
  ('battery',          'Battery type, count & specification stated',                               10),
  ('battery',          'Battery installation diagram included (or written description if internal)', 11),
  ('rechargeable_usb', '"USB cable included/not included" stated',                                 12),
  ('rechargeable_usb', 'USB charging caution + charging instructions on artwork',                  13),
  ('battery',          'Crossed-out bin symbol WITH block underneath, min 7mm height incl. the X', 14),
  ('rechargeable_usb', 'Crossed-out bin symbol WITH block underneath, min 7mm height incl. the X', 15),
  ('non_electronic',   'Crossed-out bin symbol REMOVED (non-electronic product)',                  16),
  ('non_electronic',   'Recycle symbol added',                                                     17),
  ('ride_on',          'Special usage/safety warning for ride-ons included',                       18),
  ('ride_on',          'BIS third-party testing confirmed for CKD route',                          19),
  ('has_im',           'IM artwork complete & included in print files',                            20)
) as t(condition, label, position)
where c.slug = 'hamleys';

-- 9. SEED: Hamleys COMPLIANCE checklist (the checker's review).
insert into public.checklist_templates (client_id, audience, condition, label, position)
select c.id, 'compliance', t.condition, t.label, t.position
from public.clients c,
(values
  ('all',              'Age grading format & value correct',                          1),
  ('all',              'Warning & safety text complete (BIS/EN71 as applicable)',     2),
  ('all',              'MRP / importer / manufacturer details verified',              3),
  ('all',              'Artwork legible at print size',                               4),
  ('battery',          'Battery diagram, instruction & specification verified',       5),
  ('rechargeable_usb', 'USB charging caution & cable-included statement verified',    6),
  ('battery',          'Bin symbol present, ≥7mm with block',                         7),
  ('rechargeable_usb', 'Bin symbol present, ≥7mm with block',                         8),
  ('non_electronic',   'No bin symbol present; recycle symbol present',               9),
  ('ride_on',          'Ride-on usage warning verified',                             10),
  ('all',              'Compliance approved — okay to proceed for print',            11)
) as t(condition, label, position)
where c.slug = 'hamleys';

-- ===== Migration: Activity feed privacy (hide admin-actored events) =====
-- Run this block in the Supabase SQL Editor against the live project.
-- The activity feed must never surface an admin's own actions, for admins or
-- clients. Profiles RLS ("read own profile or admin reads all") hides admin rows
-- from client users, so client code cannot identify admin actors with a plain
-- profiles query. This SECURITY DEFINER function returns admin UUIDs only (no
-- names/emails) regardless of RLS; the data layer filters events against it.
create or replace function public.admin_profile_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select id from public.profiles where role = 'admin';
$$;
grant execute on function public.admin_profile_ids() to authenticated;

-- ===== Migration: "Files Checked" pipeline stage at position 2 =====
-- Run this block in the Supabase SQL Editor against the live project.
-- Inserts a non-optional, non-client-toggleable stage between "Files Received"
-- (pos 1) and "Brief Received". Idempotent and guarded: the position shift only
-- runs if files_checked does not already exist, so a re-run cannot double-shift.
do $$
declare hid uuid;
begin
  select id into hid from public.clients where slug = 'hamleys';
  if hid is not null and not exists (
    select 1 from public.stage_templates where client_id = hid and stage_key = 'files_checked'
  ) then
    -- (a) shift positions >= 2 up by one
    update public.stage_templates set position = position + 1
      where client_id = hid and position >= 2;
    -- (b) insert the new template at position 2
    insert into public.stage_templates (client_id, stage_key, label, position, is_optional, client_can_toggle)
      values (hid, 'files_checked', 'Files Checked', 2, false, false);
    -- (c) backfill an unchecked sku_stages row for every existing Hamleys SKU
    insert into public.sku_stages (sku_id, client_id, stage_key)
      select s.id, s.client_id, 'files_checked' from public.skus s where s.client_id = hid
      on conflict (sku_id, stage_key) do nothing;
  end if;
end $$;

-- ===== Migration: Print vendor on SKUs =====
-- Run this block in the Supabase SQL Editor against the live project.
-- Distinct from projects.vendor (the factory) — this is where final files go for
-- printing. Inherits existing skus RLS (admin write, client read).
alter table public.skus add column if not exists print_vendor text;

-- ===== Migration: Email digests + live compliance-approved notification =====
-- Run this block in the Supabase SQL Editor against the live project.
-- One daily digest per recipient (admin / supervisor / buyer / checker) sent by
-- /api/cron/daily-digest; the single live email is compliance approval via
-- /api/notify/compliance-approved. digest_log dedupes both.

-- 1. Recipient columns. They inherit existing RLS (admin write, client read own
--    tenant) — supervisor_email and the checker UUIDs become readable by the
--    tenant's client users (colleagues' work info; acceptable).
alter table public.clients  add column if not exists supervisor_email text;
alter table public.clients  add column if not exists compliance_india_user_id  uuid references public.profiles(id);
alter table public.clients  add column if not exists compliance_global_user_id uuid references public.profiles(id);
alter table public.projects add column if not exists buyer_email text;
alter table public.skus     add column if not exists buyer_email_override text;

-- 2. digest_log: send ledger. RLS enabled with ZERO policies — service role
--    (the API) only, same pattern as integration_tokens.
create table if not exists public.digest_log (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null,   -- admin_digest|supervisor_digest|buyer_digest|checker_digest|compliance_approved
  recipient   text not null,
  sku_id      uuid references public.skus(id) on delete set null,
  digest_date date,            -- UTC run date for dailies; NULL for live emails
  sent_at     timestamptz not null default now(),
  meta        jsonb not null default '{}'
);
alter table public.digest_log enable row level security;
-- Daily dedupe: one row per kind+recipient+day. NOT partial: NULL digest_date
-- rows (live emails) never conflict, and supabase-js upsert onConflict cannot
-- target a partial index.
create unique index if not exists digest_log_daily_uniq
  on public.digest_log (kind, recipient, digest_date);
-- Live 10-minute dedupe lookup.
create index if not exists digest_log_live_idx
  on public.digest_log (kind, sku_id, sent_at);

-- 3. Hamleys wiring. Run scripts/create_users.mjs FIRST so Emily Liu exists,
--    otherwise re-run the second UPDATE once she does (its subselect returns
--    null until then). Verify Emily's real email — eliu@hamleys.com.hk is a
--    placeholder.
update public.clients set supervisor_email = 'neha.gadia@ril.com' where slug = 'hamleys';
update public.clients set
  compliance_india_user_id  = (select id from public.profiles where lower(email) = lower('Santosh107.Kumar@ril.com')),
  compliance_global_user_id = (select id from public.profiles where lower(email) = 'eliu@hamleys.com.hk')
where slug = 'hamleys';

-- ===== Migration: Onboarding tour =====
-- Run this block in the Supabase SQL Editor against the live project.
-- 1. Flag on profiles. Existing rows default to false, so everyone gets the
--    guided tour exactly once after deploy.
alter table public.profiles add column if not exists onboarded boolean not null default false;

-- 2. Clients cannot UPDATE profiles (admin-only policy), so reuse the
--    delete_comment pattern: a SECURITY DEFINER function that touches exactly
--    one column on the caller's own row.
create or replace function public.mark_onboarded()
returns void language sql security definer set search_path = public as $$
  update public.profiles set onboarded = true where id = auth.uid();
$$;
grant execute on function public.mark_onboarded() to authenticated;
