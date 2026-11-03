/* Normalise the AI-generated sovereign crest into a reproducible brand raster kit.
 * Run: node scripts/prepare-crest.mjs  (called automatically by generate-brand.py)
 * Source artwork: public/brand/royal-crest-source.png
 */
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'public/brand/royal-crest-source.png');
const OBSIDIAN = [9, 11, 16]; // --obsidian #090B10, so the seal melts into the site

const { data, info } = await sharp(SRC).raw().toBuffer({ resolveWithObject: true });
for (let i = 0; i < data.length; i += info.channels) {
  const r = data[i], g = data[i + 1], b = data[i + 2];
  if (Math.max(r, g, b) < 62) {
    data[i] = OBSIDIAN[0]; data[i + 1] = OBSIDIAN[1]; data[i + 2] = OBSIDIAN[2];
  }
}
const master = sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } })
  .png({ compressionLevel: 9, palette: false });

await master.toFile(path.join(ROOT, 'public/brand/royal-crest.png'));
await sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } })
  .resize(384, 384, { fit: 'cover' })
  .jpeg({ quality: 86, mozjpeg: true })
  .toFile(path.join(ROOT, 'public/brand/royal-crest.jpg'));

const icons = [
  ['public/favicon-16.png', 16],
  ['public/favicon-32.png', 32],
  ['public/favicon-64.png', 64],
  ['public/apple-touch-icon.png', 180],
  ['public/brand-mark-512.png', 512],
];
for (const [rel, size] of icons) {
  await sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } })
    .resize(size, size, { fit: 'cover', kernel: 'lanczos3' })
    .png({ compressionLevel: 9 })
    .toFile(path.join(ROOT, rel));
}
console.log(`Prepared crest master + ${icons.length} raster icons from ${path.basename(SRC)}`);
