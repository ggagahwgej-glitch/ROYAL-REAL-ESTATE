import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { PropertyBrowser } from '@/components/site/PropertyBrowser';
import { Loading } from '@/components/ui/UI';

export const metadata: Metadata = {
  title: 'Residences for Sale',
  description: 'Acquire an extraordinary residence from the Imperial Royal collection of villas, estates, penthouses and heritage properties.',
  alternates: { canonical: '/buy' },
};
export default function BuyPage() {
  return (
    <>
      <section className="page-hero"><div className="container">
        <nav className="breadcrumb" aria-label="Breadcrumb"><Link href="/">Home</Link> / <span>For Sale</span></nav>
        <p className="eyebrow no-line mt-8">Acquisitions</p>
        <h1>Residences for sale.</h1>
        <p className="lead mt-16 max-w-600">Landmark freehold and leasehold properties, chosen for architecture, provenance and long-term significance.</p>
      </div></section>
      <section className="section-sm"><Suspense fallback={<Loading />}><PropertyBrowser lockType="buy" heading="Available acquisitions" description="for sale" initialFilters={{ listingType: 'buy' }} /></Suspense></section>
    </>
  );
}
