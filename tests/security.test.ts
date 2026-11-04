/* Static security assertions — these complement the live diagnostics and
   the executable supabase/rls-tests.sql. */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '..');
const read = (p: string) => readFileSync(path.join(root, p), 'utf8');

function walk(dir: string): string[] {
  return readdirSync(path.join(root, dir)).flatMap(name => {
    const rel = path.join(dir, name);
    const full = path.join(root, rel);
    if (statSync(full).isDirectory()) {
      if (['node_modules', '.next', '.git', 'data'].includes(name)) return [];
      return walk(rel);
    }
    return [rel];
  });
}

describe('no service-role credential in browser-accessible code', () => {
  it('contains no service-role key value or sb_secret_ token in app/lib/components/public', () => {
    const files = [...walk('app'), ...walk('lib'), ...walk('components'), ...walk('public')]
      .filter(f => /\.(ts|tsx|js|jsx|json|css|html|mjs|svg)$/.test(f));
    const offenders = files.filter(f => {
      const body = read(f);
      // Detection strings in validation/docs are fine; actual secrets are not.
      return /sb_secret_[A-Za-z0-9]{12,}/.test(body) || /"role"\s*:\s*"service_role"\s*,\s*"key"/.test(body);
    });
    expect(offenders).toEqual([]);
  });
  it('never calls createClient with a service-role variable outside the factory', () => {
    const offenders = [...walk('app'), ...walk('lib'), ...walk('components')]
      .filter(f => /\.(ts|tsx)$/.test(f))
      .filter(f => /createClient\(/.test(read(f)) && !f.includes('lib/supabase/factory.ts'));
    expect(offenders).toEqual([]);
  });
  it('does not reference a 12-digit secret code / PIN anywhere', () => {
    const files = [...walk('app'), ...walk('lib'), ...walk('components')].filter(f => /\.(ts|tsx|css)$/.test(f));
    const offenders = files.filter(f => /12[- ]?digit|secretCode|secretPin|ownerPin|securityCode/i.test(read(f)));
    expect(offenders).toEqual([]);
  });
});

describe('RLS schema assertions', () => {
  const sql = read('supabase/schema.sql');
  const storage = read('supabase/storage.sql');
  it('enables RLS on all five application tables', () => {
    for (const t of ['profiles', 'properties', 'property_media', 'inquiries', 'site_settings']) {
      expect(sql).toMatch(new RegExp(`alter table public\\.${t}\\s+enable row level security`));
    }
  });
  it('grants public read of published listings only', () => {
    expect(sql).toMatch(/public read published[\s\S]{0,200}status = 'published'/);
  });
  it('has NO insert/update/delete policy on profiles and protects the owner flag', () => {
    const profilePolicies = sql.match(/create policy[^;]*on public\.profiles[^;]*;/g) ?? [];
    expect(profilePolicies.every(p => /for select/.test(p))).toBe(true);
    expect(sql).toMatch(/protect_owner_flag/);
    expect(sql).toMatch(/cannot be self-assigned/);
  });
  it('forces inquiry status and restricts anonymous inserts', () => {
    expect(sql).toMatch(/new\.status := 'new'/);
    expect(sql).toMatch(/inquiries: public controlled insert/);
    expect(sql).not.toMatch(/create policy "inquiries: public select/);
  });
  it('requires is_owner() for all owner writes', () => {
    expect((sql.match(/public\.is_owner\(\)/g) ?? []).length).toBeGreaterThanOrEqual(8);
  });
  it('creates a private storage bucket with owner-only read', () => {
    expect(storage).toMatch(/'owner-private', 'owner-private', false/);
    expect(storage).toMatch(/owner read private/);
    expect(storage).toMatch(/public\.is_owner\(\)/);
  });
});
