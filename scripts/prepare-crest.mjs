/* Build the IMPERIAL ROYAL brand kit from the client's 3D gold-and-crimson
 * knight-helmet render.
 *
 * Source of truth: public/brand/royal-crest-source.png — the client's chosen
 * render, kept exactly as delivered. Nothing is redrawn, re-generated or
 * recoloured: this script only prepares it for production.
 *
 *   1. key the pure-black studio background out to a feathered alpha edge and
 *      de-fringe the anti-aliased rim, so the mark composes on obsidian, ivory
 *      or paper without a black halo;
 *   2. crop to the mark and centre it on a square stage with a luxury margin;
 *   3. trace the silhouette to vector for the tiny tab icons, where the 3D
 *      shading would collapse into noise;
 *   4. export the responsive WebP set, the PNG masters, the print master and
 *      the full raster icon set.
 *
 * Run: node scripts/prepare-crest.mjs
 */
import sharp from 'sharp';
import { Potrace } from 'potrace';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { statSync, writeFileSync } from 'node:fs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BRAND = path.join(ROOT, 'public/brand');
const SRC = path.join(BRAND, 'royal-crest-source.png');

const OBSIDIAN = { r: 9, g: 11, b: 16, alpha: 1 };
const KEY_LOW = 8;      // pure-black studio floor
const KEY_HIGH = 40;    // full opacity: above this the artwork is untouched
const DEFRINGE = 0.55;  // brighten the feathered rim back to its true colour
const PAD = 0.04;       // margin around the mark on its square stage

/* ----------------------------------------------------- 1. key + 2. square -- */
const { data: src, info } = await sharp(SRC).raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H, channels: C } = info;
const keyed = Buffer.alloc(W * H * 4);
let minX = W, minY = H, maxX = 0, maxY = 0;

for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * C;
    const o = (y * W + x) * 4;
    let r = src[i], g = src[i + 1], b = src[i + 2];
    const a = Math.max(0, Math.min(1, (Math.max(r, g, b) - KEY_LOW) / (KEY_HIGH - KEY_LOW)));
    if (a > 0 && a < 1) {
      const boost = 1 + (1 - a) * DEFRINGE;
      r = Math.min(255, r * boost); g = Math.min(255, g * boost); b = Math.min(255, b * boost);
    }
    keyed[o] = r; keyed[o + 1] = g; keyed[o + 2] = b; keyed[o + 3] = Math.round(a * 255);
    if (a > 0.04) {
      if (x < minX) minX = x; if (y < minY) minY = y;
      if (x > maxX) maxX = x; if (y > maxY) maxY = y;
    }
  }
}

const markW = maxX - minX + 1;
const markH = maxY - minY + 1;
const pad = Math.round(Math.max(markW, markH) * PAD);
const side = Math.max(markW, markH) + pad * 2;
const offsetX = Math.round((side - markW) / 2);
const offsetY = Math.round((side - markH) / 2);

const stage = await sharp({
  create: { width: side, height: side, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
})
  .composite([{
    input: await sharp(keyed, { raw: { width: W, height: H, channels: 4 } })
      .extract({ left: minX, top: minY, width: markW, height: markH })
      .png().toBuffer(),
    left: offsetX, top: offsetY,
  }])
  .png()
  .toBuffer();

/* --------------------------------------------- 3. vector silhouette (icons) -- */
const iconMask = await sharp(stage)
  .ensureAlpha()
  .extractChannel('alpha')
  .threshold(140)
  .trim({ threshold: 10 })
  .negate()   // potrace traces dark shapes: the mark must be dark on white
  .png()
  .toBuffer();
const { width: maskW, height: maskH } = await sharp(iconMask).metadata();

const tracer = new Potrace({
  threshold: 128, turdSize: 120, alphaMax: 1.2, optCurve: true, optTolerance: 0.6,
  color: '#000000', background: 'transparent',
});
await new Promise((resolve, reject) => tracer.loadImage(iconMask, (err) => (err ? reject(err) : resolve())));
const silhouette = /d="([^"]+)"/.exec(tracer.getSVG())?.[1];
if (!silhouette) throw new Error('potrace returned no silhouette — check royal-crest-source.png');

const iconStage = Math.round(Math.max(maskW, maskH) * 1.14);
const ivx = Math.round((maskW - iconStage) / 2);
const ivy = Math.round((maskH - iconStage) / 2);
const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${ivx} ${ivy} ${iconStage} ${iconStage}">
  <defs>
    <linearGradient id="gold" x1=".14" y1="0" x2=".86" y2="1">
      <stop offset="0" stop-color="#FFF6D8"/><stop offset=".35" stop-color="#F2CE6E"/>
      <stop offset=".7" stop-color="#C79A34"/><stop offset="1" stop-color="#8A6118"/>
    </linearGradient>
  </defs>
  <path d="${silhouette}" fill="url(#gold)"/>
</svg>
`;

/* --------------------------------------------------------------- 4. exports -- */
const written = [];
const note = async (label, promise, rel) => {
  await promise;
  written.push([path.relative(ROOT, rel), statSync(rel).size, label]);
};

const render = async (px, { background = null, quantize = false, margin = 0 } = {}) => {
  const inner = Math.round(px * (1 - margin * 2));
  let body = await sharp(stage).resize(inner, inner, { kernel: 'lanczos3' }).png().toBuffer();
  const canvas = background
    ? { r: background.r, g: background.g, b: background.b, alpha: background.alpha }
    : { r: 0, g: 0, b: 0, alpha: 0 };
  const composed = sharp({ create: { width: px, height: px, channels: 4, background: canvas } })
    .composite([{ input: body, left: Math.round((px - inner) / 2), top: Math.round((px - inner) / 2) }]);
  const pipeline = background ? composed.removeAlpha() : composed;
  return quantize
    ? pipeline.png({ palette: true, colours: 192, dither: 1, compressionLevel: 9 })
    : pipeline.png({ compressionLevel: 9 });
};

// Render the silhouette once at ~1024 px, then downsample to the tab size.
const iconPng = async (px) => sharp(Buffer.from(ICON_SVG), { density: Math.max(1, (1024 / iconStage) * 72) })
  .resize(px, px, { fit: 'fill', kernel: 'lanczos3' })
  .png({ compressionLevel: 9 });

// Self-contained SVG master: the same artwork embedded, for design tools.
const masterPng = await (await render(1024, { quantize: true })).toBuffer();
const MASTER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" role="img" aria-label="Imperial Royal knight-helmet crest">
  <title>Imperial Royal — sovereign knight crest, gold and crimson</title>
  <image x="0" y="0" width="1024" height="1024" href="data:image/png;base64,${masterPng.toString('base64')}"/>
</svg>
`;
writeFileSync(path.join(BRAND, 'royal-crest.svg'), MASTER_SVG);
written.push(['public/brand/royal-crest.svg', statSync(path.join(BRAND, 'royal-crest.svg')).size, 'svg master (embedded render)']);

// Web masters + print master
await note('png 512 (web fallback)', (await render(512, { quantize: true })).toFile(path.join(BRAND, 'royal-crest.png')), path.join(BRAND, 'royal-crest.png'));
await note('png 2048 (print)', (await render(2048, { quantize: true })).toFile(path.join(BRAND, 'royal-crest-2048.png')), path.join(BRAND, 'royal-crest-2048.png'));
await note('png 384 (svg lockups)', (await render(384, { quantize: true })).toFile(path.join(BRAND, 'royal-crest-384.png')), path.join(BRAND, 'royal-crest-384.png'));
await note('png 96 (favicon svg)', (await render(96, { quantize: true })).toFile(path.join(BRAND, 'royal-crest-96.png')), path.join(BRAND, 'royal-crest-96.png'));

// Responsive transparent WebP set
for (const size of [96, 192, 384, 768]) {
  const rel = path.join(BRAND, `royal-crest-${size}.webp`);
  await note(`webp ${size}`, (await render(size)).webp({ quality: 90, alphaQuality: 100, effort: 6 }).toFile(rel), rel);
}

// Single-colour raster (engraving / one-colour print)
await note('mono 384', (await render(384)).greyscale().png({ palette: true, colours: 128, compressionLevel: 9 })
  .toFile(path.join(BRAND, 'royal-crest-mono-384.png')), path.join(BRAND, 'royal-crest-mono-384.png'));

// Opaque obsidian tile for email signatures / social cards
await note('jpeg tile', (await render(384, { background: OBSIDIAN }))
  .jpeg({ quality: 92, mozjpeg: true })
  .toFile(path.join(BRAND, 'royal-crest.jpg')), path.join(BRAND, 'royal-crest.jpg'));

// Icons: vector silhouette for tiny tabs, full render everywhere else
const icons = [
  ['public/favicon-16.png', 16, 'vector'],
  ['public/favicon-32.png', 32, 'vector'],
  ['public/favicon-64.png', 64, 'raster', { margin: 0.02 }],
  ['public/apple-touch-icon.png', 180, 'raster', { margin: 0.07, background: OBSIDIAN }],
  ['public/brand-mark-192.png', 192, 'raster', { margin: 0.07, background: OBSIDIAN }],
  ['public/brand-mark-512.png', 512, 'raster', { margin: 0.07, background: OBSIDIAN }],
];
for (const [rel, size, kind, options = {}] of icons) {
  const pipeline = kind === 'vector' ? await iconPng(size) : await render(size, options);
  await note(`${size}px icon (${kind})`, pipeline.toFile(path.join(ROOT, rel)), path.join(ROOT, rel));
}

/* ---------------------------------------------------------------- report --- */
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
console.log('Prepared the Imperial Royal knight-helmet crest');
console.log(`  source ${W}×${H} · mark ${markW}×${markH} · square stage ${side}×${side} · feathered alpha ${KEY_LOW}→${KEY_HIGH}`);
console.log(`  silhouette traced for tab icons: ${(silhouette.length / 1024).toFixed(1)} KB path`);
for (const [rel, size, label] of written) console.log(`  ${rel.padEnd(42)} ${kb(size).padStart(10)}  ${label}`);
console.log('  palette: 3D gold + crimson render, black studio background keyed out');
