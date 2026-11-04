import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { PropertyBrowser } from '@/components/site/PropertyBrowser';
import { Loading } from '@/components/ui/UI';

export const metadata: Metadata = {
  title: 'Residences for Rent',
  description: 'Exceptional long-term and serviced residences available to rent through Imperial Royal private client services.',
  alternates: { canonical: '/rent' },
};
export default function RentPage() {
  return (
    <>
      <section className="page-hero"><div className="container">
        <nav className="breadcrumb" aria-label="Breadcrumb"><Link href="/">Home</Link> / <span>For Rent</span></nav>
        <p className="eyebrow no-line mt-8">Private lettings</p>
        <h1>Residences for rent.</h1>
        <p className="lead mt-16 max-w-600">Discreet, fully managed tenancies in residences of genuine distinction.</p>
      </div></section>
      <section className="section-sm"><Suspense fallback={<Loading />}><PropertyBrowser lockType="rent" heading="Available lettings" description="to rent" initialFilters={{ listingType: 'rent' }} /></Suspense></section>
    </>
  );
}
