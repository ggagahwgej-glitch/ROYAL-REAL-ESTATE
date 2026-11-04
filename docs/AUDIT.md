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

---

# Pass 2 — full verification sweep + presentation upgrade

Date: 2026-11-04 (same branch)

## 1. New automated coverage

`scripts/audit.mjs` (`npm run audit`) crawls every public and studio route against a running
production build and asserts **401 structural conditions** the eye would otherwise catch late:
status codes, `html[lang]`, titles, meta descriptions, canonical URLs, `og:image`, admin
`noindex`, exactly one `<h1>` on public pages, duplicate DOM ids, missing `alt` text, unlabelled
form controls, unnamed icon buttons, empty links, `target="_blank"` without `rel`, JSON-LD that
fails to parse, `undefined`/`NaN` leaking into copy, every internal link resolving, and the
presence of the security headers. It exits non-zero, so it can gate a deploy.

`tests/admin-flows.test.ts` adds 7 unit tests for the studio write paths that previously had none:
settings are always written to row 1 without `updated_at`, a failed cover-clear stops before the
cover is set, gallery renumbering writes `0..n-1` in order, and the dashboard reads all seven
counters (degrading to zeros with a message when the database refuses).

Current totals: **168 unit tests · 61 smoke checks · 401 SSR checks — all passing**, plus a clean
`tsc --noEmit` and `next build`.

## 2. Defects fixed in this pass

| Severity | Defect | Fix |
|---|---|---|
| High | `/properties/[slug]` server-rendered **only a loading skeleton** — no `<h1>`, no price, no gallery in the HTML. Crawlers, link previews and slow connections saw an empty page. | The page now fetches the residence server-side and passes it (with its gallery) into the client component for hydration; the client no longer re-fetches the record it was given. |
| High | A single failed gallery sub-query replaced the **entire residence page** with an error notice. | A degraded gallery is now an inline warning; the residence always renders. |
| Medium | Nothing stopped a server-rendered residence from being swapped for a skeleton once the client booted (config was not initialised on the server). | The loading/setup gates only apply when there is no server-provided record. |
| Low | Anchor targets (`#collection`, `#philosophy`, `#pillars`) scrolled underneath the fixed header. | `[id] { scroll-margin-top: header + 34px }`. |
| Low | 401 audit also flagged missing `content-type` hardening expectations — headers were already correct and are now continuously asserted. | Audit only. |

## 3. Presentation pass (v4, additive)

* **Typography** — `text-wrap: balance` on headings and `pretty` on paragraphs, tabular figures for
  prices, counters and stats (so digits stop jittering), kerning/ligatures enabled on the display
  serif.
* **Colour & ornament** — a single gold hairline across the top edge of property cards, studio
  cards and stat cards; the footer's warm pool of light moved into the background so it can never
  wash over type; hero now fades into the page instead of cutting.
* **Interaction** — consistent gold focus ring for keyboard users, metallic edge and pressed state
  on gold buttons, arrow drift on gold links, calmer image grading with a richer hover grade.
* **Studio** — glassier top bar, hairline active state in the sidebar, denser table typography,
  framed login card with an emblem halo drawn purely in CSS (no new assets), quieter scrollbars.
* **Words** — “Refine the collection”, a more confident collection lead, and a collections
  introduction that states the promise instead of repeating the UI.

No brand asset was redrawn: the approved 3D render remains the only mark, and every existing
brand-kit weight test still passes.

---

# Pass 3 — Vercel deployment readiness (zero warnings, zero build errors)

Goal: import the repository into Vercel and get a clean build on the first attempt, with no
import warnings, no missing-asset crash, no build-time filesystem failure, and no database step
that aborts halfway.

## 1. Defects found and fixed

| Severity | Defect | Fix |
|---|---|---|
| **Critical** | `supabase/schema.sql` declared `public.is_owner()` **before** `public.profiles`. A SQL-language body is analysed at `CREATE` time, so the first paste into a brand-new Supabase project aborted with `relation "public.profiles" does not exist` — the deploy stopped on statement 2 of the very first script. | The helper is created immediately after the table it reads, in `schema.sql` and in the inlined copy inside the generated `showcase-setup.sql`. Verified by executing the scripts against a real PostgreSQL engine. |
| **High** | Nothing ever *executed* the SQL. Earlier passes validated it by parsing only, which is why the ordering bug survived three passes. | `npm run schema:check` boots PostgreSQL 18 in WebAssembly (PGlite), stubs `auth`/`storage`/roles, and runs `schema.sql → storage.sql → verify-schema.sql → showcase-setup.sql` (twice). `7/7 steps passed`; wired into `npm test`. |
| **High** | A deployed Vercel function has a **read-only** filesystem, yet `POST /api/public-config` attempted `mkdir` + `writeFile`, which fails with `EROFS`. Owner Studio would report a failure for an operation that can never work there. | Route now detects `VERCEL`/`VERCEL_ENV`/`IMPERIAL_READONLY_FS` and short-circuits **before** any write: `501`, `mode: "download"`, the exact artifact and the env vars to set. `DELETE` returns an honest "nothing is stored at runtime" response instead of unlinking a file that cannot exist. |
| **High** | Environment variables were the **lowest** priority — a committed sample `public/public-config.json` silently overrode whatever the operator configured in the Vercel dashboard. | Precedence is now runtime file → **environment** → committed file. Env wins over the sample, so a dashboard configuration is never ignored. |
| **Medium** | The root layout applied `alternates.canonical: '/'` to every page, so the static 404 shipped `http://localhost:3000` as its canonical and `og:url` even on a live domain. | Root canonical removed (every real page declares its own); `getSiteUrl()` now resolves `NEXT_PUBLIC_SITE_URL` → request host → `VERCEL_PROJECT_PRODUCTION_URL` → `VERCEL_URL` → localhost, which also covers prerendered pages where no request exists. |
| **Medium** | `next` was declared as `^15.5.28` — Vercel import resolves whatever satisfies the range, and reports an unpinned-framework warning. No `engines`, no `.nvmrc`, no `vercel.json`. | `next` pinned to `15.5.28`; `engines.node: "22.x"`; `.nvmrc` = `22`; `vercel.json` selects the Next.js preset. |
| **Low** | `sharp` was a **runtime** dependency although only `scripts/*.mjs` and the brand tests use it — dead weight in every serverless function bundle and a source of install warnings. | Moved to `devDependencies`; Vercel's image optimizer ships its own copy. Lockfile regenerated. |
| **Low** | No way to confirm a live project's schema matched the application build. | `supabase/verify-schema.sql` — 132 lines, read-only, catalog-only (safe on an empty project): 38 PASS/FAIL rows covering tables, RLS, policy semantics, functions, triggers, buckets, columns, indexes, plus a summary row. Guards the ≤180-line owner constraint in `tests/sql.test.ts`. |
| **Low** | `.vercel` (CLI output) was not ignored. | Added to `.gitignore`. |

## 2. Verified sound (no change needed)

* `next build` emits **zero warnings and zero errors** from a clean `.next`.
* All routes build as static or dynamic correctly; `/api/public-config` and the studio are
  `force-dynamic` as intended, `/properties/[slug]` keeps ISR (`revalidate = 60`).
* `images.remotePatterns` uses the current API (no deprecated `domains`), no static `output:
  'export'` that would break API routes, no `distDir` override.
* No `preinstall` / `postinstall` / `prebuild` hook, so Vercel's install step cannot run anything
  that needs the repository to already be built, or the network beyond the registry.
* Security headers stay report-only, and `X-Frame-Options` / `frame-ancestors` remain absent so
  the hosted preview can still embed the site.
* Largest tracked file is `public/brand/royal-crest-source.png` at 1.4 MB — far below any Vercel
  limit, so no Git LFS is required.

## 3. Coverage added

`tests/deployment.test.ts` (16 tests) and `tests/sql.test.ts` (6 tests): manifest pinning,
engines/`.nvmrc` agreement, framework preset, absence of deprecated image keys and export mode,
publishable-key-only bootstrap file, ignore rules, canonical-origin resolution for all five
fallbacks, and the full SQL deploy order executed against a real database engine. Suite total:
**129 tests in 12 files**, all passing, plus `tsc` clean, `build` clean, `smoke` 61/61 and the SSR
audit 401/401.

---

# Pass 4 — the "404 NOT_FOUND at /" deployment failure

Reported: the Vercel deployment finished in ~2 seconds and the root URL returned
`404: NOT_FOUND`.

## Root cause

`main` — the branch Vercel builds by default — contains exactly one file:

```
$ git ls-tree -r --name-only main
README.md
```

No `package.json`, no `app/`, no `next.config`. Framework detection therefore found nothing to
build, Vercel performed a *static* deployment of an empty site (the two-second duration is the
signature), and every path including `/` resolved to 404. The complete application (174 files) is
on `arena/da665b45-royal-real-estate`; `vercel.json`, `app/page.tsx`, exports and config were never
at fault — `app/(site)/page.tsx` resolves to `/` and exports a default.

## What this pass adds

| Change | Purpose |
|---|---|
| `scripts/vercel-preflight.mjs` + `prebuild` hook | `npm run build` now fails in milliseconds, before compiling, if the built folder has no `package.json`, no `app/`/`pages/`, no root layout, no page resolving to `/` (or one without a default export), a `basePath`, `rewrites()`, `framework !== "nextjs"`, or an `outputDirectory` override. The message names the fix. Verified: passes on this branch, exits 1 on a `main`-shaped checkout. |
| `vercel.json` → `buildCommand: "npm run build"` | Vercel's Next preset would call `next build` directly and skip the `prebuild` hook; going through `npm run build` guarantees the preflight runs on the platform too. |
| `vercel.json` still sets **no** `outputDirectory` | Setting `.next` makes Vercel treat the build folder as static output and 404 every route — the requested change would have *caused* the reported symptom. Documented in `docs/DEPLOYMENT.md` §0 and asserted by a test. |
| `tests/deployment.test.ts` +5 (21 total) | Locks the root entry points (layout + page that resolves to `/`, real default export), the absence of `basePath`/`rewrites()`, the preflight hook, and the `outputDirectory` prohibition. |
| `docs/DEPLOYMENT.md` §0 | The branch table, the two fixes (change Production Branch, or merge into `main`), the required dashboard settings, and new troubleshooting rows. |

## Live verification of the deployed site

`https://roya-real-estate.vercel.app` — first production deployment after the merge:

* Build: **~80 s** (a real build; the failing deploy took ~2 s), GitHub commit status `Vercel:
  Deployment has completed`, state `success`.
* `/` returns the full homepage: title, hero, the six signature residences with prices, the
  collections and destinations sections, the crest and both hero images served through
  `/_next/image`.
* One **content** defect surfaced, not a deployment one: the site correctly fell back to the
  showcase presentation but told the visitor

  `Public website settings could not be read (column site_settings.id does not exist).`

  Two separate issues, both now addressed:
  1. **Schema drift in the connected Supabase project** — `site_settings` predates this build (no
     `id` column). Re-running `supabase/showcase-setup.sql` repairs the table shape; `verify-schema.sql`
     then reports 38/38. This is the owner's one remaining action.
  2. **A raw Postgres message shown to visitors** (fixed in code). Public warnings are now neutral
     prose; the driver text moves to a new `warningDetail` field rendered behind a collapsed
     `<details>Technical detail</details>` for the owner. Owner Studio still gets the full message.
     `tests/content.test.ts` now fails the build if a database message is interpolated into any
     visitor-facing `warning`.


### Second live finding: the collection flashed an empty state

On the deployed homepage the showcase catalogue was replaced by
“**The collection is being prepared** — no published residences are available yet”, while `/properties`
rendered all 20 residences from the same data source. Cause: both collection gates tested only the
*configuration* hook (`config.loading`), never the *data* hook (`loading`), so between hydration and
the first query resolving the component fell through to the empty state. Fixed in
`PropertyCollection` and `PropertyBrowser` — the skeleton now holds until `configured && loading`
is false, so a populated collection can never be replaced by an empty one. Guarded by a test.

---

# Pass 5 — mobile render safety & the Owner Studio gallery dead end

## 1. Coloured static rows across property cards (Android Chrome)

A compositing stack, not a colour problem. On the card, three things combined:

| Layer | Code | Why it broke |
|---|---|---|
| `backdrop-filter: blur(6px)` on `.property-fav` and `.property-tags .badge` | `globals.css` | A backdrop blur compositing a CSS-**filtered** `<img>` behind it, inside an `overflow:hidden` card with `isolation:isolate` — the known Chromium/Android tile-corruption path |
| Three stacked `filter:` declarations on `.property-image img` (`.92` → `.99/.1.05` → hover `.1.04/.1.07`) | `globals.css` | Only the last wins, but every re-declaration forces a repaint; the hover variant animated *while* the card was mid-transform |
| `mix-blend-mode: overlay` on the `feTurbulence` grain | `.hero-grain` | GPU-rendered noise blended over a composited layer is the classic generator of coloured static |
| Hover state on a touch screen | `.property-card:hover` | A tap latches `:hover` on Android, leaving the card composited with a translate + image scale + animating filter |

Fixed by removing each part rather than masking it: the two chips now use a solid
`rgba(8,9,13,.82)` fill, one image filter remains and is disabled below 900 px, the grain keeps its texture
but never blends, and all hover transforms live behind `@media (hover:none), (pointer:coarse)`.
On small screens the remaining `backdrop-filter` uses (header, hero badge, mobile overlay, glass panels,
studio top bar, sticky table headers) are switched off with opaque replacements, and the card's
`box-shadow` is dropped so scrolling stops repainting it. No `will-change`/`translateZ(0)` was added —
the fix is fewer composited layers, and a test fails if an acceleration hint ever appears.

## 2. "Save the property first" dead end in Owner Studio

The Media gallery tab rendered `MediaManager` only for `isEdit && propertyId`, otherwise a terminal
empty state — the only way forward was to guess that the form had to be submitted first.

Now the tab *is* the affordance:

* clicking **Media gallery** on a new residence validates and saves it, then lands on
  `/admin/properties/<id>/edit?saved=1&tab=media` — one click, no dead end;
* if the essentials are missing, the form stays on Core details, names the first two problems, and
  moves the cursor to the offending field;
* the panel itself lists what the gallery needs (title, city, collection, price) with live ticks and a
  **Save details & open gallery** button, so the requirement is visible before the click;
* the tab carries a lock while unsaved, and `?tab=` is honoured on load so the redirect and any
  bookmark land in the right place.

`tests/ui-safety.test.ts` (11 tests) covers both halves: the CSS stack rules and the studio flow.

---

# Pass 6 — six owner-experience defects

Every item was reported from real use, and each is now covered by a test.

| # | Defect | Fix |
|---|---|---|
| 1 | The **Inquiries badge said "New" forever** — every page load, whether or not anything was unread (`AdminShell`). | `getNewInquiryCount()` counts `status = 'new'` with `head: true` (no rows transferred); the shell re-reads on every navigation so opening the inbox clears it. Failed counts show nothing rather than a false badge. Shows the number, `99+` above that, with an `aria-label`. |
| 2 | A **deleted Storage object rendered a broken-image box** in cards and in the lightbox. | `SmartImage` and `Lightbox` gained `onError` state that swaps in the branded emblem (`NoImage`, with the original alt text as an `aria-label` and `data-image-fallback` for diagnostics). No empty rectangles anywhere an image can fail. |
| 3 | **`getSiteSettings` had no ceiling** — the header and footer await it on every page, so a stalled database froze the site chrome. | 8 s `AbortController` **plus** a racing timer (some platforms never settle an aborted fetch). Timeouts now route into the showcase fallback with `warning`/`warningDetail`, exactly like a schema error. |
| 4 | The hero figures **25+ / 40+ / 100% were hardcoded** in `Hero.tsx` — unverifiable claims about the client's business. | New `site_settings.hero_stats` JSONB (`{value,label}[]`), edited in **Owner Studio → Website Settings → Homepage hero** (add/remove, up to four, live hints), normalised on read *and* write, rendered by `Hero` (empty list hides the row). `schema.sql`, `showcase-setup.sql`, both `public/sql/` mirrors and `verify-schema.sql` (now 38 checks, 132 lines) are updated; a project that has not migrated still saves everything else and is told why. |
| 5 | `app/admin/(studio)/media/page.tsx` suppressed its dependency list (`eslint-disable`) over a `selected`/`error` capture. | `load` now reads `selected` through a functional update and reports both sources with `p.error ?? m.error ?? null` (a media success no longer clears a properties error); the effect depends on `[load]` with no suppression. |
| 6 | `InquiryForm` used fixed ids (`inq-name`…), so a second instance on a page broke every label association. | `useId()` prefix; ids are now unique per instance. |

Verification: `tsc` clean · **168 tests / 14 files** · clean `next build` · smoke **61/61** · SSR audit **401/401** · SQL deploy order **7/7**.
