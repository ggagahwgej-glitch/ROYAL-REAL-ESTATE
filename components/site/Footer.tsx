'use client';
import Link from 'next/link';
import { Instagram, Linkedin, Facebook, Youtube, MapPin, Phone, Mail, ArrowUpRight, Settings2, Shield } from 'lucide-react';
import { Brand } from '@/components/brand/Brand';
import { safeUrl, whatsappLink } from '@/lib/utils';
import type { SiteSettings } from '@/lib/types';

export function Footer({ settings }: { settings?: Partial<SiteSettings> | null }) {
  const business = settings?.business_name ?? 'Imperial Royal';
  const email = settings?.contact_email ?? 'concierge@imperialroyal.com';
  const phone = settings?.contact_phone ?? '+91 98764 00000';
  const whatsapp = settings?.whatsapp ?? '+91 98764 00000';
  const social = settings?.social ?? {};
  const socials = [
    { key: 'instagram', Icon: Instagram, label: 'Instagram' },
    { key: 'linkedin', Icon: Linkedin, label: 'LinkedIn' },
    { key: 'facebook', Icon: Facebook, label: 'Facebook' },
    { key: 'youtube', Icon: Youtube, label: 'YouTube' },
  ].filter(s => social[s.key]);
  const wa = whatsappLink(whatsapp);

  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <Brand variant="footer" />
            <p className="small muted mt-24" style={{ maxWidth: 340, lineHeight: 1.8 }}>
              {settings?.footer_text ?? 'A private collection of the world’s most distinguished residences, curated with discretion and absolute integrity.'}
            </p>
            <div className="social-row">
              {socials.map(({ key, Icon, label }) => (
                <a key={key} href={safeUrl(social[key]) ?? '#'} className="social-btn" aria-label={label} target="_blank" rel="noopener noreferrer"><Icon /></a>
              ))}
              {wa && <a href={wa} className="social-btn" aria-label="WhatsApp" target="_blank" rel="noopener noreferrer"><Phone size={16} /></a>}
            </div>
          </div>
          <div>
            <p className="footer-label">Explore</p>
            <ul className="footer-links">
              <li><Link href="/properties">All Properties</Link></li>
              <li><Link href="/buy">Properties for Sale</Link></li>
              <li><Link href="/rent">Properties for Rent</Link></li>
              <li><Link href="/categories">Signature Collections</Link></li>
              <li><Link href="/about">Our Story</Link></li>
              <li><Link href="/contact">Private Enquiry</Link></li>
            </ul>
          </div>
          <div>
            <p className="footer-label">The House</p>
            <ul className="footer-links">
              <li><Link href="/about#philosophy">Our Philosophy</Link></li>
              <li><Link href="/about#pillars">Brand Pillars</Link></li>
              <li><Link href="/contact">Speak to an Advisor</Link></li>
              <li><Link href="/settings">Display Preferences</Link></li>
              <li><Link href="/admin/configuration">Backend Configuration</Link></li>
              <li><Link href="/admin">Owner Studio <ArrowUpRight size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /></Link></li>
            </ul>
          </div>
          <div>
            <p className="footer-label">Private Office</p>
            <ul className="footer-links" style={{ color: '#AEB3BE' }}>
              <li className="flex gap-12 small" style={{ alignItems: 'flex-start' }}><MapPin size={15} style={{ color: 'var(--gold)', flex: 'none', marginTop: 3 }} />{settings?.address ?? 'The Imperial House, Guwahati, Assam, India'}</li>
              <li className="flex gap-12 small"><Phone size={15} style={{ color: 'var(--gold)', flex: 'none' }} /><a href={`tel:${phone.replace(/[^+\d]/g, '')}`}>{phone}</a></li>
              <li className="flex gap-12 small"><Mail size={15} style={{ color: 'var(--gold)', flex: 'none' }} /><a href={`mailto:${email}`}>{email}</a></li>
            </ul>
            <Link href="/contact" className="btn btn-outline btn-sm mt-24"><ArrowUpRight size={14} /> Request a Private Viewing</Link>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} {business}. All rights reserved. · {settings?.footer_note ?? 'Crafted for a legacy.'}</span>
          <span className="flex gap-24 center wrap">
            <Link href="/settings"><Settings2 size={12} style={{ verticalAlign: 'middle' }} /> Preferences</Link>
            <Link href="/admin"><Shield size={12} style={{ verticalAlign: 'middle' }} /> Owner Studio</Link>
            <span>Privacy · Discretion · Legacy</span>
          </span>
        </div>
      </div>
    </footer>
  );
}
