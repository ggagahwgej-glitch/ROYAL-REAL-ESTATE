/* Build the IMPERIAL ROYAL brand mark from the client's knight-helmet artwork.
 *
 * Source of truth: public/brand/royal-crest-source.png — the client's original
 * two-tone drawing, kept byte-for-byte (never redrawn, never re-generated).
 * This script only adds the luxury finish and the production formats:
 *
 *   1. clean the drawing into a crisp two-tone mask (upscale → median → threshold);
 *   2. trace that mask into true vector curves (potrace) so the mark is sharp at
 *      any size — 16 px favicon or a 20 000 px print master;
 *   3. dress it in the house palette: polished champagne-gold face over a deep
 *      crimson lacquer backing, crimson inner rim, champagne edge light;
 *   4. export the vector master, the high-resolution master, the responsive WebP
 *      set, the raster icons and the social tile.
 *
 * Run: node scripts/prepare-crest.mjs
 */
import sharp from 'sharp';
import { Potrace } from 'potrace';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { statSync } from 'node:fs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BRAND = path.join(ROOT, 'public/brand');
const SRC = path.join(BRAND, 'royal-crest-source.png');

const OBSIDIAN = { r: 9, g: 11, b: 16, alpha: 1 };
const TRACE_UPSCALE = 3;     // × the source, enough for smooth curves at 1/3 the node count
const TRACE_TOLERANCE = 0.6; // curve-fitting tolerance
const OUTLINE = 0.008;       // crimson inner rim, relative to the mark's stage
const EDGE_LIGHT = 0.0022;   // champagne edge light

/* ------------------------------------------------------------ 1. the mask -- */
const mask = await sharp(SRC)
  .resize({ width: 237 * TRACE_UPSCALE, kernel: 'lanczos3' })
  .median(3)
  .grayscale()
  .normalize()
  // the source is a dark mark on a light field; threshold keeps the silhouette exact
  .threshold(150)
  .trim({ threshold: 10 })
  .png()
  .toBuffer();
const { width: markW, height: markH } = await sharp(mask).metadata();

/* ------------------------------------------------------- 2. the vector path -- */
const tracer = new Potrace({
  threshold: 128,
  turdSize: 200,
  alphaMax: 1.2,
  optCurve: true,
  optTolerance: TRACE_TOLERANCE,
  color: '#000000',
  background: 'transparent',
});
await new Promise((resolve, reject) => tracer.loadImage(mask, (err) => (err ? reject(err) : resolve())));
const traced = tracer.getSVG();
const markPath = /d="([^"]+)"/.exec(traced)?.[1];
if (!markPath) throw new Error('potrace returned no path — check royal-crest-source.png');

// Square stage in the mark's own coordinates: no transforms, no clipping surprises.
const side = Math.round(Math.max(markW, markH) * 1.16);
const vx = Math.round((markW - side) / 2);
const vy = Math.round((markH - side) / 2);
const f = (n) => Number(n.toFixed(2));

/* -------------------------------------------------------- 3. the house look -- */
const GOLD = `<stop offset="0" stop-color="#FFFDF4"/><stop offset=".10" stop-color="#F9EDC8"/>
      <stop offset=".26" stop-color="#EBD295"/><stop offset=".46" stop-color="#CFAB61"/>
      <stop offset=".66" stop-color="#A67D33"/><stop offset=".84" stop-color="#7C571A"/>
      <stop offset="1" stop-color="#5A3C0F"/>`;
const LACQUER = `<stop offset="0" stop-color="#C01D34"/><stop offset=".30" stop-color="#961229"/>
      <stop offset=".62" stop-color="#6B0C1B"/><stop offset="1" stop-color="#3E0410"/>`;

const DEFS = `    <path id="mark" d="${markPath}"/>
    <linearGradient id="gold" x1=".14" y1="0" x2=".86" y2="1">${GOLD}</linearGradient>
    <linearGradient id="lacquer" x1=".2" y1="0" x2=".8" y2="1">${LACQUER}</linearGradient>
    <clipPath id="clip"><use href="#mark"/></clipPath>`;

/** The mark itself: gold face, crimson lacquer backing, crimson rim, champagne edge. */
const ART = `  <g transform="translate(${f(side * 0.026)} ${f(side * 0.03)})"><use href="#mark" fill="url(#lacquer)"/></g>
  <use href="#mark" fill="url(#gold)"/>
  <use href="#mark" fill="none" stroke="url(#lacquer)" stroke-width="${f(side * OUTLINE)}" clip-path="url(#clip)"/>
  <use href="#mark" fill="none" stroke="#FFFDF4" stroke-opacity=".4" stroke-width="${f(side * EDGE_LIGHT)}" clip-path="url(#clip)"/>`;

// Tab icons: the same silhouette in solid gold. At 16–32 px the crimson backing
// and rim lights collapse into noise, so the icon keeps only the shape.
const SIMPLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${side} ${side}">
  <defs>
    <path id="mark" d="${markPath}"/>
    <linearGradient id="gold" x1=".14" y1="0" x2=".86" y2="1">${GOLD}</linearGradient>
  </defs>
  <use href="#mark" fill="url(#gold)"/>
</svg>
`;

const MASTER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${side} ${side}" role="img" aria-label="Imperial Royal knight-helmet crest">
  <title>Imperial Royal — sovereign knight crest, gold and crimson</title>
  <defs>
${DEFS}
  </defs>
${ART}
</svg>
`;

/* --------------------------------------------------------------- 4. exports -- */
const written = [];
const note = async (label, promise, rel) => {
  await promise;
  written.push([path.relative(ROOT, rel), statSync(rel).size, label, statSync(rel).size > 0]);
};

const { writeFileSync } = await import('node:fs');
writeFileSync(path.join(BRAND, 'royal-crest.svg'), MASTER_SVG);
written.push(['public/brand/royal-crest.svg', statSync(path.join(BRAND, 'royal-crest.svg')).size, 'vector master', true]);

const svgBuf = Buffer.from(MASTER_SVG);
// Render the vector at an exact pixel width without ever upscaling the source bitmap.
const render = async (px, { pad = 0.03, background = null, quantize = false, simple = false, focus = { x: 0.5, y: 0.5 } } = {}) => {
  // `inner` is how much of the canvas the artwork covers; negative padding zooms in.
  const inner = Math.max(1, Math.round(px * (1 - pad * 2)));
  const artPx = Math.max(px, inner);            // render large enough to crop from
  const density = (artPx / side) * 72;
  const art = await sharp(simple ? Buffer.from(SIMPLE_SVG) : svgBuf, { density })
    .resize(artPx, artPx, { fit: 'fill', kernel: 'lanczos3' })
    .png()
    .toBuffer();

  // `focus` picks which point of the artwork sits at the centre — tiny favicons
  // zoom into the helmet so the mark is still recognisable at 16 px.
  const boxSize = Math.min(artPx, Math.round((artPx * px) / inner));
  const clamp = (v) => Math.max(0, Math.min(artPx - boxSize, Math.round(v)));
  const left = clamp(focus.x * artPx - boxSize / 2);
  const top = clamp(focus.y * artPx - boxSize / 2);
  const body = await sharp(art)
    .extract({ left, top, width: boxSize, height: boxSize })
    .resize(px, px, { kernel: 'lanczos3' })
    .png()
    .toBuffer();

  const canvas = background
    ? { r: background.r, g: background.g, b: background.b, alpha: background.alpha }
    : { r: 0, g: 0, b: 0, alpha: 0 };
  const composed = sharp({ create: { width: px, height: px, channels: 4, background: canvas } })
    .composite([{ input: body, left: 0, top: 0 }]);
  const pipeline = background ? composed.removeAlpha() : composed;
  return quantize
    ? pipeline.png({ palette: true, colours: 192, dither: 1, compressionLevel: 9 })
    : pipeline.png({ compressionLevel: 9 });
};

// Vector master + print master (the SVG itself is resolution-independent: 16 K+ is lossless)
await note('print master 4096', (await render(4096, { pad: 0.05, quantize: true })).toFile(path.join(BRAND, 'royal-crest-4096.png')), path.join(BRAND, 'royal-crest-4096.png'));

// Universal transparent PNG for the web + fallback
await note('png master 1024', (await render(1024, { quantize: true })).toFile(path.join(BRAND, 'royal-crest.png')), path.join(BRAND, 'royal-crest.png'));
await note('png 96', (await render(96, { quantize: true })).toFile(path.join(BRAND, 'royal-crest-96.png')), path.join(BRAND, 'royal-crest-96.png'));

// Responsive transparent WebP set for the site
for (const size of [96, 192, 384]) {
  const rel = path.join(BRAND, `royal-crest-${size}.webp`);
  await note(`webp ${size}`, (await render(size)).webp({ quality: 86, alphaQuality: 100, effort: 6 }).toFile(rel), rel);
}

// Opaque obsidian tile for email signatures / social cards
await note('jpeg tile', (await render(384, { pad: 0.02, background: OBSIDIAN }))
  .jpeg({ quality: 90, mozjpeg: true })
  .toFile(path.join(BRAND, 'royal-crest.jpg')), path.join(BRAND, 'royal-crest.jpg'));

// Raster icons: transparent tab favicons, opaque launcher icons
const HELMET_FOCUS = { x: 0.53, y: 0.45 };
const icons = [
  // tab icons: solid gold silhouette — the full finish collapses into noise below ~40 px
  ['public/favicon-16.png', 16, { pad: 0.02, simple: true }],
  ['public/favicon-32.png', 32, { pad: 0.02, simple: true }],
  ['public/favicon-64.png', 64, { pad: 0.02 }],
  ['public/apple-touch-icon.png', 180, { pad: 0.07, background: OBSIDIAN }],
  ['public/brand-mark-192.png', 192, { pad: 0.07, background: OBSIDIAN }],
  ['public/brand-mark-512.png', 512, { pad: 0.07, background: OBSIDIAN }],
];
for (const [rel, size, options] of icons) {
  await note(`${size}px icon`, (await render(size, options)).toFile(path.join(ROOT, rel)), path.join(ROOT, rel));
}

/* ---------------------------------------------------------------- report --- */
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
console.log('Prepared the Imperial Royal knight-helmet crest');
console.log(`  source ${markW}×${markH} mask · traced path ${(markPath.length / 1024).toFixed(1)} KB · stage ${side}×${side} · alpha edge ${EDGE_LIGHT}`);
for (const [rel, size, label] of written) console.log(`  ${rel.padEnd(42)} ${kb(size).padStart(10)}  ${label}`);
console.log('  palette: champagne gold #FFFDF4→#5A3C0F · crimson lacquer #C01D34→#3E0410');
