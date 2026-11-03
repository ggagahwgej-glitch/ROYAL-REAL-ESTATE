import { headers } from 'next/headers';

/**
 * Canonical site origin, derived from the incoming request so no deployment
 * environment variable is required for correct canonical URLs / sitemap.
 * `NEXT_PUBLIC_SITE_URL` remains an optional explicit override.
 */
export async function getSiteUrl(): Promise<string> {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, '');
  try {
    const h = await headers();
    const host = h.get('x-forwarded-host') ?? h.get('host');
    if (host) {
      const proto = h.get('x-forwarded-proto') ?? (/localhost|127\.0\.0\.1/.test(host) ? 'http' : 'https');
      return `${proto}://${host}`.replace(/\/+$/, '');
    }
  } catch { /* build-time / non-request context */ }
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel}`;
  return 'http://localhost:3000';
}
