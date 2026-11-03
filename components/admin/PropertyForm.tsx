'use client';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Save, ArrowLeft, Loader2, Building2, Layers3, Image as ImageIcon, Search, Trash2 } from 'lucide-react';
import { Notice, EmptyState } from '@/components/ui/UI';
import { MediaManager } from './MediaManager';
import { useOwner } from '@/lib/hooks/useOwner';
import { createProperty, deleteProperty, getOwnerProperty, updateProperty } from '@/lib/supabase/queries';
import type { Property, PropertyInput } from '@/lib/types';
import { PROPERTY_CATEGORIES, AMENITY_SUGGESTIONS, parseList, slugify } from '@/lib/utils';
import { validateMapUrl } from '@/lib/maps';

const DEFAULTS: PropertyInput = {
  title: '', slug: '', subtitle: '', description: '',
  listing_type: 'buy', category: 'Villa', status: 'draft', availability: 'available',
  price: 0, currency: 'INR', price_period: 'month',
  location: '', city: '', address: '', country: 'India',
  bedrooms: 3, bathrooms: 3, area_sqft: 2500, lot_sqft: null, year_built: null,
  featured: false, amenities: [], features: [], latitude: null, longitude: null, map_url: '',
  meta_title: '', meta_description: '',
};

const TABS = [
  { id: 'details', label: 'Core details', Icon: Building2 },
  { id: 'specs', label: 'Specifications', Icon: Layers3 },
  { id: 'presentation', label: 'Presentation & SEO', Icon: Search },
  { id: 'media', label: 'Media gallery', Icon: ImageIcon },
] as const;
type TabId = typeof TABS[number]['id'];

export function PropertyForm({ propertyId }: { propertyId?: string }) {
  const router = useRouter();
  const owner = useOwner();
  const isEdit = Boolean(propertyId);
  const [form, setForm] = useState<PropertyInput>(DEFAULTS);
  const [amenitiesText, setAmenitiesText] = useState('');
  const [featuresText, setFeaturesText] = useState('');
  const [tab, setTab] = useState<TabId>('details');
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [justCreated, setJustCreated] = useState(false);

  const load = useCallback(async () => {
    if (!propertyId || !owner.client) return;
    setLoading(true);
    const res = await getOwnerProperty(owner.client, propertyId);
    setLoading(false);
    if (res.error) { setLoadError(res.error); return; }
    if (!res.data) { setLoadError('This property does not exist or you are not authorised to edit it.'); return; }
    const p = res.data;
    setForm({ ...p });
    setAmenitiesText((p.amenities ?? []).join('\n'));
    setFeaturesText((p.features ?? []).join('\n'));
  }, [propertyId, owner.client]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    // A freshly created property lands here with ?saved=1 — confirm success.
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('saved') === '1') {
      setJustCreated(true);
    }
  }, []);

  const set = <K extends keyof PropertyInput>(key: K, value: PropertyInput[K]) => {
    setForm(f => {
      const next = { ...f, [key]: value };
      if (key === 'title' && !slugTouched && !isEdit) next.slug = slugify(String(value));
      return next;
    });
  };
  const num = (key: keyof PropertyInput, raw: string, allowNull = false) => {
    if (!raw.trim()) { set(key, (allowNull ? null : 0) as never); return; }
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) set(key, parsed as never);
  };

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (!form.title || form.title.trim().length < 2) e.title = 'A title is required.';
    if (!form.city?.trim()) e.city = 'Enter a city.';
    if (!form.category) e.category = 'Choose a collection.';
    if (Number(form.price) < 0) e.price = 'Price cannot be negative.';
    if (Number(form.area_sqft) < 0) e.area_sqft = 'Area cannot be negative.';
    if (form.latitude != null && (form.latitude < -90 || form.latitude > 90)) e.latitude = 'Latitude must be between -90 and 90.';
    if (form.longitude != null && (form.longitude < -180 || form.longitude > 180)) e.longitude = 'Longitude must be between -180 and 180.';
    if (!slugify(form.slug || form.title)) e.slug = 'A valid URL slug is required.';
    const mapError = validateMapUrl(form.map_url);
    if (mapError) e.map_url = mapError;
    return e;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const validation = validate();
    setErrors(validation);
    if (Object.keys(validation).length) { setFeedback({ tone: 'error', text: 'Please correct the highlighted fields before saving.' }); setTab(validation.map_url ? 'specs' : 'details'); return; }
    if (!owner.client) { setFeedback({ tone: 'error', text: 'No authenticated Supabase client. Sign in again.' }); return; }
    setSaving(true); setFeedback(null);
    const payload: PropertyInput = {
      ...form,
      title: form.title.trim(),
      slug: slugify(form.slug || form.title),
      amenities: parseList(amenitiesText),
      features: parseList(featuresText),
      map_url: form.map_url?.trim() || null,
      price_period: form.listing_type === 'rent' ? (form.price_period || 'month') : null,
    };
    const res = isEdit
      ? await updateProperty(owner.client, propertyId!, payload)
      : await createProperty(owner.client, payload);
    setSaving(false);
    if (res.error) { setFeedback({ tone: 'error', text: `Save failed: ${res.error}` }); return; }
    if (isEdit) {
      setFeedback({ tone: 'success', text: 'Property saved. Published changes are reflected on the public website immediately.' });
      setForm(res.data!);
    } else {
      router.push(`/admin/properties/${res.data!.id}/edit?saved=1`);
    }
  };

  if (loading) return <div className="admin-card"><div className="grid gap-12">{[0, 1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 52 }} />)}</div></div>;
  if (loadError) return <EmptyState title="Property unavailable" description={loadError} action={<Link href="/admin/properties" className="btn btn-outline btn-sm">Back to properties</Link>} />;

  return (
    <form onSubmit={submit} className="grid gap-24">
      <div className="flex between center gap-16 wrap">
        <div><Link href="/admin/properties" className="link-gold mb-8"><ArrowLeft size={14} /> All properties</Link>
          <p className="eyebrow no-line mt-8">{isEdit ? 'Editing residence' : 'New residence'}</p>
          <h2 className="admin-title mt-8">{isEdit ? (form.title || 'Untitled residence') : 'Create a property'}</h2>
          <p className="small muted mt-8">{isEdit ? `Reference IR-${propertyId?.slice(0, 8).toUpperCase()} · last saved ${new Date((form as Property).updated_at ?? Date.now()).toLocaleString('en-GB')}` : 'Drafts are private. Publish when the residence is ready to appear on the website.'}</p></div>
        <div className="flex gap-12 wrap">
          {isEdit && form.status === 'published'
            ? <Link href={`/properties/${form.slug}`} className="btn btn-ghost btn-sm" target="_blank">View public page</Link>
            : <span className="tiny muted" title="Publish this property to make its public page available">Public page available after publishing</span>}
          <button type="submit" className="btn btn-gold btn-sm" disabled={saving}>{saving ? <><Loader2 size={14} className="spinner" /> Saving…</> : <><Save size={14} /> {isEdit ? 'Save changes' : 'Create property'}</>}</button>
        </div>
      </div>

      {justCreated && <Notice tone="success" title="Property created">The residence is saved as a private draft. Add images in the Media gallery tab, then set its status to Published to make the public page live.</Notice>}
      {feedback && <Notice tone={feedback.tone}>{feedback.text}</Notice>}

      <div className="tabs">{TABS.map(t => <button type="button" key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}><t.Icon size={14} style={{ verticalAlign: 'middle', marginRight: 8 }} />{t.label}</button>)}</div>

      {tab === 'details' && <div className="admin-card">
        <div className="admin-card-head"><h3 className="h3">Core details</h3><span className="badge badge-gold">{form.status}</span></div>
        <div className="form-grid">
          <div className="field span-2"><label className="label" htmlFor="p-title">Property title *</label>
            <input id="p-title" className={`input ${errors.title ? 'input-error' : ''}`} value={form.title ?? ''} onChange={e => set('title', e.target.value)} placeholder="The Aurelian Estate" />
            {errors.title && <span className="field-error">{errors.title}</span>}</div>
          <div className="field span-2"><label className="label" htmlFor="p-slug">URL slug *</label>
            <input id="p-slug" className={`input ${errors.slug ? 'input-error' : ''}`} value={form.slug ?? ''} onChange={e => { setSlugTouched(true); set('slug', e.target.value); }} placeholder="the-aurelian-estate" />
            <span className="hint">Public URL: /properties/{slugify(form.slug || form.title)}</span></div>
          <div className="field span-2"><label className="label" htmlFor="p-sub">Subtitle</label>
            <input id="p-sub" className="input" value={form.subtitle ?? ''} onChange={e => set('subtitle', e.target.value)} placeholder="A landmark residence on the northern ridge" /></div>
          <div className="field span-2"><label className="label" htmlFor="p-desc">Full description</label>
            <textarea id="p-desc" className="textarea" style={{ minHeight: 180 }} value={form.description ?? ''} onChange={e => set('description', e.target.value)} placeholder="Describe the architecture, provenance and setting…" />
            <span className="hint">Displayed on the property detail page.</span></div>
          <div className="field"><label className="label" htmlFor="p-type">Listing type</label>
            <select id="p-type" className="select" value={form.listing_type} onChange={e => set('listing_type', e.target.value as 'buy' | 'rent')}><option value="buy">For sale</option><option value="rent">For rent</option></select></div>
          <div className="field"><label className="label" htmlFor="p-cat">Collection</label>
            <select id="p-cat" className={`select ${errors.category ? 'input-error' : ''}`} value={form.category} onChange={e => set('category', e.target.value)}>{PROPERTY_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
          <div className="field"><label className="label" htmlFor="p-price">Price *</label>
            <input id="p-price" className={`input ${errors.price ? 'input-error' : ''}`} type="number" min="0" step="1" value={form.price ?? 0} onChange={e => num('price', e.target.value)} /></div>
          <div className="field"><label className="label" htmlFor="p-currency">Currency</label>
            <select id="p-currency" className="select" value={form.currency} onChange={e => set('currency', e.target.value)}>{['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD'].map(c => <option key={c}>{c}</option>)}</select></div>
          {form.listing_type === 'rent' && <div className="field"><label className="label" htmlFor="p-period">Price period</label>
            <select id="p-period" className="select" value={form.price_period ?? 'month'} onChange={e => set('price_period', e.target.value)}><option value="month">per month</option><option value="week">per week</option><option value="year">per year</option><option value="night">per night</option></select></div>}
          <div className="field"><label className="label" htmlFor="p-status">Publication status</label>
            <select id="p-status" className="select" value={form.status} onChange={e => set('status', e.target.value as 'draft' | 'published')}><option value="draft">Draft — private</option><option value="published">Published — public</option></select></div>
          <div className="field"><label className="label" htmlFor="p-avail">Availability</label>
            <select id="p-avail" className="select" value={form.availability} onChange={e => set('availability', e.target.value as Property['availability'])}>
              {(['available', 'reserved', 'sold', 'rented'] as const).map(a => <option key={a} value={a}>{a}</option>)}</select></div>
          <div className="field"><label className="label">Curation</label><label className="checkbox" style={{ paddingTop: 12 }}><input type="checkbox" checked={Boolean(form.featured)} onChange={e => set('featured', e.target.checked)} /> Feature in the Signature Collection</label></div>
        </div>
      </div>}

      {tab === 'specs' && <div className="admin-card">
        <div className="admin-card-head"><h3 className="h3">Specifications &amp; location</h3></div>
        <div className="form-grid-3">
          <div className="field"><label className="label" htmlFor="p-city">City *</label><input id="p-city" className={`input ${errors.city ? 'input-error' : ''}`} value={form.city ?? ''} onChange={e => set('city', e.target.value)} placeholder="Guwahati" /></div>
          <div className="field"><label className="label" htmlFor="p-location">District / locality</label><input id="p-location" className="input" value={form.location ?? ''} onChange={e => set('location', e.target.value)} placeholder="Northern Ridge" /></div>
          <div className="field"><label className="label" htmlFor="p-country">Country</label><input id="p-country" className="input" value={form.country ?? ''} onChange={e => set('country', e.target.value)} /></div>
          <div className="field span-3"><label className="label" htmlFor="p-address">Full address</label><input id="p-address" className="input" value={form.address ?? ''} onChange={e => set('address', e.target.value)} /></div>
          <div className="field"><label className="label" htmlFor="p-beds">Bedrooms</label><input id="p-beds" className="input" type="number" min="0" value={form.bedrooms ?? 0} onChange={e => num('bedrooms', e.target.value)} /></div>
          <div className="field"><label className="label" htmlFor="p-baths">Bathrooms</label><input id="p-baths" className="input" type="number" min="0" value={form.bathrooms ?? 0} onChange={e => num('bathrooms', e.target.value)} /></div>
          <div className="field"><label className="label" htmlFor="p-area">Interior area (sq ft)</label><input id="p-area" className={`input ${errors.area_sqft ? 'input-error' : ''}`} type="number" min="0" value={form.area_sqft ?? 0} onChange={e => num('area_sqft', e.target.value)} /></div>
          <div className="field"><label className="label" htmlFor="p-lot">Plot area (sq ft)</label><input id="p-lot" className="input" type="number" min="0" value={form.lot_sqft ?? ''} onChange={e => num('lot_sqft', e.target.value, true)} /></div>
          <div className="field"><label className="label" htmlFor="p-year">Year built</label><input id="p-year" className="input" type="number" min="1500" max="2200" value={form.year_built ?? ''} onChange={e => num('year_built', e.target.value, true)} /></div>
          <div className="field"><label className="label" htmlFor="p-lat">Latitude</label><input id="p-lat" className={`input ${errors.latitude ? 'input-error' : ''}`} type="number" step="any" value={form.latitude ?? ''} onChange={e => num('latitude', e.target.value, true)} /></div>
          <div className="field"><label className="label" htmlFor="p-lng">Longitude</label><input id="p-lng" className={`input ${errors.longitude ? 'input-error' : ''}`} type="number" step="any" value={form.longitude ?? ''} onChange={e => num('longitude', e.target.value, true)} /></div>
          <div className="field span-2"><label className="label" htmlFor="p-map">Map link (optional)</label>
            <input id="p-map" className={`input ${errors.map_url ? 'input-error' : ''}`} value={form.map_url ?? ''} onChange={e => set('map_url', e.target.value)} placeholder="https://maps.app.goo.gl/… or a Google Maps / OpenStreetMap link" />
            {errors.map_url && <span className="field-error">{errors.map_url}</span>}
            <span className="hint">Paste any Google Maps share/place/embed link or an OpenStreetMap embed link — it is converted into a working embedded map automatically. If left blank, latitude/longitude (or the city) generate the map. Every listing also gets an “Open in Google Maps” link.</span></div>
          <div className="field span-2"><label className="label" htmlFor="p-amenities">Amenities (one per line)</label>
            <textarea id="p-amenities" className="textarea" value={amenitiesText} onChange={e => setAmenitiesText(e.target.value)} placeholder="Private infinity pool&#10;Concierge service" />
            <span className="hint">Suggestions: {AMENITY_SUGGESTIONS.slice(0, 6).join(' · ')}</span></div>
          <div className="field span-2"><label className="label" htmlFor="p-features">Distinguishing features (one per line)</label>
            <textarea id="p-features" className="textarea" value={featuresText} onChange={e => setFeaturesText(e.target.value)} placeholder="Double-height marble atrium" /></div>
        </div>
      </div>}

      {tab === 'presentation' && <div className="admin-card">
        <div className="admin-card-head"><h3 className="h3">Presentation &amp; search engine optimisation</h3></div>
        <div className="form-grid">
          <div className="field span-2"><label className="label" htmlFor="p-meta-title">Meta title</label><input id="p-meta-title" className="input" value={form.meta_title ?? ''} onChange={e => set('meta_title', e.target.value)} placeholder="The Aurelian Estate · Guwahati" /><span className="hint">Leave blank to use the property title and city.</span></div>
          <div className="field span-2"><label className="label" htmlFor="p-meta-desc">Meta description</label><textarea id="p-meta-desc" className="textarea" style={{ minHeight: 90 }} value={form.meta_description ?? ''} onChange={e => set('meta_description', e.target.value)} placeholder="A short, compelling summary for search results and social sharing." /></div>
        </div>
        <Notice tone="info" className="mt-24">The cover image from the media gallery is used automatically for Open Graph previews, structured data and the property card. Set one image as the cover in the Media gallery tab.</Notice>
      </div>}

      {tab === 'media' && (isEdit && propertyId
        ? <MediaManager propertyId={propertyId} client={owner.client} title="Gallery & video" />
        : <div className="admin-card"><EmptyState icon={<ImageIcon />} title="Save the property first"
          description="Media must be linked to a saved property record. Create the property, then upload images and video from this tab." /></div>)}

      <div className="flex between gap-12 wrap">
        <Link href="/admin/properties" className="btn btn-ghost"><ArrowLeft size={15} /> Back to properties</Link>
        <div className="flex gap-12 wrap">
          {isEdit && <button type="button" className="btn btn-danger btn-sm" onClick={async () => {
            if (!owner.client || !propertyId || !window.confirm('Permanently delete this property? This cannot be undone.')) return;
            const res = await deleteProperty(owner.client, propertyId);
            if (res.error) setFeedback({ tone: 'error', text: res.error }); else router.push('/admin/properties');
          }}><Trash2 size={14} /> Delete property</button>}
          <button type="submit" className="btn btn-gold" disabled={saving}>{saving ? <><Loader2 size={14} className="spinner" /> Saving…</> : <><Save size={15} /> {isEdit ? 'Save changes' : 'Create property'}</>}</button>
        </div>
      </div>
    </form>
  );
}
