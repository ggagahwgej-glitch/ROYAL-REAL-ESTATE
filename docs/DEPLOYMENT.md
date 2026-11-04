# Deployment — Vercel, zero warnings

This document is the single source of truth for taking this repository from GitHub to a live
domain. Everything in it is already configured in the repository: there is nothing to change in
the Vercel dashboard beyond adding two environment variables.

---

## 0. Read this first: "404 NOT_FOUND at /" after a two-second deploy

A two-second deploy means **no build ran**. Vercel found no `package.json` and no `app/` in the
branch it was told to build, so it fell back to a static deployment with nothing to serve — hence
`404: NOT_FOUND` at `/`.

That is a **branch** problem, not a code problem. In this repository:

| Ref | Contents |
|---|---|
| `main` | `README.md` only — no `package.json`, no `app/` |
| `arena/da665b45-royal-real-estate` | the complete application (174 files) |

Pick one fix:

1. **Change the production branch (fastest, no merge).**
   Vercel → Project → **Settings → Git → Production Branch** → `arena/da665b45-royal-real-estate`
   → *Save*, then **Deployments → Redeploy**. The next deploy runs a real build (≈40 s, not 2 s).
2. **Merge the branch into `main`** (recommended long-term) — open a pull request from
   `arena/da665b45-royal-real-estate` into `main` and merge it. `main` then contains the app and
   every future deploy works, including previews from `main`.

Either way, also confirm in **Settings → General**:

* **Root Directory** = *empty* (repository root) — not `public`, not `app`.
* **Framework Preset** = *Next.js* (also declared in `vercel.json`).
* **Output Directory** = *default* — do **not** set `.next`. For a Next.js project an explicit
  output directory makes Vercel treat the build folder as static output, and every route 404s.

From now on this can never fail silently: `npm run build` starts with
`scripts/vercel-preflight.mjs`, which aborts in milliseconds with an actionable message if the
built folder has no `package.json`, no `app/`, or no page that resolves to `/`.

---

## 1. Import the repository

1. Vercel → **Add New… → Project → Import Git Repository** → select this repository.
2. Leave every build setting on its default. The repository already declares:

| Setting | Value | Declared in |
|---|---|---|
| Framework preset | **Next.js** | `vercel.json` (`"framework": "nextjs"`) |
| Root directory | repository root | — |
| Install command | `npm ci` (default) | `package-lock.json` is committed |
| Build command | **`npm run build`** | `vercel.json` (so the prebuild preflight runs; `next build` alone would skip it) |
| Output directory | **default — never set `.next`** | the Next.js preset owns it; an explicit value breaks routing |
| Node.js version | **22.x** | `package.json` → `engines.node`, `.nvmrc` |

`next` is **pinned** to `15.5.28` (no caret) so the Vercel import cannot resolve a different
framework version than the one this build was verified against, and no "different Node.js
version / unpinned framework" warning is raised on import.

3. Add the environment variables in step 2 below, then **Deploy**.

---

## 2. Environment variables

| Variable | Required | Scope | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes (production) | Production, Preview, Development | `https://<project-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes (production) | Production, Preview, Development | the **publishable / anon** key only |
| `NEXT_PUBLIC_SITE_URL` | optional | Production | `https://your-domain.com` — pins canonical URLs, `sitemap.xml` and Open Graph before the first request |
| `NEXT_PUBLIC_SHOWCASE` | optional | any | `0` hides the demonstration catalogue |

**Never add a service-role key.** The application never reads one, and `tests/deployment.test.ts`
fails the build if one is committed. Row Level Security is the actual access-control boundary.

### How the app resolves its configuration

`lib/config/server.ts` resolves the public bootstrap config in this order:

1. `data/public-config.json` — written by the owner through `/api/public-config` on a writable
   filesystem (VPS / local). Highest priority because it is the owner's most recent choice.
2. **Deployment environment variables** — this is how a Vercel project is configured.
3. `public/public-config.json` — the committed sample, used when nothing else is set.

Environment variables deliberately beat the committed file: a sample project shipped in the
repository must never silently override what the operator configured in the dashboard.

On a read-only serverless filesystem, `POST /api/public-config` short-circuits **before** writing
and returns `501` with `mode: "download"`, the exact artifact to commit as
`public/public-config.json`, and the names of the environment variables to set. It never attempts
a doomed write and never claims to have saved globally. `GET /api/public-config` reports
`runtimeWritable: false` so Owner Studio can explain the situation instead of failing.

---

## 3. Database (Supabase) — run once, in this order

Open Supabase → **SQL Editor** → paste each file → **Run**.

| # | File | Lines | What it creates |
|---|---|---|---|
| 1 | `supabase/schema.sql` | 287 | 5 tables, functions, triggers, RLS policies, grants |
| 2 | `supabase/storage.sql` | 42 | 3 buckets + 6 storage policies |
| 3 | `supabase/owner-provisioning.sql` | 39 | promotes one auth user to owner (`is_owner = true`) |
| 4 | `supabase/showcase-setup.sql` | 1229 | self-healing reset: schema + storage + showcase rows |
| 5 | `supabase/verify-schema.sql` | 130 | **read-only** checklist — 37 PASS/FAIL rows |

Every file is byte-identical to its `public/sql/` copy (enforced by `tests/sql.test.ts`), so the
same links are available from the running site at `/sql/<name>.sql`.

- `showcase-setup.sql` is idempotent: it is safe to re-run, and it repairs a project whose tables
  were created with a different shape.
- `verify-schema.sql` mutates nothing. Re-run it after any manual change; `999 · summary` reads
  `37 / 37` when the schema matches this build.
- Owner accounts: create the user in **Authentication → Users**, then run
  `owner-provisioning.sql` with that email.

### Schema drift

`npm run schema:check` executes the whole deploy order offline — `schema.sql` → `storage.sql` →
`verify-schema.sql` → `showcase-setup.sql` twice — inside a WebAssembly PostgreSQL instance
(`@electric-sql/pglite`, a dev dependency). It is the gate that proves the shipped SQL still
applies cleanly to an empty project and is safe to re-run. It exits non-zero on any error or FAIL
row, and it runs as part of `npm test`.

---

## 4. Verify the deployment

```bash
BASE_URL=https://your-domain.com npm run smoke   # 61 end-to-end HTTP checks
BASE_URL=https://your-domain.com npm run audit   # 401 SSR quality checks
```

Both scripts accept any origin, so they work against the live domain exactly as they do locally.

Canonical URLs resolve in this order: `NEXT_PUBLIC_SITE_URL` → the incoming request host →
`VERCEL_PROJECT_PRODUCTION_URL` (used while prerendering the static 404 page) → `VERCEL_URL`
(preview deployments) → `http://localhost:3000`. A deployed site never emits a `localhost`
canonical, even before `NEXT_PUBLIC_SITE_URL` is set.

---

## 5. What is intentionally not on Vercel

| Feature | Behaviour on Vercel | Why |
|---|---|---|
| Owner-published shared config (`POST /api/public-config`) | returns `501` + downloadable artifact and env-var instructions | the bundle is read-only; there is no persistent disk to write `data/public-config.json` to |
| Clearing the config (`DELETE`) | returns `ok: true` with instructions | nothing is stored at runtime to clear |
| `data/public-config.json` | git-ignored, never required | VPS-only runtime override |
| Image uploads | Supabase Storage, public bucket `property-media` | Vercel functions have no durable disk |
| Local `sharp` | dev dependency only | Vercel's image optimizer ships its own copy; the module is only used by `scripts/*.mjs` and brand tests |

---

## 6. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Deploy finishes in ~2 s and `/` is `404 NOT_FOUND` | the built branch has no application (this repo's code is not on `main`) | set the Production Branch to the code branch, or merge it into `main` — see section 0. The preflight now fails the build with this exact message. |
| Build log: `No Output Directory named "public" found` | Output Directory was overridden during import | set it back to *default*; the Next.js preset owns `.next` |
| Every route 404s but the build succeeded | Output Directory was set to `.next` | clear it — the Next.js preset consumes `.next` itself |
| Site loads, every collection is empty | env vars missing or added only to Preview | add both `NEXT_PUBLIC_SUPABASE_*` to **Production** and redeploy |
| Owner Studio shows "read-only filesystem" | expected on serverless | configure via env vars (step 2); the download artifact is an alternative |
| `next/image` 400 on an external host | host not in `images.remotePatterns` | add it in `next.config.ts` → `remotePatterns` (`domains` is deprecated) |
| 404 page shows `http://localhost:3000` | a root-level canonical was reintroduced | remove it; `getSiteUrl()` handles the static case via `VERCEL_PROJECT_PRODUCTION_URL` |
| SQL Editor: `relation "public.profiles" does not exist` | `is_owner()` declared before its table | fixed in `schema.sql`; re-pull the current file |
| Vercel warns about Node version | `engines.node` / `.nvmrc` missing | both are committed (`22.x`); check the project's Node setting matches |

---

## 7. Local gates before pushing

```bash
npm run preflight     # is this folder the deployable application?
npm run typecheck     # strict TypeScript
npm run test          # 129 unit tests, including the SQL deploy order
npm run schema:check  # SQL deploy order only (PGlite)
npm run build         # production build — must print no warnings
npm run smoke         # 61 checks against a running server
npm run audit         # 401 SSR checks against a running server
```
