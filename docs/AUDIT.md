# Whole-Project Audit — Findings & Fixes

Date: 2026-11-04 · Branch: `arena/da665b45-royal-real-estate`

Scope: every route under `app/`, all components, `lib/` (config, auth, Supabase queries, storage,
maps, preferences), `next.config.ts`, `supabase/*.sql` (schema, RLS, triggers, storage policies),
plus a production build, the route smoke suite and the unit/regression suite.

Status after this pass: `tsc --noEmit` clean · `vitest` **100/100** · `next build` clean ·
`smoke` **61/61**.

---

## 1. Defects found and fixed

| # | Severity | Defect | Fix |
|---|---|---|---|
| 1 | High | `lib/config/manager.ts` — the `/api/public-config` probe had **no timeout**. A stalled endpoint left `initialized: false` forever, so every page stayed on its loading skeleton with no error. | `fetchJson()` now aborts after 8 s via `AbortController`, and a timeout is reported as a readable note instead of a permanent spinner. |
| 2 | High | Quick actions in **Owner Studio → Properties** (publish, feature, availability) sent `{ title, ... }` to `updateProperty()`, which re-derived the slug from the title. Toggling a badge could silently change a live listing's public URL (broken links, lost rankings, unique-slug failures). | `propertyPayload(input, deriveSlug)` only derives a slug on **create**; an update changes the slug only when the owner actually edits it. Regression tests added. |
| 3 | Medium | Display preferences (density / contrast / reduced motion) were written to `<html>` by `/settings` only. Leaving the page dropped them, so the setting appeared to do nothing. | New `lib/preferences.ts` (normalise → read → apply → persist) plus `components/site/PreferencesBootstrap.tsx` mounted in the root layout, so the choice applies on every page and follows other tabs. |
| 4 | Medium | `PropertyBrowser` wrote filters into the URL but never read them back: browser **Back/Forward** changed the address bar while the results stayed frozen on the old filter set. | Two-way sync with a `selfWritten` guard — external URL changes are adopted, own writes are ignored. No loops. |
| 5 | Medium | Home page “Featured destinations” linked to `/properties?location=<last word>`; e.g. “The Azure Coast” → `?location=Coast`, which can never match a listing. Every card led to an empty result set. | Cards now link to the collection (the destinations are editorial themes, not filterable cities). |
| 6 | Medium | `MediaManager` dropzone: the hidden `<input type="file">` sits **inside** the clickable container, so a programmatic `input.click()` bubbled back into the container handler and could re-trigger itself/double-open the picker. | Input stops propagation; the container ignores clicks that originate inside the input. |
| 7 | Medium | Area display: land parcels (`area_sqft = 0`, `lot_sqft` set) rendered “Interior area 0 sq ft” on the detail page, cards and admin table. | New `formatArea()` in `lib/utils.ts` → “1,42,000 sq ft plot”. Tested. |
| 8 | Low | Search by location matched **city only**, although the form promises “City or region”. Searching a locality returned nothing. | Filter now matches city, locality and country (input still sanitised for PostgREST syntax). |
| 9 | Low | A duplicate slug surfaced as the raw Postgres `duplicate key value violates unique constraint …` dump. | `friendlyPropertyError()` explains the collision and the exact `/properties/<slug>` address. |
| 10 | Low | Breadcrumb “Home” was a plain `<a href="/">` on seven pages — a full page reload inside a client-routed app. | Converted to `next/link`. |
| 11 | Low | Two `target="_blank"` links in the studio omitted `rel="noopener noreferrer"`. | Added. |
| 12 | Low | `usePublicProperties` reset `perPage` to 9 on empty/error states, ignoring the requested page size. | Falls back to the caller's `perPage`. |
| 13 | Low | Alt-text editor closed even when the save failed, discarding the typed description. | `run()` reports success; the editor only closes on success. |
| 14 | Low | `Modal` had no dialog semantics or focus handling. | `role="dialog"`, `aria-modal`, `aria-labelledby`, focus moved into the panel on open. |
| 15 | Low | No HTTP security headers at all. | Added `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-DNS-Prefetch-Control` and a **report-only** CSP documenting the required origins. Deliberately **no** `X-Frame-Options` / `frame-ancestors` so the preview frame keeps working. |
| 16 | Low | `protect_owner_flag()` guarded with `auth.uid() is not null` — a key-only (anon) request has a NULL uid, so the flag would have been writable through the API had a policy ever granted `UPDATE` on `profiles`. | Guard now keys off the PostgREST JWT-claims GUC, so **any** API request is blocked while the SQL Editor still provisions owners. Patched in `supabase/schema.sql`, `supabase/showcase-setup.sql` and both `public/sql/` copies. |

Documentation drift fixed at the same time: `README.md` and `docs/TESTING.md` now state the real
test counts and the new regression coverage.

---

## 2. Verified sound (no change needed)

* **No service-role key anywhere**; `lib/config/validation.ts` rejects `sb_secret_…` and
  `service_role` JWTs in every path (local storage, import, publish, server config).
* **RLS**: published-only public reads, media gated on the parent listing, `inquiries` insert-only
  for `anon` with server-forced `status = 'new'`, no public `SELECT`/`UPDATE`/`DELETE` on enquiries
  or profiles, permissive legacy policies dropped before installation.
* **Enquiry submit** never requests a representation (which would fail for `anon`), validates
  against the same constraints as the database, and reports failures honestly.
* **Auth**: session revalidated with `auth.getUser()` on every check, `is_owner` read through RLS,
  open-redirect protection via `safeNextPath()`, browser-only login throttling on top of Supabase
  rate limits, PKCE and implicit recovery links both handled.
* **Storage**: MIME inferred from the extension when the browser sends none, HEIC rejected with
  guidance, batch upload rolls back on partial failure, DB row deleted before the object.
* **Search input** is stripped of PostgREST syntax characters before `.or()` is built.
* **No `eval`, no unsafe `innerHTML`**; the single `dangerouslySetInnerHTML` is JSON-LD with `<`
  escaped. Owner-supplied social links pass through `safeUrl()`; map URLs are host-allowlisted.
* Sitemap, robots, manifest, canonical URLs and per-property JSON-LD all generate correctly from
  the runtime request host (no build-time env needed).

---

## 3. Optional SQL hardening (only if the database was provisioned before this pass)

The full scripts in `supabase/` already contain the fix. If `schema.sql` was already run on the
live project, run this once in the Supabase SQL Editor — it is safe to re-run:

```sql
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
```

No data change, no downtime. Owner provisioning from the SQL Editor continues to work because the
editor has no request JWT context.
