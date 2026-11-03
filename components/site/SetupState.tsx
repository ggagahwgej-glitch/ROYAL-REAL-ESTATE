'use client';
import Link from 'next/link';
import { Database, ArrowRight, CheckCircle2, FileDown, ShieldCheck, Server } from 'lucide-react';
import { Brand } from '@/components/brand/Brand';
import { Notice } from '@/components/ui/UI';
import type { ConfigState } from '@/lib/config/manager';

/** Professional first-run state. Never a blank screen, never silent failure. */
export function SetupState({ config, compact = false, context = 'public' }: {
  config: ConfigState; compact?: boolean; context?: 'public' | 'admin';
}) {
  const hasLocal = Boolean(config.local);
  const hasShared = Boolean(config.shared);
  return (
    <div className={compact ? '' : 'section'}>
      <div className={compact ? '' : 'container-narrow'}>
        <div className="admin-card" style={{ borderColor: 'var(--line)', padding: compact ? 24 : 40 }}>
          <div className="flex center gap-16 mb-24">
            <div className="feature-icon"><Database size={20} /></div>
            <div>
              <p className="eyebrow no-line mb-8">Owner setup required</p>
              <h2 className="h3">Connect your Supabase project</h2>
            </div>
          </div>
          <p className="muted small" style={{ lineHeight: 1.85 }}>
            This website reads its properties, media, inquiries and branding from <strong style={{ color: 'var(--ivory)' }}>your own Supabase project</strong>.
            No connection has been configured yet, so live listings are intentionally hidden rather than replaced with demo properties.
          </p>

          <div className="grid grid-2 gap-16 mt-24">
            <div className="notice notice-info" style={{ flexDirection: 'column', gap: 6 }}>
              <span className="flex center gap-8"><Server size={15} /><strong>Shared public configuration</strong></span>
              <span className="tiny">{hasShared ? 'Published and available to every visitor.' : 'Not published yet — visitors cannot see live data.'}</span>
            </div>
            <div className="notice notice-info" style={{ flexDirection: 'column', gap: 6 }}>
              <span className="flex center gap-8"><ShieldCheck size={15} /><strong>Local browser configuration</strong></span>
              <span className="tiny">{hasLocal ? 'Saved in this browser only.' : 'No configuration saved in this browser.'}</span>
            </div>
          </div>

          {!compact && (
            <ol style={{ margin: '28px 0 0', padding: 0, counterReset: 'step', listStyle: 'none' }}>
              {[
                <>Open <strong>Backend Configuration</strong> in the Owner Studio.</>,
                <>Enter your <strong>Supabase Project URL</strong> and <strong>publishable / legacy anon key</strong> (never a service-role key).</>,
                <>Run <strong>Test Connection</strong>, then <strong>Save Configuration</strong> for this browser.</>,
                <>Install the database schema with <code>supabase/schema.sql</code> and provision the owner account.</>,
                <>Sign in and <strong>Publish Shared Configuration</strong> so every visitor uses the same project. If the host filesystem is read-only, download the artifact and place it at <code>public/public-config.json</code>.</>,
              ].map((step, i) => (
                <li key={i} className="flex gap-16 small" style={{ alignItems: 'flex-start', padding: '11px 0', borderBottom: '1px solid var(--line-soft)', color: '#C6CAD3' }}>
                  <span className="gold" style={{ fontFamily: 'var(--font-display)', fontSize: 20, lineHeight: 1, flex: 'none', width: 26 }}>{String(i + 1).padStart(2, '0')}</span>
                  <span style={{ lineHeight: 1.7 }}>{step}</span>
                </li>
              ))}
            </ol>
          )}

          <div className="flex gap-12 wrap mt-24">
            <Link href="/admin/configuration" className="btn btn-gold"><Database size={16} /> Open Backend Configuration <ArrowRight size={15} /></Link>
            <Link href="/admin/login" className="btn btn-outline">Owner Sign In</Link>
          </div>
          <Notice tone="warning" className="mt-24" title="Two distinct scopes">
            Local browser configuration applies only to the browser it was saved in. Only the <strong>shared public bootstrap configuration</strong> makes the project available to all website visitors. The application never claims otherwise. <FileDown size={13} style={{ display: 'inline', verticalAlign: 'middle' }} />
          </Notice>
          {context === 'admin' && <p className="tiny muted mt-16 flex center gap-8"><CheckCircle2 size={13} /> You can configure the connection before signing in; publishing it requires verified owner authentication.</p>}
        </div>
      </div>
    </div>
  );
}
