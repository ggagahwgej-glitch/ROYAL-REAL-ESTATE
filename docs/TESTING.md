# Testing & Verification Guide

## Automated (executed in this repository)

| Command | What it verifies |
|---|---|
| `npm run typecheck` | TypeScript strict check across all app, lib and component code |
| `npm run build` | Production build of all 24 routes, metadata routes, sitemap, robots, manifest |
| `npm run test` | 41 unit + static security assertions (configuration validation, key-role rejection, filtering, pagination, formatting, RLS schema assertions, no service-role key, no PIN system) |
| `npm run smoke` | All routes return expected status/content; configuration endpoint rejects secret keys and unauthenticated publishes; robots/sitemap/manifest/favicon present |

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

## Setup state

With no shared configuration, every data-driven surface shows a professional setup state with
instructions instead of broken components or fabricated listings. The owner receives explicit
guidance in `/admin/configuration`.
