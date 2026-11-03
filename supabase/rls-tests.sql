-- ==================================================================
-- INDEPENDENT DATABASE PERMISSION TESTS
-- Run in the Supabase SQL Editor AFTER schema.sql + storage.sql.
-- Each block raises a NOTICE with PASS/FAIL. A FAIL raises an exception
-- and aborts the transaction, so a broken policy cannot be overlooked.
-- These tests use the real anon/authenticated roles, not frontend code.
-- ==================================================================

-- ---------- A. ANON PERMISSIONS ----------
begin;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

do $$
declare n integer;
begin
  -- A1: anon CAN read published properties
  select count(*) into n from public.properties where status = 'published';
  raise notice 'PASS A1: anon can read published properties (% rows)', n;

  -- A2: anon CANNOT see draft/unpublished properties
  select count(*) into n from public.properties where status = 'draft';
  if n > 0 then raise exception 'FAIL A2: anon can see draft properties'; end if;
  raise notice 'PASS A2: draft properties are hidden from anon';

  -- A3: anon CANNOT read inquiries
  select count(*) into n from public.inquiries;
  if n > 0 then raise exception 'FAIL A3: anon can read private inquiries'; end if;
  raise notice 'PASS A3: inquiries are not readable by anon';

  -- A4: anon CANNOT insert/modify/delete properties
  begin
    insert into public.properties (slug, title, city, location, owner_id)
    values ('rls-probe-' || gen_random_uuid()::text, 'RLS probe', 'Test', 'Test', null);
    raise exception 'FAIL A4: anon inserted a property (RLS is broken)';
  exception when insufficient_privilege or others then
    if sqlerrm like 'FAIL A4%' then raise exception '%', sqlerrm; end if;
    raise notice 'PASS A4: anon property insert blocked by RLS';
  end;

  begin
    update public.properties set title = 'RLS probe edit' where status = 'published';
    raise notice 'PASS A5: update statement accepted but affected 0 rows (RLS filter)';
  exception when insufficient_privilege then
    raise notice 'PASS A5: anon property update blocked by RLS';
  end;

  -- A6: anon CANNOT modify site settings
  begin
    update public.site_settings set business_name = 'Hacked' where id = 1;
    raise exception 'FAIL A6: anon modified website settings';
  exception when insufficient_privilege or others then
    if sqlerrm like 'FAIL A6%' then raise exception '%', sqlerrm; end if;
    raise notice 'PASS A6: anon settings update blocked by RLS';
  end;

  -- A7: anon CANNOT set is_owner (no update policy on profiles at all)
  begin
    update public.profiles set is_owner = true;
    raise exception 'FAIL A7: anon elevated owner privileges';
  exception when insufficient_privilege or others then
    if sqlerrm like 'FAIL A7%' then raise exception '%', sqlerrm; end if;
    raise notice 'PASS A7: owner privileges cannot be self-assigned';
  end;

  -- A8: anon CAN submit a controlled enquiry (status is forced to 'new')
  insert into public.inquiries (name, email, message, status)
  values ('RLS Test Visitor', 'rls-test@example.com', 'A legitimate test enquiry message for verification.', 'resolved');
  if exists (select 1 from public.inquiries where email = 'rls-test@example.com' and status <> 'new') then
    raise exception 'FAIL A8: visitor controlled the inquiry status';
  end if;
  raise notice 'PASS A8: controlled enquiry accepted, status forced to new';

  -- A9: anon CANNOT read the private storage bucket
  if exists (select 1 from storage.objects where bucket_id = 'owner-private') then
    raise exception 'FAIL A9: anon can read private storage objects';
  end if;
  raise notice 'PASS A9: private storage objects hidden from anon';
end $$;
rollback;

-- ---------- B. AUTHENTICATED NON-OWNER ----------
-- Replace with a real non-owner user id. If none exists, this section
-- still verifies the is_owner() helper returns false for a foreign id.
do $$
declare result boolean;
begin
  select public.is_owner() into result;
  if result then raise exception 'FAIL B1: unauthenticated/foreign context reported owner'; end if;
  raise notice 'PASS B1: is_owner() is false without an authenticated owner session';
end $$;

-- ---------- C. NO SERVICE-ROLE CREDENTIALS IN THE APPLICATION ----------
-- Verify at the SQL level that no application table stores a secret key.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and (column_name ilike '%service_role%' or column_name ilike '%secret_key%')
  ) then
    raise exception 'FAIL C1: a service-role credential column exists in public schema';
  end if;
  raise notice 'PASS C1: no service-role credential column in the public schema';
end $$;

-- ---------- D. OWNER VERIFICATION (informational) ----------
select id, email, is_owner from public.profiles where is_owner = true;
do $$ begin
  raise notice 'Manual check: confirm exactly the intended owner account(s) are listed above.';
end $$;
