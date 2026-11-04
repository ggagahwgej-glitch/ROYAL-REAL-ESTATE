import type { Metadata } from 'next';
import Link from 'next/link';
import { Clock, MessageCircle, ArrowUpRight } from 'lucide-react';
import { ContactFormPanel } from '@/components/site/ContactFormPanel';
import { ContactDetails } from '@/components/site/ContactDetails';

export const metadata: Metadata = {
  title: 'Private Enquiry — Contact an Advisor',
  description: 'Speak with an Imperial Royal private advisor about acquisitions, lettings, viewings or an acquisition brief.',
  alternates: { canonical: '/contact' },
};

export default function ContactPage() {
  return (
    <>
      <section className="page-hero"><div className="container">
        <nav className="breadcrumb" aria-label="Breadcrumb"><Link href="/">Home</Link> / <span>Contact</span></nav>
        <p className="eyebrow no-line mt-8">Private office</p>
        <h1>Begin a private conversation.</h1>
        <p className="lead mt-16 max-w-600">Tell us what you are looking for. Every enquiry is read personally and answered with complete discretion.</p>
      </div></section>

      <section className="section"><div className="container">
        <div className="detail-grid">
          <div>
            <p className="eyebrow">Direct lines</p>
            <h2 className="h2 mt-16">The private office.</h2>
            <p className="muted mt-16 max-w-600">We respond to all enquiries within one business day. For time-sensitive matters, WhatsApp and telephone are monitored during office hours.</p>
            <ContactDetails />
            <div className="admin-card mt-32">
              <p className="eyebrow no-line mb-16">Office hours</p>
              <div className="grid grid-2 gap-16 small">
                <div className="flex gap-12 center"><Clock size={16} className="gold" /> Monday — Friday · 09:00 — 19:00</div>
                <div className="flex gap-12 center"><Clock size={16} className="gold" /> Saturday · By appointment</div>
                <div className="flex gap-12 center"><Clock size={16} className="gold" /> Sunday · Closed</div>
                <div className="flex gap-12 center"><MessageCircle size={16} className="gold" /> Private viewings by arrangement</div>
              </div>
            </div>
            <div className="mt-32 flex gap-12 wrap">
              <Link href="/properties" className="btn btn-outline btn-sm">Browse residences <ArrowUpRight size={14} /></Link>
              <Link href="/admin" className="btn btn-ghost btn-sm">Owner Studio</Link>
            </div>
          </div>
          <div className="sticky-card"><ContactFormPanel /></div>
        </div>
      </div></section>
    </>
  );
}
