import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DEFAULT_SETTINGS } from '../lib/utils';
import {
  getNewInquiryCount,
  getSiteSettings,
  normaliseHeroStats,
  saveSiteSettings,
  SETTINGS_TIMEOUT_MESSAGE,
} from '../lib/supabase/queries';

/**
 * Owner-facing behaviour added in this pass:
 *   · hero statistics normalisation + persistence
 *   · an 8 s ceiling on the settings read, with a graceful fallback
 *   · a real unread-inquiry count for the sidebar badge
 */

const root = process.cwd();
const read = (rel: string) => readFileSync(path.join(root, rel), 'utf8');

/** Minimal PostgREST-shaped client for the two builders these functions use. */
function settingsClient(opts: {
  read?: () => Promise<{ data: unknown; error: { message: string } | null }>;
  upsert?: (payload: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
}) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: opts.read ?? (async () => ({ data: null, error: null })) }),
      }),
      upsert: (payload: Record<string, unknown>) => ({
        select: () => ({
          single: () => (opts.upsert ? opts.upsert(payload) : Promise.resolve({ data: null, error: null })),
        }),
      }),
    }),
  } as never;
}

afterEach(() => { vi.useRealTimers(); });

describe('hero statistics', () => {
  it('trims, drops empty rows and caps the list at four', () => {
    expect(normaliseHeroStats([
      { value: ' 25+ ', label: ' Years of stewardship ' },
      { value: '', label: 'orphan label' },
      { value: '40+', label: '' },
      null, 'nope', 42,
      { value: '1', label: 'a' }, { value: '2', label: 'b' }, { value: '3', label: 'c' }, { value: '4', label: 'd' },
    ])).toEqual([
      { value: '25+', label: 'Years of stewardship' },
      { value: '1', label: 'a' }, { value: '2', label: 'b' }, { value: '3', label: 'c' },
    ]);
  });

  it('survives a missing or malformed column', () => {
    expect(normaliseHeroStats(undefined)).toEqual([]);
    expect(normaliseHeroStats('oops')).toEqual([]);
    expect(normaliseHeroStats({ value: '25+', label: 'x' })).toEqual([]);
  });

  it('truncates runaway values rather than letting them break the layout', () => {
    const [stat] = normaliseHeroStats([{ value: '9'.repeat(40), label: 'x'.repeat(200) }]);
    expect(stat.value.length).toBeLessThanOrEqual(12);
    expect(stat.label.length).toBeLessThanOrEqual(48);
  });

  it('defaults to the house figures when the row has none', async () => {
    const res = await getSiteSettings(settingsClient({ read: async () => ({ data: { id: 1 }, error: null }) }));
    expect(res.data?.hero_stats).toEqual(DEFAULT_SETTINGS.hero_stats);
  });

  it('uses the figures the owner published', async () => {
    const res = await getSiteSettings(settingsClient({
      read: async () => ({ data: { id: 1, hero_stats: [{ value: '31', label: 'Years advising' }] }, error: null }),
    }));
    expect(res.data?.hero_stats).toEqual([{ value: '31', label: 'Years advising' }]);
  });

  it('is written back normalised', async () => {
    let sent: Record<string, unknown> | null = null;
    await saveSiteSettings(settingsClient({
      upsert: async (payload) => { sent = payload; return { data: { id: 1 }, error: null }; },
    }), { hero_stats: [{ value: ' 12 ', label: ' Cities ' }] });
    expect(sent!.hero_stats).toEqual([{ value: '12', label: 'Cities' }]);
  });

  it('still saves the rest of the settings when the column does not exist yet', async () => {
    const seen: Array<Record<string, unknown>> = [];
    const res = await saveSiteSettings(settingsClient({
      upsert: async (payload) => {
        seen.push(payload);
        return payload.hero_stats
          ? { data: null, error: { message: 'column "hero_stats" of relation "site_settings" does not exist' } }
          : { data: { id: 1 }, error: null };
      },
    }), { business_name: 'Imperial Royal', hero_stats: [{ value: '1', label: 'one' }] });

    expect(res.error).toBeNull();
    expect(res.warning).toMatch(/hero_stats/);
    expect(seen).toHaveLength(2);
    expect(seen[1].hero_stats).toBeUndefined();
    expect(seen[1].business_name).toBe('Imperial Royal');
  });
});

describe('settings read ceiling', () => {
  it('gives up after eight seconds instead of freezing the site chrome', async () => {
    vi.useFakeTimers();
    const res = await (async () => {
      const pending = getSiteSettings(settingsClient({ read: () => new Promise(() => {}) }));
      await vi.advanceTimersByTimeAsync(8_000);
      return pending;
    })();
    // Showcase deployments keep rendering and name the cause for the owner.
    expect(res.data).toBeTruthy();
    expect(res.warning).toMatch(/curated presentation settings/i);
    expect(res.warningDetail).toContain(SETTINGS_TIMEOUT_MESSAGE);
  });

  it('names the ceiling in the message', () => {
    expect(SETTINGS_TIMEOUT_MESSAGE).toMatch(/8 seconds/);
  });
});

describe('unread inquiry count', () => {
  function countClient(result: { count: number | null; error: { message: string } | null }) {
    return {
      from: () => ({
        select: (_cols: string, options: { count?: string; head?: boolean }) => {
          expect(options).toMatchObject({ count: 'exact', head: true });
          return { eq: async () => result };
        },
      }),
    } as never;
  }

  it('returns the number of unread inquiries', async () => {
    expect((await getNewInquiryCount(countClient({ count: 4, error: null }))).data).toBe(4);
  });

  it('reports zero rather than failing when the count is null', async () => {
    expect((await getNewInquiryCount(countClient({ count: null, error: null }))).data).toBe(0);
  });

  it('reports the error so the shell can stay silent', async () => {
    const res = await getNewInquiryCount(countClient({ count: null, error: { message: 'denied' } }));
    expect(res.error).toBe('denied');
  });
});

describe('sidebar badge', () => {
  const shell = read('components/admin/AdminShell.tsx');

  it('is driven by the real count, not a hardcoded word', () => {
    expect(shell).toContain('getNewInquiryCount');
    expect(shell).toMatch(/newInquiries > 0/);
    expect(shell).not.toMatch(/\{label === 'Inquiries' && <span className="badge badge-gold"[^>]*>New<\/span>\}/);
  });

  it('says how many are unread for screen readers', () => {
    expect(shell).toMatch(/aria-label=\{`\$\{newInquiries\} unread/);
  });
});

describe('image fallbacks', () => {
  it('SmartImage swaps to the branded emblem on error', () => {
    const source = read('components/ui/SmartImage.tsx');
    expect(source).toMatch(/onError=\{\(\) => setFailed\(true\)\}/);
    expect(source).toMatch(/if \(!src \|\| failed\) return <NoImage/);
    expect(source).toContain('data-image-fallback');
  });

  it('the lightbox does the same instead of a broken-image glyph', () => {
    const source = read('components/site/Lightbox.tsx');
    expect(source).toContain('NoImage');
    expect(source).toMatch(/onError=\{\(\) => setFailed\(true\)\}/);
    expect(source).toMatch(/setFailed\(false\)/);
  });
});

describe('owner studio forms', () => {
  it('uses generated ids so two inquiry forms cannot collide', () => {
    const source = read('components/site/InquiryForm.tsx');
    expect(source).toContain('useId');
    expect(source).not.toMatch(/id="inq-/);
    expect(source).not.toMatch(/htmlFor="inq-/);
  });

  it('loads the media library without a suppressed dependency list', () => {
    const source = read('app/admin/(studio)/media/page.tsx');
    expect(source).not.toContain('eslint-disable-line react-hooks/exhaustive-deps');
    expect(source).toMatch(/useEffect\(\(\) => \{ void load\(\); \}, \[load\]\)/);
    expect(source).toMatch(/setSelected\(prev =>/);
  });

  it('exposes the hero statistics in Website Settings', () => {
    const source = read('app/admin/(studio)/settings/page.tsx');
    expect(source).toContain('Hero statistics');
    expect(source).toMatch(/setStat\(index, \{ value/);
    expect(source).toMatch(/setStat\(index, \{ label/);
    expect(source).toMatch(/hero_stats: normaliseHeroStats\(stats\)/);
  });
});
