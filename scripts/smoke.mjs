/* Route + endpoint smoke test against a RUNNING server.
   Usage: BASE_URL=http://localhost:3000 node scripts/smoke.mjs */
import { writeFileSync } from 'node:fs';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6Imh0dHBzOi8vYWJjLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJpYXQiOjE3MDAwMDAwMDAsImV4cCI6MjAwMDAwMDAwMH0.signature';
const SERVICE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoiaHR0cHM6Ly9hYmMuc3VwYWJhc2UuY28vYXV0aC92MSIsImlhdCI6MTcwMDAwMDAwMCwiZXhwIjoyMDAwMDAwMDAwfQ.signature';

const ROUTES = [
  ['/', 200, 'Where Exceptional Living'],
  ['/properties', 200, 'Find your exceptional address'],
  ['/buy', 200, 'Residences for sale'],
  ['/rent', 200, 'Residences for rent'],
  ['/categories', 200, 'Signature collections'],
  ['/about', 200, 'A house built on'],
  ['/contact', 200, 'Begin a private conversation'],
  ['/settings', 200, 'Display preferences'],
  ['/properties/a-nonexistent-residence', 200, null],
  ['/admin', 307, null],
  ['/admin/login', 200, 'Private Owner Studio'],
  ['/admin/dashboard', 200, null],
  ['/admin/properties', 200, null],
  ['/admin/properties/new', 200, null],
  ['/admin/properties/00000000-0000-4000-8000-000000000000/edit', 200, null],
  ['/admin/inquiries', 200, null],
  ['/admin/media', 200, null],
  ['/admin/settings', 200, null],
  // The Owner Studio guards render a verification loader during SSR; the page title appears after hydration.
  ['/admin/configuration', 200, 'Verifying your secure session'],
  ['/robots.txt', 200, 'Disallow: /admin'],
  ['/sitemap.xml', 200, '<urlset'],
  ['/manifest.webmanifest', 200, 'Imperial Royal'],
  ['/icon.svg', 200, '<svg'],
  ['/favicon.svg', 200, '<svg'],
  ['/setup', 200, 'Connect the live collection'],
  ['/public-config.json', 200, 'schemaVersion'],
  ['/sql/schema.sql', 200, 'ROW LEVEL SECURITY'],
  ['/images/hero-estate.jpg', 200, null],
];

const results = [];
async function request(path, init = {}, timeout = 60000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(`${BASE}${path}`, { ...init, signal: controller.signal, redirect: 'manual' });
    const type = res.headers.get('content-type') ?? '';
    const body = type.includes('json') ? await res.json().catch(() => ({})) : await res.text().catch(() => '');
    return { status: res.status, body, headers: res.headers };
  } finally { clearTimeout(timer); }
}

let failures = 0;
function check(label, condition, detail = '') {
  results.push({ label, pass: Boolean(condition), detail });
  if (!condition) failures++;
  console.log(`${condition ? '  PASS' : '  FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
}

console.log(`\nImperial Royal — route smoke test against ${BASE}\n${'='.repeat(64)}`);
for (const [path, expectedStatus, expectedText] of ROUTES) {
  try {
    const r = await request(path);
    const rendered = typeof r.body === 'string' ? r.body : JSON.stringify(r.body);
    const ok = r.status === expectedStatus && (!expectedText || rendered.includes(expectedText));
    check(`${path} → ${r.status}`, ok, ok ? '' : `expected ${expectedStatus}${expectedText ? ` + "${expectedText}"` : ''}`);
    if (typeof r.body === 'string' && /Application error|Internal Server Error|This page could not be found/i.test(r.body)) {
      check(`${path} has no error page`, false, 'error marker in HTML');
    }
  } catch (e) { check(path, false, e.message); }
}

console.log(`\nHomepage content contract\n${'-'.repeat(64)}`);
try {
  const home = await request('/');
  const html = typeof home.body === 'string' ? home.body : '';
  const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1] ?? '';
  const h1Text = h1.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  check('Exact hero heading', h1Text === 'Where Exceptional Living Meets Timeless Elegance.', h1Text);
  check('Exact hero supporting text', html.includes('Discover extraordinary residences, prestigious addresses and exceptional real estate opportunities.'));
  check('Exact primary button label', html.includes('Explore Properties.'));
  check('Exact secondary button label', html.includes('Discover Our Collection.'));
  check('No fabricated client testimonials', !['A. R. Mehta', 'Eleanor Vance', 'S. Kapoor'].some(n => html.includes(n)));
  check('Honest testimonial empty state is server-rendered', html.includes('References are shared in confidence.'));

  const cfg = await request('/public-config.json');
  check('Shared config contains the real project URL',
    cfg.status === 200 && typeof cfg.body === 'object' && /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(String(cfg.body.url ?? '')));
  check('Shared config exposes a publishable key only (no secret)',
    /^sb_publishable_/.test(String(cfg.body?.anonKey ?? '')) && !JSON.stringify(cfg.body).includes('sb_secret_'));

  const setup = await request('/sql/showcase-setup.sql');
  const setupSql = typeof setup.body === 'string' ? setup.body : '';
  check('One-paste showcase setup script is downloadable', setup.status === 200 && setupSql.includes('insert into public.properties'));
  check('Setup script also removes foreign policies and revokes anon profile access',
    setupSql.includes('do $policies$') && setupSql.includes('revoke all on public.profiles from anon'));
  check('Setup script seeds at least 20 residences',
    (setupSql.match(/\n    \('/g) ?? []).length >= 20, `${(setupSql.match(/\n    \('/g) ?? []).length} value rows`);
  check('Setup script preserves the old schema data', setupSql.includes('imperial_legacy_backup'));
  check('Setup script detects every legacy column mismatch and repairs privileges',
    setupSql.includes('with needed(t, cols)') && setupSql.includes("'listing_type'")
    && setupSql.includes("'storage_path'") && setupSql.includes('grant select on public.properties to anon, authenticated'));

  const sitemap = await request('/sitemap.xml');
  check('Sitemap includes showcase residence pages',
    sitemap.status === 200 && String(sitemap.body).includes('/properties/azure-cliff-residence'));
} catch (e) { check('Homepage content contract', false, e.message); }

console.log(`\nConfiguration endpoint tests\n${'-'.repeat(64)}`);
try {
  const get = await request('/api/public-config');
  check('GET /api/public-config returns a structured payload',
    get.status === 200 && typeof get.body === 'object' && 'configured' in get.body,
    `configured=${get.body.configured}`);
  check('GET response never contains a service-role key', !JSON.stringify(get.body).includes(SERVICE));
  check('GET is not cached', /no-store/.test(get.headers.get('cache-control') ?? ''));

  const badKey = await request('/api/public-config', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config: { url: 'https://abc.supabase.co', anonKey: SERVICE }, accessToken: 'a.b.c' }),
  });
  check('POST refuses a service-role key (400)', badKey.status === 400, String(badKey.body.error ?? ''));

  const noToken = await request('/api/public-config', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config: { url: 'https://abc.supabase.co', anonKey: ANON }, accessToken: '' }),
  });
  check('POST refuses an unauthenticated publish (403)', noToken.status === 403, String(noToken.body.error ?? ''));

  const badUrl = await request('/api/public-config', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config: { url: 'not a url', anonKey: ANON }, accessToken: 'a.b.c' }),
  });
  check('POST refuses an invalid URL (400)', badUrl.status === 400);

  const clear = await request('/api/public-config', {
    method: 'DELETE', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessToken: '' }),
  });
  // A bound project requires a verified owner token (403). An empty project
  // has nothing to clear (200). Neither may report a false 500.
  check('DELETE respects owner authorization / gracefully handles an empty project',
    get.body.configured === true
      ? clear.status === 403
      : clear.status === 200 && clear.body.ok === true,
    `configured=${get.body.configured} status=${clear.status}`);

  const mapSql = await request('/sql/rls-tests.sql');
  check('Downloadable RLS script contains executable permission probes',
    mapSql.status === 200 && String(mapSql.body).includes('PASS A8b'));
} catch (e) { check('Configuration endpoint tests', false, e.message); }

console.log(`\n${'='.repeat(64)}`);
console.log(`${results.length - failures}/${results.length} checks passed, ${failures} failed.`);
writeFileSync('scripts/smoke-results.json', JSON.stringify({ base: BASE, at: new Date().toISOString(), results }, null, 2));
process.exit(failures ? 1 : 0);
