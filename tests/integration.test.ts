/* Regression tests for the bug-fix pass: public enquiry writes, Google Maps
   normalisation, login redirect safety, and media upload/delete behaviour. */
import { describe, expect, it, vi } from 'vitest';
import { createProperty, submitInquiry, updateProperty, type Client } from '../lib/supabase/queries';
import { mediaMimeType, validateMediaFile, deletePropertyMedia } from '../lib/supabase/storage';
import { resolvePropertyMap, extractCoordinates, validateMapUrl } from '../lib/maps';
import { safeNextPath, getOwnerAccessToken } from '../lib/auth/owner';
import type { PropertyMedia } from '../lib/types';

function file(name: string, type = '', size = 1024): File {
  const f = new File([new Uint8Array(size)], name, { type });
  return f;
}

/* ------------------------------------------------ 1. public enquiry insert */
describe('public enquiry submission', () => {
  function inquiryClient(opts: { error?: { message: string }; onInsert?: (p: Record<string, unknown>) => void } = {}): Client {
    return {
      from(table: string) {
        if (table !== 'inquiries') throw new Error(`unexpected table ${table}`);
        return {
          insert(payload: Record<string, unknown>) {
            opts.onInsert?.(payload);
            // Any `.select()` on this builder would reproduce the real bug:
            // anon has no SELECT grant/policy on inquiries.
            return Object.assign(Promise.resolve({ data: null, error: opts.error ?? null }), {
              select: () => { throw new Error('return=representation is forbidden for anon inquiries'); },
            });
          },
        };
      },
    } as unknown as Client;
  }

  it('inserts without requesting a representation (anon has no SELECT privilege)', async () => {
    let payload: Record<string, unknown> = {};
    const res = await submitInquiry(inquiryClient({ onInsert: p => { payload = p; } }), {
      name: '  Ada Lovelace  ', email: '  ADA@Example.COM ', phone: ' +91 98765 43210 ',
      message: '  I would like to arrange a private viewing.  ', source: 'contact',
    });
    expect(res.error).toBeNull();
    expect(payload).toMatchObject({
      name: 'Ada Lovelace', email: 'ada@example.com', phone: '+91 98765 43210',
      message: 'I would like to arrange a private viewing.', source: 'contact', status: 'new',
    });
  });

  it('surfaces database errors instead of a false success', async () => {
    const res = await submitInquiry(inquiryClient({ error: { message: 'permission denied' } }), {
      name: 'Ada Lovelace', email: 'ada@example.com', message: 'A perfectly valid enquiry message.',
    });
    expect(res.error).toContain('permission denied');
  });

  it('validates the same constraints as the database before hitting it', async () => {
    const client = inquiryClient();
    expect((await submitInquiry(client, { name: 'A', email: 'ada@example.com', message: 'A long enough message.' })).error).toMatch(/name/i);
    expect((await submitInquiry(client, { name: 'Ada Lovelace', email: 'bad', message: 'A long enough message.' })).error).toMatch(/email/i);
    expect((await submitInquiry(client, { name: 'Ada Lovelace', email: 'ada@example.com', message: 'short' })).error).toMatch(/message/i);
  });
});

/* ------------------------------------------------ 2. maps */
describe('Google / OpenStreetMap embedding', () => {
  const base = { address: 'The Imperial House', location: 'Northern Ridge', city: 'Guwahati', country: 'India' };

  it('extracts coordinates from a Google Maps place link', () => {
    expect(extractCoordinates('https://www.google.com/maps/place/Imperial+House/@26.1445,91.7362,15z'))
      .toEqual({ lat: 26.1445, lng: 91.7362 });
    expect(extractCoordinates('https://www.google.com/maps/embed?pb=!1m18!3d26.1445!4d91.7362'))
      .toEqual({ lat: 26.1445, lng: 91.7362 });
  });

  it('converts a Google share link into a genuinely embeddable map', () => {
    const r = resolvePropertyMap({ ...base, map_url: 'https://www.google.com/maps/place/Imperial+House/@26.1445,91.7362,15z' });
    expect(r).not.toBeNull();
    expect(r!.embedUrl).toContain('openstreetmap.org/export/embed.html');
    expect(r!.embedUrl).toContain('26.144500');
    expect(r!.approximate).toBe(false);
    expect(r!.externalUrl).toContain('google.com/maps/search');
  });

  it('keeps a Google "Embed a map" URL as-is', () => {
    const url = 'https://www.google.com/maps/embed?pb=!1m18!2m1!3d26.1';
    expect(resolvePropertyMap({ ...base, map_url: url })!.embedUrl).toBe(url);
  });

  it('handles maps.app.goo.gl short links that cannot be framed', () => {
    const r = resolvePropertyMap({ ...base, map_url: 'https://maps.app.goo.gl/abc123' });
    expect(r!.embedUrl).toContain('output=embed');
    expect(r!.embedUrl).not.toContain('maps.app.goo.gl');
    expect(r!.approximate).toBe(true);
    expect(r!.externalUrl).toContain('google.com/maps/search');
  });

  it('never iframes an unsafe URL', () => {
    const r = resolvePropertyMap({ ...base, map_url: 'javascript:alert(1)' });
    expect(r!.embedUrl.startsWith('https://')).toBe(true);
    expect(r!.embedUrl).not.toContain('javascript');
    expect(validateMapUrl('javascript:alert(1)')).toMatch(/https/i);
    expect(validateMapUrl('https://evil.example.com/embed')).toMatch(/Only Google/i);
    expect(validateMapUrl('https://google.evil.com/maps/embed?pb=x')).toMatch(/Only Google/i);
    expect(validateMapUrl('https://google.co.in/maps/place/X')).toBeNull();
    expect(validateMapUrl('https://maps.google.com/maps?q=Guwahati&output=embed')).toBeNull();
    expect(validateMapUrl('')).toBeNull();
  });

  it('uses latitude/longitude even when a coordinate is exactly zero', () => {
    const r = resolvePropertyMap({ ...base, latitude: 0, longitude: 0 });
    expect(r!.coords).toEqual({ lat: 0, lng: 0 });
    expect(r!.approximate).toBe(false);
    expect(r!.embedUrl).toContain('marker=0.000000');
  });

  it('still offers an approximate map when only a city is known', () => {
    const r = resolvePropertyMap({ city: 'Guwahati', country: 'India' });
    expect(r!.approximate).toBe(true);
    expect(r!.embedUrl).toContain('output=embed');
    expect(r!.externalUrl).toContain('Guwahati');
  });
});

/* ------------------------------------------------ 3. login redirect */
describe('post-login destination', () => {
  it('blocks open redirects', () => {
    for (const bad of ['https://evil.example.com', '//evil.example.com', '/\\evil.com', 'javascript:alert(1)', '/', '/public']) {
      expect(safeNextPath(bad)).toBe('/admin/dashboard');
    }
  });
  it('preserves safe internal admin routes without loops', () => {
    expect(safeNextPath('/admin/configuration')).toBe('/admin/configuration');
    expect(safeNextPath('/admin/properties/abc/edit?tab=media')).toBe('/admin/properties/abc/edit?tab=media');
    expect(safeNextPath('/admin/login')).toBe('/admin/dashboard');
    expect(safeNextPath('/admin')).toBe('/admin/dashboard');
  });
  it('returns null when no validated session exists', async () => {
    expect(await getOwnerAccessToken(null)).toBeNull();
    const client = { auth: { getSession: async () => ({ data: { session: null }, error: null }) } } as never;
    expect(await getOwnerAccessToken(client)).toBeNull();
  });
});

/* ------------------------------------------------ 4. media handling */
describe('media file validation', () => {
  it('infers the MIME type from the extension when browsers omit it', () => {
    expect(mediaMimeType(file('photo.JPG'))).toBe('image/jpeg');
    expect(mediaMimeType(file('film.mp4'))).toBe('video/mp4');
    expect(validateMediaFile(file('photo.png')).ok).toBe(true);
  });
  it('rejects HEIC photos with an actionable message', () => {
    const r = validateMediaFile(file('photo.heic', 'image/heic'));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/JPG or PNG/);
  });
  it('rejects empty and oversized files', () => {
    expect(validateMediaFile(file('empty.jpg', 'image/jpeg', 0)).ok).toBe(false);
    expect(validateMediaFile(file('huge.jpg', 'image/jpeg', 13 * 1024 * 1024)).ok).toBe(false);
  });
});

describe('media deletion', () => {
  const media = { id: 'm1', storage_path: 'p1/a.jpg', public_url: 'https://x/a.jpg' } as PropertyMedia;

  it('deletes the DB row before the stored object and reports cleanup warnings', async () => {
    const order: string[] = [];
    const client = {
      from: () => ({ delete: () => ({ eq: async () => { order.push('db'); return { error: null }; } }) }),
      storage: { from: () => ({ remove: async () => { order.push('storage'); return { error: { message: 'cleanup failed' } }; } }) },
    } as unknown as Client;
    const res = await deletePropertyMedia(client, media);
    expect(order).toEqual(['db', 'storage']);
    expect(res.error).toBeNull();
    expect(res.warning).toMatch(/could not be deleted/);
  });

  it('keeps the stored object when the DB delete fails', async () => {
    const removed = vi.fn();
    const client = {
      from: () => ({ delete: () => ({ eq: async () => ({ error: { message: 'RLS blocked' } }) }) }),
      storage: { from: () => ({ remove: removed }) },
    } as unknown as Client;
    const res = await deletePropertyMedia(client, media);
    expect(res.error).toMatch(/RLS blocked/);
    expect(removed).not.toHaveBeenCalled();
  });
});

/* ------------------------------------- 5. the public slug must never drift */
describe('property writes and the public slug', () => {
  function propertyClient(error?: { code?: string; message: string }) {
    const writes: Array<Record<string, unknown>> = [];
    const result = (payload: Record<string, unknown>) => ({ data: { id: 'p1', ...payload }, error: error ?? null });
    const client = {
      from(table: string) {
        if (table !== 'properties') throw new Error(`unexpected table ${table}`);
        return {
          insert(payload: Record<string, unknown>) {
            writes.push(payload);
            return { select: () => ({ single: async () => result(payload) }) };
          },
          update(payload: Record<string, unknown>) {
            writes.push(payload);
            return { eq: () => ({ select: () => ({ single: async () => result(payload) }) }) };
          },
        };
      },
    } as unknown as Client;
    return { client, writes };
  }

  it('derives a slug from the title when a property is created', async () => {
    const { client, writes } = propertyClient();
    const res = await createProperty(client, { title: 'The Aurelian Estate' });
    expect(res.error).toBeNull();
    expect(writes[0].slug).toBe('the-aurelian-estate');
  });

  it('never re-derives the slug on update, so publish/feature toggles cannot break a live URL', async () => {
    const { client, writes } = propertyClient();
    const res = await updateProperty(client, 'p1', { title: 'Renamed Residence', featured: true });
    expect(res.error).toBeNull();
    expect(writes[0]).not.toHaveProperty('slug');
    expect(writes[0]).toMatchObject({ title: 'Renamed Residence', featured: true });
  });

  it('persists an explicitly edited slug, normalised', async () => {
    const { client, writes } = propertyClient();
    await updateProperty(client, 'p1', { title: 'Renamed Residence', slug: 'Aurelian Penthouse!' });
    expect(writes[0].slug).toBe('aurelian-penthouse');
  });

  it('turns a duplicate-slug constraint error into an actionable message', async () => {
    const { client } = propertyClient({
      code: '23505',
      message: 'duplicate key value violates unique constraint "properties_slug_key"',
    });
    const res = await createProperty(client, { title: 'The Aurelian Estate' });
    expect(res.error).toMatch(/already used by another residence/i);
    expect(res.error).toContain('/properties/the-aurelian-estate');
  });
});
