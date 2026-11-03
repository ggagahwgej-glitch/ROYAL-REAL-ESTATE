'use client';
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import Link from 'next/link';
import {
  Database, Eye, EyeOff, PlugZap, Save, Pencil, Trash2, Download, Upload, Globe, Laptop,
  CheckCircle2, XCircle, AlertTriangle, Info, Loader2, Copy, ShieldCheck, RefreshCw,
  FileCode2, ArrowRight, Server, LockKeyhole, CircleHelp, Play, ExternalLink,
} from 'lucide-react';
import { Modal, Notice } from '@/components/ui/UI';
import { useSupabaseConfig } from '@/lib/hooks/useSupabaseConfig';
import { useOwner } from '@/lib/hooks/useOwner';
import {
  clearLocalConfig, clearSharedConfig, downloadArtifact, exportConfig, importConfig,
  initialize, publishSharedConfig, saveLocalConfig, testConnection, updateLocalConfig,
  type ConnectionTest,
} from '@/lib/config/manager';
import { maskKey, validateConfig } from '@/lib/config/validation';
import { runDiagnostics, type DiagnosticsReport } from '@/lib/diagnostics';
import { formatDate } from '@/lib/utils';

const SQL_FILES = [
  { file: 'schema.sql', label: '1 · Database schema, constraints & RLS policies', note: 'Tables, indexes, validation and all Row Level Security policies.' },
  { file: 'storage.sql', label: '2 · Storage buckets & storage policies', note: 'property-media, branding and owner-private buckets.' },
  { file: 'owner-provisioning.sql', label: '3 · Secure owner provisioning', note: 'One-time administrative step to grant the owner privilege.' },
  { file: 'rls-tests.sql', label: '4 · Independent permission tests', note: 'Executable SQL assertions for public and owner permissions.' },
];

export default function ConfigurationPage() {
  const config = useSupabaseConfig();
  const owner = useOwner();
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState<ConnectionTest | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error' | 'warning'; title?: string; text: string } | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [artifact, setArtifact] = useState<string | null>(null);
  const [report, setReport] = useState<DiagnosticsReport | null>(null);
  const [diagnosticsRunning, setDiagnosticsRunning] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!dirty && config.initialized) {
      const source = config.local ?? config.shared ?? config.env;
      setUrl(source?.url ?? '');
      setKey(source?.anonKey ?? '');
    }
  }, [config.initialized, config.local, config.shared, config.env, dirty]);

  const invalidate = () => { setTest(null); setFeedback(null); };
  const onUrl = (v: string) => { setUrl(v); setDirty(true); invalidate(); };
  const onKey = (v: string) => { setKey(v); setDirty(true); invalidate(); };

  const runTest = useCallback(async (): Promise<ConnectionTest> => {
    setTesting(true); setFeedback(null);
    const result = await testConnection({ url, anonKey: key });
    setTest(result); setTesting(false);
    return result;
  }, [url, key]);

  const save = async (mode: 'save' | 'update') => {
    setBusy(mode); setFeedback(null);
    // Re-test before persisting: ONLY a validated configuration can be saved.
    const result = test?.ok
      ? test
      : await runTest();
    if (!result.ok) {
      setFeedback({ tone: 'error', title: 'Nothing was saved', text: result.message });
      setBusy(null); return;
    }
    const validation = validateConfig({ url, anonKey: key });
    if (!validation.ok) { setFeedback({ tone: 'error', text: validation.error ?? 'Invalid configuration.' }); setBusy(null); return; }
    const saved = mode === 'update' ? updateLocalConfig(validation.value!) : saveLocalConfig(validation.value!);
    if (!saved.ok) { setFeedback({ tone: 'error', text: saved.error ?? 'Save failed.' }); setBusy(null); return; }
    setDirty(false);
    setFeedback({
      tone: 'success',
      title: mode === 'update' ? 'Local configuration updated' : 'Local configuration saved',
      text: 'Saved in THIS BROWSER only. To make the connection available to every website visitor, publish the shared public configuration below.',
    });
    setBusy(null);
    await initialize(true);
  };

  const publish = async () => {
    setBusy('publish'); setFeedback(null); setArtifact(null);
    const validation = validateConfig({ url, anonKey: key });
    if (!validation.ok) { setFeedback({ tone: 'error', text: validation.error ?? 'Invalid configuration.' }); setBusy(null); return; }
    const token = owner.identity?.session?.access_token;
    if (!token) {
      setFeedback({ tone: 'error', title: 'Owner authentication required', text: 'Publishing is verified server-side against Supabase Auth and profiles.is_owner. Sign in as the provisioned owner, install supabase/schema.sql, then try again.' });
      setBusy(null); return;
    }
    const res = await publishSharedConfig(validation.value!, token);
    setBusy(null);
    if (res.artifact) setArtifact(res.artifact);
    setFeedback({ tone: res.ok ? 'success' : res.mode === 'download' ? 'warning' : 'error',
      title: res.ok ? 'Shared configuration published' : res.mode === 'download' ? 'Manual deployment required' : 'Publishing failed',
      text: res.message });
  };

  const clearShared = async () => {
    const token = owner.identity?.session?.access_token;
    if (!token) { setFeedback({ tone: 'error', text: 'A verified owner session is required to clear shared configuration.' }); return; }
    setBusy('clear-shared');
    const res = await clearSharedConfig(token);
    setBusy(null);
    setFeedback({ tone: res.ok ? 'success' : 'error', text: res.message });
  };

  const onImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const result = importConfig(await file.text());
    if (!result.ok) { setFeedback({ tone: 'error', title: 'Import refused', text: result.error ?? 'Invalid file.' }); return; }
    setUrl(result.value!.url); setKey(result.value!.anonKey); setDirty(true);
    setTest(null);
    setFeedback({ tone: 'success', title: 'Configuration imported', text: 'The artifact was validated. Run Test Connection, then Save Configuration or publish it for all visitors.' });
  };

  const doExport = () => {
    const text = exportConfig({ url, anonKey: key });
    if (!text) { setFeedback({ tone: 'error', text: 'Enter and validate a configuration before exporting.' }); return; }
    const blob = new Blob([text], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob); link.download = 'public-config.json';
    link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 2000);
    setFeedback({ tone: 'success', text: 'Configuration artifact exported. It contains only the public URL and publishable/anon key.' });
  };

  const runSecurityTests = async () => {
    setDiagnosticsRunning(true); setReport(null);
    try { setReport(await runDiagnostics(config.config, owner.client)); }
    catch (e) { setFeedback({ tone: 'error', text: e instanceof Error ? e.message : 'Diagnostics failed.' }); }
    setDiagnosticsRunning(false);
  };

  const copy = async (text: string) => { try { await navigator.clipboard.writeText(text); setFeedback({ tone: 'success', text: 'Copied to clipboard.' }); } catch { /* ignore */ } };

  return (
    <div className="grid gap-24">
      {/* ------------------------------- header ------------------------------- */}
      <div>
        <p className="eyebrow no-line">Owner Studio · System</p>
        <h1 className="admin-title mt-8">Backend Configuration</h1>
        <p className="lead mt-8" style={{ maxWidth: 760, fontSize: 15 }}>Connect your website to your own Supabase project without modifying application source code.</p>
        <div className="flex gap-12 wrap mt-16">
          <span className={`badge ${config.local ? 'badge-green' : 'badge-muted'}`}><Laptop size={11} /> Local browser: {config.local ? 'saved' : 'not saved'}</span>
          <span className={`badge ${config.shared ? 'badge-green' : 'badge-red'}`}><Globe size={11} /> Shared public: {config.shared ? 'published' : 'not published'}</span>
          <span className="badge badge-gold"><LockKeyhole size={11} /> No service-role key</span>
        </div>
      </div>

      {feedback && <Notice tone={feedback.tone === 'warning' ? 'warning' : feedback.tone} title={feedback.title}>{feedback.text}</Notice>}

      {/* --------------------------- connection form --------------------------- */}
      <div className="admin-card">
        <div className="admin-card-head"><div className="flex center gap-12"><Database size={18} className="gold" /><h2 className="h3">Supabase project credentials</h2></div>
          <span className="badge badge-muted">Publishable / anon key only</span></div>

        <div className="grid gap-16">
          <div className="field"><label className="label" htmlFor="cfg-url">1 · Supabase Project URL</label>
            <input id="cfg-url" className="input" value={url} onChange={e => onUrl(e.target.value)} placeholder="https://your-project.supabase.co" spellCheck={false} autoComplete="off" />
            <span className="hint">Found in Supabase Dashboard → Project Settings → API → Project URL.</span></div>
          <div className="field"><label className="label" htmlFor="cfg-key">2 · Supabase Publishable Key or Legacy Anon Key</label>
            <div className="input-wrap"><input id="cfg-key" className="input" type={showKey ? 'text' : 'password'} value={key} onChange={e => onKey(e.target.value)} placeholder="sb_publishable_… or eyJ…" spellCheck={false} autoComplete="off" style={{ paddingRight: 48 }} />
              <button className="input-toggle" type="button" onClick={() => setShowKey(s => !s)} aria-label={showKey ? 'Hide key' : 'Show key'}>{showKey ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>
            <span className="hint">Use the <code>sb_publishable_…</code> key or the legacy <strong>anon</strong> JWT. Secret keys (<code>sb_secret_…</code>) and service-role JWTs are rejected by design — they bypass Row Level Security.</span></div>
        </div>

        <div className="flex gap-12 wrap mt-24">
          <button className="btn btn-outline btn-sm" onClick={() => void runTest()} disabled={testing || Boolean(busy)}>
            {testing ? <><Loader2 size={14} className="spinner" /> Testing…</> : <><PlugZap size={15} /> Test Connection</>}</button>
          <button className="btn btn-gold btn-sm" onClick={() => void save('save')} disabled={testing || Boolean(busy)}>
            {busy === 'save' ? <><Loader2 size={14} className="spinner" /> Validating…</> : <><Save size={15} /> Save Configuration</>}</button>
          <button className="btn btn-outline btn-sm" onClick={() => void save('update')} disabled={testing || Boolean(busy) || !config.local}
            title={config.local ? 'Re-test and replace the saved local configuration' : 'Save a local configuration first'}>
            {busy === 'update' ? <><Loader2 size={14} className="spinner" /> Updating…</> : <><Pencil size={15} /> Update Configuration</>}</button>
          <button className="btn btn-danger btn-sm" onClick={() => setConfirmClear(true)} disabled={Boolean(busy) || (!config.local && !url && !key)}><Trash2 size={15} /> Clear Configuration</button>
        </div>
        <p className="tiny muted mt-16">Save and Update always validate the inputs and re-test the live connection. Only valid configurations are persisted — a failed connection is never reported as success.</p>

        {test && <div className="mt-24">
          <Notice tone={test.ok ? 'success' : 'error'} title={test.message}>
            {test.steps.length} checks executed against <strong>{test.projectLabel}</strong>.{!test.schemaReady && test.ok ? ' The database schema still needs to be installed (see the setup guide below).' : ''}
          </Notice>
          <div className="mt-16">
            {test.steps.map(step => <div className="diag-row" key={step.id}>
              <span className="diag-icon" style={{ color: step.ok ? 'var(--success)' : step.informational ? 'var(--warning)' : 'var(--danger)' }}>
                {step.ok ? <CheckCircle2 size={16} /> : step.informational ? <Info size={16} /> : <XCircle size={16} />}</span>
              <div><p className="small" style={{ color: 'var(--ivory)', fontWeight: 600 }}>{step.label}{step.informational && <span className="tiny muted"> · informational</span>}</p>
                <p className="tiny muted mt-8">{step.detail}</p></div>
            </div>)}
          </div>
        </div>}
      </div>

      {/* ---------------------- local vs shared scopes ---------------------- */}
      <div className="admin-duo">
        <div className="admin-card">
          <div className="admin-card-head"><div className="flex center gap-12"><Laptop size={18} className="gold" /><h2 className="h3">A · Local browser configuration</h2></div>
            <span className={`badge ${config.local ? 'badge-green' : 'badge-muted'}`}>{config.local ? 'Saved' : 'Empty'}</span></div>
          <Notice tone="info" className="mb-16">Applies to <strong>this browser only</strong>. A configuration saved here does <strong>not</strong> make the website work for other visitors.</Notice>
          <div className="grid gap-12 small">
            <div className="flex between gap-12 wrap"><span className="muted">Project URL</span><span className="gold" style={{ wordBreak: 'break-all', textAlign: 'right' }}>{config.local?.url ?? '—'}</span></div>
            <div className="flex between gap-12 wrap"><span className="muted">Key</span><span>{maskKey(config.local?.anonKey)}</span></div>
            <div className="flex between gap-12 wrap"><span className="muted">Active source</span><span>{config.source === 'local' ? 'Local browser (overrides shared)' : config.source === 'shared' ? 'Shared public' : config.source === 'env' ? 'Build-time fallback' : 'None'}</span></div>
          </div>
          <div className="flex gap-8 wrap mt-24">
            <button className="btn btn-outline btn-sm" onClick={doExport}><Download size={14} /> Export</button>
            <button className="btn btn-outline btn-sm" onClick={() => importRef.current?.click()}><Upload size={14} /> Import</button>
            <button className="btn btn-ghost btn-sm" onClick={() => { clearLocalConfig(); setDirty(false); setUrl(config.shared?.url ?? ''); setKey(config.shared?.anonKey ?? ''); setTest(null); void initialize(true); setFeedback({ tone: 'success', text: 'Local configuration removed. This browser now uses the shared public configuration (if published).' }); }} disabled={!config.local}><RefreshCw size={14} /> Use shared</button>
          </div>
          <input ref={importRef} type="file" accept="application/json,.json" className="hidden" onChange={e => void onImport(e)} />
          <p className="tiny muted mt-16">Export produces a <code>public-config.json</code> artifact containing only public credentials. Import re-validates the file and refuses service-role keys.</p>
        </div>

        <div className="admin-card">
          <div className="admin-card-head"><div className="flex center gap-12"><Globe size={18} className="gold" /><h2 className="h3">B · Shared public configuration</h2></div>
            <span className={`badge ${config.shared ? 'badge-green' : 'badge-red'}`}>{config.shared ? 'Published' : 'Missing'}</span></div>
          <Notice tone={config.shared ? 'success' : 'warning'} className="mb-16">
            {config.shared ? 'Served from /api/public-config to every visitor. The public website and Owner Studio both use this configuration.' : 'Not published. Every other visitor sees a professional setup state instead of broken pages.'}
          </Notice>
          <div className="grid gap-12 small">
            <div className="flex between gap-12 wrap"><span className="muted">Project URL</span><span className="gold" style={{ wordBreak: 'break-all', textAlign: 'right' }}>{config.shared?.url ?? '—'}</span></div>
            <div className="flex between gap-12 wrap"><span className="muted">Key</span><span>{maskKey(config.shared?.anonKey)}</span></div>
            <div className="flex between gap-12 wrap"><span className="muted">Storage</span><span>{config.sharedMeta.storage === 'server' ? 'Runtime file · data/public-config.json' : config.sharedMeta.storage === 'static-file' ? 'Static file · public/public-config.json' : 'None'}</span></div>
            <div className="flex between gap-12 wrap"><span className="muted">Published</span><span>{formatDate(config.sharedMeta.publishedAt, true)}</span></div>
          </div>
          <div className="flex gap-8 wrap mt-24">
            <button className="btn btn-gold btn-sm" onClick={() => void publish()} disabled={Boolean(busy) || owner.status !== 'authenticated'}>
              {busy === 'publish' ? <><Loader2 size={14} className="spinner" /> Publishing…</> : <><Globe size={14} /> {config.shared ? 'Update shared' : 'Publish shared'}</>}</button>
            <button className="btn btn-outline btn-sm" onClick={() => { const v = validateConfig({ url, anonKey: key }); if (v.ok) downloadArtifact(v.value!); else setFeedback({ tone: 'error', text: v.error ?? 'Invalid configuration.' }); }}><Download size={14} /> Download artifact</button>
            <button className="btn btn-danger btn-sm" onClick={() => void clearShared()} disabled={Boolean(busy) || !config.shared || owner.status !== 'authenticated'}><Trash2 size={14} /> Clear shared</button>
          </div>
          {owner.status !== 'authenticated' && <p className="tiny muted mt-16 flex center gap-8"><Info size={13} /> Publishing requires a verified owner session. <Link href="/admin/login?next=/admin/configuration" className="gold">Sign in →</Link></p>}
          <Notice tone="info" className="mt-16" title="How public visitors are configured">
            The server reads <code>data/public-config.json</code>, then the committed <code>public/public-config.json</code>, then an optional build-time fallback. On a read-only serverless filesystem the publish endpoint returns <strong>mode: download</strong> and never claims success — download the artifact below, place it at <code>public/public-config.json</code> in the repository and redeploy. No service-role key is involved at any point.
          </Notice>
          {artifact && <div className="mt-16"><div className="flex between center gap-12 mb-8"><p className="tiny gold uppercase">Configuration artifact</p>
            <div className="flex gap-8"><button className="btn btn-ghost btn-sm" onClick={() => void copy(artifact)}><Copy size={13} /> Copy</button>
              <button className="btn btn-gold btn-sm" onClick={() => { const blob = new Blob([artifact], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'public-config.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }}><Download size={13} /> Download</button></div></div>
            <pre className="code-block">{artifact}</pre></div>}
        </div>
      </div>

      {/* ---------------------------- setup guide ---------------------------- */}
      <div className="admin-card">
        <div className="admin-card-head"><div className="flex center gap-12"><FileCode2 size={18} className="gold" /><h2 className="h3">First-run setup guide</h2></div>
          <a href="/sql/schema.sql" download className="link-gold"><Download size={14} /> Download SQL bundle</a></div>
        <div className="grid grid-2 gap-16">
          {SQL_FILES.map(f => <a key={f.file} href={`/sql/${f.file}`} download className="card card-hover" style={{ display: 'block', padding: 18 }}>
            <div className="flex between center gap-12"><p className="small" style={{ color: 'var(--ivory)', fontWeight: 600 }}>{f.label}</p><Download size={15} className="gold" /></div>
            <p className="tiny muted mt-8">{f.note}</p><p className="tiny gold mt-8">supabase/{f.file}</p>
          </a>)}
        </div>
        <ol className="mt-24" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {[
            <>Create a Supabase project and copy its <strong>Project URL</strong> and <strong>publishable / anon key</strong> (Project Settings → API).</>,
            <>Enter them above, run <strong>Test Connection</strong> and <strong>Save Configuration</strong>. This browser is now connected.</>,
            <>Run <code>schema.sql</code>, <code>storage.sql</code> and <code>owner-provisioning.sql</code> in the Supabase SQL Editor. Create the owner account in Authentication → Users with auto-confirm enabled.</>,
            <>Add <code>{typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com'}/admin/login</code> to Authentication → URL Configuration → Redirect URLs so password reset works.</>,
            <>Sign in at <Link className="gold" href="/admin/login">/admin/login</Link>, then <strong>Publish shared</strong> above. If the host is read-only, download the artifact and commit it as <code>public/public-config.json</code>.</>,
            <>Run the security diagnostics below and resolve any failures before adding real listings.</>,
          ].map((step, i) => <li key={i} className="flex gap-16 small" style={{ alignItems: 'flex-start', padding: '10px 0', borderBottom: '1px solid var(--line-soft)', color: '#C6CAD3' }}>
            <span className="serif gold" style={{ fontSize: 20, lineHeight: 1, width: 26, flex: 'none' }}>{String(i + 1).padStart(2, '0')}</span><span style={{ lineHeight: 1.7 }}>{step}</span></li>)}
        </ol>
        <Notice tone="warning" className="mt-24" title="Security model">
          Every browser operation uses the publishable/anon key. Public visitors may read published listings/content and submit controlled inquiries; only an authenticated account with <code>profiles.is_owner = true</code> may write. These rules are enforced by Row Level Security, not by hiding buttons. Storage policies protect the private bucket independently.
        </Notice>
      </div>

      {/* ---------------------------- diagnostics ---------------------------- */}
      <div className="admin-card">
        <div className="admin-card-head"><div className="flex center gap-12"><ShieldCheck size={18} className="gold" /><h2 className="h3">Security &amp; permission diagnostics</h2></div>
          <button className="btn btn-gold btn-sm" onClick={() => void runSecurityTests()} disabled={diagnosticsRunning || !config.config}>
            {diagnosticsRunning ? <><Loader2 size={14} className="spinner" /> Running…</> : <><Play size={14} /> Run diagnostics</>}</button></div>
        <p className="small muted mb-16">Independent live tests against your Supabase project: configuration, anonymous write/read restrictions, owner authorization, schema, storage policies and credential exposure. Anonymous probes use a deliberately temporary, non-persistent client from the centralized factory.</p>
        {!config.config && <Notice tone="warning">Connect and save a configuration to enable diagnostics.</Notice>}
        {report && <>
          <div className="flex gap-12 wrap mb-16">
            <span className="badge badge-green"><CheckCircle2 size={11} /> {report.passed} passed</span>
            <span className="badge badge-red"><XCircle size={11} /> {report.failed} failed</span>
            <span className="badge badge-muted"><AlertTriangle size={11} /> {report.warned} warnings</span>
            <span className="tiny muted">Run {formatDate(report.finishedAt, true)}</span>
          </div>
          {report.results.map(r => <div className="diag-row" key={r.id}>
            <span className="diag-icon" style={{ color: r.severity === 'pass' ? 'var(--success)' : r.severity === 'fail' ? 'var(--danger)' : r.severity === 'warn' ? 'var(--warning)' : 'var(--silver)' }}>
              {r.severity === 'pass' ? <CheckCircle2 size={16} /> : r.severity === 'fail' ? <XCircle size={16} /> : r.severity === 'warn' ? <AlertTriangle size={16} /> : <Info size={16} />}</span>
            <div><p className="small" style={{ color: 'var(--ivory)', fontWeight: 600 }}>{r.label}</p><p className="tiny muted mt-8">{r.detail}</p></div>
          </div>)}
          {report.failed > 0 && <Notice tone="error" className="mt-16" title="Resolve these failures before going live">Review <code>supabase/schema.sql</code> and <code>supabase/storage.sql</code>, then run <code>supabase/rls-tests.sql</code> in the Supabase SQL Editor for an independent database-level verification.</Notice>}
        </>}
        <div className="flex gap-12 wrap mt-24">
          <a href="/sql/rls-tests.sql" download className="link-gold"><FileCode2 size={14} /> Download RLS test script</a>
          <Link href="/settings" className="link-gold"><ExternalLink size={14} /> Public connection status</Link>
        </div>
      </div>

      <Modal open={confirmClear} onClose={() => setConfirmClear(false)} title="Clear local configuration?">
        <p className="small muted">This removes the saved URL and key from <strong style={{ color: 'var(--ivory)' }}>this browser only</strong>. The shared public configuration is unaffected. If no shared configuration exists, this website and studio will show the setup state on this device.</p>
        <div className="flex between gap-12 mt-24 wrap" style={{ width: '100%' }}>
          <button className="btn btn-ghost" onClick={() => setConfirmClear(false)}>Cancel</button>
          <button className="btn btn-danger" onClick={() => {
            clearLocalConfig(); setUrl(config.shared?.url ?? ''); setKey(config.shared?.anonKey ?? '');
            setDirty(false); setTest(null); setConfirmClear(false); void initialize(true);
            setFeedback({ tone: 'success', text: 'Local browser configuration cleared.' });
          }}><Trash2 size={15} /> Clear local configuration</button>
        </div>
      </Modal>
    </div>
  );
}
