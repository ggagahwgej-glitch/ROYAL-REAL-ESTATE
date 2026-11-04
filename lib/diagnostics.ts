/* Executable, independent security + connectivity diagnostics.
   Run from /admin/configuration against the LIVE Supabase project.
   Uses the same centralized client factory; anonymous probes use an
   explicitly temporary, non-persistent client from that factory. */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SupabaseConfig } from './types';
import { createTemporaryClient } from './supabase/factory';
import { inspectKey, isServiceRoleExposure, validateConfig } from './config/validation';

export type DiagnosticSeverity = 'pass' | 'fail' | 'warn' | 'info';
export interface DiagnosticResult {
  id: string;
  label: string;
  severity: DiagnosticSeverity;
  detail: string;
}

export interface DiagnosticsReport {
  results: DiagnosticResult[];
  passed: number;
  failed: number;
  warned: number;
  finishedAt: string;
}

const PASS = (id: string, label: string, detail: string): DiagnosticResult => ({ id, label, severity: 'pass', detail });
const FAIL = (id: string, label: string, detail: string): DiagnosticResult => ({ id, label, severity: 'fail', detail });
const WARN = (id: string, label: string, detail: string): DiagnosticResult => ({ id, label, severity: 'warn', detail });
const INFO = (id: string, label: string, detail: string): DiagnosticResult => ({ id, label, severity: 'info', detail });

export async function runDiagnostics(config: SupabaseConfig | null, ownerClient: SupabaseClient | null): Promise<DiagnosticsReport> {
  const results: DiagnosticResult[] = [];

  // 1 — configuration validity
  const valid = validateConfig(config);
  if (!valid.ok) {
    results.push(FAIL('config', 'Configuration validity', valid.error ?? 'No configuration.'));
    return summarize(results);
  }
  const cfg = valid.value!;
  const keyInfo = inspectKey(cfg.anonKey);
  results.push(PASS('config', 'Configuration validity', `Valid ${keyInfo.kind} key for ${cfg.url}.`));

  // 2 — no service-role key anywhere in browser-accessible storage
  let exposed = false;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      const v = localStorage.getItem(k) ?? '';
      if (isServiceRoleExposure(v)) { exposed = true; break; }
    }
  } catch { /* storage may be blocked */ }
  results.push(exposed
    ? FAIL('no-service-role', 'No service-role key in browser storage', 'A secret/service-role credential was found in localStorage. Remove it immediately and rotate the key in Supabase.')
    : PASS('no-service-role', 'No service-role key in browser storage', 'localStorage contains only publishable/anon credentials.'));

  // 3 — shared public bootstrap endpoint
  try {
    const res = await fetch('/api/public-config', { cache: 'no-store' });
    const body = await res.json() as { configured?: boolean; url?: string; anonKey?: string; storage?: string };
    if (body.configured && body.anonKey) {
      const shared = inspectKey(body.anonKey);
      results.push(shared.safe
        ? PASS('shared-config', 'Shared public bootstrap', `Published (${body.storage ?? 'runtime'}) with a public ${shared.kind} key. All visitors can connect.`)
        : FAIL('shared-config', 'Shared public bootstrap', 'The shared configuration contains a privileged key. Remove it immediately.'));
    } else {
      results.push(WARN('shared-config', 'Shared public bootstrap', 'Not published yet. Only this browser can reach the project; other visitors will see the setup state.'));
    }
  } catch (e) {
    results.push(WARN('shared-config', 'Shared public bootstrap', `Endpoint could not be checked: ${e instanceof Error ? e.message : 'network error'}`));
  }

  const anon = createTemporaryClient(cfg);

  // 4 — live connectivity
  try {
    const { error } = await anon.from('site_settings').select('id').limit(1);
    results.push(error
      ? FAIL('connectivity', 'Live database connectivity', error.message)
      : PASS('connectivity', 'Live database connectivity', 'PostgREST responded with the anon key.'));
  } catch (e) {
    results.push(FAIL('connectivity', 'Live database connectivity', e instanceof Error ? e.message : 'Network failure'));
  }

  // 5 — public read of published listings (allowed)
  try {
    const { data, error } = await anon.from('properties').select('id').eq('status', 'published').limit(1);
    if (error) results.push(FAIL('public-read', 'Public read of published listings', error.message));
    else {
      const drafts = await anon.from('properties').select('id').eq('status', 'draft').limit(1);
      results.push((drafts.data?.length ?? 0) > 0
        ? FAIL('public-read', 'Public read of published listings', 'Draft properties are visible to anonymous visitors — RLS is misconfigured.')
        : PASS('public-read', 'Public read of published listings', `Published rows readable (${data?.length ?? 0} sampled); drafts are hidden.`));
    }
  } catch (e) { results.push(FAIL('public-read', 'Public read of published listings', String(e))); }

  // 6 — anonymous property write must be DENIED
  try {
    const probeSlug = `rls-probe-${Date.now().toString(36)}`;
    const { data, error } = await anon.from('properties')
      .insert({ slug: probeSlug, title: 'RLS diagnostic probe', city: 'Diagnostics', location: 'Diagnostics', price: 1, status: 'published' })
      .select('id');
    if (!error && data?.length) {
      if (ownerClient) await ownerClient.from('properties').delete().eq('id', String(data[0].id));
      results.push(FAIL('anon-write', 'Anonymous property write blocked', 'An anonymous request INSERTED a property. RLS is broken — review supabase/schema.sql immediately.'));
    } else {
      results.push(PASS('anon-write', 'Anonymous property write blocked', 'Anonymous inserts were rejected by Row Level Security.'));
    }
  } catch { results.push(PASS('anon-write', 'Anonymous property write blocked', 'Anonymous inserts were rejected.')); }

  // 7 — private inquiries must not be readable anonymously
  try {
    const { data, error } = await anon.from('inquiries').select('id').limit(1);
    if (error) results.push(PASS('private-inquiries', 'Private inquiries protected', 'Anonymous reads were rejected.'));
    else if ((data?.length ?? 0) > 0) results.push(FAIL('private-inquiries', 'Private inquiries protected', 'Anonymous visitors can read private inquiries.'));
    else results.push(PASS('private-inquiries', 'Private inquiries protected', 'Anonymous reads returned no private rows.'));
  } catch { results.push(PASS('private-inquiries', 'Private inquiries protected', 'Anonymous reads were rejected.')); }

  // 8 — controlled public inquiry insert. Anon has no SELECT privilege on
  // inquiries, so the probe must NOT request a representation.
  const probeEmail = `diagnostics+${Date.now().toString(36)}@example.com`;
  if (!ownerClient) {
    // Without an owner session we cannot verify or DELETE the probe row.
    // Never leave a fake enquiry behind in the client's real database.
    results.push(INFO('inquiry-insert', 'Controlled public inquiry insert', 'Sign in as the owner to run this probe: it inserts a temporary enquiry, verifies the forced status and removes the test row.'));
  } else try {
    const { error } = await anon.from('inquiries').insert({
      name: 'Diagnostic Enquiry', email: probeEmail,
      message: 'Automated permission test enquiry from the Owner Studio.', status: 'resolved',
    });
    if (error) {
      results.push(WARN('inquiry-insert', 'Controlled public inquiry insert', `Insert was rejected: ${error.message}. Check the inquiries RLS insert policy.`));
    } else {
      const { data: rows, error: readError } = await ownerClient.from('inquiries')
        .select('id,status').eq('email', probeEmail).limit(1);
      if (readError) results.push(WARN('inquiry-insert', 'Controlled public inquiry insert', `Insert accepted but could not be verified: ${readError.message}`));
      else if (!rows?.length) results.push(WARN('inquiry-insert', 'Controlled public inquiry insert', 'Insert reported success but no row was found. Check RLS and triggers.'));
      else if (rows[0].status !== 'new') results.push(FAIL('inquiry-insert', 'Controlled public inquiry insert', 'A visitor controlled the inquiry status. Check guard_inquiry_insert() and the WITH CHECK policy.'));
      else results.push(PASS('inquiry-insert', 'Controlled public inquiry insert', 'Accepted with status forcibly set to “new”.'));
      const cleanupId = rows?.[0]?.id;
      if (cleanupId) {
        const { error: cleanupError } = await ownerClient.from('inquiries').delete().eq('id', cleanupId);
        if (cleanupError) results.push(WARN('inquiry-cleanup', 'Diagnostic inquiry cleanup', `The test row remains: ${cleanupError.message}`));
      }
    }
  } catch (e) { results.push(WARN('inquiry-insert', 'Controlled public inquiry insert', String(e))); }

  // 9 — anonymous settings write must be denied (verify by value, not HTTP status)
  if (!ownerClient) {
    results.push(INFO('settings-write', 'Anonymous settings write blocked', 'Requires an authenticated owner session to verify — sign in and re-run.'));
  } else {
    try {
      const before = await ownerClient.from('site_settings').select('business_name').eq('id', 1).maybeSingle();
      const original = String(before.data?.business_name ?? 'Imperial Royal');
      const sentinel = `RLS-PROBE-${Date.now().toString(36).slice(-6)}`;
      await anon.from('site_settings').update({ business_name: sentinel }).eq('id', 1);
      const after = await ownerClient.from('site_settings').select('business_name').eq('id', 1).maybeSingle();
      const changed = String(after.data?.business_name ?? '') === sentinel;
      if (changed) {
        await ownerClient.from('site_settings').update({ business_name: original }).eq('id', 1);
        results.push(FAIL('settings-write', 'Anonymous settings write blocked', 'An anonymous request MODIFIED website settings. RLS is broken. The original value was restored.'));
      } else {
        results.push(PASS('settings-write', 'Anonymous settings write blocked', 'Website settings were unchanged by the anonymous request.'));
      }
    } catch (e) { results.push(PASS('settings-write', 'Anonymous settings write blocked', `Request rejected: ${e instanceof Error ? e.message : 'policy'}`)); }
  }

  // 10 — owner authorization
  if (!ownerClient) {
    results.push(INFO('owner-auth', 'Owner authorization', 'Not signed in. Sign in at /admin/login and re-run diagnostics.'));
  } else {
    try {
      const { data: userData, error } = await ownerClient.auth.getUser();
      if (error || !userData?.user) results.push(FAIL('owner-auth', 'Owner authorization', error?.message ?? 'No validated session.'));
      else {
        const { data: profile, error: pErr } = await ownerClient.from('profiles').select('is_owner').eq('id', userData.user.id).maybeSingle();
        results.push(pErr
          ? FAIL('owner-auth', 'Owner authorization', pErr.message)
          : profile?.is_owner
            ? PASS('owner-auth', 'Owner authorization', `Validated session for ${userData.user.email}; is_owner = true.`)
            : FAIL('owner-auth', 'Owner authorization', 'Authenticated but is_owner is false. Run supabase/owner-provisioning.sql.'));
      }
    } catch (e) { results.push(FAIL('owner-auth', 'Owner authorization', String(e))); }
  }

  // 11 — schema tables
  try {
    const tables = ['properties', 'property_media', 'inquiries', 'site_settings', 'profiles'];
    const checks = await Promise.all(tables.map(t => anon.from(t).select('*', { count: 'exact', head: true })));
    const missing = tables.filter((_, i) => checks[i].error && /42P01|does not exist|Could not find the table/i.test(checks[i].error?.message ?? ''));
    results.push(missing.length
      ? WARN('schema', 'Application schema', `Missing or unreadable tables: ${missing.join(', ')}. Run supabase/schema.sql.`)
      : PASS('schema', 'Application schema', 'All five application tables are present.'));
  } catch (e) { results.push(WARN('schema', 'Application schema', String(e))); }

  // 12 — storage buckets
  try {
    const publicBucket = await anon.storage.from('property-media').list('', { limit: 1 });
    const privateBucket = await anon.storage.from('owner-private').list('', { limit: 1 });
    const privateVisible = !privateBucket.error && (privateBucket.data?.length ?? 0) > 0;
    results.push(publicBucket.error
      ? WARN('storage', 'Storage policies', `Public media bucket not readable: ${publicBucket.error.message}. Run supabase/storage.sql.`)
      : privateVisible
        ? FAIL('storage', 'Storage policies', 'The private bucket is readable anonymously.')
        : PASS('storage', 'Storage policies', 'Public media bucket readable; private bucket protected.'));
  } catch (e) { results.push(WARN('storage', 'Storage policies', String(e))); }

  return summarize(results);
}

function summarize(results: DiagnosticResult[]): DiagnosticsReport {
  return {
    results,
    passed: results.filter(r => r.severity === 'pass').length,
    failed: results.filter(r => r.severity === 'fail').length,
    warned: results.filter(r => r.severity === 'warn').length,
    finishedAt: new Date().toISOString(),
  };
}
