'use client';
import { useState } from 'react';
import Image from 'next/image';
import { Emblem } from '@/components/brand/Emblem';
import { cn } from '@/lib/utils';

/**
 * next/image for bundled assets; native lazy img for owner-uploaded Supabase URLs.
 * A missing or broken file degrades to the branded emblem instead of an empty
 * rectangle — owner-uploaded objects can be deleted while their row survives.
 */
export function SmartImage({ src, alt, className, fill = true, sizes = '(max-width: 768px) 100vw, 33vw', priority = false }: {
  src?: string | null; alt: string; className?: string; fill?: boolean; sizes?: string; priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <NoImage className={className} alt={alt} />;
  if (src.startsWith('/') || src.startsWith('data:')) {
    return <Image src={src} alt={alt} fill={fill} sizes={sizes} priority={priority} style={{ objectFit: 'cover' }} className={className} onError={() => setFailed(true)} />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading={priority ? 'eager' : 'lazy'} decoding="async" className={className}
    onError={() => setFailed(true)}
    style={fill ? { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' } : undefined} />;
}

export function NoImage({ className, alt }: { className?: string; alt?: string }) {
  return (
    <div className={cn('no-image', className)} role="img" aria-label={alt ? `${alt} — image unavailable` : 'Image unavailable'}
      data-image-fallback="true"
      style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(circle at 50% 40%,rgba(198,164,90,.13),transparent 60%),linear-gradient(150deg,#141A28,#080A10)' }}>
      <div style={{ width: 62, height: 73, opacity: .32 }}><Emblem tone="mono" /></div>
    </div>
  );
}
