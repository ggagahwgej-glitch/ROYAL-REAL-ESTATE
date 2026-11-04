import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowUpRight, ArrowRight, Compass, Gem, ShieldCheck, Landmark, KeyRound, Check } from 'lucide-react';
import { Hero } from '@/components/site/Hero';
import { SearchBar } from '@/components/site/SearchBar';
import { PropertyCollection } from '@/components/site/PropertyCollection';
import { Testimonials } from '@/components/site/Testimonials';
import { Reveal } from '@/components/ui/Reveal';
import { CATEGORIES, DESTINATIONS, WHY_US, BRAND_PILLARS } from '@/data/marketing';

export const metadata: Metadata = {
  title: 'Where Exceptional Living Meets Timeless Elegance',
  alternates: { canonical: '/' },
};

export default function HomePage() {
  return (
    <>
      <Hero />
      <SearchBar />

      {/* 4 — Brand introduction */}
      <section className="section" id="introduction">
        <div className="container split">
          <Reveal>
            <p className="eyebrow">The House of Imperial Royal</p>
            <h2 className="h2 mt-16">A legacy built on <span className="gold-gradient-text">extraordinary addresses.</span></h2>
            <div className="gold-rule" />
            <p className="lead">For over two decades we have represented residences of genuine consequence — estates with a story, architecture with intent, and addresses that will matter to the next generation.</p>
            <p className="muted mt-16">Our work is deliberately quiet. We hold a small, carefully edited collection, and we know every property, every owner and every detail within it. It is a different way of practising real estate: fewer transactions, deeper relationships, absolute discretion.</p>
            <div className="stat-row">
              <div><p className="stat-big">25</p><p className="stat-label">Years of expertise</p></div>
              <div><p className="stat-big">₹2,400<span className="small">Cr</span></p><p className="stat-label">Advised transactions</p></div>
              <div><p className="stat-big">98%</p><p className="stat-label">Private referrals</p></div>
            </div>
            <Link href="/about" className="link-gold mt-32">Discover our story <ArrowUpRight /></Link>
          </Reveal>
          <Reveal delay={1}>
            <div className="split-visual">
              <Image src="/images/interior-gallery.jpg" alt="The grand marble hall of an imperial residence" fill sizes="(max-width: 1024px) 100vw, 50vw" style={{ objectFit: 'cover' }} />
              <span className="frame-corner" style={{ top: 18, left: 18, borderRight: 0, borderBottom: 0 }} />
              <span className="frame-corner" style={{ bottom: 18, right: 18, borderLeft: 0, borderTop: 0 }} />
              <div style={{ position: 'absolute', bottom: 22, left: 24, zIndex: 2, background: 'rgba(8,9,13,.72)', padding: '14px 20px', border: '1px solid var(--line)' }}>
                <p className="eyebrow no-line">The Imperial Standard</p>
                <p className="serif mt-8" style={{ fontSize: '1.3rem' }}>Considered. Rare. Enduring.</p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* 5 — Signature property collection (live Supabase records) */}
      <div className="section-alt"><PropertyCollection /></div>

      {/* 6 — Luxury categories */}
      <section className="section" id="categories">
        <div className="container">
          <div className="section-head">
            <Reveal><p className="eyebrow">Curated collections</p><h2 className="h2 mt-16">Residences of a particular character.</h2></Reveal>
            <Link href="/categories" className="link-gold">All collections <ArrowUpRight /></Link>
          </div>
          <div className="grid grid-4">
            {CATEGORIES.map((cat, i) => (
              <Reveal key={cat.name} delay={(i % 4) as 0 | 1 | 2 | 3}>
                <Link href={cat.href} className="category-card">
                  <Image src={cat.image} alt={cat.name} fill sizes="(max-width: 560px) 100vw, 25vw" style={{ objectFit: 'cover' }} />
                  <div className="category-body">
                    <p className="tiny gold uppercase">{cat.caption}</p>
                    <h3>{cat.name}</h3>
                    <span className="link-gold mt-8">Explore <ArrowRight size={14} /></span>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 7 — Featured destinations */}
      <section className="section section-alt" id="destinations">
        <div className="container">
          <div className="section-head">
            <Reveal><p className="eyebrow">Where we are</p><h2 className="h2 mt-16">Addresses that define a landscape.</h2>
              <p className="muted mt-16 max-w-600">From private coastlines to the world’s great capitals, each destination is chosen for its enduring desirability.</p></Reveal>
            <Link href="/properties" className="link-gold">Search by location <ArrowUpRight /></Link>
          </div>
          <div className="grid grid-3">
            {DESTINATIONS.map((d, i) => (
              <Reveal key={d.name} delay={(i + 1) as 0 | 1 | 2 | 3}>
                {/* These are editorial location themes, not filterable cities: the
                    old link sent “The Azure Coast” to ?location=Coast, which could
                    never match a listing. Send visitors to the full collection. */}
                <Link href="/properties" className="destination-card" aria-label={`Browse residences in ${d.name}`} style={{ display: 'block', position: 'relative' }}>
                  <Image src={d.image} alt={d.name} fill sizes="(max-width: 780px) 100vw, 33vw" style={{ objectFit: 'cover' }} />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg,rgba(6,7,11,.9),transparent 65%)' }} />
                  <div className="destination-body">
                    <p className="tiny gold uppercase">{d.country}</p>
                    <h3 className="h3 mt-8">{d.name}</h3>
                    <p className="small muted">{d.count}</p>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 8 — Why choose us */}
      <section className="section" id="why-us">
        <div className="container split">
          <Reveal>
            <p className="eyebrow">Why Imperial Royal</p>
            <h2 className="h2 mt-16">An advisor, not an agent.</h2>
            <p className="lead mt-24">We are retained for judgement. Every recommendation is made with the same care we would apply to our own family’s holdings.</p>
            <div className="mt-32">
              {WHY_US.map((f, i) => (
                <div className="feature-item" key={f.title}>
                  <div className="feature-icon">{i === 0 ? <Gem /> : i === 1 ? <ShieldCheck /> : i === 2 ? <Landmark /> : <KeyRound />}</div>
                  <div><h4>{f.title}</h4><p>{f.body}</p></div>
                </div>
              ))}
            </div>
          </Reveal>
          <Reveal delay={1}>
            <div className="admin-card" style={{ padding: 'clamp(28px,4vw,52px)' }}>
              <p className="eyebrow no-line">Our commitment</p>
              <p className="serif mt-24" style={{ fontSize: 'clamp(1.6rem,2.6vw,2.3rem)', lineHeight: 1.35 }}>
                “We measure our success not by the number of properties we sell, but by the number of families who return to us a generation later.”
              </p>
              <div className="gold-rule" />
              <p className="small muted">The Founding Principle · Imperial Royal</p>
              <div className="grid gap-12 mt-32">
                {['Personally inspected residences', 'Confidential private viewings', 'Independent valuation guidance', 'Lifelong client stewardship'].map(item => (
                  <div key={item} className="flex gap-12 small" style={{ alignItems: 'center' }}><Check size={15} className="gold" />{item}</div>
                ))}
              </div>
              <Link href="/contact" className="btn btn-gold mt-32">Begin a private conversation <ArrowUpRight size={16} /></Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* 9 — Brand story */}
      <section className="section section-alt" id="story">
        <div className="container">
          <div className="split">
            <Reveal>
              <div className="split-visual" style={{ minHeight: 520 }}>
                <Image src="/images/hero-estate.jpg" alt="The illuminated facade of an imperial estate" fill sizes="(max-width: 1024px) 100vw, 50vw" style={{ objectFit: 'cover' }} />
                <span className="frame-corner" style={{ top: 18, left: 18, borderRight: 0, borderBottom: 0 }} />
                <span className="frame-corner" style={{ bottom: 18, right: 18, borderLeft: 0, borderTop: 0 }} />
              </div>
            </Reveal>
            <Reveal delay={1}>
              <p className="eyebrow">The Brand Story</p>
              <h2 className="h2 mt-16">Ancient authority. A future-facing house.</h2>
              <p className="lead mt-24">The golden emblem represents the lion — strength, guardianship and lineage — held within a shield of architectural symmetry and crowned by imperial geometry. It is the visual expression of everything we protect.</p>
              <p className="muted mt-16">Imperial Royal was founded to bring old-world standards of stewardship into a modern, international market. We pair hereditary judgement with precise technology, so that every detail of a residence — and every detail of a transaction — is handled with clarity.</p>
              <div className="mt-32">
                {BRAND_PILLARS.map(p => (
                  <div key={p.number} className="flex gap-24" style={{ padding: '18px 0', borderTop: '1px solid var(--line-soft)' }}>
                    <span className="serif gold" style={{ fontSize: '1.8rem', lineHeight: 1 }}>{p.number}</span>
                    <div><h4 className="h4">{p.title}</h4><p className="small muted mt-8">{p.body}</p></div>
                  </div>
                ))}
              </div>
              <Link href="/about" className="link-gold mt-32">Read the full story <ArrowUpRight /></Link>
            </Reveal>
          </div>
        </div>
      </section>

      {/* 10 — Genuine, owner-published testimonials */}
      <Testimonials />

      {/* 11 — Premium CTA */}
      <section className="cta-band">
        <div className="container relative" style={{ zIndex: 2 }}>
          <Reveal>
            <p className="eyebrow no-line">A private invitation</p>
            <h2 className="display-sm mt-24">Your next address should be <span className="gold-gradient-text">extraordinary.</span></h2>
            <p className="lead mt-24" style={{ maxWidth: 620, marginInline: 'auto' }}>Speak with an advisor about a residence, a collection or an acquisition brief. Every conversation begins in confidence.</p>
            <div className="flex gap-12 center wrap mt-32" style={{ justifyContent: 'center' }}>
              <Link href="/contact" className="btn btn-gold btn-lg">Request a Private Consultation <ArrowUpRight size={17} /></Link>
              <Link href="/properties" className="btn btn-outline btn-lg"><Compass size={17} /> Explore Properties</Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
