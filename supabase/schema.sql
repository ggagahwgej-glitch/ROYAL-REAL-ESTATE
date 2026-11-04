-- ==================================================================
-- IMPERIAL ROYAL REAL ESTATE — Supabase schema, RLS and constraints
-- Run this ONCE in the Supabase SQL Editor for the client's project.
-- Requires ONLY the project URL + publishable/anon key at runtime.
-- No service-role key is ever used by the application.
-- ==================================================================
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- 1. helpers
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

-- is_owner() reads public.profiles, so it is created AFTER the table. A
-- SQL-language body is analysed at CREATE time; declaring it first fails on a
-- brand-new project with "relation public.profiles does not exist".
create or replace function public.is_owner()
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select coalesce((select p.is_owner from public.profiles p where p.id = auth.uid()), false);
$$;
revoke all on function public.is_owner() from public;
grant execute on function public.is_owner() to anon, authenticated;

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
  hero_stats jsonb not null default '[]'::jsonb,
  theme jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.site_settings add column if not exists testimonials jsonb not null default '[]'::jsonb;
alter table public.site_settings add column if not exists hero_stats jsonb not null default '[]'::jsonb;
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
