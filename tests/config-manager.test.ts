/* Simulated-browser integration tests for the centralized configuration manager:
   save → reload persistence, local vs shared scope, import/export and
   "only save valid configurations". */
import { beforeAll, describe, expect, it, vi } from 'vitest';

const URL = 'https://abcdefghijkl.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6Imh0dHBzOi8vYWJjLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJpYXQiOjE3MDAwMDAwMDAsImV4cCI6MjAwMDAwMDAwMH0.signature';
const SERVICE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoiaHR0cHM6Ly9hYmMuc3VwYWJhc2UuY28vYXV0aC92MSIsImlhdCI6MTcwMDAwMDAwMCwiZXhwIjoyMDAwMDAwMDAwfQ.signature';

const store = new Map<string, string>();
let shared: Record<string, unknown> = { configured: false, url: '', anonKey: '' };

beforeAll(() => {
  const localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; },
    clear: () => store.clear(),
  };
  vi.stubGlobal('localStorage', localStorage);
  vi.stubGlobal('window', {
    localStorage,
    dispatchEvent: () => true,
    addEventListener: () => {},
    location: { origin: 'https://example.com' },
  });
  vi.stubGlobal('CustomEvent', class { type: string; constructor(type: string) { this.type = type; } });
  vi.stubGlobal('fetch', async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    if (url.includes('/api/public-config')) {
      if (method === 'POST') {
        const body = JSON.parse(String(init?.body)) as { config: { url: string; anonKey: string } };
        shared = { configured: true, ...body.config, publishedAt: new Date().toISOString(), storage: 'server', persistent: true };
        return { ok: true, status: 200, json: async () => ({ ok: true, mode: 'persisted', message: 'published' }) } as Response;
      }
      return { ok: true, status: 200, json: async () => shared } as Response;
    }
    if (url.includes('/public-config.json')) {
      return { ok: true, status: 200, json: async () => ({ schemaVersion: 1, url: '', anonKey: '', publishedAt: null }) } as Response;
    }
    // Supabase REST probe used by testConnection
    return { ok: false, status: 401, json: async () => ({}), headers: new Headers() } as Response;
  });
});

describe('configuration manager — browser persistence', () => {
  it('starts in a clean, unconfigured state', async () => {
    const m = await import('../lib/config/manager');
    store.clear();
    shared = { configured: false, url: '', anonKey: '' };
    const state = await m.initialize(true);
    expect(state.initialized).toBe(true);
    expect(state.config).toBeNull();
    expect(state.source).toBe('none');
    expect(state.shared).toBeNull();
  });

  it('refuses to persist an invalid or privileged configuration', async () => {
    const m = await import('../lib/config/manager');
    expect(m.saveLocalConfig({ url: 'not-a-url', anonKey: ANON }).ok).toBe(false);
    expect(m.saveLocalConfig({ url: URL, anonKey: SERVICE }).ok).toBe(false);
    expect(m.saveLocalConfig({ url: URL, anonKey: '' }).ok).toBe(false);
    expect(store.has(m.LOCAL_STORAGE_KEY)).toBe(false);
  });

  it('saves a valid local config and persists it across a simulated reload', async () => {
    const m = await import('../lib/config/manager');
    const saved = m.saveLocalConfig({ url: URL, anonKey: ANON });
    expect(saved.ok).toBe(true);
    expect(store.has(m.LOCAL_STORAGE_KEY)).toBe(true);
    expect(m.getConfig()).toEqual({ url: URL, anonKey: ANON });
    expect(m.getConfigSource()).toBe('local');
    // Simulate a page reload: re-run bootstrap from storage.
    const reloaded = await m.initialize(true);
    expect(reloaded.source).toBe('local');
    expect(reloaded.config?.url).toBe(URL);
    expect(reloaded.local?.anonKey).toBe(ANON);
  });

  it('exports an artifact that re-imports to the same public config', async () => {
    const m = await import('../lib/config/manager');
    const artifact = m.exportConfig();
    expect(artifact).toBeTruthy();
    expect(artifact).not.toContain('service_role');
    const imported = m.importConfig(artifact!);
    expect(imported.ok).toBe(true);
    expect(imported.value).toEqual({ url: URL, anonKey: ANON });
  });

  it('update requires an existing local config', async () => {
    const m = await import('../lib/config/manager');
    m.clearLocalConfig();
    expect(m.updateLocalConfig({ url: URL, anonKey: ANON }).ok).toBe(false);
    m.saveLocalConfig({ url: URL, anonKey: ANON });
    expect(m.updateLocalConfig({ url: 'https://updated.supabase.co', anonKey: ANON }).ok).toBe(true);
    expect(m.getConfig()?.url).toBe('https://updated.supabase.co');
  });

  it('distinguishes local browser config from shared public config', async () => {
    const m = await import('../lib/config/manager');
    m.clearLocalConfig();
    let state = await m.initialize(true);
    expect(state.shared).toBeNull();
    expect(state.config).toBeNull();

    const published = await m.publishSharedConfig({ url: URL, anonKey: ANON }, 'a.b.c');
    expect(published.ok).toBe(true);
    state = await m.initialize(true);
    expect(state.shared?.url).toBe(URL);
    expect(state.source).toBe('shared');
    expect(state.config?.url).toBe(URL);

    // A local override takes precedence and is explicitly labelled local.
    m.saveLocalConfig({ url: 'https://local-only.supabase.co', anonKey: ANON });
    expect(m.getConfigSource()).toBe('local');
    expect(m.getConfig()?.url).toBe('https://local-only.supabase.co');
    m.clearLocalConfig();
    expect(m.getConfigSource()).toBe('shared');
  });

  it('clear removes only local browser configuration', async () => {
    const m = await import('../lib/config/manager');
    m.saveLocalConfig({ url: URL, anonKey: ANON });
    m.clearLocalConfig();
    expect(store.has(m.LOCAL_STORAGE_KEY)).toBe(false);
    expect(m.getConfigSource()).toBe('shared');
  });

  it('a failed connection test never reports success', async () => {
    const m = await import('../lib/config/manager');
    const result = await m.testConnection({ url: URL, anonKey: ANON });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/Connection failed/i);
    expect(result.steps.find(s => s.id === 'rest')?.ok).toBe(false);
  });
});
