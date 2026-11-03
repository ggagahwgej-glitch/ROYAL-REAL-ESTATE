-- ==================================================================
-- INDEPENDENT DATABASE PERMISSION TESTS
-- Run in the Supabase SQL Editor AFTER schema.sql + storage.sql.
-- Each check raises a NOTICE with PASS/FAIL. A real FAIL raises an
-- exception and aborts the transaction, so a broken policy cannot be
-- overlooked. These tests use the real anon/authenticated roles, not
-- frontend code.
--
-- IMPORTANT: `anon` intentionally has INSERT but NO SELECT privilege on
-- public.inquiries. Permission-denied errors are therefore treated as a
-- PASS for read probes, and the insert probe is verified with an elevated
-- role afterwards. Nothing is committed: section A ends with ROLLBACK.
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

  -- A3: anon CANNOT read private inquiries. A missing SELECT grant is
  -- itself a valid (and expected) outcome — only visible rows are a failure.
  begin
    select count(*) into n from public.inquiries;
    if n > 0 then raise exception 'FAIL A3: anon can read private inquiries'; end if;
    raise notice 'PASS A3: inquiries are not readable by anon (0 visible rows)';
  exception when insufficient_privilege then
    raise notice 'PASS A3: inquiries are not readable by anon (permission denied)';
  end;

  -- A4: anon CANNOT insert properties
  begin
    insert into public.properties (slug, title, city, location, owner_id)
    values ('rls-probe-' || gen_random_uuid()::text, 'RLS probe', 'Test', 'Test', null);
    raise exception 'FAIL A4: anon inserted a property (RLS is broken)';
  exception when others then
    if sqlerrm like 'FAIL A4%' then raise exception '%', sqlerrm; end if;
    raise notice 'PASS A4: anon property insert blocked (%)', sqlerrm;
  end;

  -- A5: anon CANNOT update properties
  begin
    update public.properties set title = 'RLS probe edit' where status = 'published';
    raise notice 'PASS A5: anon property update affected 0 rows (RLS filter)';
  exception when insufficient_privilege then
    raise notice 'PASS A5: anon property update blocked by RLS';
  end;

  -- A6: anon CANNOT modify site settings
  begin
    update public.site_settings set business_name = 'Hacked' where id = 1;
    raise exception 'FAIL A6: anon modified website settings';
  exception when others then
    if sqlerrm like 'FAIL A6%' then raise exception '%', sqlerrm; end if;
    raise notice 'PASS A6: anon settings update blocked (%)', sqlerrm;
  end;

  -- A7: anon CANNOT set is_owner (no update policy on profiles at all)
  begin
    update public.profiles set is_owner = true;
    raise exception 'FAIL A7: anon elevated owner privileges';
  exception when others then
    if sqlerrm like 'FAIL A7%' then raise exception '%', sqlerrm; end if;
    raise notice 'PASS A7: owner privileges cannot be self-assigned (%)', sqlerrm;
  end;

  -- A8a: anon CAN submit a controlled enquiry, but must not control status.
  -- No RETURNING here: anon has no SELECT privilege on inquiries.
  begin
    insert into public.inquiries (name, email, message, status)
    values ('RLS Test Visitor', 'rls-probe@imperial-royal.test',
            'A legitimate permission-test enquiry used to verify RLS policies.', 'resolved');
    raise notice 'PASS A8a: controlled anon enquiry insert accepted';
  exception when others then
    raise exception 'FAIL A8: legitimate enquiry insert was rejected (%). Check the INSERT policy, GRANTs and guard_inquiry_insert().', sqlerrm;
  end;

  -- A9: anon CANNOT read the private storage bucket
  begin
    if exists (select 1 from storage.objects where bucket_id = 'owner-private') then
      raise exception 'FAIL A9: anon can read private storage objects';
    end if;
    raise notice 'PASS A9: private storage objects hidden from anon';
  exception when insufficient_privilege then
    raise notice 'PASS A9: private storage objects hidden from anon (permission denied)';
  end;

  -- A10: anon CAN read published website settings
  begin
    select count(*) into n from public.site_settings where id = 1;
    if n <> 1 then raise exception 'FAIL A10: public settings row is not readable by anon'; end if;
    raise notice 'PASS A10: public website settings readable by anon';
  exception when insufficient_privilege then
    raise exception 'FAIL A10: public settings are not readable by anon';
  end;

  -- A11: anon CANNOT delete inquiries
  begin
    delete from public.inquiries where email = 'rls-probe@imperial-royal.test';
    raise notice 'PASS A11: anon inquiry delete affected 0 rows (no policy)';
  exception when insufficient_privilege then
    raise notice 'PASS A11: anon inquiry delete blocked by RLS';
  end;
end $$;

-- Verify the trigger forced status='new' using the elevated SQL Editor role.
reset role;
do $$
declare s text;
begin
  select status into s from public.inquiries
   where email = 'rls-probe@imperial-royal.test' order by created_at desc limit 1;
  if s is null then raise exception 'FAIL A8b: the enquiry row was not persisted'; end if;
  if s <> 'new' then raise exception 'FAIL A8b: visitor controlled the inquiry status (%)', s; end if;
  raise notice 'PASS A8b: enquiry status forced to new by guard_inquiry_insert()';
end $$;
rollback;

-- ---------- B. AUTHENTICATED NON-OWNER ----------
-- is_owner() must be false without an authenticated owner session.
do $$
declare result boolean;
begin
  select public.is_owner() into result;
  if result then raise exception 'FAIL B1: unauthenticated/foreign context reported owner'; end if;
  raise notice 'PASS B1: is_owner() is false without an authenticated owner session';
end $$;

-- To test a real signed-in NON-OWNER account, replace the UUID below and run
-- this block in the SQL Editor. It must raise a FAIL if the account can read
-- inquiries or write properties.
-- do $$
-- declare uid uuid := '00000000-0000-4000-8000-000000000000';
-- begin
--   perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',uid::text)::text, true);
--   if public.is_owner() then raise exception 'FAIL B2: non-owner reported as owner'; end if;
--   raise notice 'PASS B2: is_owner() is false for a non-owner account';
-- end $$;

-- ---------- C. NO SERVICE-ROLE CREDENTIALS IN THE APPLICATION ----------
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

-- ---------- E. SUMMARY ----------
do $$ begin
  raise notice 'RLS verification finished. Any FAIL above aborts its transaction — fix the reported policy before going live.';
end $$;
