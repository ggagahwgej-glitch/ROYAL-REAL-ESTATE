'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Building2, CircleCheck, BadgeCheck, KeyRound, Star, Inbox, MailOpen, ArrowUpRight, PlusCircle, Database, RefreshCw, TriangleAlert } from 'lucide-react';
import { Notice, StatusBadge } from '@/components/ui/UI';
import { useOwner } from '@/lib/hooks/useOwner';
import { useSupabaseConfig } from '@/lib/hooks/useSupabaseConfig';
import { getDashboardStats, getInquiries, getOwnerProperties, type DashboardStats } from '@/lib/supabase/queries';
import type { Inquiry, Property } from '@/lib/types';
import { formatDate, truncate } from '@/lib/utils';

const EMPTY: DashboardStats = { total: 0, available: 0, sold: 0, rental: 0, featured: 0, inquiries: 0, unread: 0 };

export default function DashboardPage() {
  const owner = useOwner();
  const config = useSupabaseConfig();
  const [stats, setStats] = useState<DashboardStats>(EMPTY);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!owner.client) return;
    setLoading(true); setError(null);
    const [s, i, p] = await Promise.all([getDashboardStats(owner.client), getInquiries(owner.client), getOwnerProperties(owner.client)]);
    if (s.data) setStats(s.data);
    if (s.error) setError(s.error);
    if (i.data) setInquiries(i.data.slice(0, 5));
    if (i.error && !error) setError(i.error);
    if (p.data) setProperties(p.data.slice(0, 5));
    if (p.error && !error) setError(p.error);
    setLoading(false);
  };
  useEffect(() => { void load(); }, [owner.client]); // eslint-disable-line react-hooks/exhaustive-deps

  const cards = [
    { label: 'Total properties', value: stats.total, Icon: Building2, tone: 'gold' },
    { label: 'Available', value: stats.available, Icon: CircleCheck, tone: 'green' },
    { label: 'Sold', value: stats.sold, Icon: BadgeCheck, tone: 'muted' },
    { label: 'Rental properties', value: stats.rental, Icon: KeyRound, tone: 'blue' },
    { label: 'Featured', value: stats.featured, Icon: Star, tone: 'gold' },
    { label: 'Total inquiries', value: stats.inquiries, Icon: Inbox, tone: 'blue' },
    { label: 'Unread inquiries', value: stats.unread, Icon: MailOpen, tone: 'red' },
  ] as const;

  return (
    <div className="grid gap-24">
      <div className="flex between center gap-16 wrap">
        <div><p className="eyebrow no-line">Executive overview</p><h2 className="admin-title mt-8">Welcome back{owner.identity?.profile.full_name ? `, ${owner.identity.profile.full_name}` : ''}.</h2>
          <p className="small muted mt-8">A live view of your portfolio, relationships and connection health.</p></div>
        <div className="flex gap-12 wrap">
          <button className="btn btn-ghost btn-sm" onClick={() => void load()}><RefreshCw size={14} /> Refresh</button>
          <Link href="/admin/properties/new" className="btn btn-gold btn-sm"><PlusCircle size={15} /> Add property</Link>
        </div>
      </div>

      {error && <Notice tone="error" title="Some data could not be loaded">{error} This usually means the database schema has not been installed. Run <code>supabase/schema.sql</code> in the Supabase SQL Editor.</Notice>}
      {!config.shared && config.config && <Notice tone="warning" title="Shared configuration not published">This browser is connected, but other visitors cannot see live data yet. <Link className="gold" href="/admin/configuration">Publish the shared public configuration →</Link></Notice>}

      <div className="stat-grid">
        {cards.map(c => <div className="stat-card" key={c.label}>
          <div className="icon"><c.Icon /></div>
          <p className="num">{loading ? '—' : c.value}</p>
          <p className="lbl">{c.label}</p>
        </div>)}
      </div>

      <div className="admin-duo">
        <div className="admin-card">
          <div className="admin-card-head"><h3 className="h3">Recent inquiries</h3><Link href="/admin/inquiries" className="link-gold">View all <ArrowUpRight size={14} /></Link></div>
          {loading ? <div className="skeleton" style={{ height: 180 }} /> : inquiries.length === 0 ? <p className="small muted">No inquiries yet. Submissions from the public website will appear here instantly.</p> : (
            <div className="table-wrap"><table className="table"><thead><tr><th>From</th><th>Message</th><th>Status</th><th>Date</th></tr></thead><tbody>
              {inquiries.map(q => <tr key={q.id}><td><strong style={{ color: 'var(--ivory)' }}>{q.name}</strong><br /><span className="tiny muted">{q.email}</span></td>
                <td style={{ maxWidth: 220 }}>{truncate(q.message, 60)}</td>
                <td><StatusBadge tone={q.status === 'new' ? 'red' : q.status === 'resolved' ? 'green' : 'gold'}>{q.status}</StatusBadge></td>
                <td className="tiny muted">{formatDate(q.created_at)}</td></tr>)}
            </tbody></table></div>
          )}
        </div>
        <div className="admin-card">
          <div className="admin-card-head"><h3 className="h3">Portfolio</h3><Link href="/admin/properties" className="link-gold">Manage <ArrowUpRight size={14} /></Link></div>
          {loading ? <div className="skeleton" style={{ height: 180 }} /> : properties.length === 0 ? <p className="small muted">Your portfolio is empty. Create your first residence to begin.</p> : (
            <div className="grid gap-12">{properties.map(p => <Link href={`/admin/properties/${p.id}/edit`} key={p.id} className="flex between center gap-12" style={{ padding: '10px 0', borderBottom: '1px solid var(--line-soft)' }}>
              <div><p className="small" style={{ color: 'var(--ivory)' }}>{truncate(p.title, 42)}</p><p className="tiny muted">{p.city} · {p.category}</p></div>
              <div className="flex gap-8 center"><StatusBadge tone={p.status === 'published' ? 'green' : 'muted'}>{p.status}</StatusBadge><ArrowUpRight size={14} className="gold" /></div>
            </Link>)}</div>
          )}
          <div className="grid gap-8 mt-24">
            <Link href="/admin/configuration" className="btn btn-outline btn-sm btn-block"><Database size={14} /> Backend Configuration</Link>
            <Link href="/admin/media" className="btn btn-ghost btn-sm btn-block">Manage media library</Link>
          </div>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card-head"><h3 className="h3">System integrity</h3><StatusBadge tone={config.config ? 'green' : 'red'}>{config.config ? 'Operational' : 'Setup required'}</StatusBadge></div>
        <div className="grid grid-3 gap-16 small">
          <div className="flex gap-12" style={{ alignItems: 'flex-start' }}><Database size={16} className="gold" style={{ flex: 'none' }} /><div><strong style={{ color: 'var(--ivory)' }}>Configuration</strong><p className="tiny muted mt-8">{config.config ? `${config.source === 'local' ? 'Local browser' : 'Shared public'} · ${config.config.url}` : 'Not connected'}</p></div></div>
          <div className="flex gap-12" style={{ alignItems: 'flex-start' }}><CircleCheck size={16} className="gold" style={{ flex: 'none' }} /><div><strong style={{ color: 'var(--ivory)' }}>Authentication</strong><p className="tiny muted mt-8">Supabase Auth · {owner.status === 'authenticated' ? 'verified owner' : 'pending'}</p></div></div>
          <div className="flex gap-12" style={{ alignItems: 'flex-start' }}><TriangleAlert size={16} className="gold" style={{ flex: 'none' }} /><div><strong style={{ color: 'var(--ivory)' }}>Data protection</strong><p className="tiny muted mt-8">RLS enforced · publishable key only · no service-role credential</p></div></div>
        </div>
      </div>
    </div>
  );
}
