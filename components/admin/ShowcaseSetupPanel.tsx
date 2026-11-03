'use client';
import { useState } from 'react';
import { Sparkles, FileDown, Copy, Check, Database, ShieldCheck, ArrowRight, AlertTriangle } from 'lucide-react';
import { SHOWCASE_ENABLED, SHOWCASE_PROPERTIES, SHOWCASE_MEDIA, SHOWCASE_TESTIMONIALS } from '@/lib/showcase';

/**
 * One-paste setup guide for the client demonstration. Explains the live
 * schema mismatch found on the connected project and how to resolve it.
 */
export function ShowcaseSetupPanel({ configuredUrl }: { configuredUrl?: string }) {
  const [copied, setCopied] = useState(false);

  const copySql = async () => {
    try {
      const text = await (await fetch('/sql/showcase-setup.sql')).text();
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch { setCopied(false); }
  };

  if (!SHOWCASE_ENABLED) return null;

  return (
    <div className="showcase-setup">
      <div className="showcase-setup-head">
        <span className="showcase-notice-icon"><Sparkles size={20} /></span>
        <div style={{ flex: 1, minWidth: 220 }}>
          <p className="eyebrow no-line">Client demonstration · one-time setup</p>
          <h2 className="h3 mt-8">Make the showcase collection editable</h2>
          <p className="small muted mt-8" style={{ maxWidth: 760, lineHeight: 1.8 }}>
            The public site already shows <strong style={{ color: 'var(--ivory)' }}>{SHOWCASE_PROPERTIES.length} residences</strong>, {SHOWCASE_MEDIA.length} gallery images and {SHOWCASE_TESTIMONIALS.length} sample references with star ratings. To see and edit those same records here in the Owner Studio, install the matching database schema once.
          </p>
        </div>
        <span className="badge badge-gold">20 properties</span>
      </div>

      <div className="showcase-setup-alert">
        <AlertTriangle size={16} />
        <p className="tiny" style={{ lineHeight: 1.75 }}>
          <strong style={{ color: 'var(--ivory)' }}>Live check found:</strong> {configuredUrl ? `${configuredUrl} is reachable and the publishable key is valid, but its tables were created for a different application` : 'the connected project has tables from a different application'} — <code>properties</code> has no <code>city</code>, <code>category</code>, <code>listing_type</code>, <code>featured</code> or <code>area_sqft</code>; <code>property_media</code> and <code>site_settings</code> also use different columns. That causes PostgREST <code>42703</code> errors, blank galleries and default branding. The script below fixes it.
        </p>
      </div>

      <ol className="showcase-setup-steps">
        <li><span>01</span><div><strong>Open the Supabase SQL Editor</strong><p>In your Supabase dashboard choose <em>SQL Editor → New query</em>. No service-role key is needed.</p></div></li>
        <li><span>02</span><div><strong>Paste the setup script</strong><p>Click “Copy setup SQL” below, paste it, then press <em>Run</em>. It aligns the schema, installs RLS and Storage policies, provisions the first Auth user as owner, and inserts the showcase content.</p></div></li>
        <li><span>03</span><div><strong>Reload this Studio</strong><p>Real database rows replace the labelled showcase automatically. Properties, media and references become fully editable here.</p></div></li>
      </ol>

      <div className="showcase-setup-actions">
        <button className="btn btn-gold" onClick={() => void copySql()}>
          {copied ? <><Check size={15} /> Copied to clipboard</> : <><Copy size={15} /> Copy setup SQL</>}
        </button>
        <a className="btn btn-outline" href="/sql/showcase-setup.sql" download><FileDown size={15} /> Download .sql</a>
        <span className="tiny muted flex center gap-8"><ShieldCheck size={13} /> Existing rows are backed up to <code>imperial_legacy_*</code> tables first.</span>
      </div>

      <div className="showcase-setup-foot">
        <Database size={14} className="gold" />
        <span className="tiny muted">Everything in the showcase is clearly labelled sample content. Remove it from the Owner Studio before using this project for real clients. Set <code>NEXT_PUBLIC_SHOWCASE=0</code> to disable showcase mode entirely.</span>
        <ArrowRight size={14} className="gold" />
      </div>
    </div>
  );
}
