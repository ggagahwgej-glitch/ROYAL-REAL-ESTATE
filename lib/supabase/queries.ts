/* All database operations. Every function receives a client from
   lib/supabase/factory.ts — there is no other way to reach Supabase. */
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Inquiry, InquiryStatus, PagedResult, Property, PropertyFilters, PropertyInput,
  PropertyMedia, QueryResult, SiteSettings,
} from '../types';
import { DEFAULT_SETTINGS, errorMessage, slugify } from '../utils';

export type Client = SupabaseClient;

export function ok<T>(data: T): QueryResult<T> { return { data, error: null }; }
export function fail<T>(error: unknown): QueryResult<T> { return { data: null, error: errorMessage(error) }; }

function sanitizeSearch(value: string): string {
  return value.replace(/[%,().*\\]/g, ' ').trim().slice(0, 80);
}

export interface PublicPropertiesOptions extends PropertyFilters {
  forceAll?: boolean;
}

/** Published listings only. Filtering + sorting + pagination happen in the database. */
export async function getPublicProperties(client: Client, filters: PublicPropertiesOptions = {}): Promise<QueryResult<PagedResult<Property>>> {
  try {
    const page = Math.max(1, filters.page ?? 1);
    const perPage = Math.min(48, Math.max(1, filters.perPage ?? 9));
    let query = client.from('properties').select('*', { count: 'exact' }).eq('status', 'published');

    if (filters.listingType && filters.listingType !== 'all') query = query.eq('listing_type', filters.listingType);
    if (filters.category) query = query.eq('category', filters.category);
    if (filters.availability && filters.availability !== 'all') query = query.eq('availability', filters.availability);
    if (filters.featured) query = query.eq('featured', true);
    if (filters.location) query = query.ilike('city', `%${sanitizeSearch(filters.location)}%`);
    if (filters.minPrice) query = query.gte('price', filters.minPrice);
    if (filters.maxPrice) query = query.lte('price', filters.maxPrice);
    if (filters.bedrooms) query = query.gte('bedrooms', filters.bedrooms);
    if (filters.bathrooms) query = query.gte('bathrooms', filters.bathrooms);
    if (filters.minArea) query = query.gte('area_sqft', filters.minArea);
    if (filters.q) {
      const q = sanitizeSearch(filters.q);
      if (q) query = query.or(`title.ilike.%${q}%,city.ilike.%${q}%,location.ilike.%${q}%,category.ilike.%${q}%,description.ilike.%${q}%`);
    }
    switch (filters.sort) {
      case 'price-asc': query = query.order('price', { ascending: true }); break;
      case 'price-desc': query = query.order('price', { ascending: false }); break;
      case 'area-desc': query = query.order('area_sqft', { ascending: false }); break;
      case 'title': query = query.order('title', { ascending: true }); break;
      default: query = query.order('featured', { ascending: false }).order('created_at', { ascending: false });
    }
    const from = (page - 1) * perPage;
    const { data, error, count } = await query.range(from, from + perPage - 1);
    if (error) return fail(error);
    const total = count ?? 0;
    return ok({ items: (data ?? []) as Property[], total, page, perPage, pages: Math.max(1, Math.ceil(total / perPage)) });
  } catch (e) { return fail(e); }
}

export async function getPublicPropertyBySlug(client: Client, slug: string): Promise<QueryResult<Property | null>> {
  try {
    const { data, error } = await client.from('properties').select('*').eq('slug', slug).eq('status', 'published').maybeSingle();
    if (error) return fail(error);
    return ok((data as Property | null) ?? null);
  } catch (e) { return fail(e); }
}

export async function getPublicPropertyById(client: Client, id: string): Promise<QueryResult<Property | null>> {
  try {
    const { data, error } = await client.from('properties').select('*').eq('id', id).eq('status', 'published').maybeSingle();
    if (error) return fail(error);
    return ok((data as Property | null) ?? null);
  } catch (e) { return fail(e); }
}

export async function getMediaForProperties(client: Client, ids: string[]): Promise<QueryResult<PropertyMedia[]>> {
  if (!ids.length) return ok([]);
  try {
    const { data, error } = await client.from('property_media').select('*').in('property_id', ids)
      .order('is_cover', { ascending: false }).order('position', { ascending: true });
    if (error) return fail(error);
    return ok((data ?? []) as PropertyMedia[]);
  } catch (e) { return fail(e); }
}

export async function getMediaForProperty(client: Client, propertyId: string): Promise<QueryResult<PropertyMedia[]>> {
  try {
    const { data, error } = await client.from('property_media').select('*').eq('property_id', propertyId)
      .order('is_cover', { ascending: false }).order('position', { ascending: true });
    if (error) return fail(error);
    return ok((data ?? []) as PropertyMedia[]);
  } catch (e) { return fail(e); }
}

export async function getRelatedProperties(client: Client, property: Property, limit = 3): Promise<QueryResult<Property[]>> {
  try {
    const { data, error } = await client.from('properties').select('*').eq('status', 'published')
      .neq('id', property.id).or(`city.eq.${sanitizeSearch(property.city)},category.eq.${sanitizeSearch(property.category)}`)
      .limit(limit);
    if (error) return fail(error);
    if (data?.length) return ok(data as Property[]);
    const fallback = await client.from('properties').select('*').eq('status', 'published').neq('id', property.id).limit(limit);
    if (fallback.error) return fail(fallback.error);
    return ok((fallback.data ?? []) as Property[]);
  } catch (e) { return fail(e); }
}

export async function getDistinctCities(client: Client): Promise<QueryResult<string[]>> {
  try {
    const { data, error } = await client.from('properties').select('city').eq('status', 'published');
    if (error) return fail(error);
    const cities = Array.from(new Set((data ?? []).map(r => String(r.city)).filter(Boolean))).sort();
    return ok(cities);
  } catch (e) { return fail(e); }
}

export async function getSiteSettings(client: Client): Promise<QueryResult<SiteSettings>> {
  try {
    const { data, error } = await client.from('site_settings').select('*').eq('id', 1).maybeSingle();
    // Still render with brand defaults, but never hide the database failure.
    if (error) return { data: { ...DEFAULT_SETTINGS }, error: `Public website settings could not be read (${error.message}). The application schema may not be installed yet.` };
    const row = (data as Partial<SiteSettings> | null) ?? {};
    const rawTestimonials = row.testimonials;
    const testimonials = Array.isArray(rawTestimonials)
      ? rawTestimonials.filter((t): t is SiteSettings['testimonials'][number] =>
          !!t && typeof t.quote === 'string' && t.quote.trim().length > 0 && typeof t.name === 'string' && t.name.trim().length > 0)
      : [];
    return ok({ ...DEFAULT_SETTINGS, ...row,
      testimonials,
      social: { ...DEFAULT_SETTINGS.social, ...(row.social ?? {}) },
      theme: { ...DEFAULT_SETTINGS.theme, ...(row.theme ?? {}) } });
  } catch (e) { return { data: { ...DEFAULT_SETTINGS }, error: `Website settings could not be loaded: ${errorMessage(e)}` }; }
}

export interface InquiryInput {
  property_id?: string | null;
  name: string;
  email: string;
  phone?: string | null;
  message: string;
  source?: string | null;
}

export async function submitInquiry(client: Client, input: InquiryInput): Promise<QueryResult<{ id: string }>> {
  try {
    const { data, error } = await client.from('inquiries').insert({
      property_id: input.property_id ?? null,
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      phone: input.phone?.trim() || null,
      message: input.message.trim(),
      source: input.source ?? 'website',
      status: 'new',
    }).select('id').single();
    if (error) return fail(error);
    return ok({ id: String((data as { id: string }).id) });
  } catch (e) { return fail(e); }
}

/* ------------------------- Owner operations ------------------------- */

export async function getOwnerProperties(client: Client): Promise<QueryResult<Property[]>> {
  try {
    const { data, error } = await client.from('properties').select('*').order('created_at', { ascending: false });
    if (error) return fail(error);
    return ok((data ?? []) as Property[]);
  } catch (e) { return fail(e); }
}

export async function getOwnerProperty(client: Client, id: string): Promise<QueryResult<Property | null>> {
  try {
    const { data, error } = await client.from('properties').select('*').eq('id', id).maybeSingle();
    if (error) return fail(error);
    return ok((data as Property | null) ?? null);
  } catch (e) { return fail(e); }
}

function propertyPayload(input: PropertyInput): Record<string, unknown> {
  const payload: Record<string, unknown> = { ...input };
  delete payload.id;
  delete payload.owner_id;
  delete payload.created_at;
  delete payload.updated_at;
  if (input.title && !input.slug) payload.slug = slugify(input.title);
  if (input.slug) payload.slug = slugify(input.slug);
  return payload;
}

export async function createProperty(client: Client, input: PropertyInput): Promise<QueryResult<Property>> {
  try {
    const slug = slugify(input.slug || input.title);
    const { data, error } = await client.from('properties').insert({ ...propertyPayload(input), slug })
      .select('*').single();
    if (error) return fail(error);
    return ok(data as Property);
  } catch (e) { return fail(e); }
}

export async function updateProperty(client: Client, id: string, input: PropertyInput): Promise<QueryResult<Property>> {
  try {
    const { data, error } = await client.from('properties').update(propertyPayload(input)).eq('id', id).select('*').single();
    if (error) return fail(error);
    return ok(data as Property);
  } catch (e) { return fail(e); }
}

export async function deleteProperty(client: Client, id: string): Promise<QueryResult<null>> {
  try {
    const { error } = await client.from('properties').delete().eq('id', id);
    if (error) return fail(error);
    return ok(null);
  } catch (e) { return fail(e); }
}

export async function duplicateProperty(client: Client, property: Property): Promise<QueryResult<Property>> {
  const copy: PropertyInput = {
    ...property,
    title: `${property.title} (Copy)`,
    slug: `${slugify(property.slug)}-copy-${Date.now().toString(36).slice(-5)}`,
    status: 'draft',
    featured: false,
  };
  return createProperty(client, copy);
}

export interface DashboardStats {
  total: number;
  available: number;
  sold: number;
  rental: number;
  featured: number;
  inquiries: number;
  unread: number;
}

const EMPTY_STATS: DashboardStats = { total: 0, available: 0, sold: 0, rental: 0, featured: 0, inquiries: 0, unread: 0 };

async function count(client: Client, table: string, column: string, value?: string | boolean): Promise<number> {
  let query = client.from(table).select('*', { count: 'exact', head: true });
  if (value !== undefined) query = query.eq(column, value);
  const { count: n, error } = await query;
  if (error) throw error;
  return n ?? 0;
}

export async function getDashboardStats(client: Client): Promise<QueryResult<DashboardStats>> {
  try {
    const [total, available, sold, rental, featured, inquiries, unread] = await Promise.all([
      count(client, 'properties', 'id'),
      count(client, 'properties', 'availability', 'available'),
      count(client, 'properties', 'availability', 'sold'),
      count(client, 'properties', 'listing_type', 'rent'),
      count(client, 'properties', 'featured', true),
      count(client, 'inquiries', 'id'),
      count(client, 'inquiries', 'status', 'new'),
    ]);
    return ok({ total, available, sold, rental, featured, inquiries, unread });
  } catch (e) { return { data: { ...EMPTY_STATS }, error: errorMessage(e) }; }
}

export async function getInquiries(client: Client): Promise<QueryResult<Inquiry[]>> {
  try {
    const { data, error } = await client.from('inquiries').select('*').order('created_at', { ascending: false }).limit(500);
    if (error) return fail(error);
    return ok((data ?? []) as Inquiry[]);
  } catch (e) { return fail(e); }
}

export async function setInquiryStatus(client: Client, id: string, status: InquiryStatus): Promise<QueryResult<null>> {
  try {
    const { error } = await client.from('inquiries').update({ status }).eq('id', id);
    if (error) return fail(error);
    return ok(null);
  } catch (e) { return fail(e); }
}

export async function deleteInquiry(client: Client, id: string): Promise<QueryResult<null>> {
  try {
    const { error } = await client.from('inquiries').delete().eq('id', id);
    if (error) return fail(error);
    return ok(null);
  } catch (e) { return fail(e); }
}

export async function saveSiteSettings(client: Client, settings: Partial<SiteSettings>): Promise<QueryResult<SiteSettings>> {
  try {
    const payload = { ...settings, id: 1 };
    delete (payload as Partial<SiteSettings>).updated_at;
    const { data, error } = await client.from('site_settings').upsert(payload, { onConflict: 'id' }).select('*').single();
    if (error) return fail(error);
    return ok(data as SiteSettings);
  } catch (e) { return fail(e); }
}

export async function getOwnerMedia(client: Client): Promise<QueryResult<PropertyMedia[]>> {
  try {
    const { data, error } = await client.from('property_media').select('*').order('created_at', { ascending: false }).limit(500);
    if (error) return fail(error);
    return ok((data ?? []) as PropertyMedia[]);
  } catch (e) { return fail(e); }
}
