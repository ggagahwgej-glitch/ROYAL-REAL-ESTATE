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

The site works immediately with an intentional, professional **setup state**. To connect real data:

1. Open `/admin/configuration` → **Backend Configuration**.
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
  brand/                      Original royal golden emblem + 7 brand lockups
  site/ admin/ ui/            Shared design-system components
lib/
  config/                     ONE dynamic configuration manager (+ server reader, validation)
  supabase/                   ONE client factory, queries, storage
  auth/                       Supabase Auth + owner verification
  properties/ hooks/ diagnostics.ts
supabase/                     schema.sql · storage.sql · owner-provisioning.sql · rls-tests.sql
public/
  brand/ sql/ images/         Static brand kit, SQL downloads, original photography
  public-config.json          Shared public bootstrap template
tests/ scripts/               41 unit/security tests + live route smoke harness
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
  Metallic Gold `#D4B36A`, Antique Gold `#927442`, Ivory `#F4F0E7`.
* Cormorant Garamond (display) + Inter (body), loaded at runtime — no build-time font fetch.
* Original hand-drawn heraldic SVG emblem (crowned lion within an architectural shield) with
  `gold`, `mono` and `light` tones, plus horizontal, compact, emblem, favicon and footer lockups.
  Static brand kit is in `public/brand/`; `app/icon.svg` is the favicon.
* Restrained motion with full `prefers-reduced-motion` support; responsive from 360px to 1920px.

---

## Commands

```bash
npm run dev          # development server (0.0.0.0)
npm run build        # production build
npm run start        # production server (0.0.0.0)
npm run typecheck    # strict TypeScript check
npm run test         # vitest — 41 tests
npm run smoke        # requires a running server; BASE_URL=http://localhost:3000
```

## SEO

Dynamic per-property metadata and Open Graph, canonical URLs, `RealEstateListing` JSON-LD,
`sitemap.xml` (includes published listings), `robots.txt` disallowing `/admin` and `/api`,
web manifest, local image optimization with next/image and lazy loading for owner uploads.
Admin routes carry `noindex, nofollow, nocache`.

## Honest scope notes

* No live Supabase project was supplied, so **live database / Auth / Storage / upload operations
  could not be executed here**. The application ships executable live diagnostics
  (`/admin/configuration → Run diagnostics`) and `supabase/rls-tests.sql` for that verification.
  See [`docs/TESTING.md`](docs/TESTING.md) for the complete manual checklist.
* Property listings are never faked: with no backend they are replaced by a setup/empty state.
  The architectural photography and editorial brand copy are static marketing assets.
* `data/public-config.json` is a runtime file on writable Node/VPS deployments. On read-only
  serverless hosting the API returns a downloadable artifact and explicit redeploy instructions
  rather than a false success.
