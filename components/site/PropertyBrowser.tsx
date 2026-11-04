'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, SlidersHorizontal, RotateCcw, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { PropertyCard } from './PropertyCard';
import { SetupState } from './SetupState';
import { EmptyState, Notice, SkeletonCard } from '@/components/ui/UI';
import { usePublicProperties } from '@/lib/hooks/useSiteData';
import { useSupabaseConfig } from '@/lib/hooks/useSupabaseConfig';
import { getSupabaseClient } from '@/lib/supabase/factory';
import { getDistinctCities } from '@/lib/supabase/queries';
import { activeFilterCount, filtersToSearch, parseFiltersFromSearch, describeFilters } from '@/lib/properties/filters';
import { PROPERTY_CATEGORIES, formatNumber } from '@/lib/utils';
import type { PropertyFilters } from '@/lib/types';

const SORTS: Array<{ value: NonNullable<PropertyFilters['sort']>; label: string }> = [
  { value: 'newest', label: 'Featured & newest' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'area-desc', label: 'Largest area' },
  { value: 'title', label: 'Name A–Z' },
];

export function PropertyBrowser({ initialFilters = {}, lockType, heading, description }: {
  initialFilters?: PropertyFilters; lockType?: 'buy' | 'rent'; heading?: string; description?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const config = useSupabaseConfig();
  const fromUrl = useMemo(() => parseFiltersFromSearch(params), [params]);
  const [filters, setFilters] = useState<PropertyFilters>({ ...initialFilters, ...fromUrl, ...(lockType ? { listingType: lockType } : {}) });
  const [searchText, setSearchText] = useState(fromUrl.q ?? '');
  const [cities, setCities] = useState<string[]>([]);
  const [filterOpen, setFilterOpen] = useState(true);
  const { result, media, loading, error, warning, configured, refresh } = usePublicProperties(filters);
  // Remembers the query string THIS component wrote, so the URL can be read
  // back without fighting our own navigation.
  const selfWritten = useRef<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => { if (searchText !== (filters.q ?? '')) setFilters(f => ({ ...f, q: searchText, page: 1 })); }, 350);
    return () => clearTimeout(t);
  }, [searchText]); // eslint-disable-line react-hooks/exhaustive-deps

  // filters → URL
  useEffect(() => {
    const query = filtersToSearch(filters);
    selfWritten.current = query;
    const target = `/${window.location.pathname.split('/').filter(Boolean).join('/')}${query ? `?${query}` : ''}`;
    if (`${window.location.pathname}${window.location.search}` !== target) router.replace(target, { scroll: false });
  }, [filters, router]);

  // URL → filters. Back/Forward (or a shared/pasted link) previously updated the
  // address bar while the results stayed frozen on the old filter set.
  const incomingQuery = params.toString();
  useEffect(() => {
    if (selfWritten.current === incomingQuery) return; // echo of our own write
    const next = parseFiltersFromSearch(params);
    setFilters(f => ({ ...f, ...next, ...(lockType ? { listingType: lockType } : {}) }));
    setSearchText(next.q ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingQuery, lockType]);

  useEffect(() => {
    if (!config.config) { setCities([]); return; }
    const client = getSupabaseClient(config.config);
    if (!client) return;
    void getDistinctCities(client).then(res => { if (res.data) setCities(res.data); });
  }, [config.config?.url, config.source]);

  const update = useCallback(<K extends keyof PropertyFilters>(key: K, value: PropertyFilters[K]) => {
    setFilters(f => ({ ...f, [key]: value, page: key === 'page' ? (value as number) : 1 }));
  }, []);
  const reset = useCallback(() => { setSearchText(''); setFilters({ ...(initialFilters ?? {}), ...(lockType ? { listingType: lockType } : {}), page: 1 }); }, [initialFilters, lockType]);
  const active = activeFilterCount(filters);

  return (
    <>
      <div className="container">
        {warning && <div className="showcase-strip"><span className="showcase-tag">Showcase collection</span>
          <span className="tiny muted">Illustrative residences for this demonstration. Filters, search and pagination are fully working.</span></div>}
        <div className="filter-panel mt-48">
          <div className="flex between center gap-16 wrap mb-24">
            <div className="flex center gap-12"><SlidersHorizontal size={17} className="gold" /><h2 className="h4">Refine your search</h2>{active > 0 && <span className="badge badge-gold">{active} active</span>}</div>
            <div className="flex gap-12 center wrap">
              <button className="link-gold" onClick={() => setFilterOpen(o => !o)}>{filterOpen ? 'Hide filters' : 'Show filters'}</button>
              <button className="btn btn-ghost btn-sm" onClick={reset}><RotateCcw size={14} /> Reset</button>
            </div>
          </div>

          {filterOpen && (
            <>
              <div className="flex between gap-16 wrap mb-24">
                <div className="search-tabs" style={{ margin: 0 }}>
                  {(['all', 'buy', 'rent'] as const).map(t => (
                    <button key={t} className={`search-tab ${(filters.listingType ?? 'all') === t ? 'active' : ''}`}
                      onClick={() => update('listingType', t)} disabled={Boolean(lockType) && t !== lockType}>
                      {t === 'all' ? 'All' : t === 'buy' ? 'For Sale' : 'For Rent'}
                    </button>
                  ))}
                </div>
                <div className="field" style={{ minWidth: 260, flex: 1, maxWidth: 380 }}>
                  <div className="input-wrap"><Search size={15} style={{ position: 'absolute', left: 14, color: 'var(--gold)' }} />
                    <input className="input" style={{ paddingLeft: 38 }} placeholder="Search residences, cities…" value={searchText} onChange={e => setSearchText(e.target.value)} aria-label="Search properties" />
                  </div>
                </div>
              </div>

              <div className="filter-grid">
                <div className="field"><label className="label" htmlFor="f-loc">Location</label>
                  <input id="f-loc" className="input" list="city-list" placeholder="Any city" value={filters.location ?? ''} onChange={e => update('location', e.target.value)} />
                  <datalist id="city-list">{cities.map(c => <option key={c} value={c} />)}</datalist>
                </div>
                <div className="field"><label className="label" htmlFor="f-cat">Collection</label>
                  <select id="f-cat" className="select" value={filters.category ?? ''} onChange={e => update('category', e.target.value)}>
                    <option value="">All collections</option>{PROPERTY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="field"><label className="label" htmlFor="f-min">Min price</label>
                  <input id="f-min" className="input" type="number" min="0" placeholder="No minimum" value={filters.minPrice ?? ''} onChange={e => update('minPrice', e.target.value ? Number(e.target.value) : null)} />
                </div>
                <div className="field"><label className="label" htmlFor="f-max">Max price</label>
                  <input id="f-max" className="input" type="number" min="0" placeholder="No maximum" value={filters.maxPrice ?? ''} onChange={e => update('maxPrice', e.target.value ? Number(e.target.value) : null)} />
                </div>
                <div className="field"><label className="label" htmlFor="f-beds">Bedrooms</label>
                  <select id="f-beds" className="select" value={filters.bedrooms ?? ''} onChange={e => update('bedrooms', e.target.value ? Number(e.target.value) : null)}>
                    <option value="">Any</option>{[1, 2, 3, 4, 5, 6, 8].map(n => <option key={n} value={n}>{n}+ bedrooms</option>)}
                  </select>
                </div>
                <div className="field"><label className="label" htmlFor="f-baths">Bathrooms</label>
                  <select id="f-baths" className="select" value={filters.bathrooms ?? ''} onChange={e => update('bathrooms', e.target.value ? Number(e.target.value) : null)}>
                    <option value="">Any</option>{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}+ bathrooms</option>)}
                  </select>
                </div>
                <div className="field"><label className="label" htmlFor="f-area">Min area (sq ft)</label>
                  <input id="f-area" className="input" type="number" min="0" placeholder="Any area" value={filters.minArea ?? ''} onChange={e => update('minArea', e.target.value ? Number(e.target.value) : null)} />
                </div>
                <div className="field"><label className="label" htmlFor="f-avail">Availability</label>
                  <select id="f-avail" className="select" value={filters.availability ?? 'all'} onChange={e => update('availability', e.target.value as PropertyFilters['availability'])}>
                    <option value="all">All statuses</option><option value="available">Available</option>
                    <option value="reserved">Reserved</option><option value="sold">Sold</option><option value="rented">Rented</option>
                  </select>
                </div>
                <div className="field"><label className="label" htmlFor="f-sort">Sort by</label>
                  <select id="f-sort" className="select" value={filters.sort ?? 'newest'} onChange={e => update('sort', e.target.value as PropertyFilters['sort'])}>
                    {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div className="field"><label className="label">Options</label>
                  <label className="checkbox" style={{ paddingTop: 12 }}><input type="checkbox" checked={Boolean(filters.featured)} onChange={e => update('featured', e.target.checked)} /> Signature collection only</label>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="results-bar">
          <div>
            {heading && <h2 className="h3">{heading}</h2>}
            <p className="small muted mt-8">
              {loading ? 'Searching the collection…' : error ? 'Unable to load results' : <><strong className="gold">{formatNumber(result.total)}</strong> {result.total === 1 ? 'residence' : 'residences'} found{description ? ` · ${description}` : ''}</>}
            </p>
          </div>
          <div className="flex gap-8 wrap center">
            {describeFilters(filters).map((chip, i) => <span className="chip" key={`${chip}-${i}`}>{chip}<button onClick={() => {
              if (chip.startsWith('“')) { setSearchText(''); update('q', undefined); }
              else if (chip === 'For sale') update('listingType', 'all');
              else if (chip === 'For rent') update('listingType', 'all');
              else if (chip.includes('bedrooms')) update('bedrooms', null);
              else if (chip.includes('bathrooms')) update('bathrooms', null);
              else if (chip.includes('sq ft')) update('minArea', null);
              else if (chip === 'Signature collection') update('featured', false);
              else if (PROPERTY_CATEGORIES.includes(chip as never)) update('category', '');
              else update('location', '');
            }} aria-label={`Remove ${chip}`}><X size={12} /></button></span>)}
            {active > 0 && <button className="link-gold" onClick={reset}>Clear all</button>}
          </div>
        </div>

        {!config.initialized || (config.loading && configured) ? (
          <div className="property-grid">{[0, 1, 2, 3, 4, 5].map(i => <SkeletonCard key={i} />)}</div>
        ) : !configured ? (
          <SetupState config={config} compact />
        ) : error ? (
          <Notice tone="error" title="The collection could not be loaded">{error}<div className="mt-16"><button className="btn btn-outline btn-sm" onClick={refresh}>Retry</button></div></Notice>
        ) : result.items.length === 0 ? (
          <EmptyState icon={<Search />} title="No residences match these criteria"
            description="Try widening your price range, removing a filter, or exploring the complete collection."
            action={<button className="btn btn-gold btn-sm" onClick={reset}>Reset filters</button>} />
        ) : (
          <>
            <div className="property-grid">
              {result.items.map((p, i) => <PropertyCard key={p.id} property={p} media={media.filter(m => m.property_id === p.id)} priority={i < 3} />)}
            </div>
            {result.pages > 1 && (
              <nav className="pagination" aria-label="Pagination">
                <button className="page-btn" disabled={result.page <= 1} onClick={() => { update('page', result.page - 1); window.scrollTo({ top: 320, behavior: 'smooth' }); }} aria-label="Previous page"><ChevronLeft size={15} /></button>
                {Array.from({ length: result.pages }, (_, i) => i + 1).filter(p => p === 1 || p === result.pages || Math.abs(p - result.page) <= 1).map((p, i, arr) => (
                  <span key={p} className="flex gap-8 center">
                    {i > 0 && p - arr[i - 1] > 1 && <span className="muted small">…</span>}
                    <button className={`page-btn ${p === result.page ? 'active' : ''}`} onClick={() => { update('page', p); window.scrollTo({ top: 320, behavior: 'smooth' }); }}>{p}</button>
                  </span>
                ))}
                <button className="page-btn" disabled={result.page >= result.pages} onClick={() => { update('page', result.page + 1); window.scrollTo({ top: 320, behavior: 'smooth' }); }} aria-label="Next page"><ChevronRight size={15} /></button>
              </nav>
            )}
            <p className="tiny muted text-center mt-24">Page {result.page} of {result.pages} · <Link href="/contact" className="gold">Ask our advisors for a private shortlist</Link></p>
          </>
        )}
      </div>
    </>
  );
}
