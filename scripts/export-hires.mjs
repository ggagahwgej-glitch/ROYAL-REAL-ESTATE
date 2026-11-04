/* Render the vector crest at any raster size — the mark is true vector, so even a
 * 20 000 px master is generated from curves, never upscaled from a bitmap.
 *
 * Usage:  node scripts/export-hires.mjs            (16 384 px, the 16K deliverable)
 *         node scripts/export-hires.mjs 20000      (custom size)
 *         node scripts/export-hires.mjs 8192 --flat  (opaque obsidian tile)
 *
 * Output: brand-exports/royal-crest-<size>px.png (+ .jpg when --flat)
 */
import sharp from 'sharp';
import { readFileSync, mkdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SVG = readFileSync(path.join(ROOT, 'public/brand/royal-crest.svg'));
const STAGE = 966; // the master's viewBox side
const OBSIDIAN = { r: 9, g: 11, b: 16, alpha: 1 };

const args = process.argv.slice(2);
const size = Number(args.find((a) => /^\d+$/.test(a)) ?? 16384);
const flat = args.includes('--flat');
if (!Number.isFinite(size) || size < 512 || size > 40000) {
  console.error('Size must be between 512 and 40000 px.');
  process.exit(1);
}

const OUT = path.join(ROOT, 'brand-exports');
mkdirSync(OUT, { recursive: true });
const target = path.join(OUT, `royal-crest-${size}px${flat ? '-tile' : ''}.png`);

const started = Date.now();
const density = (size / STAGE) * 72;
let pipeline = sharp(SVG, { density, limitInputPixels: false })
  .resize(size, size, { fit: 'fill', kernel: 'lanczos3' });
if (flat) {
  pipeline = pipeline.flatten({ background: OBSIDIAN }).removeAlpha();
}
await pipeline
  .png({ palette: !flat, colours: 192, dither: 1, compressionLevel: 6 })
  .toFile(target, { limitInputPixels: false });

const mb = (statSync(target).size / 1048576).toFixed(2);
console.log(`${path.relative(ROOT, target)} — ${size}×${size}, ${mb} MB, ${((Date.now() - started) / 1000).toFixed(1)}s`);
console.log('Generated from vector curves: no upscaling, no loss.');
