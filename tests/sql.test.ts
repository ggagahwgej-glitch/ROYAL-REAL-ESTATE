import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

/**
 * Database-schema gate.
 *
 * `scripts/schema-check.mjs` boots PostgreSQL in WebAssembly and executes the
 * exact SQL the owner is told to run, in the documented order, twice. This test
 * wraps it plus the static rules that keep the shipped SQL honest.
 */

const root = process.cwd();
const read = (rel: string) => readFileSync(path.join(root, rel), 'utf8');
const stripComments = (src: string) => src.replace(/--[^\n]*/g, '');

describe('sql · offline deploy order', () => {
  it('applies schema → storage → verify → showcase and stays idempotent', () => {
    const out = execFileSync('node', ['scripts/schema-check.mjs'], {
      cwd: root,
      encoding: 'utf8',
      timeout: 180_000,
    });
    expect(out).toMatch(/7\/7 steps passed/);
    expect(out).not.toMatch(/^FAIL/m);
  }, 200_000);
});

describe('sql · shipped scripts', () => {
  it('keeps every supabase script byte-identical to its public/sql copy', () => {
    const files = readdirSync(path.join(root, 'supabase')).filter((f) => f.endsWith('.sql'));
    expect(files.length).toBeGreaterThan(4);
    for (const file of files) {
      expect(read(`public/sql/${file}`), `${file} is out of sync with public/sql`).toBe(
        read(`supabase/${file}`),
      );
    }
  });

  it('ships a verification script that fits in one SQL-editor block', () => {
    // Standing owner requirement: any hand-delivered SQL stays under 180 lines.
    const lines = read('supabase/verify-schema.sql').trimEnd().split('\n');
    expect(lines.length).toBeLessThanOrEqual(180);
  });

  it('keeps the verification script strictly read-only', () => {
    const body = stripComments(read('supabase/verify-schema.sql'));
    // It may run SELECTs and a DO block of SELECTs; it must never mutate.
    expect(body).not.toMatch(/(^|;)\s*(create|alter|drop|grant|revoke|truncate)\b/i);
    expect(body).not.toMatch(/(^|;)\s*(insert\s+into|update\s+\w|delete\s+from)\b/i);
    expect(body).toMatch(/to_regclass\('public\.properties'\)/);
  });

  it('creates is_owner() after the table it reads', () => {
    // A SQL-language body is analysed at CREATE time, so declaring the helper
    // before public.profiles breaks the very first run on a clean project.
    const schema = read('supabase/schema.sql');
    expect(schema.indexOf('create table if not exists public.profiles')).toBeLessThan(
      schema.indexOf('create or replace function public.is_owner()'),
    );
  });

  it('inlines the same schema into the showcase setup, so one file can reset everything', () => {
    const schema = read('supabase/schema.sql');
    const showcase = read('supabase/showcase-setup.sql');
    expect(showcase.indexOf('create table if not exists public.profiles')).toBeLessThan(
      showcase.indexOf('create or replace function public.is_owner()'),
    );
    expect(showcase).toContain('create extension if not exists pgcrypto;');
    expect(schema).toContain('create extension if not exists pgcrypto;');
  });
});
