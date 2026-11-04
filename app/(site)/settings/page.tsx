'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Settings2, Check, Database, Globe, LockKeyhole, RotateCcw, Eye, ArrowUpRight } from 'lucide-react';
import { Notice } from '@/components/ui/UI';
import { useSupabaseConfig } from '@/lib/hooks/useSupabaseConfig';
import { maskKey } from '@/lib/config/validation';
import { formatDate } from '@/lib/utils';
import {
  DEFAULT_PREFERENCES, normalizePreferences, readPreferences, savePreferences,
  type DisplayPreferences,
} from '@/lib/preferences';

type Prefs = DisplayPreferences;
const DEFAULT: Prefs = DEFAULT_PREFERENCES;

export default function SettingsPage() {
  const config = useSupabaseConfig();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT);
  const [saved, setSaved] = useState(false);

  // Read once on mount (SSR must render the documented defaults).
  useEffect(() => { setPrefs(readPreferences()); }, []);

  const update = (patch: Partial<Prefs>) => {
    const next = normalizePreferences({ ...prefs, ...patch });
    setPrefs(next);
    // savePreferences() also writes the <html> data attributes, so the choice
    // now survives navigation to every other page.
    savePreferences(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  return (
    <>
      <section className="page-hero"><div className="container">
        <nav className="breadcrumb" aria-label="Breadcrumb"><Link href="/">Home</Link> / <span>Preferences</span></nav>
        <p className="eyebrow no-line mt-8">Your experience</p>
        <h1>Display preferences.</h1>
        <p className="lead mt-16 max-w-600">Personalise how the collection is presented in this browser. These settings are local to your device and never alter the website for other visitors.</p>
      </div></section>

      <section className="section"><div className="container-narrow">
        {saved && <Notice tone="success" className="mb-24"><Check size={14} /> Preferences saved to this browser.</Notice>}
        <div className="admin-card">
          <div className="admin-card-head"><div className="flex center gap-12"><Settings2 size={18} className="gold" /><h2 className="h3">Presentation</h2></div>
            <button className="btn btn-ghost btn-sm" onClick={() => update(DEFAULT)}><RotateCcw size={14} /> Restore defaults</button></div>
          <div className="form-grid">
            <div className="field"><label className="label" htmlFor="pref-currency">Preferred currency display</label>
              <select id="pref-currency" className="select" value={prefs.currency} onChange={e => update({ currency: e.target.value })}>
                <option value="INR">INR — Indian Rupee (₹)</option><option value="USD">USD — US Dollar ($)</option>
                <option value="EUR">EUR — Euro (€)</option><option value="GBP">GBP — Pound Sterling (£)</option><option value="AED">AED — UAE Dirham</option>
              </select>
              <span className="hint">Listing prices are stored in the owner’s chosen currency; this preference is a display hint for future releases.</span></div>
            <div className="field"><label className="label" htmlFor="pref-density">Layout density</label>
              <select id="pref-density" className="select" value={prefs.density} onChange={e => update({ density: e.target.value as Prefs['density'] })}>
                <option value="comfortable">Comfortable — editorial spacing</option><option value="compact">Compact — more content per screen</option>
              </select></div>
            <div className="field"><label className="label" htmlFor="pref-motion">Motion &amp; transitions</label>
              <select id="pref-motion" className="select" value={prefs.motion} onChange={e => update({ motion: e.target.value as Prefs['motion'] })}>
                <option value="full">Full — restrained animations</option><option value="reduced">Reduced — minimal movement</option>
              </select><span className="hint">Your operating system’s reduce-motion preference is always respected.</span></div>
            <div className="field"><label className="label" htmlFor="pref-contrast">Contrast</label>
              <select id="pref-contrast" className="select" value={prefs.contrast} onChange={e => update({ contrast: e.target.value as Prefs['contrast'] })}>
                <option value="standard">Standard — Imperial Midnight</option><option value="high">High — stronger text contrast</option>
              </select></div>
          </div>
          <p className="tiny muted mt-24 flex center gap-8"><Eye size={13} /> Changes take effect immediately and persist in this browser only.</p>
        </div>

        <div className="admin-card mt-24">
          <div className="admin-card-head"><div className="flex center gap-12"><Globe size={18} className="gold" /><h2 className="h3">Connection status</h2></div>
            <span className={`badge ${config.config ? 'badge-green' : 'badge-red'}`}>{config.config ? 'Connected' : 'Not configured'}</span></div>
          <div className="grid gap-12 small">
            <div className="flex between gap-16 wrap"><span className="muted">Active configuration in this browser</span><span>{config.source === 'local' ? 'Local browser configuration' : config.source === 'shared' ? 'Shared public configuration' : config.source === 'env' ? 'Build-time fallback' : 'None'}</span></div>
            <div className="flex between gap-16 wrap"><span className="muted">Project URL</span><span className="gold" style={{ wordBreak: 'break-all', textAlign: 'right' }}>{config.config?.url ?? 'Not set'}</span></div>
            <div className="flex between gap-16 wrap"><span className="muted">Publishable / anon key</span><span>{maskKey(config.config?.anonKey)}</span></div>
            <div className="flex between gap-16 wrap"><span className="muted">Shared configuration for all visitors</span><span>{config.shared ? `Published · ${formatDate(config.sharedMeta.publishedAt)}` : 'Not published'}</span></div>
            <div className="flex between gap-16 wrap"><span className="muted">Service-role key</span><span className="badge badge-green"><LockKeyhole size={11} /> Never used or stored</span></div>
          </div>
          <Notice tone="info" className="mt-24"><Database size={14} /> This page shows status only. Connection credentials are managed exclusively in the <Link href="/admin/configuration" className="gold">Backend Configuration</Link> of the Owner Studio.</Notice>
          <Link href="/admin/configuration" className="btn btn-outline btn-sm mt-24">Open Backend Configuration <ArrowUpRight size={14} /></Link>
        </div>
      </div></section>
    </>
  );
}
