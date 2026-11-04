/* Export the crest at a larger raster size.
 *
 * The brand mark is the client's 3D render (1254 × 1254), so its genuine detail
 * ends there: this script resamples the 2048 px print master upwards with a
 * Lanczos kernel plus a light unsharp pass, which holds up well for large-format
 * print and presentation boards. Beyond 8192 px the gain is interpolation only.
 *
 * Usage:  node scripts/export-hires.mjs            (4096 px)
 *         node scripts/export-hires.mjs 8192
 *         node scripts/export-hires.mjs 4096 --flat   (opaque obsidian tile)
 *
 * Output: brand-exports/royal-crest-<size>px[-tile].png
 */
import sharp from 'sharp';
import { mkdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(ROOT, 'public/brand/royal-crest-2048.png');
const OBSIDIAN = { r: 9, g: 11, b: 16, alpha: 1 };
const NATIVE = 1254;

const args = process.argv.slice(2);
const size = Number(args.find((a) => /^\d+$/.test(a)) ?? 4096);
const flat = args.includes('--flat');
if (!Number.isFinite(size) || size < 512 || size > 8192) {
  console.error('Size must be between 512 and 8192 px (the artwork is a 1254 px render).');
  process.exit(1);
}

const OUT = path.join(ROOT, 'brand-exports');
mkdirSync(OUT, { recursive: true });
const target = path.join(OUT, `royal-crest-${size}px${flat ? '-tile' : ''}.png`);

const started = Date.now();
let pipeline = sharp(SOURCE).resize(size, size, { kernel: 'lanczos3' });
if (flat) pipeline = pipeline.flatten({ background: OBSIDIAN }).removeAlpha();
await pipeline
  .sharpen({ sigma: 0.6, m1: 0.4, m2: 0.6 })
  .png({ palette: !flat, colours: 192, dither: 1, compressionLevel: 6 })
  .toFile(target);

const mb = (statSync(target).size / 1048576).toFixed(2);
console.log(`${path.relative(ROOT, target)} — ${size}×${size}, ${mb} MB, ${((Date.now() - started) / 1000).toFixed(1)}s`);
console.log(`Source artwork is ${NATIVE} px; this is a ${(size / NATIVE).toFixed(1)}× resample of the print master.`);
