'use client';
import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Building2, PlusCircle, Inbox, Images, Settings, Database,
  Menu, X, LogOut, ChevronRight, ExternalLink, ShieldCheck, Wifi, WifiOff, Bell,
} from 'lucide-react';
import { Brand } from '@/components/brand/Brand';
import { OwnerGuard, SetupBanner } from './OwnerGuard';
import { useOwner } from '@/lib/hooks/useOwner';
import { useSupabaseConfig } from '@/lib/hooks/useSupabaseConfig';
import { getNewInquiryCount } from '@/lib/supabase/queries';
import { cn } from '@/lib/utils';

const NAV = [
  { group: 'Overview', items: [
    { href: '/admin/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  ]},
  { group: 'Portfolio', items: [
    { href: '/admin/properties', label: 'Properties', Icon: Building2 },
    { href: '/admin/properties/new', label: 'Add Property', Icon: PlusCircle },
    { href: '/admin/media', label: 'Media Library', Icon: Images },
  ]},
  { group: 'Relationships', items: [
    { href: '/admin/inquiries', label: 'Inquiries', Icon: Inbox },
  ]},
  { group: 'The House', items: [
    { href: '/admin/settings', label: 'Website Settings', Icon: Settings },
    { href: '/admin/configuration', label: 'Backend Configuration', Icon: Database },
  ]},
];

const TITLES: Record<string, string> = {
  '/admin/dashboard': 'Dashboard',
  '/admin/properties': 'Property Management',
  '/admin/properties/new': 'Add a Property',
  '/admin/inquiries': 'Inquiry Management',
  '/admin/media': 'Media Library',
  '/admin/settings': 'Website Settings',
  '/admin/configuration': 'Backend Configuration',
};

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const owner = useOwner();
  const config = useSupabaseConfig();
  const [newInquiries, setNewInquiries] = useState(0);

  /* Re-read on every navigation, so opening the inbox clears the badge without
     a reload. Never invented: a failed count simply shows nothing. */
  useEffect(() => {
    const client = owner.client;
    if (!client) { setNewInquiries(0); return; }
    let cancelled = false;
    void (async () => {
      const res = await getNewInquiryCount(client);
      if (!cancelled) setNewInquiries(res.error ? 0 : Math.max(0, res.data ?? 0));
    })();
    return () => { cancelled = true; };
  }, [owner.client, pathname]);
  // Bootstrap window: configuration remains reachable only until a shared config is published.
  const allowSetup = pathname === '/admin/configuration' && !config.shared;
  const title = TITLES[pathname] ?? (pathname.startsWith('/admin/properties/') && pathname.endsWith('/edit') ? 'Edit Property' : 'Owner Studio');

  const sidebar = (
    <aside className={cn('admin-sidebar', open && 'open')}>
      <div className="admin-side-head">
        <Brand variant="compact" href="/admin/dashboard" onClick={() => setOpen(false)} />
        <button className="btn-icon btn-sm btn-ghost" onClick={() => setOpen(false)} aria-label="Close navigation" style={{ display: 'none' }}><X size={16} /></button>
      </div>
      <nav className="admin-nav" aria-label="Owner Studio navigation">
        {NAV.map(group => <div key={group.group}>
          <p className="admin-nav-label">{group.group}</p>
          {group.items.map(({ href, label, Icon }) => (
            <Link key={href} href={href} onClick={() => setOpen(false)}
              className={cn('admin-nav-link', pathname === href && 'active')}>
              <Icon />{label}
              {label === 'Inquiries' && newInquiries > 0 && (
                <span className="badge badge-gold" style={{ marginLeft: 'auto', padding: '2px 7px' }}
                  aria-label={`${newInquiries} unread ${newInquiries === 1 ? 'inquiry' : 'inquiries'}`}>
                  {newInquiries > 99 ? '99+' : newInquiries}
                </span>
              )}
            </Link>
          ))}
        </div>)}
        <p className="admin-nav-label">Website</p>
        <Link href="/" className="admin-nav-link" onClick={() => setOpen(false)}><ExternalLink /> View public website <ChevronRight size={13} style={{ marginLeft: 'auto' }} /></Link>
      </nav>
      <div className="admin-side-foot">
        <div className="flex center gap-8 tiny" style={{ color: config.config ? 'var(--success)' : 'var(--warning)', marginBottom: 12 }}>
          {config.config ? <Wifi size={13} /> : <WifiOff size={13} />}
          {config.config ? `Connected · ${config.source === 'local' ? 'local browser' : 'shared'}` : 'Backend not configured'}
        </div>
        <p className="tiny muted" style={{ wordBreak: 'break-word' }}>{owner.identity?.user.email ?? 'Not signed in'}</p>
        <button className="btn btn-ghost btn-sm btn-block mt-16" onClick={async () => { await owner.signOut(); window.location.href = '/admin/login'; }}><LogOut size={14} /> Secure sign out</button>
      </div>
    </aside>
  );

  return (
    <OwnerGuard allowSetup={allowSetup}>
      <div className="admin-shell">
        {sidebar}
        <div className={cn('admin-backdrop', open && 'open')} onClick={() => setOpen(false)} />
        <div className="admin-main">
          <header className="admin-topbar">
            <div className="flex center gap-12">
              <button className="btn-icon btn-sm btn-ghost admin-mobile-toggle" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu size={18} /></button>
              <div><p className="tiny muted uppercase" style={{ letterSpacing: '.18em' }}>Owner Studio</p><h1 className="serif" style={{ fontSize: 20, lineHeight: 1.1 }}>{title}</h1></div>
            </div>
            <div className="flex center gap-12">
              <span className="badge badge-gold hidden-mobile" style={{ display: 'none' }}><Bell size={11} /></span>
              <span className={cn('badge', config.config ? 'badge-green' : 'badge-red')}>{config.config ? 'Supabase connected' : 'Setup required'}</span>
              <Link href="/admin/configuration" className="btn btn-ghost btn-sm" title="Backend configuration"><Database size={15} /></Link>
              <span className="admin-avatar" style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(140deg,var(--gold),var(--gold-antique))', color: '#14100A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, flex: 'none' }}>
                {owner.identity?.user.email?.slice(0, 2).toUpperCase() ?? 'IR'}
              </span>
            </div>
          </header>
          <main className="admin-content">
            <SetupBanner />
            {children}
          </main>
          <footer className="admin-content" style={{ paddingTop: 0, paddingBottom: 28 }}>
            <div className="divider" />
            <p className="tiny muted mt-16 flex center gap-8"><ShieldCheck size={12} /> Supabase Auth · Row Level Security · Publishable key only · No service-role credential</p>
          </footer>
        </div>
      </div>
    </OwnerGuard>
  );
}
