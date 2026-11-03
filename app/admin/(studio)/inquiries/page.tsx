'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, RefreshCw, Trash2, Eye, MailOpen, PhoneCall, CheckCircle2, Mail, Phone, MessageSquare, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { EmptyState, Modal, Notice, StatusBadge } from '@/components/ui/UI';
import { useOwner } from '@/lib/hooks/useOwner';
import { deleteInquiry, getInquiries, getOwnerProperties, setInquiryStatus } from '@/lib/supabase/queries';
import type { Inquiry, InquiryStatus, Property } from '@/lib/types';
import { formatDate } from '@/lib/utils';

const STATUSES: InquiryStatus[] = ['new', 'read', 'contacted', 'resolved'];

export default function AdminInquiriesPage() {
  const owner = useOwner();
  const [items, setItems] = useState<Inquiry[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | InquiryStatus>('all');
  const [selected, setSelected] = useState<Inquiry | null>(null);
  const [confirm, setConfirm] = useState<Inquiry | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!owner.client) return;
    setLoading(true); setError(null);
    const [q, p] = await Promise.all([getInquiries(owner.client), getOwnerProperties(owner.client)]);
    if (q.error) setError(q.error); else setItems(q.data ?? []);
    if (p.data) setProperties(p.data);
    setLoading(false);
  }, [owner.client]);
  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => items.filter(q => {
    if (status !== 'all' && q.status !== status) return false;
    if (search && !`${q.name} ${q.email} ${q.phone ?? ''} ${q.message}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [items, search, status]);

  const changeStatus = async (id: string, next: InquiryStatus) => {
    if (!owner.client) return;
    setBusy(id); setFeedback(null);
    const res = await setInquiryStatus(owner.client, id, next);
    setBusy(null);
    if (res.error) setFeedback({ tone: 'error', text: res.error });
    else { setFeedback({ tone: 'success', text: `Inquiry marked as ${next}.` }); setSelected(null); await load(); }
  };

  return (
    <div className="grid gap-24">
      <div className="flex between center gap-16 wrap">
        <div><p className="eyebrow no-line">Client relationships</p><h2 className="admin-title mt-8">Inquiries</h2>
          <p className="small muted mt-8">Private submissions from the public website. Only verified owners can read them.</p></div>
        <button className="btn btn-ghost btn-sm" onClick={() => void load()}><RefreshCw size={14} /> Refresh</button>
      </div>
      {feedback && <Notice tone={feedback.tone}>{feedback.text}</Notice>}
      {error && <Notice tone="error" title="Inquiries could not be loaded">{error}</Notice>}

      <div className="stat-grid">
        {STATUSES.map(s => <div className="stat-card" key={s}>
          <div className="icon">{s === 'new' ? <Mail /> : s === 'read' ? <MailOpen /> : s === 'contacted' ? <PhoneCall /> : <CheckCircle2 />}</div>
          <p className="num">{loading ? '—' : items.filter(q => q.status === s).length}</p><p className="lbl">{s}</p>
        </div>)}
      </div>

      <div className="admin-card">
        <div className="admin-card-head">
          <div className="flex gap-12 wrap" style={{ flex: 1 }}>
            <div className="input-wrap" style={{ minWidth: 220, flex: 1, maxWidth: 380 }}><Search size={15} style={{ position: 'absolute', left: 14, color: 'var(--gold)' }} />
              <input className="input" style={{ paddingLeft: 38 }} placeholder="Search name, email, message…" value={search} onChange={e => setSearch(e.target.value)} /></div>
            <select className="select" style={{ width: 170 }} value={status} onChange={e => setStatus(e.target.value as typeof status)}>
              <option value="all">All statuses</option>{STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div><span className="badge badge-gold">{filtered.length} shown</span>
        </div>
        {loading ? <div className="grid gap-12">{[0, 1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 60 }} />)}</div>
          : filtered.length === 0 ? <EmptyState icon={<MessageSquare />} title={items.length ? 'No matching inquiries' : 'No inquiries yet'}
            description={items.length ? 'Try a different search or status filter.' : 'When a visitor submits an enquiry, it appears here with status “new”.'} />
            : <div className="table-wrap"><table className="table"><thead><tr><th>Client</th><th>Message</th><th>Property</th><th>Status</th><th>Received</th><th>Actions</th></tr></thead><tbody>
              {filtered.map(q => <tr key={q.id}>
                <td><p style={{ color: 'var(--ivory)', fontWeight: 600 }}>{q.name}</p><p className="tiny muted">{q.email}{q.phone ? ` · ${q.phone}` : ''}</p></td>
                <td style={{ maxWidth: 260 }}>{q.message.length > 78 ? `${q.message.slice(0, 78)}…` : q.message}</td>
                <td className="tiny">{q.property_id ? (properties.find(p => p.id === q.property_id)?.title ?? '—') : 'General enquiry'}</td>
                <td><StatusBadge tone={q.status === 'new' ? 'red' : q.status === 'resolved' ? 'green' : 'gold'}>{q.status}</StatusBadge></td>
                <td className="tiny muted" style={{ whiteSpace: 'nowrap' }}>{formatDate(q.created_at, true)}</td>
                <td><div className="table-actions">
                  <button className="btn btn-ghost btn-icon btn-sm" title="View" onClick={() => setSelected(q)}><Eye size={14} /></button>
                  {q.status !== 'read' && <button className="btn btn-ghost btn-icon btn-sm" title="Mark as read" disabled={busy === q.id} onClick={() => void changeStatus(q.id, 'read')}><MailOpen size={14} /></button>}
                  {q.status !== 'contacted' && <button className="btn btn-ghost btn-icon btn-sm" title="Mark as contacted" disabled={busy === q.id} onClick={() => void changeStatus(q.id, 'contacted')}><PhoneCall size={14} /></button>}
                  {q.status !== 'resolved' && <button className="btn btn-ghost btn-icon btn-sm" title="Mark as resolved" disabled={busy === q.id} onClick={() => void changeStatus(q.id, 'resolved')}><CheckCircle2 size={14} /></button>}
                  <button className="btn btn-danger btn-icon btn-sm" title="Delete" onClick={() => setConfirm(q)}><Trash2 size={14} /></button>
                </div></td>
              </tr>)}
            </tbody></table></div>}
      </div>

      <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title="Inquiry detail">
        {selected && <div className="grid gap-16">
          <div className="flex between center gap-12 wrap"><div><p className="h3">{selected.name}</p><p className="tiny muted">{formatDate(selected.created_at, true)}</p></div>
            <StatusBadge tone={selected.status === 'new' ? 'red' : selected.status === 'resolved' ? 'green' : 'gold'}>{selected.status}</StatusBadge></div>
          <div className="grid grid-2 gap-12 small">
            <a href={`mailto:${selected.email}`} className="flex gap-8 center"><Mail size={14} className="gold" />{selected.email}</a>
            {selected.phone && <a href={`tel:${selected.phone.replace(/[^+\d]/g, '')}`} className="flex gap-8 center"><Phone size={14} className="gold" />{selected.phone}</a>}
          </div>
          <div className="panel" style={{ padding: 18 }}><p className="tiny muted uppercase mb-8">Message</p><p className="small" style={{ whiteSpace: 'pre-wrap' }}>{selected.message}</p></div>
          {selected.property_id && <Link href={`/admin/properties/${selected.property_id}/edit`} className="link-gold">View related property <ArrowUpRight size={14} /></Link>}
          <div className="flex gap-8 wrap">{STATUSES.filter(s => s !== selected.status).map(s => <button key={s} className="btn btn-outline btn-sm" onClick={() => void changeStatus(selected.id, s)}>Mark {s}</button>)}</div>
        </div>}
      </Modal>

      <Modal open={Boolean(confirm)} onClose={() => setConfirm(null)} title="Delete this inquiry?">
        <p className="small muted">This permanently removes the enquiry from <strong style={{ color: 'var(--ivory)' }}>{confirm?.name}</strong>. It cannot be recovered.</p>
        <div className="flex between gap-12 mt-24 wrap" style={{ width: '100%' }}>
          <button className="btn btn-ghost" onClick={() => setConfirm(null)}>Cancel</button>
          <button className="btn btn-danger" onClick={async () => {
            if (!confirm || !owner.client) return;
            const res = await deleteInquiry(owner.client, confirm.id);
            setConfirm(null);
            setFeedback(res.error ? { tone: 'error', text: res.error } : { tone: 'success', text: 'Inquiry deleted.' });
            await load();
          }}><Trash2 size={15} /> Delete</button>
        </div>
      </Modal>
    </div>
  );
}
