#!/usr/bin/env node
/* ==================================================================
   SSR quality audit — runs against a live server (production build).

   Usage:  BASE_URL=http://localhost:3000 node scripts/audit.mjs
           npm run audit          (expects a server on :3000)

   Checks every public and admin route for the defects a browser would
   surface later: duplicate DOM ids, unlabelled controls, images without
   alt text, dangling internal links, broken JSON-LD, missing metadata,
   leaking "undefined"/"NaN" into rendered copy, and missing security
   headers. Exits non-zero when something fails, so it can gate a deploy.
================================================================== */
import { createRequire } from 'node:module';

// Next ships this parser; resolve it explicitly so no extra dependency is needed.
const require = createRequire(import.meta.url);
const { parse } = require('next/dist/compiled/node-html-parser/index.js');

const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');

const ROUTES = [
  '/', '/properties', '/buy', '/rent', '/categories', '/about', '/contact', '/settings', '/setup',
  '/properties/the-signature-land-parcel', '/properties/azure-cliff-residence', '/properties/villa-serene-alibaug',
  '/admin/login', '/admin/dashboard', '/admin/properties', '/admin/properties/new',
  '/admin/properties/00000000-0000-4000-8000-000000000000/edit',
  '/admin/inquiries', '/admin/media', '/admin/settings', '/admin/configuration',
  '/robots.txt', '/sitemap.xml', '/manifest.webmanifest', '/favicon.svg', '/brand/royal-crest-384.png',
];

const results = [];
const linkTargets = new Set();
const record = (route, name, ok, detail = '') => results.push({ route, name, ok, detail });

async function fetchRoute(path) {
  const res = await fetch(`${BASE}${path}`, { headers: { 'user-agent': 'imperial-audit/1.0' } });
  return { res, body: await res.text() };
}

/* ---------------------------------------------------------------- helpers */
const isInteractive = (el) =>
  ['a', 'button', 'input', 'select', 'textarea'].includes(el.rawTagName?.toLowerCase());

function visibleText(root) {
  const clone = parse(root.toString());
  for (const selector of ['script', 'style', 'noscript']) {
    for (const el of clone.querySelectorAll(selector)) el.remove();
  }
  return clone.textContent.replace(/\s+/g, ' ').trim();
}

/* ------------------------------------------------------------------ audit */
for (const route of ROUTES) {
  let body;
  let res;
  try {
    ({ res, body } = await fetchRoute(route));
  } catch (e) {
    record(route, 'reachable', false, e.message);
    continue;
  }

  record(route, 'status 200', res.status === 200, `got ${res.status}`);

  const isHtml = (res.headers.get('content-type') || '').includes('text/html');
  if (!isHtml) continue;

  const root = parse(body, { comment: false });

  /* metadata */
  const html = root.querySelector('html');
  record(route, 'html[lang]', Boolean(html?.getAttribute('lang')), html?.getAttribute('lang') || 'missing');

  const title = root.querySelector('title')?.textContent?.trim() ?? '';
  record(route, 'document title', title.length > 8 && !/^undefined|^NaN/.test(title), title.slice(0, 70));

  const desc = root.querySelector('meta[name="description"]')?.getAttribute('content') ?? '';
  record(route, 'meta description', desc.length > 40, `${desc.length} chars`);

  if (!route.startsWith('/admin')) {
    const canonical = root.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? '';
    record(route, 'canonical link', canonical.startsWith(BASE), canonical.slice(0, 60));
    const ogImage = root.querySelector('meta[property="og:image"]')?.getAttribute('content') ?? '';
    record(route, 'og:image', Boolean(ogImage), ogImage.slice(0, 60));
  } else {
    const robots = root.querySelector('meta[name="robots"]')?.getAttribute('content') ?? '';
    record(route, 'admin noindex', /noindex/.test(robots), robots || 'missing');
  }

  /* headings — the studio renders its chrome after the session check, so an
     admin route may legitimately ship zero h1 elements in the HTML shell. */
  const h1s = root.querySelectorAll('h1');
  const expectsH1 = !route.startsWith('/admin');
  record(route, expectsH1 ? 'exactly one <h1>' : 'at most one <h1>',
    expectsH1 ? h1s.length === 1 : h1s.length <= 1, `${h1s.length} found`);
  if (h1s.length) {
    const text = h1s[0].textContent.replace(/\s+/g, ' ').trim();
    record(route, '<h1> not empty', text.length > 2, text.slice(0, 60));
  }

  /* duplicate ids */
  const ids = new Map();
  for (const el of root.querySelectorAll('[id]')) {
    const id = el.getAttribute('id');
    if (!id) continue;
    ids.set(id, (ids.get(id) ?? 0) + 1);
  }
  const dupes = [...ids.entries()].filter(([, n]) => n > 1).map(([id, n]) => `${id}×${n}`);
  record(route, 'no duplicate id', dupes.length === 0, dupes.join(', '));

  /* images */
  const badAlt = root.querySelectorAll('img').filter(el => el.getAttribute('alt') === undefined);
  record(route, 'images have alt', badAlt.length === 0,
    badAlt.slice(0, 3).map(el => el.getAttribute('src')?.slice(0, 40)).join(', '));
  const badDim = root.querySelectorAll('img').filter(el => {
    const src = el.getAttribute('src') ?? '';
    if (src.startsWith('data:')) return false;
    if (el.getAttribute('srcset')) return false;               // responsive raster set
    if (el.getAttribute('width') && el.getAttribute('height')) return false;
    return true;
  });
  record(route, 'images sized/served responsively', badDim.length <= 1,
    `${badDim.length} without width/height/srcset`);

  /* controls */
  const labelFor = new Set(root.querySelectorAll('label[for]').map(l => l.getAttribute('for')));
  const labelled = (el) => {
    const id = el.getAttribute('id');
    const aria = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.getAttribute('title');
    if (aria) return true;
    if (id && labelFor.has(id)) return true;
    // wrapped in a <label>
    let parent = el.parentNode;
    while (parent) { if (parent.rawTagName === 'label') return true; parent = parent.parentNode; }
    return false;
  };
  const unl = root.querySelectorAll('input, select, textarea')
    .filter(el => !['hidden', 'submit', 'button'].includes(el.getAttribute('type') ?? ''))
    .filter(el => !labelled(el));
  record(route, 'form controls labelled', unl.length === 0, `${unl.length} unlabelled`);

  const iconButtons = root.querySelectorAll('button').filter(el =>
    !(el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent.trim()));
  record(route, 'icon buttons named', iconButtons.length === 0, `${iconButtons.length} unnamed`);

  /* links */
  const anchors = root.querySelectorAll('a');
  const deadAnchors = anchors.filter(a => {
    const href = a.getAttribute('href');
    if (href === undefined) return true;
    if (href === '') return true;
    if (href === '#') return !a.getAttribute('aria-label') && !a.textContent.trim();
    return false;
  });
  record(route, 'no empty links', deadAnchors.length === 0, `${deadAnchors.length} empty`);

  const unsafeTargets = anchors.filter(a =>
    a.getAttribute('target') === '_blank' && !/noopener|noreferrer/.test(a.getAttribute('rel') ?? ''));
  record(route, 'target=_blank is safe', unsafeTargets.length === 0, `${unsafeTargets.length} unsafe`);

  for (const a of anchors) {
    const href = a.getAttribute('href') ?? '';
    if (href.startsWith('/') && !href.startsWith('//')) linkTargets.add(href.split('#')[0]);
  }

  /* structured data */
  const ld = root.querySelectorAll('script[type="application/ld+json"]');
  let ldBad = '';
  for (const el of ld) {
    try { JSON.parse(el.textContent); } catch (e) { ldBad = e.message; }
  }
  record(route, 'JSON-LD parses', ldBad === '', ldBad);

  /* leaked placeholders in visible copy */
  const text = visibleText(root);
  const leaked = ['undefined', 'NaN', '[object Object]', 'null,null'].filter(t => text.includes(t));
  record(route, 'no leaked placeholders', leaked.length === 0, leaked.join(', '));

  /* security headers */
  record(route, 'nosniff header', res.headers.get('x-content-type-options') === 'nosniff',
    res.headers.get('x-content-type-options') ?? 'missing');
  record(route, 'referrer policy', Boolean(res.headers.get('referrer-policy')),
    res.headers.get('referrer-policy') ?? 'missing');
}

/* --------------------------------------------- internal links resolve */
const targets = [...linkTargets].filter(t => !t.startsWith('/admin'));
for (const href of targets) {
  try {
    const res = await fetch(`${BASE}${href}`, { redirect: 'manual' });
    record(href, 'internal link resolves', res.status < 400, `HTTP ${res.status}`);
  } catch (e) {
    record(href, 'internal link resolves', false, e.message);
  }
}

/* ------------------------------------------------------------- report */
const failed = results.filter(r => !r.ok);
const byRoute = new Map();
for (const r of results) {
  if (!byRoute.has(r.route)) byRoute.set(r.route, []);
  byRoute.get(r.route).push(r);
}

console.log(`\nImperial Royal — SSR quality audit against ${BASE}`);
console.log('='.repeat(72));
for (const [route, checks] of byRoute) {
  const bad = checks.filter(c => !c.ok);
  if (!bad.length) continue;
  console.log(`\n${route}`);
  for (const c of bad) console.log(`  FAIL  ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
}
console.log('\n' + '='.repeat(72));
console.log(`${results.length - failed.length}/${results.length} checks passed, ${failed.length} failed.`);
process.exit(failed.length ? 1 : 0);
