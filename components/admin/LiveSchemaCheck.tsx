'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, XCircle, RefreshCw, ShieldAlert, Database } from 'lucide-react';
import { useSupabaseConfig } from '@/lib/hooks/useSupabaseConfig';

/**
 * Read-only, browser-side health check for the connected Supabase project.
 * It uses ONLY anonymous GETs with the public publishable key — the same
 * requests any visitor could make. It never writes, never needs a service
 * role and never sees a password. Its purpose is to make a wrong or
 * half-finished SQL setup immediately visible to the owner.
 */

type Verdict = 'pass' | 'fail' | 'warn';
interface Check {
  id: string;
  label: string;
  verdict: Verdict;
  detail: string;
}
interface Probe {
  status: number;
  body: unknown;
  message: string;
}

async function probe(base: string, key: string, path: string): Promise<Probe> {
  const sep = path.includes('?') ? '&' : '?';
  try {
    const res = await fetch(`${base}/rest/v1/${path}${sep}apikey=${encodeURIComponent(key)}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    const body = await res.json().catch(() => ({}));
    const record = Array.isArray(body) ? body[0] : body;
    const message = String(record?.message ?? record?.hint ?? '');
    return { status: res.status, body, message };
  } catch (e) {
    return { status: 0, body: null, message: e instanceof Error ? e.message : 'Network error' };
  }
}

const raw = (p: Probe) => JSON.stringify(p.body ?? '') + ' ' + p.message;
const missingColumn = (p: Probe) =>
  /42703|PGRST205|does not exist|Could not find the table/i.test(raw(p));
const denied = (p: Probe) =>
  p.status === 401 || p.status === 403 ||
  /42501|permission denied/i.test(raw(p));

export function LiveSchemaCheck() {
  const { config, initialized } = useSupabaseConfig();
  const [checks, setChecks] = useState<Check[]>([]);
  const [busy, setBusy] = useState(false);
  const [ran, setRan] = useState(false);
  const started = useRef(false);

  const run = useCallback(async () => {
    if (!config) return;
    setBusy(true);
    const base = config.url.replace(/\/+$/, '');
    const key = config.anonKey;
    const [props, published, media, settings, profiles, inquiries] = await Promise.all([
      probe(base, key, 'properties?select=id,slug,status,listing_type,city,category,featured,area_sqft&limit=1'),
      probe(base, key, 'properties?select=id&status=eq.published&limit=100'),
      probe(base, key, 'property_media?select=id,storage_path,public_url,is_cover,position&limit=1'),
      probe(base, key, 'site_settings?select=business_name,testimonials,hero_heading&limit=1'),
      probe(base, key, 'profiles?select=is_owner&limit=1'),
      probe(base, key, 'inquiries?select=id&limit=1'),
    ]);

    const out: Check[] = [];
    const add = (id: string, label: string, verdict: Verdict, detail: string) =>
      out.push({ id, label, verdict, detail });

    // 1. Canonical properties shape
    if (props.status === 200) {
      add('properties', 'Properties table matches this website', 'pass',
        'All required columns (listing_type, area_sqft, featured …) are present and readable.');
    } else if (missingColumn(props)) {
      add('properties', 'Properties table has a different schema', 'fail',
        `Missing column: ${props.message || 'see 42703'}. A different application\'s script was run. The website cannot read these rows.`);
    } else {
      add('properties', 'Properties table is not readable publicly', 'fail',
        `${props.status} ${props.message || 'permission denied'}. RLS is enabled but the public GRANT is missing.`);
    }

    // 2. At least 20 published listings
    const count = Array.isArray(published.body) ? published.body.length : 0;
    if (published.status === 200 && count >= 20) {
      add('published', 'Published residences', 'pass', `${count}+ rows with status = 'published'.`);
    } else if (missingColumn(published)) {
      add('published', 'Published residences', 'fail', 'Cannot query status = published on the current table shape.');
    } else {
      add('published', 'Published residences', 'fail',
        `${count} published rows found (expected at least 20). Rows using status = 'Available' or 'draft' are not shown on the public site.`);
    }

    // 3. Gallery shape
    if (media.status === 200) {
      add('media', 'Gallery table matches this website', 'pass', 'storage_path, public_url, is_cover and position are present.');
    } else if (missingColumn(media)) {
      add('media', 'Gallery table has a different schema', 'fail',
        `Missing column: ${media.message || 'see 42703'}. Gallery images cannot be displayed.`);
    } else {
      add('media', 'Gallery table is not readable publicly', 'fail', `${media.status} ${media.message || 'permission denied'}.`);
    }

    // 4. Settings shape + sample references
    const row = Array.isArray(settings.body) ? settings.body[0] : settings.body;
    const refs = Array.isArray(row?.testimonials) ? row.testimonials.length : 0;
    if (settings.status === 200 && row && 'business_name' in row) {
      add('settings', 'Website settings & reviews', refs >= 8 ? 'pass' : 'warn',
        refs >= 8
          ? `Flat settings row present with ${refs} references.`
          : `Settings row present but only ${refs} references were found.`);
    } else {
      add('settings', 'Website settings has a different schema', 'fail',
        `Expected a flat settings row with business_name / testimonials. ${settings.message || 'Columns are missing.'} Reviews stored in a key/value row are invisible to this website.`);
    }

    // 5 & 6. Privacy — anonymous visitors must NOT read these tables
    const exposed = (p: Probe) => p.status === 200 && Array.isArray(p.body) && p.body.length > 0;
    add('profiles', 'Owner profiles are private', exposed(profiles) ? 'fail' : 'pass',
      exposed(profiles)
        ? `SECURITY: an anonymous visitor CAN read profiles (${(profiles.body as unknown[]).length} row(s), including is_owner). Revoke anon SELECT immediately.`
        : denied(profiles)
          ? 'Anonymous reads of profiles are correctly denied.'
          : 'Anonymous reads are blocked by Row Level Security (no rows returned).');
    add('inquiries', 'Enquiries are private', exposed(inquiries) ? 'fail' : 'pass',
      exposed(inquiries)
        ? 'SECURITY: an anonymous visitor can read enquiry data.'
        : denied(inquiries)
          ? 'Anonymous reads of enquiries are correctly denied; visitors may only insert.'
          : 'Anonymous reads are blocked by Row Level Security (no rows returned).');

    setChecks(out);
    setRan(true);
    setBusy(false);
  }, [config]);

  useEffect(() => {
    if (!initialized || !config || started.current) return;
    started.current = true;
    void run();
  }, [initialized, config, run]);

  const failures = checks.filter(c => c.verdict === 'fail').length;
  const ready = ran && failures === 0;

  return (
    <section className="db-check" aria-label="Live database health check">
      <div className="db-check-head">
        <div className="flex center gap-12" style={{ flex: 1, minWidth: 220 }}>
          <span className="showcase-notice-icon"><Database size={20} /></span>
          <div>
            <p className="eyebrow no-line">Live database check · read only</p>
            <h2 className="h3 mt-8">Is my project connected correctly?</h2>
            <p className="tiny muted mt-8">
              Anonymous GETs only, using the public publishable key. Nothing is written.
            </p>
          </div>
        </div>
        <button className="btn btn-outline btn-sm" onClick={() => void run()} disabled={busy || !config}>
          <RefreshCw size={14} className={busy ? 'spin' : ''} /> {busy ? 'Checking…' : 'Re-check'}
        </button>
      </div>

      {!initialized || !config ? (
        <p className="small muted" style={{ padding: 20 }}>Loading the shared project configuration…</p>
      ) : !ran ? (
        <p className="small muted" style={{ padding: 20 }}>Checking {config.url} …</p>
      ) : (
        <>
          <div className={`db-check-verdict ${ready ? 'is-ok' : 'is-bad'}`}>
            {ready ? <CheckCircle2 size={18} /> : <ShieldAlert size={18} />}
            <span>
              <strong>{ready ? 'Database is aligned with the website.' : `${failures} problem${failures === 1 ? '' : 's'} found in the live database.`}</strong>
              {!ready && ' The public site is showing the labelled in-app showcase because the live rows cannot be read. Run the setup SQL below to fix it.'}
            </span>
          </div>
          <ul className="db-check-list">
            {checks.map(c => (
              <li key={c.id} className={c.verdict}>
                {c.verdict === 'fail'
                  ? <XCircle size={16} />
                  : <CheckCircle2 size={16} />}
                <div>
                  <strong>{c.label}</strong>
                  <p className="tiny muted">{c.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
