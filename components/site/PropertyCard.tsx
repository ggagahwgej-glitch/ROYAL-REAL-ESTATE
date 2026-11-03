'use client';
import Link from 'next/link';
import { MapPin, BedDouble, Bath, Maximize2, ArrowUpRight, Heart } from 'lucide-react';
import { SmartImage } from '@/components/ui/SmartImage';
import type { Property, PropertyMedia } from '@/lib/types';
import { coverImage, formatNumber, formatPrice } from '@/lib/utils';

export function PropertyCard({ property, media = [], priority = false }: {
  property: Property; media?: PropertyMedia[]; priority?: boolean;
}) {
  const image = coverImage(property, media);
  const statusLabel = property.availability === 'available' ? undefined
    : property.availability.charAt(0).toUpperCase() + property.availability.slice(1);
  return (
    <article className="property-card">
      <Link href={`/properties/${property.slug}`} className="property-image" aria-label={`View ${property.title}`}>
        <SmartImage src={image} alt={property.title} priority={priority} />
        <div className="property-tags">
          {property.featured && <span className="badge badge-gold">Signature</span>}
          <span className="badge badge-muted" style={{ background: 'rgba(8,9,13,.65)' }}>{property.listing_type === 'buy' ? 'For Sale' : 'For Rent'}</span>
          {statusLabel && <span className="badge badge-red">{statusLabel}</span>}
        </div>
        <span className="property-fav" aria-hidden="true"><Heart size={15} /></span>
      </Link>
      <div className="property-body">
        <span className="property-location"><MapPin size={13} />{property.city}{property.location && property.location !== property.city ? ` · ${property.location}` : ''}</span>
        <Link href={`/properties/${property.slug}`}><h3 className="property-title">{property.title}</h3></Link>
        <p className="small muted" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {property.subtitle || property.description || `${property.category} in ${property.city}`}
        </p>
        <div className="property-price">{formatPrice(property.price, property.currency)}
          {property.listing_type === 'rent' && <small> / {property.price_period || 'month'}</small>}
        </div>
        <div className="property-specs">
          <span><BedDouble size={14} />{formatNumber(property.bedrooms)} Beds</span>
          <span><Bath size={14} />{formatNumber(property.bathrooms)} Baths</span>
          <span><Maximize2 size={14} />{formatNumber(property.area_sqft)} sq ft</span>
          <Link href={`/properties/${property.slug}`} style={{ marginLeft: 'auto', color: 'var(--gold)', display: 'inline-flex' }} aria-label={`View ${property.title}`}><ArrowUpRight size={17} /></Link>
        </div>
      </div>
    </article>
  );
}
