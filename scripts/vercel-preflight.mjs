#!/usr/bin/env node
/**
 * Deployment preflight.
 *
 * Runs before every `npm run build` (locally and on Vercel) and fails in
 * milliseconds — with an actionable message — if the directory being built is
 * not the application. This is the guard against the failure mode that produced
 * a "404 NOT_FOUND at /" after a two-second deploy: Vercel built a branch (or a
 * Root Directory) that contained no `package.json` and no `app/`, so framework
 * detection fell back to a static deploy with nothing to serve.
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const errors = [];
const notes = [];

const has = (rel) => existsSync(path.join(root, rel));

/* ── 1. This must be the application root ─────────────────────────────── */
const manifestPath = path.join(root, 'package.json');
let manifest = null;
if (!has('package.json')) {
  errors.push(
    'package.json is missing from the build root. Vercel is building a branch or a ' +
    '"Root Directory" that does not contain the application.',
  );
} else {
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    errors.push(`package.json is not valid JSON (${error.message}).`);
  }
}

if (manifest) {
  const scripts = manifest.scripts ?? {};
  if (!scripts.build) errors.push('package.json has no "build" script.');
  if (!manifest.dependencies?.next) {
    errors.push('next is not listed in dependencies, so the framework cannot be detected.');
  }
}

/* ── 2. A router must exist, and something must answer "/" ────────────── */
const hasApp = has('app') && statSync(path.join(root, 'app')).isDirectory();
const hasPages = has('pages') || has('src/pages');
const hasSrcApp = has('src/app');

if (!hasApp && !hasPages && !hasSrcApp) {
  errors.push(
    'No app/ or pages/ directory at the build root. Set Vercel → Settings → General → ' +
    'Root Directory to the repository root.',
  );
}

if (hasApp) {
  if (!has('app/layout.tsx') && !has('app/layout.jsx') && !has('app/layout.js')) {
    errors.push('app/ has no root layout (app/layout.tsx).');
  }

  /** Every route segment between app/ and the file, minus route groups. */
  const pageRoutes = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(abs);
      else if (/^page\.(tsx|jsx|ts|js)$/.test(entry.name)) {
        const segments = path
          .relative(path.join(root, 'app'), path.dirname(abs))
          .split(path.sep)
          .filter((s) => s && s !== '.' && !/^\(.*\)$/.test(s));
        pageRoutes.push({ route: `/${segments.join('/')}`.replace(/\/$/, '') || '/', file: abs });
      }
    }
  };
  walk(path.join(root, 'app'));

  const rootPage = pageRoutes.find((p) => p.route === '/');
  if (!rootPage) {
    errors.push(
      `No page resolves to "/" (found: ${pageRoutes.map((p) => p.route).join(', ') || 'none'}). ` +
      'The homepage must be app/page.tsx or a route group such as app/(site)/page.tsx.',
    );
  } else {
    const source = readFileSync(rootPage.file, 'utf8');
    if (!/export\s+default/.test(source)) {
      errors.push(`${path.relative(root, rootPage.file)} has no default export, so "/" cannot render.`);
    }
    notes.push(`homepage → ${path.relative(root, rootPage.file)}`);
  }
  notes.push(`${pageRoutes.length} app routes detected`);
}

/* ── 3. Nothing may displace "/" at the config level ──────────────────── */
for (const candidate of ['next.config.ts', 'next.config.mjs', 'next.config.js']) {
  if (!has(candidate)) continue;
  const config = readFileSync(path.join(root, candidate), 'utf8');
  if (/basePath\s*:/.test(config)) {
    errors.push(`${candidate} sets basePath, so the site is not served from "/".`);
  }
  if (/rewrites\s*\(\s*\)/.test(config)) {
    errors.push(`${candidate} declares rewrites(); verify none of them capture "/".`);
  }
  notes.push(`config → ${candidate}`);
}

/* ── 4. Framework preset cannot be overridden into a static deploy ────── */
if (has('vercel.json')) {
  try {
    const vercel = JSON.parse(readFileSync(path.join(root, 'vercel.json'), 'utf8'));
    if (vercel.framework !== 'nextjs') {
      errors.push(`vercel.json framework is "${vercel.framework ?? 'unset'}" — must be "nextjs".`);
    }
    if (vercel.outputDirectory) {
      errors.push(
        'vercel.json sets outputDirectory. For a Next.js project that makes Vercel serve the ' +
        'build folder as static output and every route 404s — remove it.',
      );
    }
    notes.push('vercel.json → framework nextjs, no outputDirectory override');
  } catch (error) {
    errors.push(`vercel.json is not valid JSON (${error.message}).`);
  }
}

/* ── Report ───────────────────────────────────────────────────────────── */
if (errors.length === 0) {
  console.log(`preflight: OK — ${notes.join(' · ')}`);
  process.exit(0);
}

console.error('\npreflight: this directory cannot produce a working deployment.\n');
for (const error of errors) console.error(`  ✗ ${error}`);
console.error(
  '\nFix: in Vercel → Project → Settings → General, set Root Directory to the repository root ' +
  'and Production Branch to the branch that contains the application (this repository keeps its ' +
  'code on a long-lived feature branch, not on main).\n',
);
process.exit(1);
