-- ==================================================================
-- SECURE OWNER PROVISIONING — one-time administrative action
-- ------------------------------------------------------------------
-- A public user CANNOT grant themselves owner privileges:
--   * profiles has NO insert/update/delete RLS policies at all
--   * a BEFORE UPDATE trigger rejects any is_owner change made through
--     an authenticated API request
--   * the is_owner() function is SECURITY DEFINER and reads the profile
--     of auth.uid() only
--
-- Only the project administrator, working in the Supabase SQL Editor
-- (or the dashboard Authentication panel), performs the steps below.
-- ==================================================================

-- STEP 1 — Create the owner account in Supabase Dashboard:
--   Authentication → Users → Add user  (email + password, auto-confirm ON)
--   Or sign up normally through /admin/login and then run STEP 2.

-- STEP 2 — Replace the email below, then run this in the SQL Editor.
--          The SQL Editor runs as postgres, so the RLS restriction and
--          the protect_owner_flag trigger do not block this operation.
update public.profiles
set is_owner = true, updated_at = now()
where lower(email) = lower('owner@your-domain.com');

-- STEP 3 — Verify (should return exactly one row with is_owner = true):
select id, email, is_owner, created_at from public.profiles where is_owner = true;

-- STEP 4 — Sign in at /admin/login with that email and password.
--          The application calls Supabase Auth, revalidates the token with
--          auth.getUser(), and checks profiles.is_owner on every session.

-- TO REVOKE OWNER ACCESS (SQL Editor only):
-- update public.profiles set is_owner = false where lower(email) = lower('owner@your-domain.com');
--
-- PASSWORD RESET: handled by Supabase Auth from /admin/login → "Forgot password".
-- Configure the redirect URL in Supabase Dashboard → Authentication → URL
-- Configuration → Redirect URLs:  https://your-domain.com/admin/login
-- ==================================================================
