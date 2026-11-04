'use client';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, Compass } from 'lucide-react';
import { SmartImage } from '@/components/ui/SmartImage';
import { Emblem } from '@/components/brand/Emblem';
import { useSiteSettings } from '@/lib/hooks/useSiteData';
import { DEFAULT_SETTINGS } from '@/lib/utils';

export function Hero() {
  const { settings } = useSiteSettings();
  const heading = settings.hero_heading ?? DEFAULT_SETTINGS.hero_heading!;
  const sub = settings.hero_subheading ?? DEFAULT_SETTINGS.hero_subheading!;
  // Owner-editable figures; an empty list hides the row rather than inventing one.
  const stats = (settings.hero_stats ?? DEFAULT_SETTINGS.hero_stats).filter(s => s.value.trim() && s.label.trim());
  // Preserve the owner's wording verbatim. Only split at the word "Meets" for
  // the two-tone typographic treatment; the final period is never stripped.
  const match = /^(.*?\bMeets\b)\s+(.+)$/i.exec(heading);
  const first = match ? match[1] : heading;
  const second = match ? match[2] : '';

  return (
    <section className="hero">
      <div className="hero-media">
        <SmartImage src={settings.hero_image || '/images/showcase-01.jpg'} alt="An imperial cliffside residence illuminated at blue hour above the Arabian Sea" priority sizes="100vw" />
      </div>
      <div className="hero-grain" />
      <div className="hero-content">
        <div className="container hero-inner">
          <p className="eyebrow" style={{ animation: 'fadeIn 1s ease both' }}>The Imperial Collection · Est. MMXXIV</p>
          <h1 style={{ animation: 'fadeIn 1.1s .1s ease both' }}>
            {first}{second ? <> <span className="accent">{second}</span></> : null}
          </h1>
          <p className="hero-lead" style={{ animation: 'fadeIn 1.2s .2s ease both' }}>{sub}</p>
          <div className="hero-buttons" style={{ animation: 'fadeIn 1.3s .3s ease both' }}>
            <Link href="/properties" className="btn btn-gold btn-lg">Explore Properties. <ArrowUpRight size={17} /></Link>
            <Link href="/categories" className="btn btn-outline btn-lg">Discover Our Collection. <Compass size={17} /></Link>
          </div>
          {stats.length > 0 && <div className="stat-row" style={{ maxWidth: 620, animation: 'fadeIn 1.4s .4s ease both' }}>
            {stats.map(stat => <div key={`${stat.value}-${stat.label}`}>
              <p className="stat-big">{stat.value}</p><p className="stat-label">{stat.label}</p>
            </div>)}
          </div>}
        </div>
      </div>
      <div className="hero-badge">
        <div style={{ width: 34, height: 40, margin: '0 auto 10px', opacity: .95 }}><Emblem /></div>
        <p className="eyebrow no-line" style={{ justifyContent: 'center', fontSize: 9, letterSpacing: '.3em' }}>By private appointment</p>
        <p className="serif mt-8" style={{ fontSize: '1.15rem', lineHeight: 1.3 }}>A standard above the ordinary.</p>
        <p className="tiny muted mt-8">Every residence personally inspected.</p>
      </div>
      <div className="hero-scroll"><span /> Scroll to discover</div>
    </section>
  );
}
