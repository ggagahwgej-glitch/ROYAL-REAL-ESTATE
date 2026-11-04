import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { PropertyBrowser } from '@/components/site/PropertyBrowser';
import { Loading } from '@/components/ui/UI';

export const metadata: Metadata = {
  title: 'The Collection — Extraordinary Residences',
  description: 'Search the complete Imperial Royal collection of villas, penthouses, estates and heritage residences for sale or rent.',
  alternates: { canonical: '/properties' },
};

export default function PropertiesPage() {
  return (
    <>
      <section className="page-hero"><div className="container">
        <nav className="breadcrumb" aria-label="Breadcrumb"><Link href="/">Home</Link> / <span>Properties</span></nav>
        <p className="eyebrow no-line mt-8">The complete collection</p>
        <h1>Find your exceptional address.</h1>
        <p className="lead mt-16 max-w-600">Every residence in the collection, presented without compromise — refine by destination, collection, price and specification.</p>
      </div></section>
      <section className="section-sm"><Suspense fallback={<Loading />}><PropertyBrowser /></Suspense></section>
    </>
  );
}
