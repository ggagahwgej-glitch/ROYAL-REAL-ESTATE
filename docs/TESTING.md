# Testing & Verification Guide

## Automated (executed in this repository)

| Command | What it verifies |
|---|---|
| `npm run typecheck` | TypeScript strict check across all app, lib and component code |
| `npm run build` | Production build of all 24 routes, metadata routes, sitemap, robots, manifest |
| `npm run test` | 90 unit + static security + regression assertions (configuration validation, key-role rejection, browser config persistence/import/export, exact hero copy, genuine-testimonial integrity, filtering, pagination, formatting, RLS schema assertions, no service-role key, no PIN system, **anon-inquiry no-representation insert, Google/OpenStreetMap map normalisation, open-redirect blocking, MIME inference, DB-first media deletion**, traced gold/crimson crest master, vector (not bitmap) lockups, responsive transparent raster set, favicon payload budget, manifest icon sizes matching the real files**) |
| `npm run smoke` | 61 checks: all routes, exact hero copy/button labels, no fabricated testimonials, honest empty state, configuration endpoint rejects secret keys and unauthenticated publishes, DELETE on an unconfigured site does not false-500, downloadable RLS script is present; public `/setup` guide, one-paste SQL download and sitemap showcase slugs; robots/sitemap/manifest/favicon present; brand-kit weight budget (96 px emblem < 25 KB, 192 px < 40 KB, SVG favicon < 20 KB) and the light lockup served as the traced gold/crimson vector — not a black-tiled bitmap |

## Live, project-dependent tests (require a real Supabase project)

These cannot be executed in a sandbox without the client's Supabase credentials. The application
provides **executable** tests instead of claims:

1. `/admin/configuration → Run diagnostics` — live checks for connectivity, anonymous property write
   denial, private inquiry protection, forced inquiry status, anonymous settings write denial,
   owner authorization (`profiles.is_owner`), schema presence, storage policies and credential exposure.
2. `supabase/rls-tests.sql` — independent database-level assertions using the real `anon` role in the
   Supabase SQL Editor. A failure aborts the transaction.
3. Manual checklist:
   - **Configuration**: enter URL/key → Test → Save → reload (persistence) → Import/Export → publish
     shared → open the site in a *different browser/incognito* to confirm the shared bootstrap works.
   - **Authentication**: correct email/password, wrong password, unauthorised account, session
     persistence after reload, logout, password reset (email + recovery link), expired session handling.
   - **Properties**: create, edit, delete, publish, unpublish, feature, availability change, duplicate.
   - **Media**: multiple image upload, video upload, preview, reorder, set cover, replace, remove,
     failed-upload rollback, and confirmation that the public gallery reflects changes.
   - **Inquiries**: submit from the public site, confirm it is saved, read/mark read/contacted/resolved/delete.
   - **Security**: verify RLS with `rls-tests.sql`, verify a non-owner account cannot read inquiries or
     write properties, verify private storage is inaccessible anonymously, verify no service-role key
     appears in bundles, localStorage, `public-config.json` or network configuration payloads.
   - **Responsive**: check mobile (360/390px), tablet (768px), laptop (1280px) and large (1920px)
     widths for both the public site and the Owner Studio; verify no horizontal overflow.

## Showcase mode (client demonstration)

This build ships a labelled showcase so the example site is complete on first open. `npm run test`
includes 24 dedicated assertions in `tests/showcase.test.ts` covering: at least 20 published
residences with unique slugs, ≥3 gallery images with exactly one cover each, ≥8 sample references
with valid 1–5 ratings and `sample: true` on every one, no `AggregateRating` structured data,
in-memory filter/search/sort/pagination parity, default-value-only settings merging, SQL/public
copy parity, schema + storage + RLS installation, all-column legacy-schema detection, privilege repair after an interrupted run, and absence of secret credentials.

`tests/content.test.ts` runs with `NEXT_PUBLIC_SHOWCASE=0` (via `vi.hoisted`) so the original
live-mode guarantees still hold: no invented quotes, an honest empty state, malformed JSONB
rejected and database errors surfaced.

To test the **real** database path, run `supabase/showcase-setup.sql` in the Supabase SQL Editor
once, then re-run `/admin/configuration → Run diagnostics` and `supabase/rls-tests.sql`.

## SQL syntax validation

`scripts/validate-sql.py` parses every `supabase/*.sql` file with the real PostgreSQL grammar
(optional dev dependency: `python3 -m venv .venv && .venv/bin/pip install pglast`). It validates
both the outer statements and every PL/pgSQL function/`DO` block, including dollar-quoted bodies,
without connecting to a database. All five scripts currently report `ALL SQL VALID`. Run it before
pasting any script into the Supabase SQL Editor.

## Not yet verified

No browser automation runtime (Chromium / Playwright) is available in this sandbox, so **visual
rendering, hydrated form interaction and device-width layout checks were not executed**. A real
Supabase project URL and publishable key WERE supplied and were checked live (REST, Auth settings,
anonymous permission denials); the schema mismatch found is documented in `README.md`. Direct
network egress from the sandbox is blocked, so no SQL could be executed and no live Auth sign-in,
RLS test, Storage upload, inquiry submission, config publish across visitors or SQL Editor test
could be run. Route smoke checks verify HTTP
responses and server-rendered markup; they do not prove hydrated client behavior. The manual
checklist above and the in-app diagnostics are the remaining acceptance tests.

## Setup state

With no shared configuration, every data-driven surface shows a professional setup state with
instructions instead of broken components or fabricated listings. The owner receives explicit
guidance in `/admin/configuration`.
