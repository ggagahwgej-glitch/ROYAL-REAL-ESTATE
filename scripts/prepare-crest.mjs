/* Normalise the AI-generated sovereign crest into a reproducible brand raster kit.
 * Run: node scripts/prepare-crest.mjs  (called automatically by generate-brand.py)
 * Source artwork: public/brand/royal-crest-source.png
 *
 * The source is a square render of a circular medallion sitting on a black field.
 * This script:
 *   1. maps the black field onto the site's obsidian so dark surfaces stay seamless;
 *   2. detects the medallion's true radius and crops the dead margin away;
 *   3. cuts a feathered alpha edge, so the crest composes on ANY surface (the
 *      light lockups and printed collateral no longer carry a black tile);
 *   4. writes a responsive WebP set for the UI plus opaque raster icons.
 */
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { statSync } from 'node:fs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'public/brand/royal-crest-source.png');
const OBSIDIAN = [9, 11, 16]; // --obsidian #090B10, so the seal melts into the site
const BLACK_CUTOFF = 62;      // anything darker than this becomes obsidian
const CONTENT_CUTOFF = 60;    // brightness that counts as crest, not field

/* ---------------------------------------------------------------- source -- */
const { data: srcRaw, info } = await sharp(SRC).raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H, channels: C } = info;
const cx = (W - 1) / 2;
const cy = (H - 1) / 2;
const pxMax = (x, y) => {
  const i = (y * W + x) * C;
  return Math.max(srcRaw[i], srcRaw[i + 1], srcRaw[i + 2]);
};

/* Detect the medallion radius: the furthest ring that is still mostly crest.
   Guards against a stray bright speck in the field. */
let radius = Math.min(cx, cy) * 0.9;
for (let r = 1; r < Math.min(cx, cy); r++) {
  let hit = 0;
  let total = 0;
  for (let a = 0; a < 720; a++) {
    const t = (a * Math.PI) / 360;
    const x = Math.round(cx + Math.cos(t) * r);
    const y = Math.round(cy + Math.sin(t) * r);
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    total++;
    if (pxMax(x, y) > CONTENT_CUTOFF) hit++;
  }
  if (total && hit / total >= 0.8) radius = r;
}

/* ------------------------------------------- recompose: crop + alpha edge -- */
const MARGIN = Math.round(radius * 0.03);      // breathing room around the rim
const half = radius + MARGIN;                  // half of the cropped square
const cropSize = Math.round(half * 2);
const left = Math.round(cx - half);
const top = Math.round(cy - half);
const FEATHER = 1.6;                           // px of anti-aliased rim

const out = Buffer.alloc(cropSize * cropSize * 4);
for (let y = 0; y < cropSize; y++) {
  for (let x = 0; x < cropSize; x++) {
    const sx = x + left;
    const sy = y + top;
    const i = (sy * W + sx) * C;
    let r = srcRaw[i];
    let g = srcRaw[i + 1];
    let b = srcRaw[i + 2];

    // 1. melt the black field into obsidian
    if (Math.max(r, g, b) < BLACK_CUTOFF) {
      [r, g, b] = OBSIDIAN;
    }

    // 2. feathered circular alpha mask
    const d = Math.hypot(x + 0.5 - half, y + 0.5 - half);
    const a = Math.max(0, Math.min(1, (radius + 0.5 - d) / FEATHER));

    const o = (y * cropSize + x) * 4;
    out[o] = r;
    out[o + 1] = g;
    out[o + 2] = b;
    out[o + 3] = Math.round(a * 255);
  }
}

const crest = () => sharp(out, { raw: { width: cropSize, height: cropSize, channels: 4 } });

/* Render one asset: optional padding, optional opaque background, optional
   palette quantisation (the crest is a gold-on-obsidian duotone, so a 128-colour
   palette PNG is visually identical and portable to every design tool). */
const render = async (size, { pad = 0.03, background = null, quantize = false } = {}) => {
  const inner = Math.max(1, Math.round(size * (1 - pad * 2)));
  const body = await crest()
    .resize(inner, inner, { fit: 'fill', kernel: 'lanczos3' })
    .png({ compressionLevel: 9 })
    .toBuffer();
  const canvas = background
    ? { r: background[0], g: background[1], b: background[2], alpha: 1 }
    : { r: 0, g: 0, b: 0, alpha: 0 };
  const composed = sharp({ create: { width: size, height: size, channels: 4, background: canvas } })
    .composite([{ input: body, gravity: 'center' }]);
  // Launcher icons must be fully opaque — iOS/Android composite transparency onto black.
  const encode = quantize
    ? { palette: true, colours: 128, dither: 1, compressionLevel: 9 }
    : { palette: false, compressionLevel: 9 };
  return (background ? composed.removeAlpha() : composed).png(encode);
};

/* ------------------------------------------------------------- exports ---- */
const written = [];
const note = async (label, promise, rel) => {
  await promise;
  written.push([rel.replace(`${ROOT}/`, ''), statSync(rel).size, label]);
};

const BRAND = path.join(ROOT, 'public/brand');

// Universal transparent PNG master — palette-quantised so it is ~40 KB, not 1.2 MB,
// and still readable by design tools, email clients and librsvg (unlike WebP).
await note('png master', (await render(384, { quantize: true })).toFile(path.join(BRAND, 'royal-crest.png')), path.join(BRAND, 'royal-crest.png'));
await note('png 96', (await render(96, { quantize: true })).toFile(path.join(BRAND, 'royal-crest-96.png')), path.join(BRAND, 'royal-crest-96.png'));
for (const size of [96, 192, 384]) {
  const rel = path.join(BRAND, `royal-crest-${size}.webp`);
  await note(`webp ${size}`, (await render(size)).webp({ quality: 82, alphaQuality: 100, effort: 6 }).toFile(rel), rel);
}

// Opaque obsidian tile for dark contexts (email signatures, social cards).
await note('jpeg tile', (await render(384, { pad: 0.02, background: OBSIDIAN }))
  .jpeg({ quality: 88, mozjpeg: true })
  .toFile(path.join(BRAND, 'royal-crest.jpg')), path.join(BRAND, 'royal-crest.jpg'));

// Raster icons: small favicons stay transparent, launcher icons stay opaque.
const icons = [
  ['public/favicon-16.png', 16, { pad: 0.02 }],
  ['public/favicon-32.png', 32, { pad: 0.02 }],
  ['public/favicon-64.png', 64, { pad: 0.03 }],
  ['public/apple-touch-icon.png', 180, { pad: 0.07, background: OBSIDIAN }],
  ['public/brand-mark-192.png', 192, { pad: 0.07, background: OBSIDIAN }],
  ['public/brand-mark-512.png', 512, { pad: 0.07, background: OBSIDIAN }],
];
for (const [rel, size, options] of icons) {
  await note(`${size}px icon`, (await render(size, options)).toFile(path.join(ROOT, rel)), path.join(ROOT, rel));
}

/* --------------------------------------------------------------- report --- */
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
console.log(`Prepared the sovereign crest from ${path.basename(SRC)}`);
console.log(`  source ${W}×${H} · medallion radius ${radius}px · cropped to ${cropSize}px · alpha rim ${FEATHER}px`);
for (const [rel, size, label] of written) {
  console.log(`  ${rel.padEnd(40)} ${kb(size).padStart(9)}  ${label}`);
}
console.log(`  transparent alpha: yes · responsive widths: 96 / 192 / 384`);
