/* ==================================================================
   CENTRALIZED DYNAMIC SUPABASE CONFIGURATION MANAGER  (browser)
   ------------------------------------------------------------------
   One manager for BOTH the public website and the embedded Owner
   Studio. Every client, query and storage operation resolves its
   connection through `getConfig()` / `useSupabaseConfig()`.

   Resolution priority (highest first):
     1. LOCAL  — owner's own browser (localStorage). Clearly labelled
                 as local-only; it does NOT configure other visitors.
     2. SHARED — public bootstrap config from /api/public-config
                 (persisted server-side at data/public-config.json)
                 or the static /public-config.json runtime file.
     3. ENV    — optional NEXT_PUBLIC_* build-time fallback. NOT
                 required and never mandatory.

   Only Supabase Project URL + publishable/anon key are ever stored.
   Service-role / secret keys are rejected by lib/config/validation.
================================================================== */
import type { SupabaseConfig } from '../types';
import { parseImportedConfig, serializeConfig, validateConfig, type ValidationResult } from './validation';

export type ConfigSource = 'local' | 'shared' | 'static' | 'env' | 'none';

export const LOCAL_STORAGE_KEY = 'imperial-royal.supabase.config.v2';
export const CONFIG_EVENT = 'imperial-royal:config-change';

export interface SharedMeta {
  publishedAt: string | null;
  storage: 'server' | 'static-file' | 'none' | 'unknown';
  persistent: boolean;
  note?: string;
}

export interface ConfigState {
  initialized: boolean;
  loading: boolean;
  config: SupabaseConfig | null;
  source: ConfigSource;
  local: SupabaseConfig | null;
  shared: SupabaseConfig | null;
  env: SupabaseConfig | null;
  sharedMeta: SharedMeta;
  error: string | null;
}

export interface ConnectionStep {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
  informational?: boolean;
}

export interface ConnectionTest {
  ok: boolean;
  message: string;
  schemaReady: boolean;
  steps: ConnectionStep[];
  projectLabel: string;
}

export interface PublishResult {
  ok: boolean;
  mode: 'persisted' | 'download' | 'failed';
  message: string;
  artifact?: string;
}

const EMPTY_STATE: ConfigState = {
  initialized: false,
  loading: true,
  config: null,
  source: 'none',
  local: null,
  shared: null,
  env: null,
  sharedMeta: { publishedAt: null, storage: 'unknown', persistent: false },
  error: null,
};

let state: ConfigState = EMPTY_STATE;
let initPromise: Promise<ConfigState> | null = null;
let initGeneration = 0;
const listeners = new Set<() => void>();

function emit(next: Partial<ConfigState>) {
  state = { ...state, ...next };
  listeners.forEach(fn => fn());
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(CONFIG_EVENT));
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function getSnapshot(): ConfigState { return state; }
export function getServerSnapshot(): ConfigState { return EMPTY_STATE; }

/* --------------------------- sources --------------------------- */

function readLocal(): SupabaseConfig | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const result = validateConfig({ url: String(parsed.url ?? ''), anonKey: String(parsed.anonKey ?? '') });
    return result.ok ? result.value! : null;
  } catch { return null; }
}

function readEnv(): SupabaseConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
  if (!url && !anonKey) return null;
  const result = validateConfig({ url, anonKey });
  return result.ok ? result.value! : null;
}

/* The shared-config probe sits on the critical path of EVERY page: until it
   settles, `initialized` stays false and the whole website shows its loading
   state. A hung proxy, a stalled connection or a serverless cold start that
   never answers must therefore never be able to block the app forever. */
const SHARED_CONFIG_TIMEOUT_MS = 8000;

async function fetchJson<T>(url: string): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SHARED_CONFIG_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

interface EndpointPayload {
  url?: string;
  anonKey?: string;
  publishedAt?: string | null;
  storage?: SharedMeta['storage'];
  persistent?: boolean;
  note?: string;
  configured?: boolean;
}

/** Read the SHARED public bootstrap config (available to every visitor). */
export async function readSharedConfig(): Promise<{ config: SupabaseConfig | null; meta: SharedMeta }> {
  let lastError: string | null = null;
  try {
    const fromEndpoint = await fetchJson<EndpointPayload>('/api/public-config');
    if (fromEndpoint && fromEndpoint.configured !== false) {
      const parsed = validateConfig({ url: fromEndpoint.url ?? '', anonKey: fromEndpoint.anonKey ?? '' });
      if (parsed.ok) {
        return {
          config: parsed.value!,
          meta: {
            publishedAt: fromEndpoint.publishedAt ?? null,
            storage: fromEndpoint.storage ?? 'server',
            persistent: fromEndpoint.persistent ?? false,
            note: fromEndpoint.note,
          },
        };
      }
      if (fromEndpoint.url || fromEndpoint.anonKey) lastError = parsed.error ?? 'Invalid shared configuration.';
    }
  } catch (e) {
    lastError = e instanceof Error && e.name === 'AbortError'
      ? `The shared configuration endpoint did not respond within ${SHARED_CONFIG_TIMEOUT_MS / 1000} seconds.`
      : e instanceof Error ? e.message : 'Shared configuration endpoint unreachable.';
  }

  try {
    const fromFile = await fetchJson<EndpointPayload>('/public-config.json');
    const parsed = validateConfig({ url: fromFile?.url ?? '', anonKey: fromFile?.anonKey ?? '' });
    if (parsed.ok) {
      return {
        config: parsed.value!,
        meta: { publishedAt: fromFile?.publishedAt ?? null, storage: 'static-file', persistent: true,
          note: 'Loaded from the public runtime configuration file /public-config.json.' },
      };
    }
  } catch { /* template file may legitimately be empty */ }

  return { config: null, meta: { publishedAt: null, storage: 'none', persistent: false, note: lastError ?? undefined } };
}

function resolve(local: SupabaseConfig | null, shared: SupabaseConfig | null, env: SupabaseConfig | null): { config: SupabaseConfig | null; source: ConfigSource } {
  if (local) return { config: local, source: 'local' };
  if (shared) return { config: shared, source: 'shared' };
  if (env) return { config: env, source: 'env' };
  return { config: null, source: 'none' };
}

/** Idempotent async bootstrap, safe to call from many components. */
export function initialize(force = false): Promise<ConfigState> {
  if (typeof window === 'undefined') return Promise.resolve(state);
  if (initPromise && !force) return initPromise;
  // A forced re-initialisation supersedes any in-flight one. Without a
  // generation token the older run would clear `initPromise` while the newer
  // run was still active (and could emit stale shared config afterwards).
  const generation = ++initGeneration;
  const run = (async () => {
    emit({ loading: true, error: null });
    try {
      const sharedResult = await readSharedConfig();
      if (generation !== initGeneration) return state;
      const local = readLocal();
      const env = readEnv();
      const resolved = resolve(local, sharedResult.config, env);
      emit({
        initialized: true, loading: false,
        config: resolved.config, source: resolved.source,
        local, shared: sharedResult.config, env,
        sharedMeta: sharedResult.meta, error: null,
      });
    } catch (e) {
      if (generation !== initGeneration) return state;
      emit({ initialized: true, loading: false, error: e instanceof Error ? e.message : 'Configuration could not be loaded.' });
    }
    return state;
  })();
  initPromise = run.finally(() => { if (generation === initGeneration) initPromise = null; });
  return initPromise;
}

export function getConfig(): SupabaseConfig | null { return state.config; }
export function getConfigSource(): ConfigSource { return state.source; }

/* ------------------------ local persistence ------------------------ */

export function saveLocalConfig(input: Partial<SupabaseConfig>): ValidationResult<SupabaseConfig> {
  const valid = validateConfig(input);
  if (!valid.ok) return valid;
  try {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({
      ...valid.value, savedAt: new Date().toISOString(),
    }));
  } catch { return { ok: false, error: 'Browser storage is unavailable. Enable localStorage to save configuration in this browser.' }; }
  clearClientCache();
  emit({ local: valid.value!, config: valid.value!, source: 'local', initialized: true, error: null });
  return valid;
}

export function updateLocalConfig(input: Partial<SupabaseConfig>): ValidationResult<SupabaseConfig> {
  if (!state.local) return { ok: false, error: 'There is no saved local configuration to update.' };
  return saveLocalConfig(input);
}

export function clearLocalConfig(): void {
  try { window.localStorage.removeItem(LOCAL_STORAGE_KEY); } catch { /* ignore */ }
  clearClientCache();
  const fallback = state.shared ?? state.env ?? null;
  emit({ local: null, config: fallback, source: fallback ? (state.shared ? 'shared' : 'env') : 'none' });
}

/** Import a previously exported configuration artifact and validate it. */
export function importConfig(raw: string): ValidationResult<SupabaseConfig> {
  return parseImportedConfig(raw);
}

export function exportConfig(config?: SupabaseConfig | null): string | null {
  const target = config ?? state.config;
  if (!target) return null;
  const valid = validateConfig(target);
  if (!valid.ok) return null;
  return serializeConfig(valid.value!);
}

export function downloadArtifact(config: SupabaseConfig): void {
  const artifact = serializeConfig(config);
  const blob = new Blob([artifact], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'public-config.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/* --------------------- shared public publishing --------------------- */

/**
 * Publish the SHARED public bootstrap configuration.
 * Requires a valid Supabase Auth access token: the server independently
 * verifies the JWT and the owner privilege before writing anything.
 * No service-role key is used anywhere in this flow.
 */
export async function publishSharedConfig(config: SupabaseConfig, accessToken: string): Promise<PublishResult> {
  const valid = validateConfig(config);
  if (!valid.ok) return { ok: false, mode: 'failed', message: valid.error ?? 'Invalid configuration.' };
  try {
    const res = await fetch('/api/public-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: valid.value, accessToken }),
    });
    const payload = await res.json().catch(() => ({})) as { message?: string; mode?: string; artifact?: string; error?: string };
    if (!res.ok) {
      return {
        ok: false,
        mode: payload.mode === 'download' ? 'download' : 'failed',
        message: payload.error ?? payload.message ?? `Publishing failed (HTTP ${res.status}).`,
        artifact: payload.artifact,
      };
    }
    await initialize(true);
    return {
      ok: true,
      mode: payload.mode === 'download' ? 'download' : 'persisted',
      message: payload.message ?? 'Shared public configuration published.',
      artifact: payload.artifact,
    };
  } catch (e) {
    return { ok: false, mode: 'failed', message: e instanceof Error ? e.message : 'Network error while publishing.' };
  }
}

export async function clearSharedConfig(accessToken: string): Promise<PublishResult> {
  try {
    const res = await fetch('/api/public-config', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken }),
    });
    const payload = await res.json().catch(() => ({})) as { message?: string; error?: string };
    await initialize(true);
    return { ok: res.ok, mode: res.ok ? 'persisted' : 'failed', message: payload.message ?? payload.error ?? 'Shared configuration cleared.' };
  } catch (e) {
    return { ok: false, mode: 'failed', message: e instanceof Error ? e.message : 'Network error.' };
  }
}

/* ------------------------- connection test ------------------------- */

const TIMEOUT_MS = 9000;

async function timedFetch(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try { return await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' }); }
  finally { clearTimeout(timer); }
}

export async function testConnection(input: Partial<SupabaseConfig>): Promise<ConnectionTest> {
  const valid = validateConfig(input);
  const projectLabel = (input.url ?? '').trim() || 'Unnamed project';
  if (!valid.ok) {
    return { ok: false, schemaReady: false, projectLabel,
      message: valid.error ?? 'Invalid configuration.',
      steps: [{ id: 'validate', label: 'Validate inputs', ok: false, detail: valid.error ?? 'Invalid configuration.' }] };
  }
  const { url, anonKey } = valid.value!;
  const steps: ConnectionStep[] = [{ id: 'validate', label: 'Validate URL and key', ok: true,
    detail: 'URL format is valid and the key is a publishable/anon key. No service-role credential detected.' }];

  // 1. Real network round-trip to PostgREST with the provided key.
  // New sb_publishable_… keys are NOT JWTs: some gateways reject them in a
  // Bearer header while accepting them in `apikey`. Legacy anon JWTs need the
  // Bearer fallback. Try both variants so a valid key is never reported as a
  // failed connection.
  let reachable = false;
  const publishable = /^sb_publishable_/i.test(anonKey);
  const withBearer = { apikey: anonKey, Authorization: `Bearer ${anonKey}`, Accept: 'application/openapi+json' };
  const apikeyOnly = { apikey: anonKey, Accept: 'application/openapi+json' };
  const variants = publishable ? [apikeyOnly, withBearer] : [withBearer, apikeyOnly];
  let lastStatus = 0;
  let networkDetail: string | null = null;
  let serverDetail: string | null = null;
  for (const headers of variants) {
    try {
      const res = await timedFetch(`${url}/rest/v1/`, { headers });
      lastStatus = res.status;
      if (res.status < 400 || res.status === 404) {
        reachable = true;
        steps.push({ id: 'rest', label: 'Reach project & verify API key', ok: true,
          detail: `Connected to Supabase REST at ${url} (HTTP ${res.status}).` });
        break;
      }
      if (res.status >= 500) { serverDetail = `Supabase returned HTTP ${res.status}. The project may be paused or misconfigured.`; break; }
    } catch (e) {
      networkDetail = e instanceof Error && e.name === 'AbortError'
        ? 'The request timed out. Check the URL, network access and whether the project is paused.'
        : 'Network request failed. Check the Project URL, CORS/allowlist settings and your connection.';
      break;
    }
  }
  if (!reachable) {
    steps.push({ id: 'rest', label: 'Verify API key', ok: false,
      detail: networkDetail ?? serverDetail ?? `Supabase rejected the key (HTTP ${lastStatus || 'no response'}). Confirm you pasted the publishable/anon key, not a secret key, and that the project is active.` });
  }

  // 2. Auth service health (informational — some proxies block this path).
  try {
    const res = await timedFetch(`${url}/auth/v1/health`, { headers: { apikey: anonKey } });
    steps.push({ id: 'auth', label: 'Auth service', ok: res.ok, informational: true,
      detail: res.ok ? 'Supabase Auth is responding.' : `Auth health endpoint returned HTTP ${res.status}.` });
  } catch {
    steps.push({ id: 'auth', label: 'Auth service', ok: false, informational: true,
      detail: 'Auth health endpoint was not reachable (this can be blocked by a proxy without affecting Auth).' });
  }

  // 3. Verify that the application schema exists (informational for connectivity).
  let schemaReady = false;
  try {
    const { createTemporaryClient } = await import('../supabase/factory');
    const client = createTemporaryClient(valid.value!);
    const { error } = await client.from('site_settings').select('id').limit(1);
    if (!error) {
      schemaReady = true;
      steps.push({ id: 'schema', label: 'Application database schema', ok: true, detail: 'Tables are installed and readable with RLS.' });
    } else if (/42P01|does not exist|Could not find the table/i.test(error.message ?? '')) {
      steps.push({ id: 'schema', label: 'Application database schema', ok: false, informational: true,
        detail: 'Connection works, but the database schema is not installed yet. Run supabase/schema.sql in the Supabase SQL Editor.' });
    } else if (/permission|policy|42501/i.test(error.message ?? '')) {
      schemaReady = true;
      steps.push({ id: 'schema', label: 'Application database schema', ok: true, informational: true,
        detail: 'Tables exist (Row Level Security is active).' });
    } else {
      steps.push({ id: 'schema', label: 'Application database schema', ok: false, informational: true, detail: error.message });
    }
  } catch (e) {
    steps.push({ id: 'schema', label: 'Application database schema', ok: false, informational: true,
      detail: e instanceof Error ? e.message : 'Schema check could not be completed.' });
  }

  const ok = reachable;
  const message = !ok
    ? 'Connection failed. Review the diagnostics below — nothing has been saved.'
    : schemaReady
      ? 'Connection successful. Your Supabase project is ready.'
      : 'Connection successful. The project is reachable, but the database schema still needs to be installed (see the SQL setup guide).';
  return { ok, message, schemaReady, steps, projectLabel };
}

/* Client cache invalidation is wired through the factory without a circular import. */
let cacheInvalidator: (() => void) | null = null;
export function registerCacheInvalidator(fn: () => void) { cacheInvalidator = fn; }
export function clearClientCache() { cacheInvalidator?.(); }
