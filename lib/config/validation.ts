/* ------------------------------------------------------------------
   Pure, unit-testable configuration validation.
   The single most important security rule in this file:
   a service-role / secret key is NEVER accepted by this application.
------------------------------------------------------------------ */
import type { SupabaseConfig } from '../types';

export type KeyKind = 'publishable' | 'anon' | 'service_role' | 'secret' | 'unknown' | 'empty';

export interface KeyInspection {
  kind: KeyKind;
  role: string | null;
  issuer: string | null;
  safe: boolean;
  reason: string;
}

export interface ValidationResult<T = string> {
  ok: boolean;
  value?: T;
  error?: string;
  warning?: string;
}

function decodeBase64Url(part: string): string | null {
  try {
    const padded = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
    if (typeof atob === 'function') {
      return decodeURIComponent(Array.from(atob(padded)).map(c => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`).join(''));
    }
    return Buffer.from(padded, 'base64').toString('utf8');
  } catch { return null; }
}

export function inspectKey(raw: string | null | undefined): KeyInspection {
  const key = (raw ?? '').trim();
  if (!key) return { kind: 'empty', role: null, issuer: null, safe: false, reason: 'No key provided.' };

  if (/^sb_secret_/i.test(key) || /service[-_]?role/i.test(key)) {
    return { kind: 'secret', role: 'service_role', issuer: null, safe: false,
      reason: 'Secret / service-role keys must never be used in a browser application. Use the publishable or legacy anon key instead.' };
  }

  if (/^sb_publishable_/i.test(key)) {
    return { kind: 'publishable', role: 'anon', issuer: null, safe: true,
      reason: 'Supabase publishable key.' };
  }

  const segments = key.split('.');
  if (segments.length === 3) {
    const payload = decodeBase64Url(segments[1]);
    if (payload) {
      try {
        const claims = JSON.parse(payload) as { role?: string; iss?: string };
        const role = claims.role ?? null;
        if (role === 'service_role') {
          return { kind: 'service_role', role, issuer: claims.iss ?? null, safe: false,
            reason: 'This is a service-role JWT. It bypasses Row Level Security and must never be placed in browser code or public configuration.' };
        }
        if (role === 'anon') {
          return { kind: 'anon', role, issuer: claims.iss ?? null, safe: true, reason: 'Legacy Supabase anon key.' };
        }
        return { kind: 'unknown', role, issuer: claims.iss ?? null, safe: false,
          reason: `This JWT has the "${role ?? 'unknown'}" role. Only anon or publishable keys are accepted.` };
      } catch { /* fall through */ }
    }
  }

  return { kind: 'unknown', role: null, issuer: null, safe: false,
    reason: 'Unrecognised key format. Paste a sb_publishable_… key or a legacy anon JWT.' };
}

export function validateAnonKey(raw: string | null | undefined): ValidationResult<string> {
  const key = (raw ?? '').trim();
  const info = inspectKey(key);
  if (!info.safe) return { ok: false, error: info.reason };
  return { ok: true, value: key };
}

export function validateProjectUrl(raw: string | null | undefined): ValidationResult<string> {
  let value = (raw ?? '').trim();
  if (!value) return { ok: false, error: 'Supabase Project URL is required.' };
  if (/^[\w.-]+(:\d+)?$/.test(value) && !/^https?:\/\//i.test(value) && !value.includes('/')) {
    value = `https://${value}`;
  }
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
  let parsed: URL;
  try { parsed = new URL(value); } catch { return { ok: false, error: 'Enter a valid URL, for example https://your-project.supabase.co' }; }
  if (!['https:', 'http:'].includes(parsed.protocol)) return { ok: false, error: 'Only http(s) project URLs are supported.' };
  if (parsed.protocol === 'http:' && !['localhost', '127.0.0.1'].includes(parsed.hostname)) {
    return { ok: false, error: 'Use HTTPS for hosted Supabase projects. HTTP is allowed for local development only.' };
  }
  if (parsed.pathname !== '/' && parsed.pathname !== '') return { ok: false, error: 'The Project URL should not contain a path.' };
  if (parsed.search || parsed.hash) return { ok: false, error: 'The Project URL should not contain a query string or fragment.' };
  if (!parsed.hostname.includes('.') && !['localhost', '127.0.0.1'].includes(parsed.hostname)) {
    return { ok: false, error: 'Enter a full project URL such as https://your-project.supabase.co (or a self-hosted host/IP).' };
  }
  const normalized = parsed.toString().replace(/\/+$/, '');
  const isSupabaseCloud = /\.supabase\.(co|in|net)$/i.test(parsed.hostname) || /supabase\.co$/i.test(parsed.hostname);
  const isLocal = ['localhost', '127.0.0.1'].includes(parsed.hostname);
  return {
    ok: true,
    value: normalized,
    warning: isSupabaseCloud || isLocal ? undefined : 'This does not look like a supabase.co project URL. Custom/self-hosted domains are supported if the REST and Auth endpoints are reachable.',
  };
}

export function validateConfig(input: Partial<SupabaseConfig> | null | undefined): ValidationResult<SupabaseConfig> {
  if (!input) return { ok: false, error: 'No configuration provided.' };
  const url = validateProjectUrl(input.url);
  if (!url.ok) return { ok: false, error: url.error };
  const key = validateAnonKey(input.anonKey);
  if (!key.ok) return { ok: false, error: key.error };
  return { ok: true, value: { url: url.value!, anonKey: key.value! }, warning: url.warning };
}

/** The only shape that may be saved locally, published publicly or exported. */
export function serializeConfig(config: SupabaseConfig, source = 'imperial-royal'): string {
  return JSON.stringify({
    schemaVersion: 1,
    source,
    url: config.url.trim(),
    anonKey: config.anonKey.trim(),
    publishedAt: new Date().toISOString(),
    note: 'Contains a PUBLIC publishable/anon key only. Row Level Security protects all data. Never add a service-role key.',
  }, null, 2);
}

export function parseImportedConfig(raw: string): ValidationResult<SupabaseConfig> {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return { ok: false, error: 'The selected file is not valid JSON.' }; }
  if (!parsed || typeof parsed !== 'object') return { ok: false, error: 'The configuration file is empty or invalid.' };
  const obj = parsed as Record<string, unknown>;
  if (typeof obj.service_role === 'string' || typeof obj.serviceRoleKey === 'string' || typeof obj.secret_key === 'string') {
    return { ok: false, error: 'This file contains a service-role credential and was refused.' };
  }
  return validateConfig({ url: String(obj.url ?? ''), anonKey: String(obj.anonKey ?? obj.publishableKey ?? obj.anon_key ?? '') });
}

export function maskKey(key: string | null | undefined): string {
  if (!key) return '—';
  if (key.length <= 12) return '••••••••';
  return `${key.slice(0, 6)}••••••••${key.slice(-4)}`;
}

export function isServiceRoleExposure(value: string): boolean {
  const info = inspectKey(value);
  return info.kind === 'service_role' || info.kind === 'secret' || /service_role|sb_secret_/i.test(value);
}
