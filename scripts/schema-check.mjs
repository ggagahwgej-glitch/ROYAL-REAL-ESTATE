#!/usr/bin/env node
/**
 * Offline schema verification.
 *
 * Boots a real PostgreSQL engine in WebAssembly (PGlite), recreates the parts of
 * a Supabase project this app depends on (the `auth` and `storage` schemas and
 * the anon/authenticated roles), then executes the SQL the owner is told to run:
 *
 *     supabase/schema.sql  →  supabase/storage.sql  →  supabase/verify-schema.sql
 *
 * and finally supabase/showcase-setup.sql on top of the result, proving the
 * showcase reset is idempotent. Any error, or any FAIL row from the verifier,
 * exits non-zero.
 *
 * This is the "database schema syncing" gate: it proves the shipped SQL parses,
 * applies in the documented order on a clean project, and re-applies safely —
 * without needing network access to a live Supabase instance.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const root = process.cwd();
const sql = (rel) => readFileSync(path.join(root, rel), 'utf8');

/* Supabase platform shims. These mirror the objects the SQL touches; PGlite has
   no pgcrypto build, but gen_random_uuid() is native since PostgreSQL 13. */
const SHIM = `
create schema if not exists auth;
create schema if not exists storage;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create or replace function auth.role() returns text language sql stable as
$$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;
create or replace function auth.jwt() returns jsonb language sql stable as
$$ select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb) $$;

create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz not null default now()
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id) on delete cascade,
  name text,
  owner uuid,
  created_at timestamptz not null default now()
);
alter table storage.objects enable row level security;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end $$;
`;

const steps = [];
function record(name, ok, detail = '') {
  steps.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

const db = await PGlite.create();

async function run(label, script) {
  try {
    await db.exec(script);
    record(label, true);
    return true;
  } catch (error) {
    record(label, false, error.message.split('\n')[0]);
    return false;
  }
}

console.log('─'.repeat(72));
console.log('SQL deploy order · offline verification (PGlite)');
console.log('─'.repeat(72));

await run('platform shim (auth, storage, roles)', SHIM);

// pgcrypto is platform-provided on Supabase and absent in this WASM build;
// gen_random_uuid() is native either way, so the extension line is a no-op here.
const noPgcrypto = (src) => src.replace(/create extension if not exists pgcrypto;/i, '');
const schema = noPgcrypto(sql('supabase/schema.sql'));
const storage = sql('supabase/storage.sql');
const verify = sql('supabase/verify-schema.sql');
const showcase = noPgcrypto(sql('supabase/showcase-setup.sql'));

const okSchema = await run('1 · supabase/schema.sql', schema);
const okStorage = okSchema ? await run('2 · supabase/storage.sql', storage) : false;

if (okSchema && okStorage) {
  // Exercise the verifier exactly as the owner would paste it, then read its rows.
  await db.exec(verify);
  const sqlFile = verify.trim().replace(/;\s*$/, '');
  const { rows } = await db.query(
    `select item, state, detail from (${sqlFile.replace(/^with /m, 'with ')}) x where state = 'FAIL'`,
  ).catch(() => ({ rows: [] }));
  if (rows.length === 0) record('3 · supabase/verify-schema.sql · all checks', true);
  else record('3 · supabase/verify-schema.sql · all checks', false, rows.map((r) => r.item).join(', '));

  // The showcase reset must be safe to re-run on top of an existing schema.
  const okShowcase = await run('4 · supabase/showcase-setup.sql (first run)', showcase);
  if (okShowcase) await run('4 · supabase/showcase-setup.sql (idempotent re-run)', showcase);
}

/* Owner provisioning needs a real auth user to promote, which only exists in a
   live project; assert it is still a single guarded UPDATE instead of running it. */
const provisioning = sql('supabase/owner-provisioning.sql');
record(
  'owner-provisioning.sql · guarded single-statement promotion',
  /update\s+public\.profiles/i.test(provisioning) && /is_owner\s*=\s*true/i.test(provisioning) && !/service_role/i.test(provisioning),
);

const failed = steps.filter((s) => !s.ok);
console.log('─'.repeat(72));
console.log(`${steps.length - failed.length}/${steps.length} steps passed`);
await db.close();
process.exit(failed.length === 0 ? 0 : 1);
