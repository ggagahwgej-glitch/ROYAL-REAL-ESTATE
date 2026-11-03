'use client';
import Link from 'next/link';
import { ArrowUpRight, Quote } from 'lucide-react';
import { Reveal } from '@/components/ui/Reveal';
import { useSiteSettings } from '@/lib/hooks/useSiteData';

function initialsOf(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || '—';
}

/**
 * Genuine client testimonials only. Quotes are owner-published records stored
 * in site_settings.testimonials (Supabase, RLS-protected). No fabricated names,
 * quotes or "published with permission" claims are ever rendered here.
 */
export function Testimonials() {
  const { settings, loading, configured } = useSiteSettings();
  const quotes = settings.testimonials ?? [];
  // On an unconfigured / server render there are no records to wait for, so
  // show the honest statement instead of a skeleton that never resolves.
  const showSkeleton = loading && configured;

  return (
    <section className="section" id="testimonials">
      <div className="container">
        <div className="section-head">
          <Reveal><p className="eyebrow">In their words</p><h2 className="h2 mt-16">Relationships that endure.</h2></Reveal>
          <p className="small muted max-w-600">Client references are published only with written permission. Every quote shown here is a record entered by the owner in the Owner Studio.</p>
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
                  <p>{t.quote}</p>
                  <div className="testimonial-foot">
                    <div className="avatar">{t.initials || initialsOf(t.name)}</div>
                    <div><p className="small" style={{ color: 'var(--ivory)', fontWeight: 600 }}>{t.name}</p><p className="tiny muted">{t.role}</p></div>
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
