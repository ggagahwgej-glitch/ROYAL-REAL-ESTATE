'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, ArrowUpRight, Shield } from 'lucide-react';
import { Brand } from '@/components/brand/Brand';
import { cn } from '@/lib/utils';

const LINKS = [
  { href: '/', label: 'Home' },
  { href: '/properties', label: 'Properties' },
  { href: '/buy', label: 'Buy' },
  { href: '/rent', label: 'Rent' },
  { href: '/categories', label: 'Collections' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

export function Header() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <>
      <header className={cn('site-header', scrolled && 'scrolled')}>
        <div className="container header-inner">
          <Brand variant="horizontal" />
          <nav className="nav-links" aria-label="Primary navigation">
            {LINKS.map(link => (
              <Link key={link.href} href={link.href} className={cn('nav-link',
                pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href)) ? 'active' : '')}>
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="header-actions">
            <Link href="/admin" className="btn btn-outline btn-sm"><Shield size={14} /> Owner Studio</Link>
            <button className="menu-toggle" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open}><Menu size={20} /></button>
          </div>
        </div>
      </header>

      <div className={cn('mobile-overlay', open && 'open')} aria-hidden={!open}>
        <div className="mobile-overlay-head">
          <Brand variant="compact" href={null} onClick={() => setOpen(false)} />
          <button className="menu-toggle" onClick={() => setOpen(false)} aria-label="Close menu"><X size={20} /></button>
        </div>
        <nav className="mobile-nav" aria-label="Mobile navigation">
          {LINKS.map(link => <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>{link.label}<ArrowUpRight /></Link>)}
          <Link href="/settings" onClick={() => setOpen(false)}>Preferences<ArrowUpRight /></Link>
        </nav>
        <div className="mobile-overlay-foot">
          <Link href="/admin" className="btn btn-gold btn-block" onClick={() => setOpen(false)}><Shield size={16} /> Enter Owner Studio</Link>
          <p className="tiny muted text-center mt-16">Imperial Royal · Private client services</p>
        </div>
      </div>
    </>
  );
}
