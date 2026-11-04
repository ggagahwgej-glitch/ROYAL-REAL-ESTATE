# Testing & Verification Guide

## Automated (executed in this repository)

| Command | What it verifies |
|---|---|
| `npm run typecheck` | TypeScript strict check across all app, lib and component code |
| `npm run build` | Preflight (the built folder really is the application: `package.json`, `app/`, a page resolving to `/`, no `basePath`, `framework: nextjs`, no `outputDirectory` override), then a production build of all 24 routes, metadata routes, sitemap, robots, manifest |
| `npm run test` | 136 unit + static security + regression assertions (configuration validation, key-role rejection, browser config persistence/import/export, exact hero copy, genuine-testimonial integrity, filtering, pagination, formatting, RLS schema assertions, no service-role key, no PIN system, **anon-inquiry no-representation insert, Google/OpenStreetMap map normalisation, open-redirect blocking, MIME inference, DB-first media deletion**, keyed gold/crimson client render (transparent master, 2048 px print master), self-contained lockups, responsive transparent raster set, favicon payload budget, manifest icon sizes matching the real files, **stable public slugs on property updates, duplicate-slug messaging, city/locality/country search, land-parcel area display, display-preference normalisation/application, studio write paths: settings row 1, cover clearing order, gallery renumbering, dashboard counters**, deployment contract: pinned Next version + Node engine, Vercel preset, no deprecated image key, no framing headers, canonical-origin fallbacks, publishable-key-only bootstrap file, **SQL deploy order executed in a real PostgreSQL engine (schema → storage → verify → showcase, twice)**, app-router entry points + no root displacement, the Vercel deploy preflight, **no database message in any visitor-facing warning**, every `supabase/*.sql` byte-identical to `public/sql/`, and the read-only 180-line verification script) |
| `npm run smoke` | 61 checks: all routes, exact hero copy/button labels, no fabricated testimonials, honest empty state, configuration endpoint rejects secret keys and unauthenticated publishes, DELETE on an unconfigured site does not false-500, downloadable RLS script is present; public `/setup` guide, one-paste SQL download and sitemap showcase slugs; robots/sitemap/manifest/favicon present; brand-kit weight budget (96 px emblem < 25 KB, 192 px < 40 KB, SVG favicon < 20 KB) and the light lockup served with the keyed client render — transparent, never a black-tiled bitmap |

| `npm run audit` | 401 SSR quality checks against a running build (`BASE_URL`, default `localhost:3000`): status codes, `html[lang]`, titles, descriptions, canonical + `og:image`, admin `noindex`, exactly one `<h1>` on public pages, duplicate ids, `alt` text, labelled form controls, named icon buttons, empty links, `target=_blank` safety, JSON-LD parsing, leaked `undefined`/`NaN`, every internal link resolving, and the security headers. Exits non-zero on any failure. |

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

## SQL execution — offline, in a real PostgreSQL engine

`npm run schema:check` (also part of `npm test`) boots PostgreSQL 18 compiled to WebAssembly
(`@electric-sql/pglite`) and recreates the parts of a Supabase project the SQL depends on: the
`auth` and `storage` schemas, `auth.uid()/role()/jwt()`, the three storage tables and the
`anon` / `authenticated` / `service_role` roles. It then executes the documented deploy order

```
supabase/schema.sql → supabase/storage.sql → supabase/verify-schema.sql
→ supabase/showcase-setup.sql (twice, proving idempotency)
```

and prints `7/7 steps passed`. Any error, or any FAIL row from `verify-schema.sql`, exits non-zero.

This gate caught a real, first-run failure: `public.is_owner()` was declared **before**
`public.profiles`, and because a SQL-language body is analysed at `CREATE` time, the very first
paste into a brand-new Supabase project aborted with `relation "public.profiles" does not exist`.
The helper is now created after the table, in both `schema.sql` and the inlined copy inside
`showcase-setup.sql`.

`scripts/validate-sql.py` additionally parses every file with the real PostgreSQL grammar
(optional: `python3 -m venv .venv && .venv/bin/pip install pglast`).

Only the pgcrypto extension line is skipped in the WASM harness — Supabase provides it, the
harness does not, and `gen_random_uuid()` is native either way.

## Not yet verified

No browser automation runtime (Chromium / Playwright) is available in this sandbox, so **visual
rendering, hydrated form interaction and device-width layout checks were not executed**. A real
Supabase project URL and publishable key WERE supplied and were checked live (REST, Auth settings,
anonymous permission denials); the schema mismatch found is documented in `README.md`. Direct
network egress from the sandbox is blocked. The SQL itself *is* executed — in a real PostgreSQL
engine, offline (`npm run schema:check`) — but no live Auth sign-in, RLS test against the client's
project, Storage upload, inquiry submission, config publish across visitors or Supabase SQL
Editor run could be performed. Route smoke checks verify HTTP
responses and server-rendered markup; they do not prove hydrated client behavior. The manual
checklist above and the in-app diagnostics are the remaining acceptance tests.

## Setup state

With no shared configuration, every data-driven surface shows a professional setup state with
instructions instead of broken components or fabricated listings. The owner receives explicit
guidance in `/admin/configuration`.
