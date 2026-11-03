'use client';
import Link from 'next/link';
import { Sparkles, FileDown, ArrowUpRight } from 'lucide-react';
import { SHOWCASE_ENABLED, SHOWCASE_NOTE } from '@/lib/showcase';

/**
 * Honest, always-visible disclosure shown in the Owner Studio whenever the
 * labelled demonstration catalogue is standing in for live database rows.
 */
export function ShowcaseNotice({ detail, compact = false }: { detail?: string | null; compact?: boolean }) {
  if (!SHOWCASE_ENABLED) return null;
  return (
    <div className={`showcase-notice ${compact ? 'compact' : ''}`}>
      <span className="showcase-notice-icon"><Sparkles size={18} /></span>
      <div style={{ flex: 1, minWidth: 220 }}>
        <p className="small" style={{ color: 'var(--ivory)', fontWeight: 600, letterSpacing: '.02em' }}>
          Showcase catalogue is being displayed
        </p>
        <p className="tiny muted mt-8" style={{ lineHeight: 1.7 }}>
          {SHOWCASE_NOTE} {detail && !compact ? detail : ''}{' '}
          To make these residences and references editable here, run the one-paste SQL setup in your Supabase SQL Editor. Once real rows exist, the showcase disappears automatically.
        </p>
      </div>
      <div className="flex gap-8 wrap">
        <a className="btn btn-outline btn-sm" href="/sql/showcase-setup.sql" download><FileDown size={14} /> Setup SQL</a>
        <Link className="btn btn-gold btn-sm" href="/admin/configuration">Setup guide <ArrowUpRight size={14} /></Link>
      </div>
    </div>
  );
}
