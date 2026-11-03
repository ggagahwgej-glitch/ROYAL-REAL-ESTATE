'use client';
import Link from 'next/link';
import { Emblem, type EmblemTone } from './Emblem';
import { cn } from '@/lib/utils';

export type BrandVariant = 'horizontal' | 'emblem' | 'compact' | 'mono' | 'light' | 'favicon' | 'footer';

export function Brand({
  variant = 'horizontal', href = '/', className, tagline, onClick,
}: {
  variant?: BrandVariant;
  href?: string | null;
  className?: string;
  tagline?: string;
  onClick?: () => void;
}) {
  const tone: EmblemTone = variant === 'light' ? 'light' : variant === 'mono' ? 'mono' : 'gold';
  const classes = cn('brand', (variant === 'compact' || variant === 'favicon') && 'compact', variant === 'light' && 'light', variant === 'footer' && 'footer', className);
  const showWords = variant !== 'emblem' && variant !== 'favicon';
  const content = (
    <>
      <span className="brand-emblem"><Emblem tone={tone} title="Imperial Royal sovereign crest" /></span>
      {showWords && (
        <>
          <span className="brand-divider" />
          <span className="brand-words">
            <span className="brand-name">IMPERIAL <em>ROYAL</em></span>
            <span className="brand-sub">{tagline ?? 'Private Estates · Est. MMXXIV'}</span>
          </span>
        </>
      )}
    </>
  );
  if (!href) return <div className={classes} onClick={onClick}>{content}</div>;
  return <Link href={href} className={classes} onClick={onClick} aria-label="Imperial Royal — home">{content}</Link>;
}

/** Loading-screen mark: emblem + animated gold rule. */
export function BrandLoader({ label = 'Preparing your private viewing' }: { label?: string }) {
  return (
    <div className="text-center" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}>
      <div style={{ width: 88, height: 103, animation: 'fadeIn .8s ease' }}><Emblem /></div>
      <div className="gold-rule" style={{ margin: 0, width: 120, background: 'var(--gold)' }} />
      <p className="tiny uppercase" style={{ color: 'var(--gold)', letterSpacing: '.28em' }}>{label}</p>
      <span className="spinner" />
    </div>
  );
}

export default Brand;
