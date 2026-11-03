'use client';
import Link from 'next/link';
import { ArrowUpRight, Quote, Sparkles } from 'lucide-react';
import { Reveal } from '@/components/ui/Reveal';
import { Stars } from '@/components/ui/Stars';
import { useSiteSettings } from '@/lib/hooks/useSiteData';
import { SHOWCASE_ENABLED } from '@/lib/showcase';

function initialsOf(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || '—';
}

/**
 * Owner-published references stored in site_settings.testimonials.
 *
 * In SHOWCASE mode, clearly-labelled SAMPLE references are shown for this
 * client demonstration. They are never described as genuine endorsements and
 * no AggregateRating structured data is emitted for them.
 */
export function Testimonials() {
  const { settings, loading, configured } = useSiteSettings();
  const quotes = settings.testimonials ?? [];
  const showSkeleton = loading && configured;
  const sampleMode = SHOWCASE_ENABLED && quotes.length > 0 && quotes.every(q => q.sample === true);
  const rated = quotes.filter(q => typeof q.rating === 'number' && q.rating > 0);
  const average = rated.length
    ? (rated.reduce((n, q) => n + Number(q.rating), 0) / rated.length).toFixed(1)
    : null;

  return (
    <section className="section section-alt" id="testimonials">
      <div className="container">
        <div className="section-head">
          <div>
            <Reveal><p className="eyebrow">In their words</p><h2 className="h2 mt-16">Relationships that endure.</h2></Reveal>
            {sampleMode && average && <Reveal delay={1}><div className="rating-summary mt-16">
              <Stars value={Math.round(Number(average))} size={16} showValue />
              <span className="tiny muted">{average} average · {quotes.length} showcase references</span>
            </div></Reveal>}
          </div>
          <div className="max-w-600">
            <p className="small muted">
              {sampleMode
                ? 'A considered collection of illustrative references, prepared to demonstrate how owner-published testimonials and star ratings appear across the site.'
                : 'Client references are published only with written permission. Every quote shown here is a record entered by the owner in the Owner Studio.'}
            </p>
            {sampleMode && <p className="tiny muted mt-8" style={{ opacity: .78 }}>
              <Sparkles size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
              Sample content for this demonstration — not genuine client endorsements.
            </p>}
          </div>
        </div>
        {showSkeleton ? (
          <div className="grid grid-3">{[0, 1, 2].map(i => <div key={i} className="skeleton" style={{ height: 260 }} />)}</div>
        ) : quotes.length === 0 ? (
          <Reveal>
            <div className="admin-card text-center" style={{ padding: '48px 28px' }}>
              <Quote size={26} className="gold" style={{ margin: '0 auto 18px' }} />
              <h3 className="h3">References are shared in confidence.</h3>
              <p className="small muted mt-16" style={{ maxWidth: 620, marginInline: 'auto' }}>
                We do not publish invented endorsements. Client testimonials appear here once a client has given written permission and the owner has published the quote. Ask an advisor for private references during a consultation.
              </p>
              <Link href="/contact" className="btn btn-outline mt-24">Request a Private Consultation <ArrowUpRight size={15} /></Link>
            </div>
          </Reveal>
        ) : (
          <div className="grid grid-3">
            {quotes.map((t, i) => (
              <Reveal key={`${t.name}-${i}`} delay={(Math.min(i, 3)) as 0 | 1 | 2 | 3}>
                <div className="testimonial" style={{ height: '100%' }}>
                  <span className="quote-mark">“</span>
                  <Quote size={18} className="gold mb-16" />
                  <Stars value={t.rating} size={14} />
                  <p className="mt-16">{t.quote}</p>
                  <div className="testimonial-foot">
                    <div className="avatar">{t.initials || initialsOf(t.name)}</div>
                    <div><p className="small" style={{ color: 'var(--ivory)', fontWeight: 600 }}>{t.name}</p><p className="tiny muted">{t.role}</p></div>
                    {t.sample && <span className="showcase-tag">Sample</span>}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
