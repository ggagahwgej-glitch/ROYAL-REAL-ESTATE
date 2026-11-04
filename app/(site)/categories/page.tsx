import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Suspense } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { CATEGORIES } from '@/data/marketing';
import { PropertyBrowser } from '@/components/site/PropertyBrowser';
import { Reveal } from '@/components/ui/Reveal';
import { Loading } from '@/components/ui/UI';

export const metadata: Metadata = {
  title: 'Signature Collections',
  description: 'Explore Imperial Royal’s curated collections: signature villas, imperial penthouses, grand estates and heritage residences.',
  alternates: { canonical: '/categories' },
};
export default function CategoriesPage() {
  return (
    <>
      <section className="page-hero"><div className="container">
        <nav className="breadcrumb" aria-label="Breadcrumb"><Link href="/">Home</Link> / <span>Collections</span></nav>
        <p className="eyebrow no-line mt-8">Edited with intent</p>
        <h1>Signature collections.</h1>
        <p className="lead mt-16 max-w-600">Four distinct ways to live exceptionally. Each collection is edited by hand and answered privately.</p>
      </div></section>

      <section className="section-sm"><div className="container">
        <div className="grid grid-4">
          {CATEGORIES.map((c, i) => <Reveal key={c.name} delay={(i % 4) as 0 | 1 | 2 | 3}>
            <Link href={c.href} className="category-card">
              <Image src={c.image} alt={c.name} fill sizes="(max-width: 560px) 100vw, 25vw" style={{ objectFit: 'cover' }} />
              <div className="category-body"><p className="tiny gold uppercase">{c.caption}</p><h3>{c.name}</h3>
                <span className="link-gold mt-8">View collection <ArrowUpRight size={14} /></span></div>
            </Link>
          </Reveal>)}
        </div>
      </div></section>

      <section className="section-sm"><Suspense fallback={<Loading />}><PropertyBrowser heading="All collections" /></Suspense></section>
    </>
  );
}
