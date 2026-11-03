'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSupabaseConfig } from './useSupabaseConfig';
import { getSupabaseClient } from '@/lib/supabase/factory';
import {
  getMediaForProperties, getPublicProperties, getSiteSettings,
} from '@/lib/supabase/queries';
import type { PagedResult, Property, PropertyFilters, PropertyMedia, SiteSettings } from '@/lib/types';
import { DEFAULT_SETTINGS } from '@/lib/utils';

export function useSiteSettings() {
  const config = useSupabaseConfig();
  const client = config.config ? getSupabaseClient(config.config) : null;
  const [settings, setSettings] = useState<SiteSettings>({ ...DEFAULT_SETTINGS });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!config.initialized) return;
    if (!client) { setSettings({ ...DEFAULT_SETTINGS }); setLoading(false); setError(null); return; }
    setLoading(true);
    const result = await getSiteSettings(client);
    if (result.data) setSettings(result.data);
    setError(result.error);
    setLoading(false);
  }, [client, config.initialized, config.source, config.config?.url]);

  useEffect(() => { void load(); }, [load]);
  return { settings, loading, error, refresh: load, configured: Boolean(config.config) };
}

export interface PropertiesState {
  result: PagedResult<Property>;
  media: PropertyMedia[];
  loading: boolean;
  error: string | null;
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
  const [nonce, setNonce] = useState(0);
  const filtersKey = useMemo(() => JSON.stringify(filters), [filters]);

  useEffect(() => {
    let cancelled = false;
    if (!config.initialized) return;
    if (!client) { setResult({ items: [], total: 0, page: 1, perPage: 9, pages: 1 }); setMedia([]); setLoading(false); setError(null); return; }
    (async () => {
      setLoading(true); setError(null);
      const parsed = JSON.parse(filtersKey) as PropertyFilters;
      const res = await getPublicProperties(client, parsed);
      if (cancelled) return;
      if (res.error) { setError(res.error); setResult({ items: [], total: 0, page: 1, perPage: 9, pages: 1 }); setMedia([]); setLoading(false); return; }
      const page = res.data!;
      const mediaRes = page.items.length ? await getMediaForProperties(client, page.items.map(p => p.id)) : { data: [], error: null };
      if (cancelled) return;
      setResult(page);
      setMedia(mediaRes.data ?? []);
      if (mediaRes.error) setError(`Properties loaded, but media could not be fetched: ${mediaRes.error}`);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [client, config.initialized, config.source, config.config?.url, filtersKey, nonce]);

  return { result, media, loading, error, configured: Boolean(config.config), refresh: () => setNonce(n => n + 1) };
}
