import type { Property, SiteSettings } from './types';

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90) || 'property';
}

/** Compact, locale-aware currency formatting. INR by default for this brand. */
export function formatPrice(value: number | null | undefined, currency = 'INR', compact = false): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'Price on request';
  const n = Number(value);
  try {
    const locale = (currency || 'INR').toUpperCase() === 'INR' ? 'en-IN' : 'en-US';
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency || 'INR',
      maximumFractionDigits: 0,
      notation: compact && n >= 10_000_000 ? 'compact' : 'standard',
    }).format(n);
  } catch {
    return `${currency} ${n.toLocaleString('en-IN')}`;
  }
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('en-IN').format(value);
}

export function formatDate(value: string | null | undefined, withTime = false): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(d);
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let n = bytes, i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function truncate(value: string | null | undefined, length = 160): string {
  if (!value) return '';
  return value.length > length ? `${value.slice(0, length - 1).trimEnd()}…` : value;
}

export function parseList(value: string | null | undefined): string[] {
  if (!value) return [];
  return value.split(/[\n,]/).map(s => s.trim()).filter(Boolean);
}

export function whatsappLink(number: string | null | undefined, message?: string): string | null {
  if (!number) return null;
  const digits = number.replace(/[^0-9]/g, '');
  if (digits.length < 8) return null;
  return `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
}

export function coverImage(property: Property, media?: { public_url: string; is_cover: boolean }[]): string | null {
  const cover = media?.find(m => m.is_cover)?.public_url ?? media?.[0]?.public_url;
  return cover || (property as Property & { cover_image?: string }).cover_image || null;
}

export const DEFAULT_SETTINGS: SiteSettings = {
  id: 1,
  business_name: 'Imperial Royal',
  tagline: 'Extraordinary Residences. Enduring Legacy.',
  logo_url: null,
  favicon_url: null,
  contact_email: 'concierge@imperialroyal.com',
  contact_phone: '+91 98764 00000',
  whatsapp: '+91 98764 00000',
  address: 'The Imperial House, Guwahati, Assam, India',
  hero_heading: 'Where Exceptional Living Meets Timeless Elegance.',
  hero_subheading: 'Discover extraordinary residences, prestigious addresses and exceptional real estate opportunities.',
  hero_image: null,
  social: { instagram: '', linkedin: '', facebook: '', youtube: '' },
  footer_text: 'A private collection of the world’s most distinguished residences, curated with discretion and absolute integrity.',
  footer_note: 'Imperial Royal Real Estate. Crafted for a legacy.',
  seo_title: 'Imperial Royal | Extraordinary Residences & Prestigious Addresses',
  seo_description: 'Discover an exceptional collection of luxury residences, estates and penthouses. A private, discreet real estate experience.',
  theme: { accent: '#C6A45A', density: 'comfortable' },
  updated_at: '',
};

export const PROPERTY_CATEGORIES = [
  'Villa', 'Penthouse', 'Estate', 'Mansion', 'Apartment', 'Waterfront', 'Heritage', 'Land',
] as const;

export const AMENITY_SUGGESTIONS = [
  'Private infinity pool', 'Concierge service', 'Private elevator', 'Home theatre',
  'Wine cellar', 'Spa & sauna', 'Gymnasium', 'Landscaped gardens', 'Staff quarters',
  'Smart home automation', 'Private garage', 'Helipad', '24/7 security', 'River view',
  'Sea view', 'Terrace', 'Fireplace', 'Italian marble', 'Private beach access',
];

export function safeUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const u = new URL(value);
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(u.protocol) ? u.toString() : null;
  } catch { return null; }
}

export function shortHash(value: string): string {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = ((h << 5) - h + value.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

export function errorMessage(err: unknown): string {
  if (!err) return 'An unknown error occurred.';
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && 'message' in err) return String((err as { message: unknown }).message);
  return 'An unknown error occurred.';
}
