# IMPERIAL ROYAL REAL ESTATE — Digital Experience v2.0

A single Next.js application combining an ultra-luxury public real estate website with a
fully embedded, Supabase-secured Owner Admin Studio.

**One website · one Next.js codebase · one domain · one embedded Admin Studio · one Supabase
project per client · dynamic configuration · no secret PIN · no service-role key · no mandatory
Vercel environment configuration.**

---

## Quick start

```bash
npm install
npm run dev            # http://localhost:3000  (bound to 0.0.0.0 for live preview)
```

This build is a **client demonstration**: it is pre-connected to the supplied Supabase project and
displays a labelled showcase of 20 residences, 60 gallery images and 8 sample references with star
ratings on first load — no setup required to see the full experience. To make those same records
editable in the Owner Studio, run the one-paste SQL below ([details](#client-demonstration--one-paste-setup)).

For a fresh production client (no demonstration content), the site shows an intentional professional
**setup state**. To connect real data:

1. Open `/setup` (always reachable) or `/admin/configuration` when no shared config is published yet.
2. Enter your Supabase **Project URL** and **Publishable key / legacy anon key**.
3. **Test Connection** → **Save Configuration** (saved in this browser).
4. Run `supabase/schema.sql`, `supabase/storage.sql`, `supabase/owner-provisioning.sql` in the
   Supabase SQL Editor; create the owner user in Authentication → Users.
5. Sign in at `/admin/login`, then **Publish shared** so *all visitors* use the connection.
   On read-only hosting, download the `public-config.json` artifact and commit it to
   `public/public-config.json`.
6. Run **Security & permission diagnostics** → add real properties.

Full detail: [`docs/CONFIGURATION.md`](docs/CONFIGURATION.md) · [`docs/TESTING.md`](docs/TESTING.md).

---

## Architecture

```
app/
  (site)/                     Public website (shared Header/Footer chrome)
    page.tsx                  Homepage — 12 editorial sections
    properties/               Listing browser + [slug] detail (dynamic SEO + JSON-LD)
    buy/ rent/ categories/    Filtered discovery routes
    about/ contact/ settings/ Story, private enquiry, display preferences
  admin/
    login/                    Supabase Auth sign-in, reset & recovery
    (studio)/                 Owner Studio (guarded, noindex, own chrome)
      dashboard/ properties/ properties/new/ properties/[id]/edit/
      inquiries/ media/ settings/ configuration/
  api/public-config/          Public bootstrap config (GET) + owner-gated publish (POST/DELETE)
  sitemap.ts robots.ts manifest.ts icon.svg
components/
  brand/                      Traced knight-helmet crest (gold + crimson) + 9 SVG lockups, WebP set, 6 PNG icons
  site/ admin/ ui/            Shared design-system components
lib/
  config/                     ONE dynamic configuration manager (+ server reader, validation)
  supabase/                   ONE client factory, queries, storage
  auth/                       Supabase Auth + owner verification
  properties/ hooks/ diagnostics.ts
  showcase.ts maps.ts          Demonstration catalogue + Google Maps normaliser
supabase/                     schema.sql · storage.sql · owner-provisioning.sql · rls-tests.sql · showcase-setup.sql
public/
  brand/ sql/ images/         Static brand kit, SQL downloads, original photography
  public-config.json          Shared public bootstrap (pre-connected for this demo)
tests/ scripts/               90 unit/security/regression tests + 61 live route/content smoke checks
```

### Security model

| Concern | Implementation |
|---|---|
| Authentication | Supabase Auth email + password. No PIN, no second secret, no hardcoded credential. |
| Authorization | `auth.getUser()` revalidates the token; `profiles.is_owner` verified; **RLS** on all five tables and storage. The `/api/public-config` write route verifies the JWT and owner flag **server-side**. Frontend guards are usability only. |
| Owner provisioning | Only possible in the Supabase SQL Editor. `profiles` has no insert/update/delete policies, and a `protect_owner_flag` trigger blocks self-elevation. |
| Keys | Publishable / legacy anon only. `lib/config/validation.ts` decodes JWT `role` claims and refuses `service_role`, `sb_secret_…` and unknown roles. |
| Public permissions | Read published listings, published media, public settings; controlled inquiry insert (status forced to `new`). Nothing else. |
| Session | Persisted by Supabase Auth, auto-refreshed, re-verified on visibility change and every 5 minutes; expired sessions redirect to sign-in. Password reset via Supabase. Client-side throttle + Supabase Auth rate limits. |

### Dynamic configuration — the important distinction

* **Local browser configuration** (`localStorage`) affects only that browser.
* **Shared public configuration** (`/api/public-config` → `data/public-config.json` or
  `public/public-config.json`) affects **every visitor**. localStorage alone cannot do this, and the
  UI never claims it does.

Both the public site and the Owner Studio resolve connections from
`lib/config/manager.ts` → `lib/supabase/factory.ts`. See [`docs/CONFIGURATION.md`](docs/CONFIGURATION.md).

---

## Design system — Imperial Midnight Luxury

* Obsidian `#090B10`, Imperial Black `#08090D`, Royal Navy `#101827`, Champagne Gold `#C6A45A`,
  Metallic Gold `#D4B36A`, Antique Gold `#927442`, Ivory `#F4F0E7` — with **crimson lacquer**
  `#C01D34` / `#961229` / `#5C0A17` as the second house colour (`--crimson*` tokens in `app/globals.css`).
* Cormorant Garamond (display) + Inter (body), loaded at runtime — no build-time font fetch.
* **Sovereign knight-helmet crest** — the client's own helmet drawing, kept as
  `public/brand/royal-crest-source.png` and never redrawn. The build only adds the finish: the
  silhouette is traced to **true vector curves**, then dressed in a polished champagne-gold face
  over a deep crimson lacquer backing, with a crimson inner rim and a champagne edge light. Because
  every lockup reuses that vector, the mark stays razor-sharp from a 16 px favicon to a 20 000 px
  print master, and ships in `gold`, `mono` (single-colour engraving) and `light` tones.
* The website streams a **transparent WebP set at 96 / 192 / 384 px** (1x / 2x / 3x) over a palette-PNG
  fallback, so the 52 px header crest costs ~3 KB. Launcher icons are flattened to opaque obsidian
  (iOS composites transparency onto black); tab favicons stay transparent.
* Regenerate everything with `python3 scripts/generate-brand.py` — it runs
  `scripts/prepare-crest.mjs`, which cleans the drawing into a two-tone mask, traces it, applies the
  gold/crimson finish and rebuilds every raster size, icon and SVG lockup.
* Need a bigger raster? `node scripts/export-hires.mjs 20000` renders the vector at any size
  (16 384 px is already shipped in `brand-exports/`); nothing is ever upscaled from a bitmap.
* Restrained motion with full `prefers-reduced-motion` support; responsive from 360px to 1920px.

| Asset | Use |
|---|---|
| `public/brand/royal-crest.svg` | **vector master** — gold + crimson, lossless at any size |
| `public/brand/royal-crest-4096.png` | 4096 px transparent print master |
| `public/brand/royal-crest.png` | 1024 px transparent palette-PNG web master / emblem fallback |
| `public/brand/royal-crest-{96,192,384}.webp` | responsive transparent emblem (1x / 2x / 3x) |
| `public/brand/royal-crest.jpg` | opaque obsidian tile — email signatures, social cards |
| `public/brand/emblem-{gold,mono,light}.svg` | single-emblem lockups (same traced vector) |
| `public/brand/logo-{horizontal,light,footer}.svg` | horizontal wordmark lockups (same traced vector) |
| `public/brand/favicon.svg`, `public/favicon.svg`, `app/icon.svg` | SVG favicons (~5 KB, 96 px palette payload) |
| `public/favicon-{16,32,64}.png`, `public/apple-touch-icon.png`, `public/brand-mark-{192,512}.png` | raster icons; launcher icons flattened to opaque obsidian |
| `public/brand/royal-crest-source.png` | the client's original drawing — the source of truth |
| `brand-exports/royal-crest-16384px.png` | 16 384 px deliverable, generated from the vector (`node scripts/export-hires.mjs 20000` for 20 K) |

---|---|
| `public/brand/royal-crest.png` | 384 px transparent palette-PNG master (39 KB) — emblem fallback, print, email |
| `public/brand/royal-crest-96.png` | 96 px palette PNG embedded in the SVG favicons |
| `public/brand/royal-crest-{96,192,384}.webp` | responsive transparent emblem (1x / 2x / 3x) |
| `public/brand/royal-crest.jpg` | opaque obsidian tile — email signatures, social cards |
| `public/brand/emblem-{gold,mono,light}.svg` | single-emblem lockups, self-contained (embedded palette PNG) |
| `public/brand/logo-{horizontal,light,footer}.svg` | horizontal wordmark lockups |
| `public/brand/favicon.svg`, `public/favicon.svg`, `app/icon.svg` | SVG favicons (96 px payload) |
| `public/favicon-{16,32,64}.png`, `public/apple-touch-icon.png`, `public/brand-mark-{192,512}.png` | raster icons; launcher icons flattened to opaque obsidian |
* Restrained motion with full `prefers-reduced-motion` support; responsive from 360px to 1920px.

---

## Commands

```bash
npm run dev          # development server (0.0.0.0)
npm run build        # production build
npm run start        # production server (0.0.0.0)
npm run typecheck    # strict TypeScript check
npm run test         # vitest — 90 tests
npm run smoke        # requires a running server; BASE_URL=http://localhost:3000
```

## SEO

Dynamic per-property metadata and Open Graph, canonical URLs, `RealEstateListing` JSON-LD,
`sitemap.xml` (includes published listings), `robots.txt` disallowing `/admin` and `/api`,
web manifest, local image optimization with next/image and lazy loading for owner uploads.
Canonical origins are derived from the incoming request host, so no environment variable is
needed for SEO (`NEXT_PUBLIC_SITE_URL` is an optional override).
Admin routes carry `noindex, nofollow, nocache`.

## Client demonstration & one-paste setup

Because this website is an **example to show clients how the product looks and works**, it ships
with a clearly labelled showcase catalogue. On first open you will see:

| Item | Count | Where it appears |
|---|---|---|
| Residences | **20** | Homepage collection, `/properties`, `/buy`, `/rent`, `/categories`, detail pages, sitemap and Owner Studio → Properties |
| Gallery images | **60** | Property cards, lightboxes, detail galleries and Owner Studio → Media |
| Sample references | **8** | Homepage testimonials section with **gold star ratings**, Owner Studio → Website settings → Testimonials |
| Brand kit | **Sovereign knight-helmet crest** — the client's own helmet drawing, traced to vector and finished in champagne gold over crimson lacquer (the old generic shield / `IR` monogram is retired) | Header, footer, favicon, hero badge, `public/brand/*`, `scripts/generate-brand.py` |

Everything is marked *Showcase* / *Sample*. No `AggregateRating` structured data is emitted for the
sample references, and the site states plainly that they are illustrative, not genuine endorsements.
Set `NEXT_PUBLIC_SHOWCASE=0` to turn showcase mode off completely; once real rows exist in Supabase,
the showcase disappears automatically and owner-published content takes precedence.

### Live check of the supplied project

The project URL and publishable key **work** — REST `/rest/v1/` and Auth settings respond correctly.
But live inspection found that the database was built for a **different application** ("Aurum
Estates"): `properties` has no `city`, `category`, `listing_type`, `featured`, `availability` or
`area_sqft`; `property_media` has no `kind`, `public_url`, `is_cover` or `position`; and
`site_settings` uses nested JSONB (`branding`, `contact`, `website`) instead of the flat columns
this app reads. `inquiries` and `profiles` are correctly locked down for anonymous visitors.

Without alignment those mismatches produce PostgREST `42703` errors, blank galleries and default
branding. This is why the showcase fallback exists: the site looks complete while the schema is
brought into line.

### Fix it in one paste

1. Supabase Dashboard → **SQL Editor → New query**.
2. Open **`/setup`** — a public, no-index setup guide that is always reachable. Once a shared
   config exists, `/admin/configuration` is correctly locked behind a verified owner session, and
   the owner flag itself is created by this script, so `/setup` is the bootstrap entry point.
3. Click **Copy setup SQL** (or download
   [`supabase/showcase-setup.sql`](supabase/showcase-setup.sql)) → paste → **Run**.
4. Reload the Owner Studio and sign in at `/admin/login`.

**If an earlier attempt failed:** just re-run this corrected script. The first version only
checked whether `properties` had a `category` column; a legacy table can have `category` and
`city` yet still be missing `listing_type`, `storage_path`, `public_url` and `is_cover`. In that
case the rebuild was skipped, an index or policy failed, and anonymous reads were left blocked
(`42501 permission denied`). The corrected guard checks **every required column of all four
content tables**, backs up the old rows, rebuilds the mismatched tables, and restores the minimum
public privileges even if a previous run stopped halfway. No data is lost.

### Use the live health check — not guesswork

`/setup` now runs **six read-only anonymous GETs** against the connected project the moment it
opens and shows a green/red verdict for: the properties shape, ≥20 `published` rows, the gallery
shape, flat settings + reviews, and whether `profiles`/`inquiries` are private. Click **Re-check**
after every SQL run. No password, secret key or write is involved.

**Only one file is correct:** [`supabase/showcase-setup.sql`](supabase/showcase-setup.sql)
(the same bytes are served at `/sql/showcase-setup.sql`). If the health check reports *"a
different schema"*, a script from another project was pasted into this Supabase instance. That
creates rows the website cannot read — for example `status = 'Available'` instead of
`status = 'published'`, `sqft` instead of `area_sqft`, `url` instead of `storage_path`/`public_url`,
and a key/value `site_settings` row instead of flat columns. It can also leave
`profiles.is_owner` readable by anonymous visitors, which is a security defect. The corrected
script backs those rows up, rebuilds the tables, removes foreign RLS policies and revokes
anonymous access to `profiles`. If the SQL Editor shows an error, copy the exact error text —
do not substitute a different script.

The script is idempotent and does the following:

* **Preserves data** — copies the old rows to `public.imperial_legacy_*` tables before replacing
  anything (once only).
* Installs the exact schema, constraints, triggers, RLS policies and Storage buckets this app needs.
* Provisions the first Auth user as the verified owner (`profiles.is_owner`).
* Seeds 20 residences, 60 gallery images, branding/hero settings and 8 rated sample references.
* Prints a verification notice with the resulting counts.

> **Heads-up:** replacing the schema will stop any *other* app still pointing at this project from
> working. The old data is retained in the `imperial_legacy_*` tables. Remove the showcase records
> from the Owner Studio before using this project for real clients.

---

## Bug-fix pass ( November 2026 )

A systematic review of the public site, Owner Studio, Supabase layer, listing flow, maps and
uploads found and corrected the following concrete defects. Each has a regression test in
`tests/integration.test.ts` unless it is a pure SQL/HTTP concern.

| Area | Defect | Fix |
|---|---|---|
| Public enquiries | `submitInquiry()` used `.insert(...).select('id')`, requesting `return=representation` from an `anon` role with **no SELECT grant/policy** on `inquiries`. Every enquiry failed with permission denied. | Insert without representation; validate name/email/message first; return `QueryResult<null>`. |
| Diagnostics | The controlled inquiry probe used the same forbidden anon `.select()`. | Probe with a unique email, insert without representation, verify forced `status='new'` through the owner client, then clean up. |
| RLS test script | `supabase/rls-tests.sql` aborted on the *expected* `insufficient_privilege` and used an anon SELECT to verify a forced status — self-contradictory. | Rewritten to treat denied reads as PASS, insert without `RETURNING`, verify after `reset role`, then `rollback`. Both copies (`supabase/`, `public/sql/`) are in sync. |
| Google Maps | Google share/place links (`maps.app.goo.gl`, `google.com/maps/place/…`) were iframed verbatim and rendered blank because Google sends `X-Frame-Options`; no external link existed. Arbitrary URLs were accepted. | New `lib/maps.ts` extracts coordinates, builds keyless Google/OSM embeds, host-allowlists owner input, handles `latitude=0`, and every listing now has an **Open in Google Maps** link plus a blocked-iframe note. Owner form validates the pasted link and explains it. |
| Uploads | Files with an empty MIME type (common on Android/camera-roll) were rejected; HEIC produced a confusing error; `deletePropertyMedia()` removed the Storage object *before* the DB row, so a failing DB delete left a broken gallery; cleanup failures were silently swallowed; `client!` could throw when a session lapsed. | MIME inference from extension, actionable HEIC message, DB-first deletion with explicit warning, rollback-failure reporting, `requireClient()` guards and an honest upload message. Branding bucket MIME allowlist now matches the validator. |
| Auth / security | `?next=https://evil.example` was an open redirect; password recovery saved a new password without verifying a recovery session; publishing used a possibly stale session snapshot; owner verification could be skipped by a `busy` guard and left stale state after config changes. | `safeNextPath()` allowlists internal `/admin` routes; recovery requires a verified session (also supports `?code=` PKCE links); `getOwnerAccessToken()` revalidates a current token; `useOwner` uses a generation token instead of dropping re-checks. |
| Configuration | A forced `initialize()` could emit stale shared config after a newer run; the REST probe sent publishable keys in a Bearer header on gateways that reject that; DELETE reported 500 when no runtime file existed. | Generation-guarded initialisation, dual apikey/Bearer probe variants, honest ENOENT response. |
| Listings | `getRelatedProperties()` built a PostgREST `.or()` expression from unquoted city/category values; search input could contain filter-syntax characters. | Two parameterised queries merged in memory; stricter search sanitising. |
| Performance / UX | Every public component issued its own site-settings query; a draft property's "View public site" link 404'd; the collection's empty state sent visitors to an admin page; a newly created property showed no success notice. | Short-lived shared settings promise cache with invalidation on save; status-aware link; public-facing CTA; creation confirmation. |

## Honest scope notes

* **Live project verified, not yet modified.** The supplied URL and publishable key were checked
  live: the project is up, REST and Auth respond, and anonymous reads of `inquiries` / `profiles`
  are correctly denied. The schema mismatch described above is a real, confirmed finding.
* **I could not execute the SQL for you.** This sandbox can reach the project only through a
  read-only page fetcher; direct network access and the Supabase SQL Editor API are not available.
  Writing rows, creating Storage buckets, running RLS tests and provisioning the owner therefore
  require the one paste above. I did not use or store the account password you shared.
* **Please rotate that password.** It was pasted into a chat transcript in plain text. Change it in
  Supabase Authentication → Users. The publishable key in `public/public-config.json` is designed
  to be public and is safe there; a service-role or secret key is never accepted by this app.
* **Sample content is deliberately fake.** The 20 residences, 60 images and 8 star-rated
  references are illustrative demonstration records, explicitly labelled as such on the public
  site and in the Owner Studio. In live mode, testimonials remain real, owner-published records in
  `site_settings.testimonials` with written client permission, and no ratings are invented.
* **"16K" is not a practical web format.** A true 16K still is ~130 megapixels and hundreds of
  megabytes per image; a page of them would never load on mobile. The generated photography here
  is 1376×768, graded for high dynamic range and delivered through Next.js responsive image
  optimization (`next/image`, AVIF/WebP where supported), which is what actually produces a crisp,
  fast, luxurious result at every screen size.
* **Browser rendering was not automated.** No Chromium/Playwright runtime is available in this
  sandbox, so visual, hydrated-form, mobile-width and Google Maps iframe checks still need a quick
  manual pass with the checklist in [`docs/TESTING.md`](docs/TESTING.md). The app ships executable
  live diagnostics (`/admin/configuration → Run diagnostics`) and `supabase/rls-tests.sql`.
  The `/setup` guide is linked from the sign-in page and from every owner-guard error screen.
* The first owner-verified publish binds the website to that Supabase project; afterwards the
  project URL cannot be repointed from a browser session (only the publishable key can rotate).
  See [`docs/CONFIGURATION.md`](docs/CONFIGURATION.md).
* `scripts/validate-sql.py` parses every SQL script with the real PostgreSQL grammar (optional `pip install pglast`); all five currently report `ALL SQL VALID`.
* Built on Next.js `15.5.28` (patched for CVE-2025-66478). `data/public-config.json` is a runtime
  file on writable Node/VPS deployments; on read-only serverless hosting the API returns a
  downloadable artifact and explicit redeploy instructions rather than a false success.
