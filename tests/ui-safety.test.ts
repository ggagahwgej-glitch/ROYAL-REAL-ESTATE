import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Mobile render safety + Owner Studio gallery flow.
 *
 * Android Chrome painted coloured static rows across property cards. The cause
 * was a compositing stack (backdrop-blur chip over a CSS-filtered image, inside
 * a card that also animates on hover), so these assertions lock the stack apart.
 */

const root = process.cwd();
const read = (rel: string) => readFileSync(path.join(root, rel), 'utf8');
const css = read('app/globals.css');
const form = read('components/admin/PropertyForm.tsx');

/** The declarations of a single-rule block, e.g. `.property-fav{…}`. */
function rule(selector: string): string {
  const start = css.indexOf(`${selector}{`);
  if (start === -1) return '';
  const end = css.indexOf('}', start);
  return css.slice(start + selector.length + 1, end);
}

describe('mobile render safety', () => {
  it('never puts a backdrop blur on a chip that sits over a photograph', () => {
    // These two float directly on top of the property image; Chromium on Android
    // corrupts tiles when a backdrop filter composites a filtered image behind it.
    expect(rule('.property-fav')).not.toContain('backdrop-filter');
    expect(rule('.property-tags .badge')).not.toContain('backdrop-filter');
    // They stay legible over any photograph through opacity instead.
    expect(rule('.property-fav')).toMatch(/background:rgba\(8,9,13,\.82\)/);
  });

  it('keeps a single image filter and drops it on small screens', () => {
    const declarations = css.match(/^\.property-image img\{filter:[^}]+\}/gm) ?? [];
    expect(declarations.length).toBeLessThanOrEqual(1);
    expect(css).toMatch(/@media \(max-width:900px\)\{[\s\S]*?\.property-image img,[\s\S]*?filter:none/);
  });

  it('never blends a layer over another layer', () => {
    // The feTurbulence grain used mix-blend-mode: overlay — the classic source of
    // coloured static on mobile GPUs.
    expect(css).not.toContain('mix-blend-mode');
  });

  it('confines hover transforms to devices with a real pointer', () => {
    expect(css).toContain('@media (hover:none), (pointer:coarse)');
    const touch = css.slice(css.indexOf('@media (hover:none), (pointer:coarse)'));
    expect(touch).toMatch(/\.property-card:hover\{transform:none\}/);
    expect(touch).toMatch(/\.property-card:hover \.property-image img,[\s\S]*?\{transform:none\}/);
  });

  it('adds no hardware-acceleration hints to compensate', () => {
    // The fix is fewer composited layers, not more: no will-change/translateZ(0).
    expect(css).not.toContain('will-change');
    expect(css).not.toContain('translateZ(0)');
  });

  it('drops backdrop blurs on small screens', () => {
    const mobile = css.slice(css.indexOf('@media (max-width:900px)'));
    for (const selector of ['.site-header.scrolled', '.mobile-overlay', '.hero-badge', '.glass']) {
      expect(mobile).toContain(selector);
    }
    expect(mobile).toContain('backdrop-filter:none');
  });
});

describe('owner studio · gallery on a new property', () => {
  it('no longer dead-ends on "Save the property first"', () => {
    expect(form).not.toContain('Save the property first');
    expect(form).toContain('Save details &amp; open gallery');
    expect(form).toContain('media-checklist');
  });

  it('saves the form and opens the gallery in one step', () => {
    // One write path, shared by the submit button and the gallery CTA.
    expect(form).toMatch(/const persist = async \(\): Promise<string \| null>/);
    expect(form).toContain('const openGallery = async ()');
    expect(form).toMatch(/router\.push\(`\/admin\/properties\/\$\{id\}\/edit\?saved=1&tab=media`\)/);
  });

  it('explains what is missing and puts the cursor on it', () => {
    expect(form).toContain('The gallery unlocks once the residence is saved.');
    expect(form).toMatch(/const FIELD_IDS: Record<string, string>/);
    expect(form).toMatch(/document\.getElementById\(id\)/);
  });

  it('marks the tab as locked until the record exists', () => {
    expect(form).toMatch(/const locked = t\.id === 'media' && !\(isEdit && propertyId\)/);
    expect(form).toContain('tab-lock');
  });

  it('honours ?tab=media so the redirect lands on the gallery', () => {
    expect(form).toMatch(/params\.get\('tab'\)/);
    expect(form).toMatch(/TABS\.some\(t => t\.id === requested\)/);
  });
});
