/* ==================================================================
   THE single Supabase client factory.
   Every browser query, storage call and auth operation obtains its
   client from here, always using the centralized configuration
   manager. No disconnected ad-hoc clients are created elsewhere.

   The ONLY exception is `createTemporaryClient`, used explicitly for
   connection testing and server-side owner verification (never cached,
   never persisted).
================================================================== */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { SupabaseConfig } from '../types';
import { shortHash } from '../utils';
import { getConfig, registerCacheInvalidator } from '../config/manager';

const browserClients = new Map<string, SupabaseClient>();

function clientKey(config: SupabaseConfig, mode: 'browser' | 'temporary' | 'server'): string {
  return `${mode}:${config.url}:${shortHash(config.anonKey)}`;
}

export function createTemporaryClient(config: SupabaseConfig, accessToken?: string): SupabaseClient {
  return createClient(config.url, config.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : undefined,
  });
}

/**
 * Get (or memoize) the one browser Supabase client for a configuration.
 * Passing no config resolves it from the centralized manager.
 */
export function getSupabaseClient(config?: SupabaseConfig | null): SupabaseClient | null {
  let resolved = config;
  if (resolved === undefined) {
    // Lazy require avoids a circular module evaluation problem.
    resolved = getConfig();
  }
  if (!resolved) return null;
  const key = clientKey(resolved, 'browser');
  const existing = browserClients.get(key);
  if (existing) return existing;
  const client = createClient(resolved.url, resolved.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: `imperial-royal-auth-${shortHash(resolved.url)}`,
      flowType: 'implicit',
    },
    global: { headers: { 'X-Client-Info': 'imperial-royal-studio/2.0' } },
  });
  browserClients.set(key, client);
  return client;
}

/** Server Components / Route Handlers use a non-persistent client from the same factory logic. */
export function getServerSupabaseClient(config: SupabaseConfig, accessToken?: string): SupabaseClient {
  const key = clientKey(config, 'server') + (accessToken ? `:${shortHash(accessToken)}` : '');
  const cached = browserClients.get(key);
  if (cached) return cached;
  const client = createTemporaryClient(config, accessToken);
  browserClients.set(key, client);
  return client;
}

export function clearSupabaseClientCache(): void { browserClients.clear(); }
registerCacheInvalidator(clearSupabaseClientCache);
