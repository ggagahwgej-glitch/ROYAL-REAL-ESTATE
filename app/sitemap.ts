import type { MetadataRoute } from 'next';
import { getServerConfig } from '@/lib/config/server';
import { getServerSupabaseClient } from '@/lib/supabase/factory';
import { getSiteUrl } from '@/lib/config/site-url';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const BASE = await getSiteUrl();
  const staticRoutes = ['', '/properties', '/buy', '/rent', '/categories', '/about', '/contact', '/settings']
    .map(path => ({ url: `${BASE}${path}`, lastModified: new Date(), changeFrequency: (path === '' ? 'weekly' : 'monthly') as 'weekly' | 'monthly', priority: path === '' ? 1 : 0.7 }));
  try {
    const { config } = await getServerConfig();
    if (!config) return staticRoutes;
    const client = getServerSupabaseClient(config);
    const { data, error } = await client.from('properties').select('slug,updated_at').eq('status', 'published');
    if (error || !data) return staticRoutes;
    return [...staticRoutes, ...data.map(p => ({
      url: `${BASE}/properties/${p.slug}`,
      lastModified: p.updated_at ? new Date(String(p.updated_at)) : new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }))];
  } catch { return staticRoutes; }
}
