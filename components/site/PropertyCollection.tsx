'use client';
import Link from 'next/link';
import { ArrowUpRight, Sparkles } from 'lucide-react';
import { PropertyCard } from './PropertyCard';
import { SetupState } from './SetupState';
import { EmptyState, Notice, SkeletonCard } from '@/components/ui/UI';
import { usePublicProperties } from '@/lib/hooks/useSiteData';
import { useSupabaseConfig } from '@/lib/hooks/useSupabaseConfig';

export function PropertyCollection({ heading = 'The Signature Collection', eyebrow = 'Curated Residences', limit = 6, featuredOnly = false }: {
  heading?: string; eyebrow?: string; limit?: number; featuredOnly?: boolean;
}) {
  const config = useSupabaseConfig();
  const { result, media, loading, error, configured } = usePublicProperties({ perPage: limit, featured: featuredOnly, sort: 'newest' });

  return (
    <section className="section" id="collection">
      <div className="container">
        <div className="section-head">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h2 className="h2 mt-16">{heading}</h2>
            <p className="muted mt-16 max-w-600">A small, deliberately edited selection of residences that meet our standards for architecture, provenance and position.</p>
          </div>
          <Link href="/properties" className="link-gold">View the full collection <ArrowUpRight /></Link>
        </div>

        {!config.initialized || (config.loading && configured) ? (
          <div className="property-grid">{[0, 1, 2].map(i => <SkeletonCard key={i} />)}</div>
        ) : !configured ? (
          <SetupState config={config} compact />
        ) : error ? (
          <Notice tone="error" title="Could not load properties">{error} <button className="link-gold" onClick={() => window.location.reload()}>Try again</button></Notice>
        ) : result.items.length === 0 ? (
          <EmptyState icon={<Sparkles />} title="The collection is being prepared"
            description="No published residences are available yet. Once the owner publishes listings in the Owner Studio, they appear here automatically."
            action={<Link href="/contact" className="btn btn-outline btn-sm">Speak to an advisor</Link>} />
        ) : (
          <>
            <div className="property-grid">
              {result.items.map((p, i) => <PropertyCard key={p.id} property={p} media={media.filter(m => m.property_id === p.id)} priority={i < 3} />)}
            </div>
            <div className="text-center mt-48">
              <Link href="/properties" className="btn btn-outline btn-lg">Explore All Residences <ArrowUpRight size={16} /></Link>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
