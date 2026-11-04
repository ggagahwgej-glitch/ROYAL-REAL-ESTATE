import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/config/site-url';
export default async function robots(): Promise<MetadataRoute.Robots> {
  const BASE = await getSiteUrl();
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/admin', '/admin/', '/api/'] },
    ],
    sitemap: `${BASE}/sitemap.xml`,
  };
}
