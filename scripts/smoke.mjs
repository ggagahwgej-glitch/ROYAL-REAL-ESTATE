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
} catch (e) { check('Configuration endpoint tests', false, e.message); }

console.log(`\n${'='.repeat(64)}`);
console.log(`${results.length - failures}/${results.length} checks passed, ${failures} failed.`);
writeFileSync('scripts/smoke-results.json', JSON.stringify({ base: BASE, at: new Date().toISOString(), results }, null, 2));
process.exit(failures ? 1 : 0);
