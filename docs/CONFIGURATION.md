# Dynamic Supabase Configuration — Architecture

This application has **no mandatory Vercel/environment-variable dependency** for its Supabase connection.
The owner configures the project inside the embedded Owner Studio at `/admin/configuration`.

## One centralized configuration manager

`lib/config/manager.ts` is the *only* browser-side source of connection state. Both the public website
and the Owner Studio call `useSupabaseConfig()` (`lib/hooks/useSupabaseConfig.ts`) or `getConfig()`.
`lib/supabase/factory.ts` is the *only* place `createClient()` is called; every query, storage operation
and auth call obtains its client from that factory. The only deliberate exception is
`createTemporaryClient()`, used for connection testing, server-side owner verification and anonymous
security probes — it is never cached and never persists a session.

Server Components (`generateMetadata`, `sitemap.xml`) use `lib/config/server.ts`, which reads the
**shared** configuration from the same files the public API route serves.

## Two clearly distinct scopes

| Scope | Where stored | Who it affects | How it is published |
|---|---|---|---|
| **A. Local browser configuration** | `localStorage` key `imperial-royal.supabase.config.v2` | Only the browser that saved it | `Save Configuration` / `Update Configuration` |
| **B. Shared public configuration** | `data/public-config.json` (runtime) or `public/public-config.json` (static) | **Every visitor** | `Publish shared` in Backend Configuration, or commit the downloaded artifact |

**The application never claims that A configures everyone.** The UI labels both scopes explicitly, and
`/settings` shows which one is active. Priority on any device: local override → shared → optional
build-time `NEXT_PUBLIC_*` fallback.

## Shared bootstrap mechanism

`GET /api/public-config` is public and returns only `{url, anonKey, publishedAt, storage, persistent}`.
`POST /api/public-config` is **owner-gated server-side**:

1. Re-validates the URL and key (rejects service-role/secret keys).
2. Validates the Supabase access token against the project's Auth server (`auth.getUser(token)`).
3. Reads `profiles.is_owner` through a request scoped to that JWT, so RLS applies.
4. Only then writes `data/public-config.json`.

A hidden button is never relied upon for security. `DELETE` uses the same verification.

On a read-only serverless filesystem, the endpoint returns HTTP 501 with `mode: "download"` and the
exact JSON artifact. It **does not claim success**. Download it, place it at
`public/public-config.json` in the repository and redeploy — no service-role key is involved.
A custom persistent endpoint can also be used by placing the artifact there; the static runtime file
approach is the documented default.

## Import / export

`Export` downloads `public-config.json`; `Import` validates a file, refuses any file containing a
service-role credential, and re-runs connection validation. The artifact contains **only** the project
URL and publishable/anon key — these are public by design; RLS protects all data.

## Connection test (five real checks)

1. Input format validation.
2. Real network round-trip to `<url>/rest/v1/` with the supplied key (detect 401/403, timeouts, DNS/CORS failures).
3. Auth service health (`/auth/v1/health`, informational).
4. Application schema check via `site_settings` (distinguishes "connected" from "schema not installed").
5. A clear success/failure summary.

`Save Configuration` and `Update Configuration` re-run the test before persisting. Nothing is saved
when the connection fails, and no false success message is shown.

## No service-role key, anywhere

* `lib/config/validation.ts` rejects `sb_secret_…`, `sb_publishable_…` only accepted as public,
  service-role JWTs (decoded `role` claim), and any unknown role.
* SQL provisioning, storage policies and all writes rely on Row Level Security.
* `tests/security.test.ts` statically asserts no secret credentials in browser code.
* `/admin/configuration → Run diagnostics` verifies it live against the project.

## First-run sequence

1. `/admin/configuration` → URL + publishable/anon key → **Test Connection** → **Save Configuration**.
2. Run `supabase/schema.sql`, `supabase/storage.sql`, `supabase/owner-provisioning.sql` in the Supabase SQL Editor.
3. Create the owner user (Authentication → Users, auto-confirm) and add the login URL to Redirect URLs.
4. Sign in at `/admin/login`, then **Publish shared**.
5. Run **Security & permission diagnostics** and `supabase/rls-tests.sql`; resolve all failures.
6. Add real listings. No demo property data is ever shown as production content.

## First-publish-wins and URL immutability

A brand-new deployment has no shared project, so the **first owner-verified publish binds the website
to that project**. Publish immediately after deployment from the real owner account. After that, the
project URL cannot be changed from a browser session (only the publishable/anon key may be rotated),
and clearing the configuration also requires an owner session verified against the *currently bound*
project. This prevents a third party from repointing a configured website to a project they control.

`supabase/rls-tests.sql` and the in-app diagnostics remain the authoritative verification of the
bound project's permissions.
