/* Owner Studio write paths: settings persistence, cover selection, gallery
   ordering and the dashboard counters. These are the operations a slip in
   could silently corrupt, and none of them can be exercised without a live
   project — so they are pinned here against recording mock clients. */
import { describe, expect, it } from 'vitest';
import {
  getDashboardStats, saveSiteSettings, type Client,
} from '../lib/supabase/queries';
import { reorderMedia, setCoverMedia } from '../lib/supabase/storage';
import type { PropertyMedia, SiteSettings } from '../lib/types';

type Recorder = Array<{ table: string; op: string; payload: unknown; conflict?: string }>;

describe('website settings persistence', () => {
  function settingsClient(recorder: Recorder): Client {
    return {
      from(table: string) {
        return {
          upsert(payload: Record<string, unknown>, options?: { onConflict?: string }) {
            recorder.push({ table, op: 'upsert', payload, conflict: options?.onConflict });
            return {
              select: () => ({
                single: async () => ({ data: payload, error: null }),
              }),
            };
          },
        };
      },
    } as unknown as Client;
  }

  it('always writes row 1 and never sends the read-only timestamp', async () => {
    const recorder: Recorder = [];
    const settings = {
      id: 7, business_name: 'Imperial Royal', updated_at: '2026-01-01T00:00:00.000Z',
      social: { instagram: 'https://instagram.com/imperial' },
      testimonials: [{ quote: 'A real quote', name: 'A Client', role: '', initials: '' }],
    } as unknown as SiteSettings;
    const res = await saveSiteSettings(settingsClient(recorder), settings);

    expect(res.error).toBeNull();
    expect(recorder).toHaveLength(1);
    expect(recorder[0].table).toBe('site_settings');
    expect(recorder[0].conflict).toBe('id');
    const payload = recorder[0].payload as Record<string, unknown>;
    expect(payload.id).toBe(1);
    expect(payload).not.toHaveProperty('updated_at');
    expect(payload.social).toEqual({ instagram: 'https://instagram.com/imperial' });
    expect(payload.testimonials).toEqual([{ quote: 'A real quote', name: 'A Client', role: '', initials: '' }]);
  });

  it('surfaces a database failure instead of reporting success', async () => {
    const client = {
      from: () => ({
        upsert: () => ({ select: () => ({ single: async () => ({ data: null, error: { message: 'permission denied' } }) }) }),
      }),
    } as unknown as Client;
    const res = await saveSiteSettings(client, { business_name: 'Imperial Royal' } as Partial<SiteSettings>);
    expect(res.error).toMatch(/permission denied/i);
  });
});

describe('gallery cover + ordering', () => {
  function mediaClient(recorder: Recorder, failOn?: string): Client {
    return {
      from(table: string) {
        return {
          update(payload: Record<string, unknown>) {
            recorder.push({ table, op: 'update', payload });
            return {
              eq(field: string, value: unknown) {
                recorder.push({ table, op: `where ${field}=${String(value)}`, payload: null });
                if (failOn && JSON.stringify(payload).includes(failOn)) return Promise.resolve({ error: { message: 'denied' } });
                return Promise.resolve({ error: null });
              },
            };
          },
        };
      },
    } as unknown as Client;
  }

  it('clears every cover before setting the new one', async () => {
    const recorder: Recorder = [];
    const res = await setCoverMedia(mediaClient(recorder), 'property-1', 'media-9');
    expect(res.error).toBeNull();
    const writes = recorder.filter(r => r.op === 'update').map(r => (r.payload as { is_cover?: boolean }).is_cover);
    expect(writes).toEqual([false, true]);
    expect(recorder.some(r => r.op === 'where property_id=property-1')).toBe(true);
    expect(recorder.some(r => r.op === 'where id=media-9')).toBe(true);
  });

  it('stops and reports when the cover cannot be cleared', async () => {
    const recorder: Recorder = [];
    const res = await setCoverMedia(mediaClient(recorder, 'false'), 'property-1', 'media-9');
    expect(res.error).toMatch(/denied/i);
    // the second write must never run while the first one failed
    expect(recorder.filter(r => r.op === 'update')).toHaveLength(1);
  });

  it('renumbers positions 0..n-1 in the order shown', async () => {
    const recorder: Recorder = [];
    const items = ['a', 'b', 'c'].map(id => ({ id } as PropertyMedia));
    const res = await reorderMedia(mediaClient(recorder), items);
    expect(res.error).toBeNull();
    const positions = recorder
      .filter(r => r.op === 'update')
      .map(r => (r.payload as { position: number }).position);
    expect(positions).toEqual([0, 1, 2]);
    const ids = recorder.filter(r => r.op.startsWith('where id=')).map(r => r.op);
    expect(ids).toEqual(['where id=a', 'where id=b', 'where id=c']);
  });
});

describe('dashboard counters', () => {
  it('reads all seven totals in one pass and never returns a partial shape', async () => {
    const counts: Record<string, number> = {
      'properties|': 12, 'properties|availability=available': 7, 'properties|availability=sold': 2,
      'properties|listing_type=rent': 3, 'properties|featured=true': 5,
      'inquiries|': 40, 'inquiries|status=new': 4,
    };
    const client = {
      from(table: string) {
        // One builder per call: the filter belongs to THIS query only.
        const make = (filter: string) => {
          const count = counts[`${table}|${filter}`] ?? 0;
          return Object.assign(Promise.resolve({ count, error: null }), {
            eq: (column: string, value: unknown) => make(`${column}=${String(value)}`),
          });
        };
        return { select: () => make('') };
      },
    } as unknown as Client;

    const res = await getDashboardStats(client);
    expect(res.error).toBeNull();
    expect(res.data).toMatchObject({
      total: 12, available: 7, sold: 2, rental: 3, featured: 5, inquiries: 40, unread: 4,
    });
  });

  it('degrades to zeroed counters with a message when the database refuses the read', async () => {
    const client = {
      from: () => ({ select: () => Object.assign(Promise.resolve({ count: null, error: { message: 'permission denied' } }), { eq: () => Promise.resolve({ count: null, error: { message: 'permission denied' } }) }) }),
    } as unknown as Client;
    const res = await getDashboardStats(client);
    expect(res.data).toMatchObject({ total: 0, inquiries: 0, unread: 0 });
    expect(res.error).toMatch(/permission denied/i);
  });
});
