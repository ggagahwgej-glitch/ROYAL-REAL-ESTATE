/* ==================================================================
   Map resolution — no API key required, works with Google Maps links.

   Problem this solves: a Google Maps "Share" link
   (https://maps.app.goo.gl/... or https://www.google.com/maps/place/...)
   sends X-Frame-Options: DENY, so using it directly as an <iframe src>
   renders a blank grey box. We normalise common Google/OSM links into a
   genuinely embeddable URL, extract coordinates where possible, and ALWAYS
   expose a working "Open in Google Maps" link.

   Only https URLs on known map hosts are ever placed in an iframe.
   Arbitrary / javascript: / data: URLs are rejected.
================================================================== */
import type { Property } from './types';

export type MapProvider = 'google' | 'openstreetmap';

export interface MapResolution {
  embedUrl: string;
  externalUrl: string;
  provider: MapProvider;
  /** True when the map is derived from an address/city rather than exact coordinates. */
  approximate: boolean;
  coords: { lat: number; lng: number } | null;
}

interface MapInput {
  map_url?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  location?: string | null;
  city?: string | null;
  country?: string | null;
}

// Tight allowlist: google.<ccTLD>, google.co.<cc>, google.com.<cc>, maps.google.*
// A permissive google\.[a-z.]+ would also match google.evil.com.
const GOOGLE_HOSTS = /^(?:www\.)?(?:maps\.)?google\.(?:com(?:\.[a-z]{2})?|co\.[a-z]{2}|[a-z]{2})$/i;
const GOOGLE_SHORT_HOSTS = /^(maps\.app\.goo\.gl|goo\.gl)$/i;
const OSM_HOSTS = /^(www\.)?openstreetmap\.(org|com)$/i;

function httpsUrl(raw: string | null | undefined): URL | null {
  if (!raw) return null;
  try {
    const u = new URL(String(raw).trim());
    return u.protocol === 'https:' ? u : null;
  } catch { return null; }
}

function finite(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

/** Pull coordinates out of the common Google Maps URL shapes. */
export function extractCoordinates(raw: string | null | undefined): { lat: number; lng: number } | null {
  const u = httpsUrl(raw);
  if (!u) return null;
  const text = `${u.pathname}${u.search}${u.hash}`;
  // /maps/place/…/@26.1445,91.7362,15z  and  /maps/@26.14,91.73,12z
  const at = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(text);
  if (at) {
    const lat = finite(at[1]), lng = finite(at[2]);
    if (lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
  }
  // Google embed pb= payloads use !3d<lat>!4d<lng>
  const pb = /!3d(-?\d+(?:\.\d+)?)[^!]*!4d(-?\d+(?:\.\d+)?)/.exec(text);
  if (pb) {
    const lat = finite(pb[1]), lng = finite(pb[2]);
    if (lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
  }
  // ?q=26.1445,91.7362  or  ?center=26.1445,91.7362
  const q = u.searchParams.get('q') ?? u.searchParams.get('center') ?? u.searchParams.get('ll');
  if (q) {
    const pair = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/.exec(q);
    if (pair) {
      const lat = finite(pair[1]), lng = finite(pair[2]);
      if (lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
    }
  }
  return null;
}

function addressQuery(p: MapInput): string {
  return [p.address, p.location, p.city, p.country]
    .map(v => (v ?? '').trim())
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .join(', ');
}

function googleExternal(coords: { lat: number; lng: number } | null, query: string): string {
  const q = coords ? `${coords.lat},${coords.lng}` : query;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q || 'India')}`;
}

function googleQueryEmbed(coords: { lat: number; lng: number } | null, query: string): string {
  const q = coords ? `${coords.lat},${coords.lng}` : query;
  return `https://maps.google.com/maps?q=${encodeURIComponent(q || 'India')}&z=${coords ? 15 : 12}&output=embed`;
}

function osmEmbed(lat: number, lng: number): string {
  const dLon = 0.012, dLat = 0.008;
  const bbox = [lng - dLon, lat - dLat, lng + dLon, lat + dLat].map(n => n.toFixed(6)).join('%2C');
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat.toFixed(6)}%2C${lng.toFixed(6)}`;
}

/**
 * Resolve the best embeddable map for a property. Returns null only when
 * there is no usable location information at all.
 */
export function resolvePropertyMap(property: MapInput): MapResolution | null {
  const query = addressQuery(property);
  const rawLat = finite(property.latitude);
  const rawLng = finite(property.longitude);
  const hasCoords = rawLat !== null && rawLng !== null && Math.abs(rawLat) <= 90 && Math.abs(rawLng) <= 180;
  const coords = hasCoords ? { lat: rawLat!, lng: rawLng! } : extractCoordinates(property.map_url);
  const externalUrl = googleExternal(coords, query);
  const u = httpsUrl(property.map_url);

  // 1. Owner-supplied URL on a recognised map host.
  if (u) {
    const host = u.hostname;
    const isGoogle = GOOGLE_HOSTS.test(host) || GOOGLE_SHORT_HOSTS.test(host);
    const isOsm = OSM_HOSTS.test(host);
    if (isGoogle) {
      // "Embed a map" URLs are already framed-safe.
      if (u.pathname.startsWith('/maps/embed') || u.pathname.startsWith('/maps/embed/')) {
        return { embedUrl: u.toString(), externalUrl, provider: 'google', approximate: !coords, coords };
      }
      // Any other Google share/place link: rebuild as a keyless query embed.
      // If coordinates were found, prefer the reliable OSM tile embed.
      if (coords) return { embedUrl: osmEmbed(coords.lat, coords.lng), externalUrl, provider: 'openstreetmap', approximate: false, coords };
      return { embedUrl: googleQueryEmbed(null, query || u.searchParams.get('q') || ''), externalUrl, provider: 'google', approximate: true, coords: null };
    }
    if (isOsm) {
      if (u.pathname.includes('/export/embed.html')) {
        return { embedUrl: u.toString(), externalUrl, provider: 'openstreetmap', approximate: !coords, coords };
      }
      if (coords) return { embedUrl: osmEmbed(coords.lat, coords.lng), externalUrl, provider: 'openstreetmap', approximate: false, coords };
      // A plain OSM browse link is not embeddable; fall through to query embed.
    }
    // Unknown/unsafe host: never iframe it, but keep the external Google link.
  }

  // 2. Exact coordinates from the property record.
  if (coords) return { embedUrl: osmEmbed(coords.lat, coords.lng), externalUrl, provider: 'openstreetmap', approximate: false, coords };

  // 3. Approximate map from the address/city (Google geocodes the query).
  if (query) return { embedUrl: googleQueryEmbed(null, query), externalUrl, provider: 'google', approximate: true, coords: null };

  return null;
}

/** Validate an owner-entered map URL. Returns an error string or null. */
export function validateMapUrl(raw: string | null | undefined): string | null {
  const value = (raw ?? '').trim();
  if (!value) return null;
  const u = httpsUrl(value);
  if (!u) return 'Enter a full https:// Google Maps or OpenStreetMap link (other URL schemes are not allowed in an embedded map).';
  const host = u.hostname;
  if (!(GOOGLE_HOSTS.test(host) || GOOGLE_SHORT_HOSTS.test(host) || OSM_HOSTS.test(host))) {
    return 'Only Google Maps and OpenStreetMap links are supported for embedded maps.';
  }
  return null;
}
