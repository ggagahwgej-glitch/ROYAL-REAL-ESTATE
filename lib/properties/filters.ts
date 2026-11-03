/* Pure property filtering / sorting / pagination helpers (unit tested). */
import type { PagedResult, Property, PropertyFilters } from '../types';

export function activeFilterCount(filters: PropertyFilters): number {
  let n = 0;
  if (filters.q) n++;
  if (filters.listingType && filters.listingType !== 'all') n++;
  if (filters.location) n++;
  if (filters.category) n++;
  if (filters.minPrice != null) n++;
  if (filters.maxPrice != null) n++;
  if (filters.bedrooms != null) n++;
  if (filters.bathrooms != null) n++;
  if (filters.minArea != null) n++;
  if (filters.availability && filters.availability !== 'all') n++;
  if (filters.featured) n++;
  return n;
}

export function applyFilters(items: Property[], filters: PropertyFilters): Property[] {
  const q = (filters.q ?? '').trim().toLowerCase();
  const location = (filters.location ?? '').trim().toLowerCase();
  return items.filter(p => {
    if (p.status !== 'published') return false;
    if (filters.listingType && filters.listingType !== 'all' && p.listing_type !== filters.listingType) return false;
    if (filters.category && p.category !== filters.category) return false;
    if (filters.availability && filters.availability !== 'all' && p.availability !== filters.availability) return false;
    if (filters.featured && !p.featured) return false;
    if (location && !`${p.city} ${p.location} ${p.country}`.toLowerCase().includes(location)) return false;
    if (filters.minPrice != null && Number(p.price) < filters.minPrice) return false;
    if (filters.maxPrice != null && Number(p.price) > filters.maxPrice) return false;
    if (filters.bedrooms != null && Number(p.bedrooms) < filters.bedrooms) return false;
    if (filters.bathrooms != null && Number(p.bathrooms) < filters.bathrooms) return false;
    if (filters.minArea != null && Number(p.area_sqft) < filters.minArea) return false;
    if (q) {
      const haystack = `${p.title} ${p.subtitle ?? ''} ${p.city} ${p.location} ${p.category} ${p.description ?? ''}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

export function sortProperties(items: Property[], sort: PropertyFilters['sort']): Property[] {
  const copy = [...items];
  switch (sort) {
    case 'price-asc': return copy.sort((a, b) => a.price - b.price);
    case 'price-desc': return copy.sort((a, b) => b.price - a.price);
    case 'area-desc': return copy.sort((a, b) => b.area_sqft - a.area_sqft);
    case 'title': return copy.sort((a, b) => a.title.localeCompare(b.title));
    default: return copy.sort((a, b) => Number(b.featured) - Number(a.featured) || b.created_at.localeCompare(a.created_at));
  }
}

export function paginate<T>(items: T[], page = 1, perPage = 9): PagedResult<T> {
  const p = Math.max(1, page);
  return {
    items: items.slice((p - 1) * perPage, p * perPage),
    total: items.length,
    page: p,
    perPage,
    pages: Math.max(1, Math.ceil(items.length / perPage)),
  };
}

export function filterAndPaginate(items: Property[], filters: PropertyFilters): PagedResult<Property> {
  const filtered = sortProperties(applyFilters(items, filters), filters.sort);
  return paginate(filtered, filters.page ?? 1, filters.perPage ?? 9);
}

export function describeFilters(filters: PropertyFilters): string[] {
  const parts: string[] = [];
  if (filters.q) parts.push(`“${filters.q}”`);
  if (filters.listingType && filters.listingType !== 'all') parts.push(filters.listingType === 'buy' ? 'For sale' : 'For rent');
  if (filters.category) parts.push(filters.category);
  if (filters.location) parts.push(filters.location);
  if (filters.bedrooms) parts.push(`${filters.bedrooms}+ bedrooms`);
  if (filters.bathrooms) parts.push(`${filters.bathrooms}+ bathrooms`);
  if (filters.minArea) parts.push(`${filters.minArea.toLocaleString('en-IN')}+ sq ft`);
  if (filters.featured) parts.push('Signature collection');
  return parts;
}

export function parseFiltersFromSearch(params: URLSearchParams | Record<string, string | string[] | undefined>): PropertyFilters {
  const get = (key: string): string | undefined => {
    if (params instanceof URLSearchParams) return params.get(key) ?? undefined;
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const num = (key: string): number | null => {
    const raw = get(key);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };
  const listing = get('type');
  const availability = get('availability');
  const sort = get('sort');
  return {
    q: get('q'),
    listingType: listing === 'buy' || listing === 'rent' ? listing : 'all',
    location: get('location'),
    category: get('category'),
    minPrice: num('minPrice'),
    maxPrice: num('maxPrice'),
    bedrooms: num('bedrooms'),
    bathrooms: num('bathrooms'),
    minArea: num('minArea'),
    availability: (['available', 'reserved', 'sold', 'rented'].includes(availability ?? '') ? availability : 'all') as PropertyFilters['availability'],
    featured: get('featured') === '1' || get('featured') === 'true',
    sort: (['newest', 'price-asc', 'price-desc', 'area-desc', 'title'].includes(sort ?? '') ? sort : 'newest') as PropertyFilters['sort'],
    page: num('page') ?? 1,
  };
}

export function filtersToSearch(filters: PropertyFilters): string {
  const p = new URLSearchParams();
  if (filters.q) p.set('q', filters.q);
  if (filters.listingType && filters.listingType !== 'all') p.set('type', filters.listingType);
  if (filters.location) p.set('location', filters.location);
  if (filters.category) p.set('category', filters.category);
  if (filters.minPrice != null) p.set('minPrice', String(filters.minPrice));
  if (filters.maxPrice != null) p.set('maxPrice', String(filters.maxPrice));
  if (filters.bedrooms != null) p.set('bedrooms', String(filters.bedrooms));
  if (filters.bathrooms != null) p.set('bathrooms', String(filters.bathrooms));
  if (filters.minArea != null) p.set('minArea', String(filters.minArea));
  if (filters.availability && filters.availability !== 'all') p.set('availability', filters.availability);
  if (filters.featured) p.set('featured', '1');
  if (filters.sort && filters.sort !== 'newest') p.set('sort', filters.sort);
  if (filters.page && filters.page > 1) p.set('page', String(filters.page));
  return p.toString();
}
