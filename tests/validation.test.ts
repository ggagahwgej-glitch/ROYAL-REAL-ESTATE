import { describe, expect, it } from 'vitest';
import {
  inspectKey, isServiceRoleExposure, maskKey, parseImportedConfig, serializeConfig,
  validateAnonKey, validateConfig, validateProjectUrl,
} from '../lib/config/validation';

const URL = 'https://abcdefghijkl.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6Imh0dHBzOi8vYWJjLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJpYXQiOjE3MDAwMDAwMDAsImV4cCI6MjAwMDAwMDAwMH0.signature';
const SERVICE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoiaHR0cHM6Ly9hYmMuc3VwYWJhc2UuY28vYXV0aC92MSIsImlhdCI6MTcwMDAwMDAwMCwiZXhwIjoyMDAwMDAwMDAwfQ.signature';

describe('project URL validation', () => {
  it('accepts a valid supabase.co URL and strips trailing slashes', () => {
    const r = validateProjectUrl(`${URL}/`);
    expect(r.ok).toBe(true);
    expect(r.value).toBe(URL);
  });
  it('adds a missing https scheme', () => {
    expect(validateProjectUrl('abcdefghijkl.supabase.co').value).toBe(URL);
  });
  it('rejects empty, non-http and path-bearing values', () => {
    expect(validateProjectUrl('').ok).toBe(false);
    expect(validateProjectUrl('ftp://x.supabase.co').ok).toBe(false);
    expect(validateProjectUrl(`${URL}/rest/v1`).ok).toBe(false);
    expect(validateProjectUrl('http://evil.example.com').ok).toBe(false);
    expect(validateProjectUrl('not-a-url').ok).toBe(false);
    expect(validateProjectUrl('https://custom.supabase.example.org').ok).toBe(true);
  });
  it('allows localhost http for self-hosted development', () => {
    expect(validateProjectUrl('http://localhost:54321').ok).toBe(true);
  });
});

describe('key inspection — service-role keys must never be accepted', () => {
  it('accepts publishable and legacy anon keys', () => {
    expect(inspectKey('sb_publishable_abc123XYZ').kind).toBe('publishable');
    expect(inspectKey('sb_publishable_abc123XYZ').safe).toBe(true);
    expect(inspectKey(ANON).kind).toBe('anon');
    expect(inspectKey(ANON).safe).toBe(true);
    expect(validateAnonKey(ANON).ok).toBe(true);
  });
  it('rejects service-role JWTs, sb_secret keys and unknown keys', () => {
    expect(inspectKey(SERVICE).kind).toBe('service_role');
    expect(inspectKey(SERVICE).safe).toBe(false);
    expect(validateAnonKey(SERVICE).ok).toBe(false);
    expect(inspectKey('sb_secret_abcdef').kind).toBe('secret');
    expect(validateAnonKey('sb_secret_abcdef').ok).toBe(false);
    expect(validateAnonKey('not-a-key').ok).toBe(false);
    expect(validateAnonKey('').ok).toBe(false);
  });
  it('refuses a whole configuration containing a service-role key', () => {
    expect(validateConfig({ url: URL, anonKey: SERVICE }).ok).toBe(false);
    expect(validateConfig({ url: URL, anonKey: ANON }).ok).toBe(true);
    expect(validateConfig(null).ok).toBe(false);
  });
  it('detects service-role exposure in arbitrary strings', () => {
    expect(isServiceRoleExposure(SERVICE)).toBe(true);
    expect(isServiceRoleExposure('sb_secret_key')).toBe(true);
    expect(isServiceRoleExposure(ANON)).toBe(false);
  });
});

describe('import / export workflow', () => {
  it('round-trips a valid artifact and never emits a service-role field', () => {
    const artifact = serializeConfig({ url: URL, anonKey: ANON });
    expect(artifact).not.toMatch(/service_role|sb_secret_/);
    const parsed = parseImportedConfig(artifact);
    expect(parsed.ok).toBe(true);
    expect(parsed.value).toEqual({ url: URL, anonKey: ANON });
  });
  it('refuses malformed JSON, empty files and files with secret credentials', () => {
    expect(parseImportedConfig('{nope').ok).toBe(false);
    expect(parseImportedConfig('{}').ok).toBe(false);
    expect(parseImportedConfig(JSON.stringify({ url: URL, anonKey: ANON, service_role: SERVICE })).ok).toBe(false);
    expect(parseImportedConfig(JSON.stringify({ url: URL, anonKey: SERVICE })).ok).toBe(false);
  });
  it('masks keys for display', () => {
    expect(maskKey(ANON)).not.toContain('eyJyb2xl');
    expect(maskKey(null)).toBe('—');
  });
});
