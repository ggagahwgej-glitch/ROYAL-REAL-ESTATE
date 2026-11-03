/* Curated editorial content for the public marketing surfaces.
   Property listings AND client testimonials are NEVER faked — they come from Supabase.
   Testimonials are owner-published records in site_settings.testimonials. */
export interface Category { name: string; caption: string; image: string; href: string }
export interface Destination { name: string; country: string; count: string; image: string }
export const CATEGORIES: Category[] = [
  { name: 'Signature Villas', caption: 'Private estates of rare distinction', image: '/images/coastal-villa.jpg', href: '/properties?category=Villa' },
  { name: 'Imperial Penthouses', caption: 'The city, seen from above', image: '/images/penthouse.jpg', href: '/properties?category=Penthouse' },
  { name: 'Grand Estates', caption: 'Land, lineage and legacy', image: '/images/hero-estate.jpg', href: '/properties?category=Estate' },
  { name: 'Heritage Residences', caption: 'History, beautifully preserved', image: '/images/interior-gallery.jpg', href: '/properties?category=Heritage' },
];

export const DESTINATIONS: Destination[] = [
  { name: 'The Mediterranean', country: 'Coastal Europe', count: 'A curated coastline', image: '/images/coastal-villa.jpg' },
  { name: 'Metropolitan Skylines', country: 'Global Capitals', count: 'Above the ordinary', image: '/images/penthouse.jpg' },
  { name: 'The Imperial Gardens', country: 'Private Enclaves', count: 'Space to breathe', image: '/images/garden-residence.png' },
];

export const WHY_US = [
  { title: 'A Curated Collection', body: 'Every residence is personally inspected and admitted by invitation. We represent fewer properties, and know each of them intimately.' },
  { title: 'Absolute Discretion', body: 'Private viewings, considered introductions and complete confidentiality are the foundation of every relationship we hold.' },
  { title: 'Generational Expertise', body: 'Decades of combined experience in landmark residences, heritage assets and cross-border acquisitions.' },
  { title: 'An Enduring Partnership', body: 'Our responsibility continues long after completion — from relocation to stewardship and future portfolio advice.' },
];

export const BRAND_PILLARS = [
  { number: '01', title: 'Legacy', body: 'Founded on the belief that a great residence is inherited, not merely purchased.' },
  { number: '02', title: 'Judgement', body: 'We say no far more often than yes. Curation is our most important service.' },
  { number: '03', title: 'Presence', body: 'A quiet, international network of owners, architects and advisors.' },
];
