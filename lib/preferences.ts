/* ==================================================================
   DISPLAY PREFERENCES (per browser, never per visitor)
   ------------------------------------------------------------------
   The preferences page used to write `data-density` / `data-contrast`
   onto <html> itself. Those attributes only existed while the visitor
   stayed on /settings, so the choice was silently lost as soon as any
   other page rendered. Reading, applying and persisting the choice now
   lives in ONE module used by both the site bootstrap and the page.
================================================================== */
import type { CSSProperties } from 'react';

export type PreferenceDensity = 'comfortable' | 'compact';
export type PreferenceMotion = 'full' | 'reduced';
export type PreferenceContrast = 'standard' | 'high';

export interface DisplayPreferences {
  currency: string;
  density: PreferenceDensity;
  motion: PreferenceMotion;
  contrast: PreferenceContrast;
}

export const PREFERENCES_KEY = 'imperial-royal.display-preferences.v2';
export const PREFERENCES_EVENT = 'imperial-royal:preferences-change';

export const DEFAULT_PREFERENCES: DisplayPreferences = {
  currency: 'INR',
  density: 'comfortable',
  motion: 'full',
  contrast: 'standard',
};

const CURRENCIES = new Set(['INR', 'USD', 'EUR', 'GBP', 'AED']);
const DENSITIES = new Set<PreferenceDensity>(['comfortable', 'compact']);
const MOTIONS = new Set<PreferenceMotion>(['full', 'reduced']);
const CONTRASTS = new Set<PreferenceContrast>(['standard', 'high']);

/** Never trust localStorage: an old/corrupt/partial payload must not break a page. */
export function normalizePreferences(value: unknown): DisplayPreferences {
  if (!value || typeof value !== 'object') return { ...DEFAULT_PREFERENCES };
  const raw = value as Record<string, unknown>;
  const currency = typeof raw.currency === 'string' ? raw.currency.toUpperCase() : '';
  const density = raw.density as PreferenceDensity;
  const motion = raw.motion as PreferenceMotion;
  const contrast = raw.contrast as PreferenceContrast;
  return {
    currency: CURRENCIES.has(currency) ? currency : DEFAULT_PREFERENCES.currency,
    density: DENSITIES.has(density) ? density : DEFAULT_PREFERENCES.density,
    motion: MOTIONS.has(motion) ? motion : DEFAULT_PREFERENCES.motion,
    contrast: CONTRASTS.has(contrast) ? contrast : DEFAULT_PREFERENCES.contrast,
  };
}

export function readPreferences(): DisplayPreferences {
  if (typeof window === 'undefined') return { ...DEFAULT_PREFERENCES };
  try {
    const raw = window.localStorage.getItem(PREFERENCES_KEY);
    if (!raw) return { ...DEFAULT_PREFERENCES };
    return normalizePreferences(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

/** Applies the choice to the document so it survives client-side navigation. */
export function applyPreferences(preferences: DisplayPreferences): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.dataset.density = preferences.density;
  root.dataset.contrast = preferences.contrast;
  if (preferences.motion === 'reduced') root.dataset.reducedMotion = 'true';
  else delete root.dataset.reducedMotion;
}

export function savePreferences(preferences: DisplayPreferences): DisplayPreferences {
  const next = normalizePreferences(preferences);
  applyPreferences(next);
  try {
    window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(next));
  } catch { /* private mode / storage disabled — the choice still applies for this page */ }
  try {
    window.dispatchEvent(new CustomEvent(PREFERENCES_EVENT, { detail: next }));
  } catch { /* CustomEvent may be unavailable in exotic test runtimes */ }
  return next;
}

/** Inline style helper: keeps reduced-motion styling consistent for inline transitions. */
export function motionSafe(motion: PreferenceMotion, style: CSSProperties): CSSProperties {
  return motion === 'reduced' ? { ...style, transition: 'none' } : style;
}
