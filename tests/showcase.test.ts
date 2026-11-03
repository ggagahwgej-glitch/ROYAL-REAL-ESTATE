/* Showcase-mode integrity: sample content must be complete, clearly labelled,
   never disguised as a genuine endorsement, and never leak credentials. */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  SHOWCASE_PROPERTIES, SHOWCASE_MEDIA, SHOWCASE_TESTIMONIALS,
  SHOWCASE_ENABLED, showcasePaged, showcaseCities, findShowcaseBySlug,
  showcaseMediaForProperty, mergeShowcaseSettings,
} from '../lib/showcase';
import { DEFAULT_SETTINGS } from '../lib/utils';

const read = (p: string) => readFileSync(p, 'utf8');

describe('showcase catalogue', () => {
  it('is enabled by default for this demonstration build', () => {
    expect(SHOWCASE_ENABLED).toBe(true);
  });
  it('contains at least 20 published residences with unique slugs', () => {
    expect(SHOWCASE_PROPERTIES.length).toBeGreaterThanOrEqual(20);
    expect(SHOWCASE_PROPERTIES.every(p => p.status === 'published')).toBe(true);
    expect(new Set(SHOWCASE_PROPERTIES.map(p => p.slug)).size).toBe(SHOWCASE_PROPERTIES.length);
    expect(new Set(SHOWCASE_PROPERTIES.map(p => p.id)).size).toBe(SHOWCASE_PROPERTIES.length);
  });
  it('gives every residence a cover image and a working gallery', () => {
    expect(SHOWCASE_MEDIA.length).toBeGreaterThanOrEqual(20 * 3);
    for (const p of SHOWCASE_PROPERTIES) {
      const media = showcaseMediaForProperty(p.id);
      expect(media.length).toBeGreaterThanOrEqual(3);
      expect(media.filter(m => m.is_cover).length).toBe(1);
      expect(media.every(m => m.public_url.startsWith('/images/'))).toBe(true);
    }
  });
  it('ships sample references with valid 1–5 star ratings, all labelled as samples', () => {
    expect(SHOWCASE_TESTIMONIALS.length).toBeGreaterThanOrEqual(8);
    for (const t of SHOWCASE_TESTIMONIALS) {
      expect(t.sample).toBe(true);
      expect(t.rating).toBeGreaterThanOrEqual(1);
      expect(t.rating).toBeLessThanOrEqual(5);
      expect(t.quote.trim().length).toBeGreaterThan(20);
      expect(t.name.trim().length).toBeGreaterThan(2);
    }
  });
  it('never emits AggregateRating structured data for demo references', () => {
    for (const f of ['app/layout.tsx', 'app/(site)/page.tsx', 'components/site/Testimonials.tsx']) {
      // A mention inside a comment is fine; emitting schema.org rating markup is not.
      expect(read(f)).not.toMatch(/['"]AggregateRating['"]|@type:\s*['"]AggregateRating/);
    }
    expect(read('components/site/Testimonials.tsx')).toContain('not genuine client endorsements');
  });
  it('applies filters, search, sorting and pagination in memory', () => {
    expect(showcasePaged({ perPage: 9 }).items.length).toBe(9);
    expect(showcasePaged({ perPage: 9 }).total).toBeGreaterThanOrEqual(20);
    const villas = showcasePaged({ category: 'Villa', perPage: 48 });
    expect(villas.items.every(p => p.category === 'Villa')).toBe(true);
    const rentals = showcasePaged({ listingType: 'rent', perPage: 48 });
    expect(rentals.items.every(p => p.listing_type === 'rent')).toBe(true);
    const q = showcasePaged({ q: 'Goa', perPage: 48 });
    expect(q.items.length).toBeGreaterThan(0);
    const asc = showcasePaged({ sort: 'price-asc', perPage: 48 }).items;
    for (let i = 1; i < asc.length; i++) expect(Number(asc[i].price)).toBeGreaterThanOrEqual(Number(asc[i - 1].price));
    expect(showcaseCities().length).toBeGreaterThan(8);
    expect(findShowcaseBySlug('azure-cliff-residence')?.title).toBe('The Azure Cliff Residence');
  });
  it('merges showcase presentation values only where the owner left defaults', () => {
    const merged = mergeShowcaseSettings({ ...DEFAULT_SETTINGS });
    expect(merged.hero_image).toContain('/images/');
    expect(merged.testimonials.length).toBeGreaterThanOrEqual(8);
    const custom = mergeShowcaseSettings({ ...DEFAULT_SETTINGS, business_name: 'Client Estate Ltd', testimonials: [] });
    expect(custom.business_name).toBe('Client Estate Ltd');
    expect(custom.testimonials.length).toBeGreaterThanOrEqual(8);
    const real = mergeShowcaseSettings({ ...DEFAULT_SETTINGS, testimonials: [{ quote: 'Real quote', name: 'A Client', role: 'Client' }] });
    expect(real.testimonials).toEqual([{ quote: 'Real quote', name: 'A Client', role: 'Client' }]);
  });
});

describe('one-paste SQL setup', () => {
  const sql = read('supabase/showcase-setup.sql');
  it('is mirrored to the downloadable public copy', () => {
    expect(read('public/sql/showcase-setup.sql')).toBe(sql);
  });
  it('installs the schema, storage buckets, RLS and seeds 20 properties', () => {
    expect(sql).toContain('create table if not exists public.properties');
    expect(sql).toContain('alter table public.profiles');
    expect(sql).toContain('insert into storage.buckets');
    expect(sql).toContain('enable row level security');
    expect(sql).toContain('insert into public.properties');
    expect(sql).toContain('property_media');
    expect(sql).toContain('guard_inquiry_insert');
    expect(sql).toContain('imperial_legacy_backup');
  });
  it('contains no secret key, password or service-role credential', () => {
    expect(sql).not.toMatch(/sb_secret_/i);
    expect(sql.toLowerCase()).not.toContain('rohitsaharohitsaha0795');
    expect(sql).not.toContain('ROHIT9387232918');
    expect(sql).not.toMatch(/service[-_]?role\s*key\s*=\s*'/i);
  });
  it('labels the seeded references as sample content', () => {
    expect(sql).toContain('"sample": true');
    expect(sql).toContain('"rating"');
  });
});

describe('shared public configuration', () => {
  it('contains only the publishable key and the project URL', () => {
    const cfg = JSON.parse(read('public/public-config.json'));
    expect(cfg.url).toMatch(/^https:\/\/[a-z0-9-]+\.supabase\.co$/);
    expect(cfg.anonKey).toMatch(/^sb_publishable_/);
    expect(JSON.stringify(cfg)).not.toMatch(/sb_secret_|service_role|password/i);
  });
});
