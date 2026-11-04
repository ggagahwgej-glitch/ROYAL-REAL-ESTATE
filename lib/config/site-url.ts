import { headers } from 'next/headers';

/** Accepts either a bare host (`example.com`) or a full origin. */
function asOrigin(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '');
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/**
 * Canonical site origin.
 *
 * Resolution order:
 *   1. NEXT_PUBLIC_SITE_URL         — explicit override, wins everywhere.
 *   2. The incoming request host     — correct for every dynamic route.
 *   3. VERCEL_PROJECT_PRODUCTION_URL — the stable production domain Vercel
 *      injects; used while PRERENDERING (the static 404 page, icon, etc.),
 *      where no request exists. Without this, a static page would bake
 *      `http://localhost:3000` into its canonical URL on the live site.
 *   4. VERCEL_URL                   — the per-deployment URL (preview builds).
 *   5. http://localhost:3000        — local development fallback.
 */
export async function getSiteUrl(): Promise<string> {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return asOrigin(explicit);

  try {
    const h = await headers();
    const host = h.get('x-forwarded-host') ?? h.get('host');
    if (host) {
      const proto = h.get('x-forwarded-proto') ?? (/localhost|127\.0\.0\.1/.test(host) ? 'http' : 'https');
      return `${proto}://${host}`.replace(/\/+$/, '');
    }
  } catch { /* build-time / non-request context */ }

  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (production) return asOrigin(production);

  const deployment = process.env.VERCEL_URL?.trim();
  if (deployment) return asOrigin(deployment);

  return 'http://localhost:3000';
}
