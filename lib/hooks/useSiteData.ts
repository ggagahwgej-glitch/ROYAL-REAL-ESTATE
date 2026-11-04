'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSupabaseConfig } from './useSupabaseConfig';
import { getSupabaseClient } from '@/lib/supabase/factory';
import {
  getMediaForProperties, getPublicProperties, getSiteSettings,
} from '@/lib/supabase/queries';
import type { PagedResult, Property, PropertyFilters, PropertyMedia, SiteSettings } from '@/lib/types';
import { DEFAULT_SETTINGS, shortHash } from '@/lib/utils';

/* One small settings row is shared by Header, Hero, Footer, Testimonials,
   InquiryForm and PropertyDetail. Without a cache every one of those mounts
   fires its own identical PostgREST query. De-duplicate with a short-lived
   promise cache keyed by the active configuration. */
const SETTINGS_TTL_MS = 15_000;
interface SettingsCacheEntry { promise: Promise<{ data: SiteSettings | null; error: string | null; warning?: string }>; expires: number }
const settingsCache = new Map<string, SettingsCacheEntry>();

export function invalidateSiteSettingsCache(): void { settingsCache.clear(); }

function cachedSettings(client: NonNullable<ReturnType<typeof getSupabaseClient>>, key: string, force: boolean) {
  if (!force) {
    const hit = settingsCache.get(key);
    if (hit && hit.expires > Date.now()) return hit.promise;
  }
  const promise = getSiteSettings(client).then(result => {
    if (result.error) settingsCache.delete(key); // never cache a failure
    return result;
  });
  settingsCache.set(key, { promise, expires: Date.now() + SETTINGS_TTL_MS });
  return promise;
}

export function useSiteSettings() {
  const config = useSupabaseConfig();
  const client = config.config ? getSupabaseClient(config.config) : null;
  const [settings, setSettings] = useState<SiteSettings>({ ...DEFAULT_SETTINGS });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const cacheKey = config.config
    ? `${config.source}:${config.config.url}:${shortHash(config.config.anonKey)}`
    : 'none';

  const load = useCallback(async (force = false) => {
    if (!config.initialized) return;
    if (!client) { setSettings({ ...DEFAULT_SETTINGS }); setLoading(false); setError(null); return; }
    setLoading(true);
    const result = await cachedSettings(client, cacheKey, force);
    if (result.data) setSettings(result.data);
    setError(result.error);
    setWarning(result.warning ?? null);
    setLoading(false);
  }, [client, config.initialized, cacheKey]);

  useEffect(() => { void load(); }, [load]);
  return { settings, loading, error, warning, refresh: () => load(true), configured: Boolean(config.config) };
}

export interface PropertiesState {
  result: PagedResult<Property>;
  media: PropertyMedia[];
  loading: boolean;
  error: string | null;
  /** Non-fatal: the labelled showcase catalogue is being displayed. */
  warning: string | null;
  configured: boolean;
  refresh: () => void;
}

export function usePublicProperties(filters: PropertyFilters): PropertiesState {
  const config = useSupabaseConfig();
  const client = config.config ? getSupabaseClient(config.config) : null;
  const [result, setResult] = useState<PagedResult<Property>>({ items: [], total: 0, page: 1, perPage: filters.perPage ?? 9, pages: 1 });
  const [media, setMedia] = useState<PropertyMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const filtersKey = useMemo(() => JSON.stringify(filters), [filters]);

  useEffect(() => {
    let cancelled = false;
    if (!config.initialized) return;
    if (!client) { setResult({ items: [], total: 0, page: 1, perPage: filters.perPage ?? 9, pages: 1 }); setMedia([]); setLoading(false); setError(null); setWarning(null); return; }
    (async () => {
      setLoading(true); setError(null); setWarning(null);
      const parsed = JSON.parse(filtersKey) as PropertyFilters;
      const res = await getPublicProperties(client, parsed);
      if (cancelled) return;
      setWarning(res.warning ?? null);
      if (res.error || !res.data) { setError(res.error); setResult({ items: [], total: 0, page: 1, perPage: filters.perPage ?? 9, pages: 1 }); setMedia([]); setLoading(false); return; }
      const page = res.data;
      const mediaRes = page.items.length ? await getMediaForProperties(client, page.items.map(p => p.id)) : { data: [], error: null };
      if (cancelled) return;
      setResult(page);
      setMedia(mediaRes.data ?? []);
      if (mediaRes.error) setError(`Properties loaded, but media could not be fetched: ${mediaRes.error}`);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [client, config.initialized, config.source, config.config?.url, filtersKey, nonce]);

  return { result, media, loading, error, warning, configured: Boolean(config.config), refresh: () => setNonce(n => n + 1) };
}
