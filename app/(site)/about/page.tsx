import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, Compass, Landmark, ShieldCheck, Gem } from 'lucide-react';
import { Reveal } from '@/components/ui/Reveal';
import { BRAND_PILLARS, WHY_US } from '@/data/marketing';
import { Brand } from '@/components/brand/Brand';

export const metadata: Metadata = {
  title: 'Our Story — Ancient Authority, Modern Elegance',
  description: 'The philosophy, heritage and standards behind Imperial Royal Real Estate. A house built on judgement, discretion and legacy.',
  alternates: { canonical: '/about' },
};

export default function AboutPage() {
  return (
    <>
      <section className="page-hero"><div className="container">
        <nav className="breadcrumb" aria-label="Breadcrumb"><Link href="/">Home</Link> / <span>About</span></nav>
        <p className="eyebrow no-line mt-8">The House</p>
        <h1>A house built on <span className="gold-gradient-text">judgement.</span></h1>
        <p className="lead mt-16 max-w-600">Ancient royal authority, modern architectural elegance, and a quietly futuristic standard of service.</p>
      </div></section>

      <section className="section" id="philosophy"><div className="container split">
        <Reveal>
          <p className="eyebrow">Our philosophy</p>
          <h2 className="h2 mt-16">We represent fewer residences, and know each of them intimately.</h2>
          <div className="gold-rule" />
          <p className="lead">Imperial Royal was founded on a simple conviction: that a truly exceptional property is not a product, but a responsibility. It carries a history, an architecture and a future that deserve to be understood properly.</p>
          <p className="muted mt-16">We decline far more residences than we accept. Our collection is built through personal inspection, careful provenance research and long-standing relationships with owners, architects and family offices. That discipline is the reason clients return to us — often a generation later.</p>
          <Link href="/contact" className="link-gold mt-32">Speak to an advisor <ArrowUpRight /></Link>
        </Reveal>
        <Reveal delay={1}><div className="split-visual"><Image src="/images/interior-gallery.jpg" alt="Imperial marble hall" fill sizes="(max-width: 1024px) 100vw, 50vw" style={{ objectFit: 'cover' }} />
          <span className="frame-corner" style={{ top: 18, left: 18, borderRight: 0, borderBottom: 0 }} /><span className="frame-corner" style={{ bottom: 18, right: 18, borderLeft: 0, borderTop: 0 }} />
        </div></Reveal>
      </div></section>

      <section className="section section-alt" id="pillars"><div className="container">
        <div className="section-head"><Reveal><p className="eyebrow">The brand pillars</p><h2 className="h2 mt-16">Three commitments, held without compromise.</h2></Reveal></div>
        <div className="grid grid-3">
          {BRAND_PILLARS.map((p, i) => <Reveal key={p.number} delay={(i + 1) as 0 | 1 | 2 | 3}>
            <div className="card card-gold" style={{ height: '100%' }}>
              <div className="feature-icon mb-24">{i === 0 ? <Landmark /> : i === 1 ? <Gem /> : <Compass />}</div>
              <span className="serif gold" style={{ fontSize: '2rem' }}>{p.number}</span>
              <h3 className="h3 mt-8">{p.title}</h3>
              <p className="muted small mt-16">{p.body}</p>
            </div>
          </Reveal>)}
        </div>
      </div></section>

      <section className="section"><div className="container split">
        <Reveal><div className="split-visual" style={{ minHeight: 460 }}><Image src="/images/hero-estate.jpg" alt="Imperial estate at dusk" fill sizes="(max-width: 1024px) 100vw, 50vw" style={{ objectFit: 'cover' }} />
          <span className="frame-corner" style={{ top: 18, left: 18, borderRight: 0, borderBottom: 0 }} /><span className="frame-corner" style={{ bottom: 18, right: 18, borderLeft: 0, borderTop: 0 }} />
        </div></Reveal>
        <Reveal delay={1}>
          <p className="eyebrow">The emblem</p>
          <h2 className="h2 mt-16">A symbol with a meaning.</h2>
          <p className="lead mt-24">Our golden crest joins the lion — guardianship, strength and lineage — with a symmetrical shield of architectural linework and an imperial crown. Crafted as original vector geometry, it is designed to hold its presence from a favicon to a façade.</p>
          <div className="flex center gap-24 mt-32 wrap">
            <div style={{ width: 92, height: 108 }}><Brand variant="emblem" href={null} /></div>
            <div className="small muted" style={{ maxWidth: 300 }}>Power · Authority · Prestige · Strength · Legacy · Exclusivity · Confidence</div>
          </div>
          <div className="mt-32">{WHY_US.slice(0, 3).map((w, i) => <div className="feature-item" key={w.title}>
            <div className="feature-icon">{i === 0 ? <Gem /> : i === 1 ? <ShieldCheck /> : <Landmark />}</div>
            <div><h4>{w.title}</h4><p>{w.body}</p></div>
          </div>)}</div>
        </Reveal>
      </div></section>

      <section className="cta-band"><div className="container relative" style={{ zIndex: 2 }}>
        <p className="eyebrow no-line">Begin a relationship</p>
        <h2 className="display-sm mt-24">Discover what discretion feels like.</h2>
        <p className="lead mt-24" style={{ maxWidth: 560, marginInline: 'auto' }}>A private conversation is the beginning of every brief we accept.</p>
        <div className="flex gap-12 center wrap mt-32" style={{ justifyContent: 'center' }}>
          <Link href="/contact" className="btn btn-gold btn-lg">Contact a private advisor <ArrowUpRight size={17} /></Link>
          <Link href="/properties" className="btn btn-outline btn-lg">Explore the collection</Link>
        </div>
      </div></section>
    </>
  );
}
