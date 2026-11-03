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

describe('legacy schema repair (regression)', () => {
  const sql = read('supabase/showcase-setup.sql');
  const guard = sql.slice(sql.indexOf('do $guard$'), sql.indexOf('end $guard$;'));
  const repair = sql.slice(sql.indexOf('do $grants$'), sql.indexOf('end $grants$;'));

  it('checks EVERY required column of all four content tables, not one sentinel', () => {
    // The original bug: a legacy table that happened to have `category` was
    // treated as correct, so `create table if not exists` kept a broken shape
    // and the script aborted on the first index referring to `listing_type`.
    expect(guard).toContain('with needed(t, cols)');
    for (const table of ['properties', 'property_media', 'inquiries', 'site_settings']) {
      expect(guard).toContain(`'${table}', array[`);
    }
    for (const col of ['listing_type', 'availability', 'area_sqft', 'storage_path',
                       'public_url', 'is_cover', 'position', 'testimonials',
                       'hero_heading', 'source']) {
      expect(guard).toContain(`'${col}'`);
    }
    expect(guard).toContain('information_schema.columns');
    expect(guard).toContain('unnest(n.cols) as c(col)');
  });

  it('backs up once, then drops mismatched children before parents', () => {
    expect(guard).toContain("to_regclass('public.imperial_legacy_backup') is null");
    expect(guard).toContain("'imperial_legacy_' || tbl");
    expect(guard.indexOf('drop table if exists public.property_media')).toBeLessThan(
      guard.indexOf('drop table if exists public.properties'));
    expect(guard).toContain('drop table if exists public.site_settings cascade');
  });

  it('repairs an interrupted run by restoring anon privileges', () => {
    expect(repair).toContain('grant usage on schema public to anon, authenticated');
    expect(repair).toContain('grant select on public.properties to anon, authenticated');
    expect(repair).toContain('grant select on public.property_media to anon, authenticated');
    expect(repair).toContain('grant select on public.site_settings to anon, authenticated');
    expect(repair).toContain('revoke all on public.inquiries from anon');
    expect(repair).toContain('exception when others then');
  });

  it('keeps all dollar-quoted blocks balanced and re-runs safely', () => {
    for (const tag of ['$guard$', '$grants$', '$ddl$', '$$']) {
      expect(sql.split(tag).length - 1).toBe(2 * Math.floor((sql.split(tag).length - 1) / 2));
    }
    expect(sql).toContain('create table if not exists public.properties');
    expect(sql).toContain('on conflict (slug) do update set');
    expect(sql).toContain('delete from public.property_media where storage_path like');
  });
});

describe('cross-project SQL contamination (regression)', () => {
  const sql = read('supabase/showcase-setup.sql');
  const schema = read('supabase/schema.sql');

  it('removes foreign RLS policies that could expose owner profiles', () => {
    // A different application's seed script created an anon-readable profiles
    // table. Our named policies alone do not remove unknown policies.
    expect(sql).toContain('do $policies$');
    expect(sql).toContain('pg_policies');
    expect(sql).toContain("execute format('drop policy if exists %I on public.%I'");
  });

  it('revokes anonymous access to profiles and keeps inquiries INSERT-only', () => {
    expect(sql).toContain('revoke all on public.profiles from anon');
    expect(sql).toContain('revoke all on public.inquiries from anon');
    expect(sql).toContain('grant insert on public.inquiries to anon');
    expect(schema).toContain('revoke all on public.profiles from anon');
    expect(read('public/sql/schema.sql')).toBe(schema);
  });

  it('ships a read-only live health check on the public setup guide', () => {
    const page = read('app/(site)/setup/page.tsx');
    expect(page).toContain('LiveSchemaCheck');
    const check = read('components/admin/LiveSchemaCheck.tsx');
    expect(check).toContain("'profiles?select=is_owner&limit=1'");
    expect(check).toContain('Anonymous GETs only');
    expect(check).not.toMatch(/service_role|sb_secret_/i);
  });
});
