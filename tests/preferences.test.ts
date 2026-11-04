/* Regression tests for display preferences: a corrupt payload must never break
   a page, and the choice must be applied to <html> on EVERY page (it used to
   exist only while /settings was mounted). */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_PREFERENCES, PREFERENCES_KEY, applyPreferences, normalizePreferences,
  readPreferences, savePreferences,
} from '../lib/preferences';

const store = new Map<string, string>();
const dataset: Record<string, string> = {};
const dispatched: string[] = [];

beforeEach(() => {
  store.clear();
  for (const key of Object.keys(dataset)) delete dataset[key];
  dispatched.length = 0;

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
    dispatchEvent: (event: { type: string }) => { dispatched.push(event.type); return true; },
  });
  vi.stubGlobal('document', { documentElement: { dataset } });
  vi.stubGlobal('CustomEvent', class { type: string; constructor(type: string) { this.type = type; } });
});

describe('display preferences', () => {
  it('falls back to the documented defaults when nothing is stored', () => {
    expect(readPreferences()).toEqual(DEFAULT_PREFERENCES);
  });

  it('never trusts a corrupt or partial payload', () => {
    store.set(PREFERENCES_KEY, '{not json');
    expect(readPreferences()).toEqual(DEFAULT_PREFERENCES);

    expect(normalizePreferences({ currency: 'XYZ', density: 'huge', motion: 'none', contrast: 42 }))
      .toEqual(DEFAULT_PREFERENCES);

    expect(normalizePreferences({ currency: 'usd', density: 'compact' }))
      .toEqual({ ...DEFAULT_PREFERENCES, currency: 'USD', density: 'compact' });
  });

  it('applies the choice to <html> and removes the flag when motion returns to full', () => {
    applyPreferences({ ...DEFAULT_PREFERENCES, density: 'compact' });
    expect(dataset.density).toBe('compact');
    expect(dataset.reducedMotion).toBeUndefined();

    applyPreferences({ ...DEFAULT_PREFERENCES, motion: 'reduced' });
    expect(dataset.reducedMotion).toBe('true');
    applyPreferences({ ...DEFAULT_PREFERENCES, motion: 'full' });
    expect(dataset.reducedMotion).toBeUndefined();
  });

  it('persists and re-reads the visitor choice, and announces the change', () => {
    const saved = savePreferences({ ...DEFAULT_PREFERENCES, contrast: 'high', motion: 'reduced' });
    expect(saved.contrast).toBe('high');
    expect(dataset.contrast).toBe('high');
    expect(dataset.reducedMotion).toBe('true');
    expect(readPreferences()).toEqual(saved);
    expect(dispatched).toContain('imperial-royal:preferences-change');
  });

  it('still applies the choice when storage is unavailable (private mode)', () => {
    const blocked = {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
      removeItem: () => { throw new Error('blocked'); },
      key: () => null, length: 0, clear: () => {},
    };
    vi.stubGlobal('window', { localStorage: blocked, dispatchEvent: () => true });
    expect(readPreferences()).toEqual(DEFAULT_PREFERENCES);
    const saved = savePreferences({ ...DEFAULT_PREFERENCES, density: 'compact' });
    expect(saved.density).toBe('compact');
    expect(dataset.density).toBe('compact');
  });
});
