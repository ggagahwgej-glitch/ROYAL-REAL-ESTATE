import type { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { PropertyDetail } from '@/components/site/PropertyDetail';
import { Loading } from '@/components/ui/UI';
import { getServerConfig } from '@/lib/config/server';
import { getServerSupabaseClient } from '@/lib/supabase/factory';
import { getMediaForProperty, getPublicPropertyBySlug } from '@/lib/supabase/queries';
import { truncate } from '@/lib/utils';
import { getSiteUrl } from '@/lib/config/site-url';
export const revalidate = 60;

type Params = { params: Promise<{ slug: string }> };

async function serverProperty(slug: string): Promise<{ property: Awaited<ReturnType<typeof getPublicPropertyBySlug>>['data']; error: string | null }> {
  try {
    const { config } = await getServerConfig();
    if (!config) return { property: null, error: null };
    const res = await getPublicPropertyBySlug(getServerSupabaseClient(config), slug);
    return { property: res.data, error: res.error };
  } catch { return { property: null, error: 'unavailable' }; }
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const { property: p } = await serverProperty(slug);
  if (!p) return {
    title: 'Residence not found',
    description: 'Explore the Imperial Royal collection of extraordinary residences.',
    robots: { index: false, follow: true },
  };
  const title = p.meta_title || `${p.title} · ${p.city}`;
  const description = p.meta_description || truncate(p.description || `${p.category} in ${p.city}, ${p.bedrooms} bedrooms, ${p.area_sqft} sq ft. An exceptional Imperial Royal residence.`, 158);
  let image: string | undefined;
  try {
    const { config } = await getServerConfig();
    if (config) {
      const media = await getMediaForProperty(getServerSupabaseClient(config), p.id);
      image = media.data?.find(m => m.is_cover && m.kind === 'image')?.public_url ?? media.data?.find(m => m.kind === 'image')?.public_url;
    }
  } catch { /* metadata still renders without an image */ }
  return {
    title, description,
    alternates: { canonical: `/properties/${p.slug}` },
    openGraph: { title, description, type: 'article', url: `/properties/${p.slug}`, images: image ? [{ url: image, width: 1200, height: 800, alt: p.title }] : undefined },
    twitter: { card: 'summary_large_image', title, description, images: image ? [image] : undefined },
  };
}

export default async function PropertyPage({ params }: Params) {
  const { slug } = await params;
  const { property: p, error: queryError } = await serverProperty(slug);
  const BASE = await getSiteUrl();
  // Only a hard 404 when a configured backend successfully confirms the listing is absent.
  // A local-only configuration still renders client-side, so it must never be 404'd here.
  if (p === null && !queryError && (await getServerConfig()).config) notFound();

  const jsonLd = p ? {
    '@context': 'https://schema.org', '@type': 'RealEstateListing',
    name: p.title, description: truncate(p.description || '', 300), url: `${BASE}/properties/${p.slug}`,
    datePosted: p.created_at,
    address: { '@type': 'PostalAddress', addressLocality: p.city, addressRegion: p.location, addressCountry: p.country, streetAddress: p.address },
    numberOfRooms: p.bedrooms, numberOfBathroomsTotal: p.bathrooms,
    floorSize: { '@type': 'QuantitativeValue', value: p.area_sqft, unitCode: 'FTK' },
    offers: { '@type': 'Offer', price: p.price, priceCurrency: p.currency || 'INR', availability: p.availability === 'available' ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock' },
    brand: { '@type': 'Brand', name: 'Imperial Royal Real Estate' },
  } : null;

  return (
    <>
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />}
      <Suspense fallback={<Loading />}><PropertyDetail slug={slug} /></Suspense>
    </>
  );
}
