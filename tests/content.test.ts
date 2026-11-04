/* Content-integrity tests: exact required hero copy, no invented client
   endorsements, and safe normalization of owner-published testimonials. */
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

// These assertions describe LIVE mode: no sample catalogue, no invented
// references. vi.hoisted runs before module imports, so SHOWCASE_ENABLED is
// already false when lib/showcase.ts is evaluated.
vi.hoisted(() => { process.env.NEXT_PUBLIC_SHOWCASE = '0'; });
import { DEFAULT_SETTINGS } from '../lib/utils';
import { getSiteSettings, type Client } from '../lib/supabase/queries';

const read = (p: string) => readFileSync(p, 'utf8');

function mockClient(row: unknown, error: { message: string } | null = null): Client {
  const maybeSingle = async () => ({ data: row, error });
  return { from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }) } as unknown as Client;
}

describe('exact hero copy', () => {
  it('uses the required heading verbatim', () => {
    expect(DEFAULT_SETTINGS.hero_heading).toBe('Where Exceptional Living Meets Timeless Elegance.');
  });
  it('uses the required supporting text verbatim', () => {
    expect(DEFAULT_SETTINGS.hero_subheading).toBe('Discover extraordinary residences, prestigious addresses and exceptional real estate opportunities.');
  });
  it('uses the required button labels verbatim', () => {
    const hero = read('components/site/Hero.tsx');
    expect(hero).toContain('Explore Properties.');
    expect(hero).toContain('Discover Our Collection.');
    expect(hero).toContain('/properties');
    expect(hero).toContain('/categories');
  });
});

describe('genuine testimonials only', () => {
  it('ships no invented quotes or client names', () => {
    const marketing = read('data/marketing.ts');
    expect(marketing).not.toContain('TESTIMONIALS');
    for (const name of ['A. R. Mehta', 'Eleanor Vance', 'S. Kapoor']) expect(marketing).not.toContain(name);
    expect(DEFAULT_SETTINGS.testimonials).toEqual([]);
    expect(read('components/site/Testimonials.tsx')).toContain('References are shared in confidence.');
  });
  it('renders only valid owner-published records and rejects malformed JSONB', async () => {
    const res = await getSiteSettings(mockClient({
      testimonials: [
        { quote: 'A real quote with permission', name: 'A Client', role: 'Private Client' },
        { quote: '', name: 'Incomplete' },
        { quote: 'No name' },
        null, 'not-an-object',
      ],
    }));
    expect(res.error).toBeNull();
    expect(res.data?.testimonials).toEqual([{ quote: 'A real quote with permission', name: 'A Client', role: 'Private Client' }]);
  });
  it('defaults to no testimonials when the column is missing or malformed', async () => {
    expect((await getSiteSettings(mockClient({}))).data?.testimonials).toEqual([]);
    expect((await getSiteSettings(mockClient({ testimonials: 'oops' }))).data?.testimonials).toEqual([]);
  });
  it('never silently swallows a settings database error', async () => {
    const res = await getSiteSettings(mockClient(null, { message: 'relation "site_settings" does not exist' }));
    expect(res.error).toMatch(/could not be read/i);
    expect(res.error).toContain('site_settings');
  });
});

/* The showcase path is what a visitor sees when the connected project is not yet
   ready. A raw Postgres message there is a client-facing defect, not a diagnostic. */
describe('visitor-facing diagnostics', () => {
  it('never interpolates a database message into a visitor-facing warning', () => {
    const source = readFileSync('lib/supabase/queries.ts', 'utf8');
    // Owner Studio may show driver detail; public reads may not. Split at the
    // owner section marker so the assertion only covers visitor-facing code.
    const ownerMarker = '/* ------------------------- Owner operations ------------------------- */';
    const publicSource = source.slice(0, source.indexOf(ownerMarker));
    expect(publicSource.length).toBeGreaterThan(1000);
    expect(publicSource).not.toMatch(/warning:\s*[`'][^`']*\$\{error/);
    expect(publicSource).not.toMatch(/warning:\s*[`'][^`']*\$\{errorMessage/);
    expect(publicSource).toContain('warningDetail');
  });

  it('keeps the technical detail reachable for the owner only', () => {
    const chrome = readFileSync('components/site/SiteChrome.tsx', 'utf8');
    expect(chrome).toMatch(/<details[^>]*className="technical-detail"/);
    expect(chrome).toContain('{warningDetail}');
  });
});

/* The showcase catalogue must never be replaced by an empty state while the
   first query is still in flight: visitors saw "The collection is being
   prepared" flash over a perfectly good collection on the live deployment. */
describe('collection loading gate', () => {
  for (const file of ['components/site/PropertyCollection.tsx', 'components/site/PropertyBrowser.tsx']) {
    it(`${file} keeps the skeleton until the first query resolves`, () => {
      const source = readFileSync(file, 'utf8');
      expect(source).toMatch(/\(configured && loading\)/);
      expect(source).toMatch(/!config\.initialized \|\| \(config\.loading && configured\) \|\| \(configured && loading\)/);
    });
  }
});
