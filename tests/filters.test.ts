import { describe, expect, it } from 'vitest';
import {
  activeFilterCount, applyFilters, describeFilters, filterAndPaginate, filtersToSearch,
  paginate, parseFiltersFromSearch, sortProperties,
} from '../lib/properties/filters';
import type { Property, PropertyFilters } from '../lib/types';

const base: Property = {
  id: 'a', owner_id: null, slug: 'a', title: 'Aurelian Estate', subtitle: null, description: 'A grand residence',
  listing_type: 'buy', category: 'Villa', status: 'published', availability: 'available',
  price: 50_000_000, currency: 'INR', price_period: null, location: 'Ridge', city: 'Guwahati', address: null,
  country: 'India', bedrooms: 5, bathrooms: 4, area_sqft: 6200, lot_sqft: null, year_built: 2020,
  featured: true, amenities: [], features: [], latitude: null, longitude: null, map_url: null,
  meta_title: null, meta_description: null, created_at: '2025-01-02T00:00:00Z', updated_at: '2025-01-02T00:00:00Z',
};
const all: Property[] = [
  base,
  { ...base, id: 'b', slug: 'b', title: 'Azure Penthouse', listing_type: 'rent', category: 'Penthouse', price: 900_000, bedrooms: 3, bathrooms: 3, area_sqft: 3200, featured: false, city: 'Mumbai', created_at: '2025-03-01T00:00:00Z' },
  { ...base, id: 'c', slug: 'c', title: 'Cedar Manor', status: 'draft', price: 20_000_000, featured: false, created_at: '2025-04-01T00:00:00Z' },
  { ...base, id: 'd', slug: 'd', title: 'Dune House', availability: 'sold', price: 80_000_000, bedrooms: 6, area_sqft: 9000, featured: false, created_at: '2025-02-01T00:00:00Z' },
];

describe('property filtering', () => {
  it('never shows drafts to the public', () => {
    expect(applyFilters(all, {}).map(p => p.id)).toEqual(['a', 'b', 'd']);
  });
  it('filters by listing type, category, price, beds, baths, area, city and availability', () => {
    expect(applyFilters(all, { listingType: 'rent' }).map(p => p.id)).toEqual(['b']);
    expect(applyFilters(all, { category: 'Villa' }).map(p => p.id)).toEqual(['a', 'd']);
    expect(applyFilters(all, { minPrice: 60_000_000 }).map(p => p.id)).toEqual(['d']);
    expect(applyFilters(all, { bedrooms: 6 }).map(p => p.id)).toEqual(['d']);
    expect(applyFilters(all, { bathrooms: 4 }).map(p => p.id)).toEqual(['a', 'd']);
    expect(applyFilters(all, { minArea: 7000 }).map(p => p.id)).toEqual(['d']);
    expect(applyFilters(all, { location: 'mumbai' }).map(p => p.id)).toEqual(['b']);
    expect(applyFilters(all, { availability: 'sold' }).map(p => p.id)).toEqual(['d']);
    expect(applyFilters(all, { featured: true }).map(p => p.id)).toEqual(['a']);
  });
  it('supports free-text search across title, city and description', () => {
    expect(applyFilters(all, { q: 'penthouse' }).map(p => p.id)).toEqual(['b']);
    expect(applyFilters(all, { q: 'grand' }).map(p => p.id)).toContain('a');
  });
});

describe('sorting and pagination', () => {
  it('sorts by price, area and title', () => {
    expect(sortProperties(applyFilters(all, {}), 'price-asc').map(p => p.id)).toEqual(['b', 'a', 'd']);
    expect(sortProperties(applyFilters(all, {}), 'area-desc').map(p => p.id)).toEqual(['d', 'a', 'b']);
    expect(sortProperties(applyFilters(all, {}), 'title')[0].id).toBe('a');
  });
  it('defaults to featured-first ordering', () => {
    expect(sortProperties(applyFilters(all, {}), 'newest')[0].id).toBe('a');
  });
  it('paginates with a minimum of one page', () => {
    const r = paginate([1, 2, 3, 4, 5], 2, 2);
    expect(r.items).toEqual([3, 4]);
    expect(r.pages).toBe(3);
    expect(paginate([], 1, 9).pages).toBe(1);
    expect(filterAndPaginate(all, { perPage: 2 }).items).toHaveLength(2);
  });
});

describe('URL filter state', () => {
  const f: PropertyFilters = { q: 'villa', listingType: 'buy', category: 'Villa', minPrice: 1000, bedrooms: 3, sort: 'price-desc', page: 2, featured: true };
  it('round-trips through a query string', () => {
    const query = filtersToSearch(f);
    expect(query).toContain('type=buy');
    expect(query).toContain('featured=1');
    const parsed = parseFiltersFromSearch(new URLSearchParams(query));
    expect(parsed.q).toBe('villa');
    expect(parsed.listingType).toBe('buy');
    expect(parsed.minPrice).toBe(1000);
    expect(parsed.sort).toBe('price-desc');
    expect(parsed.page).toBe(2);
    expect(parsed.featured).toBe(true);
  });
  it('ignores invalid enum values', () => {
    const parsed = parseFiltersFromSearch(new URLSearchParams('type=hack&sort=nonsense&page=abc'));
    expect(parsed.listingType).toBe('all');
    expect(parsed.sort).toBe('newest');
    expect(parsed.page).toBe(1);
  });
  it('counts active filters and builds chips', () => {
    expect(activeFilterCount(f)).toBeGreaterThanOrEqual(6);
    expect(describeFilters(f)).toContain('3+ bedrooms');
    expect(activeFilterCount({})).toBe(0);
  });
});
