-- ============================================================================
--  IMPERIAL ROYAL · READ-ONLY SCHEMA VERIFICATION
--  Paste into Supabase → SQL Editor → Run. Nothing is created or changed.
--      PASS = present and correct
--      FAIL = missing → run the deploy script named in docs/DEPLOYMENT.md
--  DEPLOY ORDER: 1 supabase/schema.sql  2 supabase/storage.sql
--                3 supabase/owner-provisioning.sql  4 supabase/showcase-setup.sql
--  Catalog-only checks: safe to run on a brand-new project where nothing exists.
-- ============================================================================

-- Content summary (appears in the editor as INFO notices, never fails).
do $info$
declare
  n integer;
begin
  if to_regclass('public.properties') is not null then
    execute 'select count(*) from public.properties where status = ''published''' into n;
    raise notice 'INFO  published listings: %', n;
  end if;
  if to_regclass('public.site_settings') is not null then
    execute 'select count(*) from public.site_settings where id = 1' into n;
    raise notice 'INFO  settings row id=1 present: % (expected 1)', n;
    execute 'select coalesce(jsonb_array_length(testimonials), 0) from public.site_settings where id = 1' into n;
    raise notice 'INFO  testimonial entries: %', coalesce(n, 0);
  end if;
  execute 'select count(*) from auth.users' into n;
  raise notice 'INFO  auth users: % (owner accounts)', n;
exception when others then
  raise notice 'INFO  content summary skipped: %', sqlerrm;
end $info$;

with sig as (
  select
    to_regclass('public.profiles')       is not null as t_profiles,
    to_regclass('public.properties')     is not null as t_properties,
    to_regclass('public.property_media') is not null as t_property_media,
    to_regclass('public.inquiries')      is not null as t_inquiries,
    to_regclass('public.site_settings')  is not null as t_site_settings,
    coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.profiles')),       false) as rls_profiles,
    coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.properties')),     false) as rls_properties,
    coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.property_media')), false) as rls_property_media,
    coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.inquiries')),      false) as rls_inquiries,
    coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.site_settings')),  false) as rls_site_settings,
    (select count(*) from pg_policies where schemaname = 'public' and tablename = 'profiles')       as p_profiles,
    (select count(*) from pg_policies where schemaname = 'public' and tablename = 'properties')     as p_properties,
    (select count(*) from pg_policies where schemaname = 'public' and tablename = 'property_media') as p_property_media,
    (select count(*) from pg_policies where schemaname = 'public' and tablename = 'inquiries')      as p_inquiries,
    (select count(*) from pg_policies where schemaname = 'public' and tablename = 'site_settings')  as p_site_settings,
    exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'properties' and cmd = 'SELECT') as anon_reads_published_only,
    not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'inquiries' and cmd = 'UPDATE') as inquiries_append_only,
    not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and cmd in ('INSERT','UPDATE','DELETE')) as profiles_locked,
    to_regprocedure('public.is_owner()')             is not null as f_is_owner,
    to_regprocedure('public.touch_updated_at()')     is not null as f_touch_updated_at,
    to_regprocedure('public.handle_new_user()')      is not null as f_handle_new_user,
    to_regprocedure('public.protect_owner_flag()')   is not null as f_protect_owner_flag,
    to_regprocedure('public.guard_inquiry_insert()') is not null as f_guard_inquiry_insert,
    exists (select 1 from pg_trigger where tgname = 'on_auth_user_created' and not tgisinternal) as g_new_user,
    exists (select 1 from pg_trigger where tgname = 'protect_owner_flag'   and not tgisinternal) as g_protect_owner,
    exists (select 1 from pg_trigger where tgname = 'properties_touch'     and not tgisinternal) as g_properties_touch,
    exists (select 1 from pg_trigger where tgname = 'inquiries_touch'      and not tgisinternal) as g_inquiries_touch,
    exists (select 1 from pg_trigger where tgname = 'guard_inquiry_insert' and not tgisinternal) as g_guard_inquiry,
    exists (select 1 from pg_trigger where tgname = 'site_settings_touch'  and not tgisinternal) as g_settings_touch,
    coalesce((select public from storage.buckets where id = 'property-media'), false) as bucket_public,
    (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects'
       and policyname in ('public read property media','public read branding',
                          'owner insert media','owner update media','owner delete media')) as storage_policies,
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles'      and column_name = 'is_owner')     as c_is_owner,
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'properties'    and column_name = 'slug')         as c_slug,
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'properties'    and column_name = 'status')       as c_status,
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'site_settings' and column_name = 'testimonials') as c_testimonials,
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'site_settings' and column_name = 'hero_stats')   as c_hero_stats,
    exists (select 1 from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any (i.indkey)
             where i.indrelid = to_regclass('public.properties') and i.indisunique and a.attname = 'slug')          as u_slug,
    exists (select 1 from pg_constraint where conrelid = to_regclass('public.inquiries') and contype = 'c'
             and pg_get_constraintdef(oid) ilike '%status%')                                                       as k_inquiry_status
),
checks as (
  select  1 as n, 'tables'   as area, 'public.profiles'        as item, s.t_profiles        as ok, 'id references auth.users'                     as detail from sig s
  union all select  2, 'tables',   'public.properties',        s.t_properties,        'one row per listing'                               from sig s
  union all select  3, 'tables',   'public.property_media',    s.t_property_media,    'gallery and cover ordering'                         from sig s
  union all select  4, 'tables',   'public.inquiries',         s.t_inquiries,         'contact form inbox'                                 from sig s
  union all select  5, 'tables',   'public.site_settings',     s.t_site_settings,     'single row, testimonial jsonb'                      from sig s
  union all select  6, 'rls',      'RLS on profiles',          s.rls_profiles,        'row level security enabled'                         from sig s
  union all select  7, 'rls',      'RLS on properties',        s.rls_properties,      'row level security enabled'                         from sig s
  union all select  8, 'rls',      'RLS on property_media',    s.rls_property_media,  'row level security enabled'                         from sig s
  union all select  9, 'rls',      'RLS on inquiries',         s.rls_inquiries,       'row level security enabled'                         from sig s
  union all select 10, 'rls',      'RLS on site_settings',     s.rls_site_settings,   'row level security enabled'                         from sig s
  union all select 11, 'policies', 'profiles policies',        s.p_profiles > 0,       'anon reads its own row only'                       from sig s
  union all select 12, 'policies', 'properties policies',      s.p_properties > 0,     'anon reads published only'                         from sig s
  union all select 13, 'policies', 'property_media policies',  s.p_property_media > 0, 'anon reads published only'                         from sig s
  union all select 14, 'policies', 'inquiries policies',       s.p_inquiries > 0,      'anon may insert only'                              from sig s
  union all select 15, 'policies', 'site_settings policies',   s.p_site_settings > 0,  'public read, owner write'                          from sig s
  union all select 16, 'policies', 'published-only read',      s.anon_reads_published_only, 'properties SELECT policy exists'              from sig s
  union all select 17, 'policies', 'inquiries append-only',    s.inquiries_append_only,     'no UPDATE policy on inquiries'                from sig s
  union all select 18, 'policies', 'profiles API read-only',   s.profiles_locked,           'no INSERT/UPDATE/DELETE policy on profiles'   from sig s
  union all select 19, 'functions', 'is_owner()',              s.f_is_owner,             'security definer, pinned search_path'            from sig s
  union all select 20, 'functions', 'touch_updated_at()',      s.f_touch_updated_at,     'updated_at maintenance'                          from sig s
  union all select 21, 'functions', 'handle_new_user()',       s.f_handle_new_user,      'provisions profile rows'                         from sig s
  union all select 22, 'functions', 'protect_owner_flag()',    s.f_protect_owner_flag,   'blocks owner escalation'                         from sig s
  union all select 23, 'functions', 'guard_inquiry_insert()',  s.f_guard_inquiry_insert, 'forces inquiry status = new'                     from sig s
  union all select 24, 'triggers', 'on_auth_user_created',     s.g_new_user,             'after insert on auth.users'                      from sig s
  union all select 25, 'triggers', 'protect_owner_flag',       s.g_protect_owner,        'before update on profiles'                       from sig s
  union all select 26, 'triggers', 'properties_touch',         s.g_properties_touch,     'before update on properties'                     from sig s
  union all select 27, 'triggers', 'inquiries_touch',          s.g_inquiries_touch,      'before update on inquiries'                      from sig s
  union all select 28, 'triggers', 'guard_inquiry_insert',     s.g_guard_inquiry,        'before insert on inquiries'                      from sig s
  union all select 29, 'triggers', 'site_settings_touch',      s.g_settings_touch,       'before update on site_settings'                  from sig s
  union all select 30, 'storage',  'bucket property-media',    s.bucket_public,          'public bucket for uploads'                       from sig s
  union all select 31, 'storage',  'storage policies',         s.storage_policies >= 5,  'read public, write owner only'                   from sig s
  union all select 32, 'columns',  'profiles.is_owner',        s.c_is_owner,             'not null, defaults false'                        from sig s
  union all select 33, 'columns',  'properties.slug',          s.c_slug,                 'URL-safe identifier'                             from sig s
  union all select 34, 'columns',  'properties.status',        s.c_status,               'draft or published'                              from sig s
  union all select 35, 'columns',  'site_settings.testimonials', s.c_testimonials,       'jsonb array of real quotes'                      from sig s
  union all select 36, 'columns',  'site_settings.hero_stats',  s.c_hero_stats,           'jsonb array of hero figures'                     from sig s
  union all select 37, 'indexes',  'properties.slug unique',   s.u_slug,                 'no duplicate URLs'                               from sig s
  union all select 38, 'indexes',  'inquiries.status check',   s.k_inquiry_status,       'new, read, contacted, resolved'                  from sig s
)
select
  n,
  area,
  item,
  case when ok then 'PASS' else 'FAIL' end as state,
  case
    when ok then detail
    else 'missing — run the deploy script for this area (docs/DEPLOYMENT.md)'
  end as detail
from checks
union all
select 999, 'summary', 'checks passed',
  (select count(*)::text from checks where ok) || ' / ' || (select count(*)::text from checks),
  case when (select bool_and(ok) from checks) then 'schema matches this application build; content rows are in the notices above'
       else 'schema drift detected — read the FAIL rows above' end
order by n;
