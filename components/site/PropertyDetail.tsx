'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MapPin, BedDouble, Bath, Maximize2, CalendarDays, Layers3, Check, Expand, ArrowUpRight, MessageCircle, Share2, PlayCircle, ShieldCheck } from 'lucide-react';
import { SmartImage } from '@/components/ui/SmartImage';
import { Lightbox } from './Lightbox';
import { InquiryForm } from './InquiryForm';
import { PropertyCard } from './PropertyCard';
import { SetupState } from './SetupState';
import { EmptyState, Notice, Loading } from '@/components/ui/UI';
import { useSupabaseConfig } from '@/lib/hooks/useSupabaseConfig';
import { useSiteSettings } from '@/lib/hooks/useSiteData';
import { getSupabaseClient } from '@/lib/supabase/factory';
import { getMediaForProperty, getPublicPropertyBySlug, getRelatedProperties, getMediaForProperties } from '@/lib/supabase/queries';
import type { Property, PropertyMedia } from '@/lib/types';
import { coverImage, formatNumber, formatPrice, whatsappLink } from '@/lib/utils';
import { resolvePropertyMap } from '@/lib/maps';

export function PropertyDetail({ slug }: { slug: string }) {
  const config = useSupabaseConfig();
  const { settings } = useSiteSettings();
  const [property, setProperty] = useState<Property | null>(null);
  const [media, setMedia] = useState<PropertyMedia[]>([]);
  const [related, setRelated] = useState<Property[]>([]);
  const [relatedMedia, setRelatedMedia] = useState<PropertyMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!config.initialized) return;
    if (!config.config) { setLoading(false); return; }
    const client = getSupabaseClient(config.config);
    if (!client) { setLoading(false); return; }
    (async () => {
      setLoading(true); setError(null);
      const res = await getPublicPropertyBySlug(client, slug);
      if (cancelled) return;
      if (res.error) { setError(res.error); setLoading(false); return; }
      if (!res.data) { setProperty(null); setLoading(false); return; }
      const p = res.data;
      const [mediaRes, relatedRes] = await Promise.all([getMediaForProperty(client, p.id), getRelatedProperties(client, p)]);
      if (cancelled) return;
      setProperty(p);
      setMedia(mediaRes.data ?? []);
      if (mediaRes.error) setError(`Gallery could not be loaded: ${mediaRes.error}`);
      const rel = relatedRes.data ?? [];
      setRelated(rel);
      if (rel.length) {
        const rm = await getMediaForProperties(client, rel.map(r => r.id));
        if (!cancelled) setRelatedMedia(rm.data ?? []);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [slug, config.initialized, config.source, config.config?.url]);

  const wa = whatsappLink(settings.whatsapp, property ? `Hello, I would like to enquire about ${property.title}.` : undefined);

  if (!config.initialized || loading) return <div className="container section"><Loading label="Preparing the residence dossier…" /></div>;
  if (!config.config) return <div className="container section"><SetupState config={config} compact /></div>;
  if (error) return <div className="container section"><Notice tone="error" title="This residence could not be loaded">{error}</Notice><div className="mt-24"><Link href="/properties" className="btn btn-outline">Back to properties</Link></div></div>;
  if (!property) return <div className="container section"><EmptyState title="Residence not found" description="This listing may have been unpublished, renamed, or is no longer available." action={<Link href="/properties" className="btn btn-gold">Browse the collection</Link>} /></div>;

  const images = media.filter(m => m.kind === 'image');
  const gallery = images.length ? images : [];
  const price = `${formatPrice(property.price, property.currency)}${property.listing_type === 'rent' ? ` / ${property.price_period || 'month'}` : ''}`;
  // Google Maps share links cannot be embedded directly (X-Frame-Options).
  // resolvePropertyMap() normalises them, extracts coordinates, and always
  // provides a working external Google Maps link.
  const map = resolvePropertyMap(property);
  const share = async () => {
    try { await navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 2200); } catch { setCopied(false); }
  };

  return (
    <>
      <div className="page-hero">
        <div className="container">
          <nav className="breadcrumb" aria-label="Breadcrumb"><Link href="/">Home</Link> / <Link href="/properties">Properties</Link> / <span>{property.title}</span></nav>
          <div className="detail-head">
            <div>
              <p className="eyebrow no-line mt-8">{property.category} · {property.listing_type === 'buy' ? 'For Sale' : 'For Rent'}</p>
              <h1 className="mt-16">{property.title}</h1>
              <p className="flex center gap-8 small muted mt-16"><MapPin size={15} className="gold" />{[property.address, property.location, property.city, property.country].filter(Boolean).join(', ')}</p>
            </div>
            <div className="text-right">
              <p className="tiny muted uppercase mb-8">Asking</p>
              <p className="serif gold-gradient-text" style={{ fontSize: 'clamp(2rem,3.4vw,3rem)', lineHeight: 1 }}>{price}</p>
              <div className="flex gap-8 mt-16 wrap" style={{ justifyContent: 'flex-end' }}>
                {property.featured && <span className="badge badge-gold">Signature Collection</span>}
                <span className={`badge ${property.availability === 'available' ? 'badge-green' : 'badge-red'}`}>{property.availability}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <section className="section-sm">
        <div className="container">
          {gallery.length ? (
            <div className="detail-gallery">
              <button className="gallery-cell g-main" onClick={() => setLightbox(media.indexOf(gallery[0]))} aria-label="Open fullscreen gallery">
                <SmartImage src={gallery[0].public_url} alt={gallery[0].alt_text ?? property.title} priority />
                <span style={{ position: 'absolute', right: 16, bottom: 16 }} className="badge badge-muted"><Expand size={12} /> View gallery</span>
              </button>
              {gallery.slice(1, 3).map((m, i) => (
                <button key={m.id} className="gallery-cell" onClick={() => setLightbox(media.indexOf(m))} aria-label={`Open image ${i + 2}`}>
                  <SmartImage src={m.public_url} alt={m.alt_text ?? property.title} />
                  {i === 1 && gallery.length > 3 && <span className="gallery-more">+{gallery.length - 3}</span>}
                </button>
              ))}
              {gallery.length === 2 && <div className="gallery-cell" style={{ cursor: 'default', background: 'var(--surface)' }} />}
              {gallery.length === 1 && <><div className="gallery-cell" style={{ cursor: 'default', background: 'var(--surface)' }} /><div className="gallery-cell" style={{ cursor: 'default', background: 'var(--surface)' }} /></>}
            </div>
          ) : (
            <div className="detail-gallery" style={{ gridTemplateRows: '260px' }}><div className="gallery-cell" style={{ gridColumn: 'span 2', cursor: 'default' }}><SmartImage src={null} alt="No images available" /></div></div>
          )}

          {media.some(m => m.kind === 'video') && (
            <div className="mt-24 flex gap-12 wrap">
              {media.filter(m => m.kind === 'video').map(v => (
                <button key={v.id} className="btn btn-outline btn-sm" onClick={() => setLightbox(media.indexOf(v))}><PlayCircle size={15} /> Watch {v.alt_text || 'property film'}</button>
              ))}
            </div>
          )}

          <div className="detail-grid mt-48">
            <div>
              <div className="flex between center gap-16 wrap">
                <p className="eyebrow">The Residence</p>
                <div className="flex gap-8">
                  <button className="btn btn-ghost btn-sm" onClick={share}><Share2 size={14} /> {copied ? 'Link copied' : 'Share'}</button>
                  {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm"><MessageCircle size={14} /> WhatsApp</a>}
                </div>
              </div>
              <h2 className="h2 mt-16">{property.subtitle || 'An address of rare distinction'}</h2>
              <p className="lead mt-24" style={{ whiteSpace: 'pre-line' }}>{property.description || 'Further details of this residence are available on request from our private advisors.'}</p>

              <div className="spec-grid">
                <div className="spec-cell"><p className="k">Bedrooms</p><p className="v">{formatNumber(property.bedrooms)}</p></div>
                <div className="spec-cell"><p className="k">Bathrooms</p><p className="v">{formatNumber(property.bathrooms)}</p></div>
                <div className="spec-cell"><p className="k">Interior area</p><p className="v">{formatNumber(property.area_sqft)} <span className="small muted">sq ft</span></p></div>
                <div className="spec-cell"><p className="k">{property.year_built ? 'Built' : 'Plot area'}</p><p className="v">{property.year_built || formatNumber(property.lot_sqft)}</p></div>
              </div>

              {(property.amenities?.length > 0 || property.features?.length > 0) && (
                <div className="grid grid-2 gap-32 mt-32">
                  {property.amenities?.length > 0 && <div><h3 className="h4 mb-16">Amenities</h3><ul className="amenity-list">{property.amenities.map(a => <li key={a}><Check size={15} />{a}</li>)}</ul></div>}
                  {property.features?.length > 0 && <div><h3 className="h4 mb-16">Distinguishing features</h3><ul className="amenity-list">{property.features.map(a => <li key={a}><Layers3 size={15} />{a}</li>)}</ul></div>}
                </div>
              )}

              <div className="mt-48">
                <div className="flex between center gap-16 wrap mb-16"><h3 className="h4">Location</h3><span className="small muted flex center gap-8"><MapPin size={14} className="gold" />{[property.location, property.city, property.country].filter(Boolean).join(', ')}</span></div>
                {map ? <>
                  <div className={`map-frame ${map.provider === 'google' ? 'map-frame-google' : ''}`}>
                    <iframe src={map.embedUrl} title={`Map of ${property.title}`} loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade" allowFullScreen
                      sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-popups-to-escape-sandbox allow-presentation" />
                  </div>
                  <div className="map-actions">
                    <span className="tiny muted">{map.approximate
                      ? 'Approximate area — exact coordinates have not been published.'
                      : 'Exact coordinates published by the owner.'}</span>
                    <a href={map.externalUrl} target="_blank" rel="noopener noreferrer" className="link-gold">Open in Google Maps <ArrowUpRight size={14} /></a>
                  </div>
                  <p className="tiny muted mt-8">If the map does not appear, embedded maps may be blocked on your network — use “Open in Google Maps” above.</p>
                </> : <div className="map-frame flex center" style={{ justifyContent: 'center' }}><div className="text-center"><ShieldCheck size={28} className="gold" style={{ margin: '0 auto 12px' }} /><p className="small muted">Precise location details are shared privately on request.</p><Link href="/contact" className="link-gold mt-16">Request details <ArrowUpRight size={14} /></Link></div></div>}
              </div>

              <div className="flex gap-24 wrap mt-32 small muted">
                <span className="flex center gap-8"><CalendarDays size={14} className="gold" /> Listed {new Date(property.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</span>
                <span className="flex center gap-8"><BedDouble size={14} className="gold" />{formatNumber(property.bedrooms)} bedrooms</span>
                <span className="flex center gap-8"><Bath size={14} className="gold" />{formatNumber(property.bathrooms)} bathrooms</span>
                <span className="flex center gap-8"><Maximize2 size={14} className="gold" />{formatNumber(property.area_sqft)} sq ft</span>
              </div>
            </div>

            <aside className="sticky-card">
              <InquiryForm propertyId={property.id} propertyTitle={property.title} settings={settings} />
              <div className="admin-card mt-16" style={{ padding: 20 }}>
                <p className="eyebrow no-line mb-16">At a glance</p>
                <div className="grid gap-12 small">
                  <div className="flex between"><span className="muted">Reference</span><span className="gold">IR-{property.id.slice(0, 8).toUpperCase()}</span></div>
                  <div className="flex between"><span className="muted">Collection</span><span>{property.category}</span></div>
                  <div className="flex between"><span className="muted">Availability</span><span>{property.availability}</span></div>
                  <div className="flex between"><span className="muted">Tenure</span><span>{property.listing_type === 'buy' ? 'Freehold / Sale' : 'Lease / Rent'}</span></div>
                </div>
                <Link href="/contact" className="btn btn-ghost btn-block btn-sm mt-24"><MessageCircle size={14} /> Speak to an advisor</Link>
              </div>
            </aside>
          </div>

          {related.length > 0 && (
            <div className="mt-48">
              <div className="section-head" style={{ marginBottom: 28 }}><div><p className="eyebrow">You may also consider</p><h2 className="h2 mt-16">Related residences</h2></div><Link href="/properties" className="link-gold">View all <ArrowUpRight /></Link></div>
              <div className="property-grid">{related.map(r => <PropertyCard key={r.id} property={r} media={relatedMedia.filter(m => m.property_id === r.id)} />)}</div>
            </div>
          )}
        </div>
      </section>

      {lightbox !== null && media.length > 0 && <Lightbox media={media} index={lightbox} onClose={() => setLightbox(null)} onIndex={setLightbox} />}
    </>
  );
}
