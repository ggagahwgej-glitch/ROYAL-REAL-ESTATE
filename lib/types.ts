/* ------------------------------------------------------------------
   Imperial Royal Real Estate — shared domain types
   These mirror supabase/schema.sql exactly.
------------------------------------------------------------------ */

export type ListingType = 'buy' | 'rent';
export type PropertyStatus = 'draft' | 'published';
export type Availability = 'available' | 'reserved' | 'sold' | 'rented';
export type InquiryStatus = 'new' | 'read' | 'contacted' | 'resolved';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  is_owner: boolean;
  created_at: string;
}

export interface Property {
  id: string;
  owner_id: string | null;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  listing_type: ListingType;
  category: string;
  status: PropertyStatus;
  availability: Availability;
  price: number;
  currency: string;
  price_period: string | null;
  location: string;
  city: string;
  address: string | null;
  country: string;
  bedrooms: number;
  bathrooms: number;
  area_sqft: number;
  lot_sqft: number | null;
  year_built: number | null;
  featured: boolean;
  amenities: string[];
  features: string[];
  latitude: number | null;
  longitude: number | null;
  map_url: string | null;
  meta_title: string | null;
  meta_description: string | null;
  created_at: string;
  updated_at: string;
}

export type PropertyInput = Partial<Property> & { title: string };

export interface PropertyMedia {
  id: string;
  property_id: string;
  kind: 'image' | 'video';
  storage_path: string;
  public_url: string;
  position: number;
  is_cover: boolean;
  alt_text: string | null;
  mime_type: string | null;
  file_size: number | null;
  created_at: string;
}

export interface Inquiry {
  id: string;
  property_id: string | null;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  status: InquiryStatus;
  source: string | null;
  created_at: string;
  updated_at: string;
}

export interface Testimonial {
  quote: string;
  name: string;
  role: string;
  initials?: string;
}

export interface SiteSettings {
  id: number;
  business_name: string;
  tagline: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  whatsapp: string | null;
  address: string | null;
  hero_heading: string | null;
  hero_subheading: string | null;
  hero_image: string | null;
  social: Record<string, string>;
  footer_text: string | null;
  footer_note: string | null;
  seo_title: string | null;
  seo_description: string | null;
  testimonials: Testimonial[];
  theme: Record<string, string>;
  updated_at: string;
}

export interface QueryResult<T> {
  data: T | null;
  error: string | null;
}

export interface PropertyFilters {
  q?: string;
  listingType?: ListingType | 'all';
  location?: string;
  category?: string;
  minPrice?: number | null;
  maxPrice?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  minArea?: number | null;
  availability?: Availability | 'all';
  featured?: boolean;
  sort?: 'newest' | 'price-asc' | 'price-desc' | 'area-desc' | 'title';
  page?: number;
  perPage?: number;
}

export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number;
  pages: number;
}
