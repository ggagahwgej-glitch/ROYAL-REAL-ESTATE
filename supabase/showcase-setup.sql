-- ==================================================================
-- IMPERIAL ROYAL — SHOWCASE SETUP   (generated; do not hand-edit)
-- Source of truth: scripts/generate-showcase.py
--
-- ONE-PASTE SETUP for the client's Supabase project.
-- Run this ONCE in Supabase Dashboard > SQL Editor > New query > Run.
-- Safe to re-run: every statement is guarded or idempotent.
--
-- WHAT THIS FIXES
--   The project was created for a DIFFERENT application ("Aurum Estates").
--   Its `properties`, `property_media`, `inquiries` and `site_settings`
--   tables have a different shape. `create table if not exists` would
--   silently KEEP that shape, so section 0 verifies EVERY column the
--   schema, policies and seed need before deciding to rebuild.
--
-- DATA SAFETY
--   Before replacing anything, the existing rows of every affected table
--   are COPIED to public.imperial_legacy_* tables. Nothing is deleted
--   without a backup. The backup is created only once.
--
-- CONTENT
--   20 showcase residences, 60 gallery images and 8 sample references with
--   star ratings are inserted. These are DEMONSTRATION records for a client
--   example site, not real inventory and not genuine client endorsements.
--   Remove them from the Owner Studio before using this project for real.
--
-- ALSO INSTALLED: RLS policies, inquiry trigger, storage buckets, and
--   owner provisioning (the first auth user becomes the verified owner).
-- ==================================================================

-- ---------------------------------------------------------------- 0. guard
-- A half-migrated project is worse than an empty one. Check ALL required
-- columns of all four content tables, not just one sentinel column.
do $guard$
declare
  mismatched boolean := false;
  tbl text;
begin
  with needed(t, cols) as (
    values
      ('properties', array[
        'id','owner_id','slug','title','subtitle','description','listing_type',
        'category','status','availability','price','currency','price_period',
        'location','city','address','country','bedrooms','bathrooms','area_sqft',
        'lot_sqft','year_built','featured','amenities','features','latitude',
        'longitude','map_url','meta_title','meta_description','created_at','updated_at']),
      ('property_media', array[
        'id','property_id','kind','storage_path','public_url','position',
        'is_cover','alt_text','mime_type','file_size','created_at']),
      ('inquiries', array[
        'id','property_id','name','email','phone','message','status','source',
        'created_at','updated_at']),
      ('site_settings', array[
        'id','business_name','tagline','logo_url','favicon_url','contact_email',
        'contact_phone','whatsapp','address','hero_heading','hero_subheading',
        'hero_image','social','footer_text','footer_note','seo_title',
        'seo_description','testimonials','theme','updated_at'])
  )
  select coalesce(bool_or(
    to_regclass('public.' || n.t) is not null
    and exists (
      select 1 from unnest(n.cols) as c(col)
      where not exists (
        select 1 from information_schema.columns ic
        where ic.table_schema = 'public'
          and ic.table_name = n.t
          and ic.column_name = c.col
      )
    )
  ), false) into mismatched
  from needed n;

  if mismatched then
    -- Keep a copy of the previous application's data, once only.
    if to_regclass('public.imperial_legacy_backup') is null then
      for tbl in select unnest(array['properties','property_media','inquiries','site_settings','profiles'])
      loop
        if to_regclass('public.' || tbl) is not null then
          execute format('create table if not exists public.%I as select * from public.%I',
                         'imperial_legacy_' || tbl, tbl);
        end if;
      end loop;
      execute 'create table public.imperial_legacy_backup (created_at timestamptz not null default now())';
      execute 'insert into public.imperial_legacy_backup default values';
    end if;
    -- Children first. `profiles` is kept and aligned below so the auth.users
    -- trigger and public.is_owner() never lose their target table.
    execute 'drop table if exists public.property_media cascade';
    execute 'drop table if exists public.inquiries cascade';
    execute 'drop table if exists public.properties cascade';
    execute 'drop table if exists public.site_settings cascade';
    raise notice 'Imperial Royal: legacy schema detected. Old rows backed up to imperial_legacy_* and content tables rebuilt.';
  end if;

  -- profiles is referenced by is_owner() and the auth.users trigger. Only a
  -- table with no uuid `id` must be rebuilt; otherwise align it in place.
  if to_regclass('public.profiles') is not null and (
       not exists (select 1 from information_schema.columns
                   where table_schema = 'public' and table_name = 'profiles' and column_name = 'id')
       or exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'profiles'
                    and column_name = 'id' and data_type <> 'uuid')) then
    execute 'drop table if exists public.profiles cascade';
    execute $ddl$create table public.profiles (
      id uuid primary key references auth.users(id) on delete cascade,
      email text not null default '', full_name text,
      is_owner boolean not null default false,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now())$ddl$;
  end if;

  if to_regclass('public.profiles') is not null then
    alter table public.profiles add column if not exists email text;
    alter table public.profiles add column if not exists full_name text;
    alter table public.profiles add column if not exists is_owner boolean not null default false;
    alter table public.profiles add column if not exists created_at timestamptz not null default now();
    alter table public.profiles add column if not exists updated_at timestamptz not null default now();
    create unique index if not exists imperial_profiles_id_key on public.profiles (id);
    -- Unknown NOT NULL columns without defaults would break handle_new_user().
    for tbl in
      select column_name from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles'
        and is_nullable = 'NO' and column_default is null
        and column_name not in ('id','email','is_owner','created_at','updated_at')
    loop
      execute format('alter table public.profiles alter column %I drop not null', tbl);
    end loop;
  end if;
end $guard$;

-- ------------------------------------------------- 0b. privilege repair
-- An interrupted earlier run may have enabled RLS without reaching the
-- GRANT statements. Restore the minimum public privileges whenever the
-- tables exist, so the site is never locked out by a partial migration.
do $grants$
begin
  execute 'grant usage on schema public to anon, authenticated';
  if to_regclass('public.properties') is not null then
    execute 'grant select on public.properties to anon, authenticated';
    execute 'grant all on public.properties to authenticated';
  end if;
  if to_regclass('public.property_media') is not null then
    execute 'grant select on public.property_media to anon, authenticated';
    execute 'grant all on public.property_media to authenticated';
  end if;
  if to_regclass('public.site_settings') is not null then
    execute 'grant select on public.site_settings to anon, authenticated';
    execute 'grant all on public.site_settings to authenticated';
  end if;
  if to_regclass('public.inquiries') is not null then
    execute 'revoke all on public.inquiries from anon';
    execute 'grant insert on public.inquiries to anon';
    execute 'grant all on public.inquiries to authenticated';
  end if;
  if to_regclass('public.profiles') is not null then
    -- A different application's script may have granted anon access to
    -- profiles.is_owner. Close that hole on every run.
    execute 'revoke all on public.profiles from anon';
    execute 'grant select on public.profiles to authenticated';
  end if;
exception when others then
  raise notice 'Imperial Royal: privilege repair deferred (%)', sqlerrm;
end $grants$;

-- ==================================================================
-- IMPERIAL ROYAL REAL ESTATE — Supabase schema, RLS and constraints
-- Run this ONCE in the Supabase SQL Editor for the client's project.
-- Requires ONLY the project URL + publishable/anon key at runtime.
-- No service-role key is ever used by the application.
-- ==================================================================
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- 1. helpers
create or replace function public.is_owner()
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select coalesce((select p.is_owner from public.profiles p where p.id = auth.uid()), false);
$$;
revoke all on function public.is_owner() from public;
grant execute on function public.is_owner() to anon, authenticated;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ---------------------------------------------------------------- 2. profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  is_owner boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on column public.profiles.is_owner is
  'SECURITY: only the project administrator can change this in the Supabase SQL Editor. No PostgREST policy permits insert/update/delete of profiles.';

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, is_owner)
  values (new.id, coalesce(new.email, ''), new.raw_user_meta_data->>'full_name', false)
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Defence in depth: a browser/API user can never elevate itself even if a
-- future policy accidentally grants UPDATE on profiles.
-- The guard keys off the JWT CONTEXT, not auth.uid(): a key-only (anon)
-- request has auth.uid() = NULL, so an "auth.uid() is not null" test would
-- leave the flag writable from the API. PostgREST always exposes the claims
-- GUC; the SQL Editor never does, so provisioning still works there.
create or replace function public.protect_owner_flag()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_owner is distinct from old.is_owner
     and coalesce(current_setting('request.jwt.claims', true), '') <> '' then
    raise exception 'Owner privileges cannot be self-assigned. Provision the owner in the Supabase SQL Editor (supabase/owner-provisioning.sql).';
  end if;
  new.updated_at = now();
  return new;
end $$;
drop trigger if exists protect_owner_flag on public.profiles;
create trigger protect_owner_flag before update on public.profiles
  for each row execute function public.protect_owner_flag();

-- Backfill profiles for any users created before this script ran.
insert into public.profiles (id, email, is_owner)
select u.id, coalesce(u.email, ''), false from auth.users u
on conflict (id) do nothing;

-- --------------------------------------------------------------- 3. properties
create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  slug text not null unique,
  title text not null check (char_length(title) between 2 and 180),
  subtitle text,
  description text,
  listing_type text not null default 'buy' check (listing_type in ('buy','rent')),
  category text not null default 'Villa',
  status text not null default 'draft' check (status in ('draft','published')),
  availability text not null default 'available' check (availability in ('available','reserved','sold','rented')),
  price numeric(16,2) not null default 0 check (price >= 0),
  currency text not null default 'INR',
  price_period text,
  location text not null default '',
  city text not null default '',
  address text,
  country text not null default 'India',
  bedrooms integer not null default 0 check (bedrooms >= 0),
  bathrooms integer not null default 0 check (bathrooms >= 0),
  area_sqft numeric(12,2) not null default 0 check (area_sqft >= 0),
  lot_sqft numeric(12,2) check (lot_sqft is null or lot_sqft >= 0),
  year_built integer check (year_built is null or year_built between 1500 and 2200),
  featured boolean not null default false,
  amenities text[] not null default '{}',
  features text[] not null default '{}',
  latitude numeric(10,7) check (latitude is null or latitude between -90 and 90),
  longitude numeric(10,7) check (longitude is null or longitude between -180 and 180),
  map_url text,
  meta_title text,
  meta_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists properties_status_idx on public.properties(status);
create index if not exists properties_listing_idx on public.properties(listing_type);
create index if not exists properties_city_idx on public.properties(city);
create index if not exists properties_category_idx on public.properties(category);
create index if not exists properties_price_idx on public.properties(price);
create index if not exists properties_featured_idx on public.properties(featured) where featured = true;
create index if not exists properties_created_idx on public.properties(created_at desc);
drop trigger if exists properties_touch on public.properties;
create trigger properties_touch before update on public.properties
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------- 4. property_media
create table if not exists public.property_media (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  kind text not null default 'image' check (kind in ('image','video')),
  storage_path text not null,
  public_url text not null,
  position integer not null default 0 check (position >= 0),
  is_cover boolean not null default false,
  alt_text text,
  mime_type text,
  file_size bigint check (file_size is null or file_size >= 0),
  created_at timestamptz not null default now()
);
create index if not exists property_media_property_idx on public.property_media(property_id, position);
create unique index if not exists property_media_one_cover
  on public.property_media(property_id) where is_cover = true;

-- --------------------------------------------------------------- 5. inquiries
create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references public.properties(id) on delete set null,
  name text not null check (char_length(name) between 2 and 120),
  email text not null check (email ~* '^[^[:space:]]+@[^[:space:]]+\.[^[:space:]]{2,}$'),
  phone text,
  message text not null check (char_length(message) between 10 and 5000),
  status text not null default 'new' check (status in ('new','read','contacted','resolved')),
  source text default 'website',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists inquiries_status_idx on public.inquiries(status);
create index if not exists inquiries_created_idx on public.inquiries(created_at desc);
drop trigger if exists inquiries_touch on public.inquiries;
create trigger inquiries_touch before update on public.inquiries
  for each row execute function public.touch_updated_at();

-- A visitor controls the CONTENT of an enquiry, never its status or timestamps.
create or replace function public.guard_inquiry_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.status := 'new';
  new.source := coalesce(nullif(new.source, ''), 'website');
  new.created_at := now();
  new.updated_at := now();
  new.name := btrim(new.name);
  new.email := lower(btrim(new.email));
  new.message := btrim(new.message);
  return new;
end $$;
drop trigger if exists guard_inquiry_insert on public.inquiries;
create trigger guard_inquiry_insert before insert on public.inquiries
  for each row execute function public.guard_inquiry_insert();

-- ------------------------------------------------------------ 6. site_settings
create table if not exists public.site_settings (
  id integer primary key default 1 check (id = 1),
  business_name text not null default 'Imperial Royal',
  tagline text,
  logo_url text,
  favicon_url text,
  contact_email text,
  contact_phone text,
  whatsapp text,
  address text,
  hero_heading text,
  hero_subheading text,
  hero_image text,
  social jsonb not null default '{}'::jsonb,
  footer_text text,
  footer_note text,
  seo_title text,
  seo_description text,
  testimonials jsonb not null default '[]'::jsonb,
  theme jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.site_settings add column if not exists testimonials jsonb not null default '[]'::jsonb;
comment on column public.site_settings.testimonials is 'Real client quotes only. Enter in Owner Studio > Website settings > Testimonials with the client''s written permission.';
insert into public.site_settings (id, business_name) values (1, 'Imperial Royal') on conflict (id) do nothing;
drop trigger if exists site_settings_touch on public.site_settings;
create trigger site_settings_touch before update on public.site_settings
  for each row execute function public.touch_updated_at();

-- ==================================================================
-- 7. ROW LEVEL SECURITY
-- ==================================================================
alter table public.profiles       enable row level security;
alter table public.properties     enable row level security;
alter table public.property_media enable row level security;
alter table public.inquiries      enable row level security;
alter table public.site_settings  enable row level security;

-- A different application's setup script may have left permissive policies
-- behind (for example an anon SELECT on profiles). Remove ALL policies on the
-- five tables before installing ours, otherwise the extra policies survive
-- and can expose private data even though ours look correct.
do $policies$
declare r record;
begin
  for r in
    select policyname, tablename from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles','properties','property_media','inquiries','site_settings')
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $policies$;

drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own" on public.profiles
  for select to authenticated using (id = auth.uid());
-- Deliberately NO insert/update/delete policies on profiles.

drop policy if exists "properties: public read published" on public.properties;
create policy "properties: public read published" on public.properties
  for select to anon, authenticated using (status = 'published');
drop policy if exists "properties: owner full access" on public.properties;
create policy "properties: owner full access" on public.properties
  for all to authenticated using (public.is_owner()) with check (public.is_owner());

drop policy if exists "media: public read published property media" on public.property_media;
create policy "media: public read published property media" on public.property_media
  for select to anon, authenticated using (
    exists (select 1 from public.properties p where p.id = property_id and p.status = 'published')
  );
drop policy if exists "media: owner full access" on public.property_media;
create policy "media: owner full access" on public.property_media
  for all to authenticated using (public.is_owner()) with check (public.is_owner());

drop policy if exists "inquiries: public controlled insert" on public.inquiries;
create policy "inquiries: public controlled insert" on public.inquiries
  for insert to anon, authenticated with check (
    status = 'new'
    and char_length(name) between 2 and 120
    and char_length(message) between 10 and 5000
    and email ~* '^[^[:space:]]+@[^[:space:]]+\.[^[:space:]]{2,}$'
  );
-- Deliberately NO public select/update/delete policy on inquiries.
drop policy if exists "inquiries: owner full access" on public.inquiries;
create policy "inquiries: owner full access" on public.inquiries
  for all to authenticated using (public.is_owner()) with check (public.is_owner());

drop policy if exists "settings: public read" on public.site_settings;
create policy "settings: public read" on public.site_settings
  for select to anon, authenticated using (true);
drop policy if exists "settings: owner update" on public.site_settings;
create policy "settings: owner update" on public.site_settings
  for all to authenticated using (public.is_owner()) with check (public.is_owner());

-- Grants: RLS still governs every row.
grant usage on schema public to anon, authenticated;
grant select on public.properties, public.property_media, public.site_settings to anon, authenticated;
revoke all on public.inquiries from anon;
grant insert on public.inquiries to anon;
revoke all on public.profiles from anon;
grant select on public.profiles to authenticated;
grant all on public.properties, public.property_media, public.inquiries, public.site_settings to authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

-- ==================================================================
-- 8. NOTES
--  * This file is safe to re-run (idempotent where practical).
--  * Owner provisioning is a separate, one-time administrative step:
--    see supabase/owner-provisioning.sql
--  * Storage buckets and policies: supabase/storage.sql
--  * Independent permission tests: supabase/rls-tests.sql
-- ==================================================================

-- ---------------------------------------------------------------- 8. STORAGE
-- ==================================================================
-- STORAGE BUCKETS & POLICIES
-- Public buckets contain ONLY intentionally public media/branding.
-- Private assets live in a protected bucket with owner-only policies.
-- ==================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('property-media', 'property-media', true, 125829120,
    array['image/jpeg','image/png','image/webp','image/avif','image/gif','video/mp4','video/webm','video/quicktime']),
  ('branding', 'branding', true, 5242880,
    array['image/jpeg','image/png','image/webp','image/avif','image/gif','image/svg+xml']),
  ('owner-private', 'owner-private', false, 26214400, null)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public read for public buckets (public buckets also serve via /object/public).
drop policy if exists "public read property media" on storage.objects;
create policy "public read property media" on storage.objects
  for select to anon, authenticated using (bucket_id = 'property-media');
drop policy if exists "public read branding" on storage.objects;
create policy "public read branding" on storage.objects
  for select to anon, authenticated using (bucket_id = 'branding');

-- Only the verified owner may write to any bucket.
drop policy if exists "owner insert media" on storage.objects;
create policy "owner insert media" on storage.objects
  for insert to authenticated with check (
    bucket_id in ('property-media','branding','owner-private') and public.is_owner()
  );
drop policy if exists "owner update media" on storage.objects;
create policy "owner update media" on storage.objects
  for update to authenticated using (public.is_owner()) with check (public.is_owner());
drop policy if exists "owner delete media" on storage.objects;
create policy "owner delete media" on storage.objects
  for delete to authenticated using (public.is_owner());

-- Private bucket read is owner-only (no anon policy exists for it).
drop policy if exists "owner read private" on storage.objects;
create policy "owner read private" on storage.objects
  for select to authenticated using (bucket_id = 'owner-private' and public.is_owner());

-- ---------------------------------------------------------------- 9. SEED
insert into public.properties (
  slug,
  title,
  subtitle,
  description,
  listing_type,
  category,
  status,
  availability,
  price,
  currency,
  price_period,
  location,
  city,
  address,
  country,
  bedrooms,
  bathrooms,
  area_sqft,
  lot_sqft,
  year_built,
  featured,
  amenities,
  features,
  latitude,
  longitude,
  map_url,
  meta_title,
  meta_description
) values
    ('azure-cliff-residence',
     'The Azure Cliff Residence',
     'A private headland above the Arabian Sea, where architecture meets the horizon.',
     'Set on a dramatic headland above the Arabian Sea, The Azure Cliff Residence is a study in restraint and spectacle. Cantilevered stone volumes frame uninterrupted ocean views, while walls of glass dissolve the boundary between the grand salon and the infinity edge. Six suites, a private spa, a cliffside fire terrace and a discreet staff wing make this one of the most singular addresses on the western coast.',
     'buy',
     'Villa',
     'published',
     'available',
     485000000,
     'INR',
     null,
     'Anjuna Cliffs',
     'Goa',
     'Azure Cliff, Anjuna, North Goa 403509',
     'India',
     6,
     7,
     11200,
     38400,
     2023,
     true,
     array['Private infinity pool','Sea view','Spa & sauna','Home theatre','Staff quarters','Smart home automation','Private garage','24/7 security','Terrace']::text[],
     array['Cantilevered stone architecture','Cliffside fire terrace','Private spa and hammam','Chef''s kitchen','Glass elevator','Direct coastal frontage']::text[],
     15.5735,
     73.7392,
     null,
     'The Azure Cliff Residence · Goa',
     'A six-suite cliffside villa above the Arabian Sea with an infinity pool, private spa and uninterrupted ocean views.'),
    ('altitude-penthouse-worli',
     'Altitude, The Worli Penthouse',
     'A full-floor sky residence above the shimmering Mumbai skyline.',
     'Occupying an entire floor of one of Worli''s most distinguished towers, Altitude is a sky residence of rare proportion. A double-height salon opens onto a wraparound terrace with a heated infinity edge, while a walnut-panelled library, private lift lobby and dedicated concierge complete an address conceived for complete privacy above the city.',
     'buy',
     'Penthouse',
     'published',
     'available',
     372000000,
     'INR',
     null,
     'Worli Sea Face',
     'Mumbai',
     'Altitude, Worli Sea Face, Mumbai 400018',
     'India',
     5,
     6,
     9400,
     null,
     2022,
     true,
     array['Private elevator','Concierge service','Private infinity pool','Home theatre','Gymnasium','Smart home automation','24/7 security','Terrace']::text[],
     array['Full-floor private lift lobby','Wraparound sky terrace','Double-height salon','Walnut library','Temperature-controlled wine room']::text[],
     19.0176,
     72.816,
     null,
     'Altitude, The Worli Penthouse · Mumbai',
     'A full-floor sky residence with a heated rooftop infinity pool, double-height salon and private lift lobby above the Mumbai skyline.'),
    ('villa-serene-alibaug',
     'Villa Serene, The Olive Grove',
     'Lime-washed calm, cypress avenues and a long reflecting pool.',
     'Behind a quiet cypress avenue near the Alibaug coast, Villa Serene is a lime-washed retreat of extraordinary stillness. Deep loggias, hand-plastered walls and a long reflecting pool create a rhythm of shade and light, while six garden suites open onto olive trees and manicured lawns. An unhurried escape, twenty minutes from the jetty.',
     'buy',
     'Villa',
     'published',
     'available',
     198000000,
     'INR',
     null,
     'Awas',
     'Alibaug',
     'Villa Serene, Awas, Alibaug, Maharashtra 402201',
     'India',
     6,
     6,
     8600,
     52000,
     2021,
     false,
     array['Private infinity pool','Landscaped gardens','Staff quarters','Smart home automation','Private garage','Terrace']::text[],
     array['Olive grove and cypress avenue','Shaded loggia with linen drapes','Reflecting pool','Outdoor dining pavilion','Guest cottage']::text[],
     18.641,
     72.868,
     null,
     'Villa Serene, The Olive Grove · Alibaug',
     'A lime-washed six-suite villa with olive groves, cypress avenues and a long reflecting pool near the Alibaug coast.'),
    ('calacatta-spa-estate',
     'The Calacatta Estate',
     'Bookmatched marble, still water and the quiet of the Aravalli hills.',
     'The Calacatta Estate is a private wellness retreat carved from bookmatched Viola marble and warm limestone. A sculptural stone bathing room, hammam, hydrotherapy pool and meditation court form the heart of the residence, while eight suites look across a mist-filled valley toward the Aravalli hills.',
     'buy',
     'Estate',
     'published',
     'available',
     265000000,
     'INR',
     null,
     'Fateh Sagar',
     'Udaipur',
     'The Calacatta Estate, Fateh Sagar Road, Udaipur 313001',
     'India',
     8,
     9,
     14800,
     76000,
     2020,
     true,
     array['Spa & sauna','Private infinity pool','Landscaped gardens','Gymnasium','Staff quarters','Fireplace','Italian marble','24/7 security']::text[],
     array['Bookmatched Calacatta Viola spa','Hydrotherapy pool','Hammam and steam room','Meditation court','Valley-facing suites']::text[],
     24.596,
     73.68,
     null,
     'The Calacatta Estate · Udaipur',
     'An eight-suite wellness estate of bookmatched marble, hammam and hydrotherapy pool overlooking the Aravalli hills.'),
    ('skyline-terrace-collection',
     'The Skyline Terrace Collection',
     'A curated duplex with a lit rooftop pool above the city lights.',
     'A rare duplex at the crown of a landmark tower, The Skyline Terrace Collection pairs smoked oak and honed stone with a spectacular illuminated rooftop pool. Floor-to-ceiling glazing frames a panorama of the city, while a private bar, screening room and guest suite make entertaining effortless.',
     'rent',
     'Penthouse',
     'published',
     'available',
     1850000,
     'INR',
     'month',
     'Bandra West',
     'Mumbai',
     'Skyline Terrace, Bandra West, Mumbai 400050',
     'India',
     4,
     5,
     7200,
     null,
     2021,
     true,
     array['Private infinity pool','Concierge service','Private elevator','Home theatre','Gymnasium','Terrace','24/7 security']::text[],
     array['Illuminated rooftop pool','Private bar','Screening room','Smoked oak interiors','Panoramic glazing']::text[],
     19.0596,
     72.8295,
     null,
     'The Skyline Terrace Collection · Mumbai',
     'A four-bedroom duplex with an illuminated rooftop infinity pool and panoramic city views, available for private letting.'),
    ('ranjit-vilas-courtyard-palace',
     'Ranjit Vilas Courtyard Palace',
     'Carved sandstone jalis, reflecting pools and Rajputana grandeur.',
     'A meticulously restored courtyard palace where hand-carved sandstone jalis filter golden light across symmetrical colonnades. Eleven suites, a private durbar hall, a rose-water reflecting pool and acres of walled gardens preserve the craftsmanship of another century with entirely contemporary comfort.',
     'buy',
     'Heritage',
     'published',
     'available',
     680000000,
     'INR',
     null,
     'Amer Road',
     'Jaipur',
     'Ranjit Vilas, Amer Road, Jaipur 302002',
     'India',
     11,
     12,
     28400,
     185000,
     1896,
     true,
     array['Landscaped gardens','Staff quarters','Private garage','Fireplace','24/7 security','Terrace','Spa & sauna']::text[],
     array['Restored sandstone jalis','Private durbar hall','Rose-water reflecting pool','Walled charbagh gardens','Heritage restoration']::text[],
     26.955,
     75.85,
     null,
     'Ranjit Vilas Courtyard Palace · Jaipur',
     'An eleven-suite restored Rajput courtyard palace with carved sandstone jalis, durbar hall and walled charbagh gardens.'),
    ('walnut-library-manor',
     'The Walnut Library Manor',
     'Emerald velvet, brass picture lights and a lifetime of collected books.',
     'A deeply private manor in the capital''s most guarded enclave. A floor-to-ceiling walnut library, emerald velvet tasting room and marble fireplace anchor the principal wing, while a concealed garden courtyard, wine cellar and six bedroom suites offer complete seclusion behind mature trees.',
     'buy',
     'Mansion',
     'published',
     'available',
     415000000,
     'INR',
     null,
     'Lutyens'' Delhi',
     'New Delhi',
     'The Walnut Manor, Lutyens'' Bungalow Zone, New Delhi 110001',
     'India',
     7,
     8,
     16900,
     64000,
     1938,
     false,
     array['Wine cellar','Fireplace','Landscaped gardens','Staff quarters','Private garage','24/7 security','Home theatre']::text[],
     array['Walnut-panelled library','Emerald velvet tasting room','Marble fireplace','Concealed courtyard','Temperature-controlled cellar']::text[],
     28.6,
     77.21,
     null,
     'The Walnut Library Manor · New Delhi',
     'A seven-suite Lutyens'' Delhi manor with a walnut library, velvet tasting room, wine cellar and walled garden.'),
    ('alpine-glass-retreat',
     'The Alpine Glass Retreat',
     'Dark timber, still snow and the pink hush of first light.',
     'At the edge of a deodar forest, The Alpine Glass Retreat is a study in warmth against the cold. Dark timber volumes and double-height glazing frame the peaks in alpenglow, while a stone fire terrace, cedar sauna and five generously proportioned suites make it an exceptional year-round sanctuary.',
     'buy',
     'Villa',
     'published',
     'available',
     142000000,
     'INR',
     null,
     'Old Manali',
     'Manali',
     'Alpine Glass Retreat, Old Manali, Himachal Pradesh 175131',
     'India',
     5,
     6,
     7800,
     41000,
     2022,
     false,
     array['Fireplace','Spa & sauna','Landscaped gardens','Private garage','Terrace','Smart home automation']::text[],
     array['Double-height peak-facing glazing','Cedar sauna','Stone fire terrace','Heated stone floors','Deodar forest frontage']::text[],
     32.249,
     77.189,
     null,
     'The Alpine Glass Retreat · Manali',
     'A five-suite dark-timber and glass retreat with cedar sauna, fire terrace and panoramic Himalayan views.'),
    ('marina-duom-residence',
     'Marina Duom Residence',
     'A waterfront address with a private berth and a glass-walled salon.',
     'Positioned on a quiet marina channel, Marina Duom pairs a sculptural white facade with a private berth and a glass-walled salon that opens directly onto the water. Four suites, a rooftop terrace and a discreet crew annex make it equally suited to long summers and effortless entertaining.',
     'buy',
     'Waterfront',
     'published',
     'available',
     312000000,
     'AED',
     null,
     'Palm Jumeirah',
     'Dubai',
     'Marina Duom, Palm Jumeirah, Dubai',
     'United Arab Emirates',
     5,
     6,
     9100,
     22000,
     2023,
     true,
     array['Private beach access','Sea view','Private infinity pool','Concierge service','Smart home automation','Terrace','24/7 security']::text[],
     array['Private berth','Glass-walled waterfront salon','Rooftop terrace','Crew annex','Direct beach access']::text[],
     25.1124,
     55.139,
     null,
     'Marina Duom Residence · Dubai',
     'A five-suite Palm Jumeirah waterfront residence with a private berth, glass salon and direct beach access.'),
    ('mayfair-garden-square',
     'Mayfair Garden Square',
     'A Georgian townhouse reimagined with quiet contemporary precision.',
     'A Grade II listed Georgian townhouse overlooking a private garden square, restored with extraordinary restraint. Original cornices and staircase sit alongside a minimalist rear extension of glass and limestone, a subterranean wellness level and five beautifully proportioned bedroom suites.',
     'buy',
     'Heritage',
     'published',
     'available',
     9850000,
     'GBP',
     null,
     'Mayfair',
     'London',
     'Mayfair Garden Square, London W1K',
     'United Kingdom',
     5,
     5,
     8200,
     6200,
     1788,
     false,
     array['Spa & sauna','Gymnasium','Wine cellar','Landscaped gardens','Staff quarters','Fireplace','Smart home automation']::text[],
     array['Grade II Georgian restoration','Glass and limestone rear extension','Subterranean wellness level','Private garden square key','Original staircase']::text[],
     51.509,
     -0.149,
     null,
     'Mayfair Garden Square · London',
     'A restored five-bedroom Georgian townhouse on a private Mayfair garden square with a subterranean wellness level.'),
    ('the-pergola-house-lonavala',
     'The Pergola House',
     'Rain-fed gardens, deep verandas and monsoon light.',
     'Above a mist-filled valley, The Pergola House is a low-slung stone and timber residence designed around the monsoon. Deep verandas, a shaded pergola walk and a long lap pool blur the line between house and garden, while five suites and a separate studio offer generous space for extended stays.',
     'buy',
     'Villa',
     'published',
     'available',
     129000000,
     'INR',
     null,
     'Khandala Ridge',
     'Lonavala',
     'The Pergola House, Khandala Ridge, Lonavala 410401',
     'India',
     5,
     5,
     8100,
     58000,
     2019,
     false,
     array['Private infinity pool','Landscaped gardens','Fireplace','Staff quarters','Terrace','Private garage']::text[],
     array['Pergola garden walk','Deep monsoon verandas','Valley-facing lap pool','Separate artist''s studio','Rain-fed gardens']::text[],
     18.754,
     73.407,
     null,
     'The Pergola House · Lonavala',
     'A five-suite stone and timber hill residence with deep verandas, a pergola garden walk and a valley-facing lap pool.'),
    ('imperial-brasserie-apartment',
     'The Imperial Brasserie Apartment',
     'A grand pied-à-terre with a chef''s kitchen and a private terrace.',
     'A beautifully scaled apartment in a landmark building, conceived for those who entertain. A chef''s kitchen in honed stone opens to a long dining gallery, while a private planted terrace, three generous suites and a dedicated study create a genuine city home rather than a pied-à-terre.',
     'rent',
     'Apartment',
     'published',
     'available',
     620000,
     'INR',
     'month',
     'Indiranagar',
     'Bengaluru',
     'The Imperial Brasserie, Indiranagar, Bengaluru 560038',
     'India',
     3,
     4,
     4800,
     null,
     2020,
     false,
     array['Concierge service','Terrace','Gymnasium','Smart home automation','Private garage','24/7 security']::text[],
     array['Chef''s kitchen in honed stone','Long dining gallery','Planted private terrace','Dedicated study','Landmark building']::text[],
     12.9719,
     77.6412,
     null,
     'The Imperial Brasserie Apartment · Bengaluru',
     'A three-suite entertaining apartment with a chef''s kitchen, dining gallery and planted private terrace in Indiranagar.'),
    ('backwater-teak-residence',
     'The Backwater Teak Residence',
     'Reclaimed teak, still water and the hush of the Kerala backwaters.',
     'Built almost entirely from reclaimed teak and laterite, this residence follows the water''s edge through a sequence of shaded pavilions. A private jetty, open-air bathing courts and six suites frame the backwaters at every turn, with a canoe house and spice garden completing the estate.',
     'buy',
     'Waterfront',
     'published',
     'available',
     176000000,
     'INR',
     null,
     'Vembanad Lake',
     'Kochi',
     'Backwater Teak Residence, Vembanad Lake, Kerala 688001',
     'India',
     6,
     6,
     9800,
     72000,
     2018,
     false,
     array['Private beach access','River view','Landscaped gardens','Staff quarters','Terrace','Spa & sauna']::text[],
     array['Reclaimed teak pavilions','Private jetty','Open-air bathing courts','Spice garden','Canoe house']::text[],
     9.84,
     76.34,
     null,
     'The Backwater Teak Residence · Kochi',
     'A six-suite reclaimed-teak residence with a private jetty, open-air bathing courts and direct Vembanad backwater frontage.'),
    ('aurum-crescent-suite',
     'The Aurum Crescent Suite',
     'A serene serviced residence above the orchard district.',
     'A softly lit, fully serviced residence designed for longer stays. Ivory bouclé, pale oak and brushed brass set a calm palette, while a generous terrace, a quiet study and housekeeping provide the ease of a private hotel with the space of a home.',
     'rent',
     'Apartment',
     'published',
     'available',
     480000,
     'INR',
     'month',
     'Jubilee Hills',
     'Hyderabad',
     'Aurum Crescent, Jubilee Hills, Hyderabad 500033',
     'India',
     3,
     3,
     4200,
     null,
     2022,
     false,
     array['Concierge service','Housekeeping','Gymnasium','Smart home automation','Terrace','24/7 security']::text[],
     array['Fully serviced residence','Pale oak and ivory bouclé palette','Generous planted terrace','Quiet study','Daily housekeeping']::text[],
     17.431,
     78.406,
     null,
     'The Aurum Crescent Suite · Hyderabad',
     'A three-bedroom fully serviced residence with a planted terrace, daily housekeeping and concierge in Jubilee Hills.'),
    ('colonial-veranda-house',
     'The Colonial Veranda House',
     'Shuttered windows, terracotta floors and a walled tropical garden.',
     'In the quiet French quarter, a restored colonial townhouse of shuttered windows, terracotta floors and deep shaded verandas. A walled tropical garden with a limewashed plunge pool sits at its heart, surrounded by four bedroom suites and a breezy upper gallery.',
     'buy',
     'Heritage',
     'published',
     'available',
     96000000,
     'INR',
     null,
     'White Town',
     'Pondicherry',
     'The Veranda House, White Town, Puducherry 605001',
     'India',
     4,
     4,
     6200,
     14000,
     1904,
     false,
     array['Private infinity pool','Landscaped gardens','Staff quarters','Terrace','Fireplace']::text[],
     array['Restored colonial shutters','Walled tropical garden','Limewashed plunge pool','Upper breezy gallery','Terracotta floors']::text[],
     11.933,
     79.834,
     null,
     'The Colonial Veranda House · Pondicherry',
     'A restored four-suite colonial townhouse in White Town with shuttered verandas and a walled tropical garden pool.'),
    ('ridge-line-modernist',
     'The Ridge Line Modernist',
     'A glass-and-stone composition set along a forested ridge.',
     'A rigorous modernist composition of board-formed concrete, glass and local stone, set lengthwise along a forested ridge. A long central gallery organises the plan, with a suspended fireplace, five suites and a lap pool that appears to spill into the treeline beyond.',
     'buy',
     'Villa',
     'published',
     'available',
     158000000,
     'INR',
     null,
     'Mussoorie Ridge',
     'Mussoorie',
     'Ridge Line Modernist, Mussoorie, Uttarakhand 248179',
     'India',
     5,
     6,
     8900,
     66000,
     2021,
     false,
     array['Private infinity pool','Fireplace','Smart home automation','Landscaped gardens','Private garage','Terrace']::text[],
     array['Board-formed concrete','Suspended fireplace','Long central gallery','Treeline lap pool','Local stone cladding']::text[],
     30.459,
     78.073,
     null,
     'The Ridge Line Modernist · Mussoorie',
     'A five-suite board-formed concrete and glass residence along a forested Himalayan ridge with a treeline lap pool.'),
    ('riverstone-haveli',
     'The Riverstone Haveli',
     'A riverside courtyard home of carved stone and quiet water.',
     'A contemporary haveli on the river''s edge, built around a shaded central court with a still water channel. Carved stone screens, a rooftop pavilion and seven suites create a rhythm of cool interiors and open sky, with a private ghat and walled orchard below.',
     'buy',
     'Estate',
     'published',
     'available',
     224000000,
     'INR',
     null,
     'Rishikesh Enclave',
     'Rishikesh',
     'Riverstone Haveli, Rishikesh, Uttarakhand 249201',
     'India',
     7,
     8,
     13200,
     88000,
     2017,
     false,
     array['River view','Landscaped gardens','Staff quarters','Spa & sauna','Terrace','Fireplace','Private garage']::text[],
     array['Shaded central court','Carved stone jali screens','Rooftop river pavilion','Private ghat','Walled orchard']::text[],
     30.086,
     78.268,
     null,
     'The Riverstone Haveli · Rishikesh',
     'A seven-suite riverside haveli with a shaded water court, carved stone screens, rooftop pavilion and private ghat.'),
    ('cedar-house-shimla',
     'Cedar House, The Old Estate',
     'A heritage hill bungalow wrapped in cedar and afternoon light.',
     'One of the last intact hill bungalows on the old estate road, Cedar House has been carefully renewed rather than remade. Original cedar panelling, bay windows and a stone fireplace remain, joined by a discreet new wing, a glass conservatory and five serene bedroom suites among the pines.',
     'rent',
     'Heritage',
     'published',
     'available',
     390000,
     'INR',
     'month',
     'The Mall Road Estate',
     'Shimla',
     'Cedar House, Old Estate Road, Shimla 171002',
     'India',
     5,
     5,
     7100,
     38000,
     1912,
     false,
     array['Fireplace','Landscaped gardens','Staff quarters','Terrace','Private garage','Home theatre']::text[],
     array['Original cedar panelling','Bay windows','Stone fireplace','Glass conservatory','Heritage renewal']::text[],
     31.104,
     77.173,
     null,
     'Cedar House, The Old Estate · Shimla',
     'A renewed five-suite heritage hill bungalow of cedar panelling, bay windows, stone fireplace and glass conservatory.'),
    ('harbour-light-apartment',
     'The Harbour Light Apartment',
     'A corner residence with two terraces and an uninterrupted harbour view.',
     'A light-filled corner residence high above the harbour, with two planted terraces and glazing on three sides. An open salon, a calm principal suite and a flexible third room make it an ideal city base, with concierge, secure parking and a residents'' pool below.',
     'rent',
     'Apartment',
     'published',
     'available',
     720000,
     'INR',
     'month',
     'Marine Drive',
     'Mumbai',
     'Harbour Light, Marine Drive, Mumbai 400020',
     'India',
     3,
     3,
     3900,
     null,
     2019,
     false,
     array['Sea view','Concierge service','Private infinity pool','Gymnasium','Terrace','24/7 security','Private garage']::text[],
     array['Two planted terraces','Three-sided glazing','Harbour panorama','Residents'' pool','Secure parking']::text[],
     18.943,
     72.823,
     null,
     'The Harbour Light Apartment · Mumbai',
     'A three-bedroom corner residence on Marine Drive with two planted terraces and uninterrupted harbour views.'),
    ('the-signature-land-parcel',
     'The Signature Land Parcel',
     'A rare walled hillside parcel with consent for a principal residence.',
     'A rare opportunity to create a legacy address from the ground up. This walled hillside parcel carries consent for a substantial principal residence and ancillary pavilions, with mature trees, a natural spring, a formed driveway and sweeping valley views already in place.',
     'buy',
     'Land',
     'published',
     'reserved',
     89000000,
     'INR',
     null,
     'Meghalaya Foothills',
     'Guwahati',
     'Signature Parcel, Meghalaya Foothills, Guwahati 781001',
     'India',
     0,
     0,
     0,
     142000,
     null,
     false,
     array['Landscaped gardens','24/7 security','River view']::text[],
     array['Consent for principal residence','Mature tree canopy','Natural spring','Formed driveway','Sweeping valley views']::text[],
     26.1445,
     91.7362,
     null,
     'The Signature Land Parcel · Guwahati',
     'A walled hillside land parcel near Guwahati with consent for a principal residence, mature trees and sweeping valley views.')
on conflict (slug) do update set
  title = excluded.title,
  subtitle = excluded.subtitle,
  description = excluded.description,
  listing_type = excluded.listing_type,
  category = excluded.category,
  status = excluded.status,
  availability = excluded.availability,
  price = excluded.price,
  currency = excluded.currency,
  price_period = excluded.price_period,
  location = excluded.location,
  city = excluded.city,
  address = excluded.address,
  country = excluded.country,
  bedrooms = excluded.bedrooms,
  bathrooms = excluded.bathrooms,
  area_sqft = excluded.area_sqft,
  lot_sqft = excluded.lot_sqft,
  year_built = excluded.year_built,
  featured = excluded.featured,
  amenities = excluded.amenities,
  features = excluded.features,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  map_url = excluded.map_url,
  meta_title = excluded.meta_title,
  meta_description = excluded.meta_description;

-- Gallery images. Only showcase-owned rows are refreshed on re-run.
delete from public.property_media where storage_path like 'showcase/%';

insert into public.property_media
  (property_id, kind, storage_path, public_url, position, is_cover, alt_text, mime_type, file_size)
select p.id, 'image', m.path, m.url, m.pos, m.cover, m.alt, 'image/jpeg', 0
from (values
    ('azure-cliff-residence', 'showcase/azure-cliff-residence/01.jpg', '/images/showcase-01.jpg', 0, true, 'The Azure Cliff Residence — principal view'),
    ('azure-cliff-residence', 'showcase/azure-cliff-residence/02.jpg', '/images/showcase-02.jpg', 1, false, 'The Azure Cliff Residence — gallery view 2'),
    ('azure-cliff-residence', 'showcase/azure-cliff-residence/03.jpg', '/images/showcase-04.jpg', 2, false, 'The Azure Cliff Residence — gallery view 3'),
    ('altitude-penthouse-worli', 'showcase/altitude-penthouse-worli/01.jpg', '/images/showcase-05.jpg', 0, true, 'Altitude, The Worli Penthouse — principal view'),
    ('altitude-penthouse-worli', 'showcase/altitude-penthouse-worli/02.jpg', '/images/showcase-02.jpg', 1, false, 'Altitude, The Worli Penthouse — gallery view 2'),
    ('altitude-penthouse-worli', 'showcase/altitude-penthouse-worli/03.jpg', '/images/penthouse.jpg', 2, false, 'Altitude, The Worli Penthouse — gallery view 3'),
    ('villa-serene-alibaug', 'showcase/villa-serene-alibaug/01.jpg', '/images/showcase-03.jpg', 0, true, 'Villa Serene, The Olive Grove — principal view'),
    ('villa-serene-alibaug', 'showcase/villa-serene-alibaug/02.jpg', '/images/garden-residence.jpg', 1, false, 'Villa Serene, The Olive Grove — gallery view 2'),
    ('villa-serene-alibaug', 'showcase/villa-serene-alibaug/03.jpg', '/images/interior-gallery.jpg', 2, false, 'Villa Serene, The Olive Grove — gallery view 3'),
    ('calacatta-spa-estate', 'showcase/calacatta-spa-estate/01.jpg', '/images/showcase-04.jpg', 0, true, 'The Calacatta Estate — principal view'),
    ('calacatta-spa-estate', 'showcase/calacatta-spa-estate/02.jpg', '/images/showcase-06.jpg', 1, false, 'The Calacatta Estate — gallery view 2'),
    ('calacatta-spa-estate', 'showcase/calacatta-spa-estate/03.jpg', '/images/interior-gallery.jpg', 2, false, 'The Calacatta Estate — gallery view 3'),
    ('skyline-terrace-collection', 'showcase/skyline-terrace-collection/01.jpg', '/images/showcase-05.jpg', 0, true, 'The Skyline Terrace Collection — principal view'),
    ('skyline-terrace-collection', 'showcase/skyline-terrace-collection/02.jpg', '/images/penthouse.jpg', 1, false, 'The Skyline Terrace Collection — gallery view 2'),
    ('skyline-terrace-collection', 'showcase/skyline-terrace-collection/03.jpg', '/images/showcase-02.jpg', 2, false, 'The Skyline Terrace Collection — gallery view 3'),
    ('ranjit-vilas-courtyard-palace', 'showcase/ranjit-vilas-courtyard-palace/01.jpg', '/images/showcase-06.jpg', 0, true, 'Ranjit Vilas Courtyard Palace — principal view'),
    ('ranjit-vilas-courtyard-palace', 'showcase/ranjit-vilas-courtyard-palace/02.jpg', '/images/interior-gallery.jpg', 1, false, 'Ranjit Vilas Courtyard Palace — gallery view 2'),
    ('ranjit-vilas-courtyard-palace', 'showcase/ranjit-vilas-courtyard-palace/03.jpg', '/images/garden-residence.jpg', 2, false, 'Ranjit Vilas Courtyard Palace — gallery view 3'),
    ('walnut-library-manor', 'showcase/walnut-library-manor/01.jpg', '/images/showcase-07.jpg', 0, true, 'The Walnut Library Manor — principal view'),
    ('walnut-library-manor', 'showcase/walnut-library-manor/02.jpg', '/images/interior-gallery.jpg', 1, false, 'The Walnut Library Manor — gallery view 2'),
    ('walnut-library-manor', 'showcase/walnut-library-manor/03.jpg', '/images/garden-residence.jpg', 2, false, 'The Walnut Library Manor — gallery view 3'),
    ('alpine-glass-retreat', 'showcase/alpine-glass-retreat/01.jpg', '/images/showcase-08.jpg', 0, true, 'The Alpine Glass Retreat — principal view'),
    ('alpine-glass-retreat', 'showcase/alpine-glass-retreat/02.jpg', '/images/forest-residence.jpg', 1, false, 'The Alpine Glass Retreat — gallery view 2'),
    ('alpine-glass-retreat', 'showcase/alpine-glass-retreat/03.jpg', '/images/interior-gallery.jpg', 2, false, 'The Alpine Glass Retreat — gallery view 3'),
    ('marina-duom-residence', 'showcase/marina-duom-residence/01.jpg', '/images/coastal-villa.jpg', 0, true, 'Marina Duom Residence — principal view'),
    ('marina-duom-residence', 'showcase/marina-duom-residence/02.jpg', '/images/showcase-01.jpg', 1, false, 'Marina Duom Residence — gallery view 2'),
    ('marina-duom-residence', 'showcase/marina-duom-residence/03.jpg', '/images/showcase-02.jpg', 2, false, 'Marina Duom Residence — gallery view 3'),
    ('mayfair-garden-square', 'showcase/mayfair-garden-square/01.jpg', '/images/interior-gallery.jpg', 0, true, 'Mayfair Garden Square — principal view'),
    ('mayfair-garden-square', 'showcase/mayfair-garden-square/02.jpg', '/images/showcase-07.jpg', 1, false, 'Mayfair Garden Square — gallery view 2'),
    ('mayfair-garden-square', 'showcase/mayfair-garden-square/03.jpg', '/images/garden-residence.jpg', 2, false, 'Mayfair Garden Square — gallery view 3'),
    ('the-pergola-house-lonavala', 'showcase/the-pergola-house-lonavala/01.jpg', '/images/garden-residence.jpg', 0, true, 'The Pergola House — principal view'),
    ('the-pergola-house-lonavala', 'showcase/the-pergola-house-lonavala/02.jpg', '/images/modern-residence.jpg', 1, false, 'The Pergola House — gallery view 2'),
    ('the-pergola-house-lonavala', 'showcase/the-pergola-house-lonavala/03.jpg', '/images/interior-gallery.jpg', 2, false, 'The Pergola House — gallery view 3'),
    ('imperial-brasserie-apartment', 'showcase/imperial-brasserie-apartment/01.jpg', '/images/interior-gallery.jpg', 0, true, 'The Imperial Brasserie Apartment — principal view'),
    ('imperial-brasserie-apartment', 'showcase/imperial-brasserie-apartment/02.jpg', '/images/showcase-02.jpg', 1, false, 'The Imperial Brasserie Apartment — gallery view 2'),
    ('imperial-brasserie-apartment', 'showcase/imperial-brasserie-apartment/03.jpg', '/images/penthouse.jpg', 2, false, 'The Imperial Brasserie Apartment — gallery view 3'),
    ('backwater-teak-residence', 'showcase/backwater-teak-residence/01.jpg', '/images/forest-residence.jpg', 0, true, 'The Backwater Teak Residence — principal view'),
    ('backwater-teak-residence', 'showcase/backwater-teak-residence/02.jpg', '/images/garden-residence.jpg', 1, false, 'The Backwater Teak Residence — gallery view 2'),
    ('backwater-teak-residence', 'showcase/backwater-teak-residence/03.jpg', '/images/coastal-villa.jpg', 2, false, 'The Backwater Teak Residence — gallery view 3'),
    ('aurum-crescent-suite', 'showcase/aurum-crescent-suite/01.jpg', '/images/showcase-02.jpg', 0, true, 'The Aurum Crescent Suite — principal view'),
    ('aurum-crescent-suite', 'showcase/aurum-crescent-suite/02.jpg', '/images/interior-gallery.jpg', 1, false, 'The Aurum Crescent Suite — gallery view 2'),
    ('aurum-crescent-suite', 'showcase/aurum-crescent-suite/03.jpg', '/images/penthouse.jpg', 2, false, 'The Aurum Crescent Suite — gallery view 3'),
    ('colonial-veranda-house', 'showcase/colonial-veranda-house/01.jpg', '/images/garden-residence.jpg', 0, true, 'The Colonial Veranda House — principal view'),
    ('colonial-veranda-house', 'showcase/colonial-veranda-house/02.jpg', '/images/showcase-03.jpg', 1, false, 'The Colonial Veranda House — gallery view 2'),
    ('colonial-veranda-house', 'showcase/colonial-veranda-house/03.jpg', '/images/interior-gallery.jpg', 2, false, 'The Colonial Veranda House — gallery view 3'),
    ('ridge-line-modernist', 'showcase/ridge-line-modernist/01.jpg', '/images/modern-residence.jpg', 0, true, 'The Ridge Line Modernist — principal view'),
    ('ridge-line-modernist', 'showcase/ridge-line-modernist/02.jpg', '/images/forest-residence.jpg', 1, false, 'The Ridge Line Modernist — gallery view 2'),
    ('ridge-line-modernist', 'showcase/ridge-line-modernist/03.jpg', '/images/showcase-04.jpg', 2, false, 'The Ridge Line Modernist — gallery view 3'),
    ('riverstone-haveli', 'showcase/riverstone-haveli/01.jpg', '/images/showcase-06.jpg', 0, true, 'The Riverstone Haveli — principal view'),
    ('riverstone-haveli', 'showcase/riverstone-haveli/02.jpg', '/images/coastal-villa.jpg', 1, false, 'The Riverstone Haveli — gallery view 2'),
    ('riverstone-haveli', 'showcase/riverstone-haveli/03.jpg', '/images/garden-residence.jpg', 2, false, 'The Riverstone Haveli — gallery view 3'),
    ('cedar-house-shimla', 'showcase/cedar-house-shimla/01.jpg', '/images/forest-residence.jpg', 0, true, 'Cedar House, The Old Estate — principal view'),
    ('cedar-house-shimla', 'showcase/cedar-house-shimla/02.jpg', '/images/showcase-07.jpg', 1, false, 'Cedar House, The Old Estate — gallery view 2'),
    ('cedar-house-shimla', 'showcase/cedar-house-shimla/03.jpg', '/images/interior-gallery.jpg', 2, false, 'Cedar House, The Old Estate — gallery view 3'),
    ('harbour-light-apartment', 'showcase/harbour-light-apartment/01.jpg', '/images/penthouse.jpg', 0, true, 'The Harbour Light Apartment — principal view'),
    ('harbour-light-apartment', 'showcase/harbour-light-apartment/02.jpg', '/images/showcase-05.jpg', 1, false, 'The Harbour Light Apartment — gallery view 2'),
    ('harbour-light-apartment', 'showcase/harbour-light-apartment/03.jpg', '/images/showcase-02.jpg', 2, false, 'The Harbour Light Apartment — gallery view 3'),
    ('the-signature-land-parcel', 'showcase/the-signature-land-parcel/01.jpg', '/images/forest-residence.jpg', 0, true, 'The Signature Land Parcel — principal view'),
    ('the-signature-land-parcel', 'showcase/the-signature-land-parcel/02.jpg', '/images/garden-residence.jpg', 1, false, 'The Signature Land Parcel — gallery view 2'),
    ('the-signature-land-parcel', 'showcase/the-signature-land-parcel/03.jpg', '/images/modern-residence.jpg', 2, false, 'The Signature Land Parcel — gallery view 3')) as m(slug, path, url, pos, cover, alt)
join public.properties p on p.slug = m.slug;

-- Site settings: branding, hero artwork and SAMPLE references with star ratings.
update public.site_settings set
  business_name = 'Imperial Royal',
  tagline = 'Extraordinary Residences. Enduring Legacy.',
  contact_email = 'concierge@imperialroyal.com',
  contact_phone = '+91 98764 00000',
  whatsapp = '+91 98764 00000',
  address = 'The Imperial House, G.S. Road, Guwahati 781005, Assam, India',
  hero_heading = 'Where Exceptional Living Meets Timeless Elegance.',
  hero_subheading = 'Discover extraordinary residences, prestigious addresses and exceptional real estate opportunities.',
  hero_image = '/images/showcase-01.jpg',
  footer_text = 'A private collection of the world''s most distinguished residences, curated with discretion and absolute integrity. Every address is considered, every introduction personal.',
  footer_note = 'Imperial Royal Real Estate. Crafted for a legacy.',
  seo_title = 'Imperial Royal | Extraordinary Residences & Prestigious Addresses',
  seo_description = 'Discover an exceptional collection of luxury residences, estates and penthouses. A private, discreet real estate experience.',
  testimonials = '[{"quote": "They understood that we were not buying a house, we were choosing where our family would gather for the next thirty years. Every detail was handled with extraordinary discretion.", "name": "Ananya Mehra", "role": "Private Client · Mumbai", "initials": "AM", "rating": 5, "sample": true}, {"quote": "From the first private viewing to the final signature, the process felt less like a transaction and more like being looked after by people who genuinely know these homes.", "name": "Vikram Rathore", "role": "Private Client · Jaipur", "initials": "VR", "rating": 5, "sample": true}, {"quote": "The dossier they prepared was the most considered document we received from any advisor. It answered questions we had not yet thought to ask.", "name": "Clara Whitfield", "role": "Private Client · London", "initials": "CW", "rating": 5, "sample": true}, {"quote": "We were shown four residences in two days, each one exactly aligned with the brief. No wasted time, no pressure, just remarkable judgement.", "name": "Rohan Bansal", "role": "Private Client · New Delhi", "initials": "RB", "rating": 5, "sample": true}, {"quote": "What stayed with us was the honesty. They told us plainly which property was right and which was not, even when the second was the more valuable introduction.", "name": "Sara D''Souza", "role": "Private Client · Goa", "initials": "SD", "rating": 5, "sample": true}, {"quote": "The concierge team was still answering our questions six months after completion. That kind of stewardship is rare in any industry.", "name": "Arjun Khanna", "role": "Private Client · Bengaluru", "initials": "AK", "rating": 4, "sample": true}, {"quote": "Beautifully presented, meticulously researched and completely confidential. We would not consider working with anyone else on a future acquisition.", "name": "Nadia Rahman", "role": "Private Client · Dubai", "initials": "NR", "rating": 5, "sample": true}, {"quote": "They found us a home we had walked past for years without ever seeing. That is what a real eye for architecture and position looks like.", "name": "Devika Nair", "role": "Private Client · Kochi", "initials": "DN", "rating": 5, "sample": true}]'::jsonb,
  social = '{}'::jsonb,
  theme = '{"accent":"#C6A45A","density":"comfortable"}'::jsonb
where id = 1;

-- ------------------------------------------------------------- 10. OWNER
-- Ensure every Auth user has a profile row before provisioning.
insert into public.profiles (id, email, is_owner)
select u.id, coalesce(u.email, ''), false from auth.users u
on conflict (id) do nothing;

-- The first project user becomes the verified owner. If you have several
-- accounts, replace the WHERE clause with: where lower(email) = lower('you@example.com')
update public.profiles p set is_owner = true
where p.id = (select u.id from auth.users u order by u.created_at asc limit 1);

-- ------------------------------------------------------------- 11. VERIFY
do $$
declare
  props int; media int; refs int; owners int;
begin
  select count(*) into props from public.properties where status = 'published';
  select count(*) into media from public.property_media;
  select jsonb_array_length(testimonials) into refs from public.site_settings where id = 1;
  select count(*) into owners from public.profiles where is_owner;
  raise notice 'IMPERIAL ROYAL SETUP COMPLETE — published properties: %, gallery images: %, sample references: %, verified owners: %', props, media, refs, owners;
  if props < 20 then raise warning 'Fewer than 20 published properties were detected.'; end if;
  if owners = 0 then raise warning 'No owner was provisioned. Check that an Auth user exists, then re-run this script.'; end if;
end $$;
