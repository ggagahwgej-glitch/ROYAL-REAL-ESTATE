'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { PlusCircle, Search, Pencil, Trash2, Copy, Eye, EyeOff, Star, StarOff, RefreshCw, ArrowUpRight, Image as ImageIcon } from 'lucide-react';
import { EmptyState, Modal, Notice, StatusBadge } from '@/components/ui/UI';
import { useOwner } from '@/lib/hooks/useOwner';
import { deleteProperty, duplicateProperty, getMediaForProperties, getOwnerProperties, updateProperty } from '@/lib/supabase/queries';
import type { Availability, Property, PropertyMedia } from '@/lib/types';
import { coverImage, formatPrice, formatDate } from '@/lib/utils';

export default function AdminPropertiesPage() {
  const owner = useOwner();
  const [items, setItems] = useState<Property[]>([]);
  const [media, setMedia] = useState<PropertyMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'published' | 'draft'>('all');
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Property | null>(null);

  const load = useCallback(async () => {
    if (!owner.client) return;
    setLoading(true); setError(null);
    const res = await getOwnerProperties(owner.client);
    if (res.error) { setError(res.error); setLoading(false); return; }
    const list = res.data ?? [];
    setItems(list);
    if (list.length) {
      const m = await getMediaForProperties(owner.client, list.map(p => p.id));
      setMedia(m.data ?? []);
    } else setMedia([]);
    setLoading(false);
  }, [owner.client]);
  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => items.filter(p => {
    if (status !== 'all' && p.status !== status) return false;
    if (search && !`${p.title} ${p.city} ${p.category} ${p.slug}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [items, search, status]);

  const act = async (id: string, fn: () => Promise<{ error: string | null }>, success: string) => {
    setBusy(id); setFeedback(null);
    const result = await fn();
    setBusy(null);
    if (result.error) { setFeedback({ tone: 'error', text: result.error }); return; }
    setFeedback({ tone: 'success', text: success });
    await load();
  };

  const changeAvailability = async (p: Property, value: Availability) => {
    if (!owner.client) return;
    await act(p.id, () => updateProperty(owner.client!, p.id, { title: p.title, availability: value }), `Availability changed to ${value}.`);
  };

  return (
    <div className="grid gap-24">
      <div className="flex between center gap-16 wrap">
        <div><p className="eyebrow no-line">Portfolio management</p><h2 className="admin-title mt-8">Properties</h2>
          <p className="small muted mt-8">Create, publish and curate every residence in the collection.</p></div>
        <div className="flex gap-12 wrap"><button className="btn btn-ghost btn-sm" onClick={() => void load()}><RefreshCw size={14} /> Refresh</button>
          <Link href="/admin/properties/new" className="btn btn-gold btn-sm"><PlusCircle size={15} /> Add property</Link></div>
      </div>

      {feedback && <Notice tone={feedback.tone}>{feedback.text}</Notice>}
      {error && <Notice tone="error" title="Could not load properties">{error}</Notice>}

      <div className="admin-card">
        <div className="admin-card-head">
          <div className="flex gap-12 wrap" style={{ flex: 1 }}>
            <div className="input-wrap" style={{ minWidth: 240, flex: 1, maxWidth: 360 }}><Search size={15} style={{ position: 'absolute', left: 14, color: 'var(--gold)' }} />
              <input className="input" style={{ paddingLeft: 38 }} placeholder="Search title, city, collection…" value={search} onChange={e => setSearch(e.target.value)} /></div>
            <select className="select" style={{ width: 170 }} value={status} onChange={e => setStatus(e.target.value as typeof status)}>
              <option value="all">All statuses</option><option value="published">Published</option><option value="draft">Draft</option>
            </select>
          </div>
          <span className="badge badge-gold">{filtered.length} {filtered.length === 1 ? 'residence' : 'residences'}</span>
        </div>

        {loading ? <div className="grid gap-12">{[0, 1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 66 }} />)}</div>
          : filtered.length === 0 ? <EmptyState icon={<ImageIcon />} title={items.length ? 'No matching properties' : 'Your portfolio is empty'}
            description={items.length ? 'Try a different search or status filter.' : 'Create your first residence. Published properties appear on the public website immediately.'}
            action={<Link href="/admin/properties/new" className="btn btn-gold btn-sm"><PlusCircle size={14} /> Add a property</Link>} />
            : <div className="table-wrap"><table className="table"><thead><tr>
              <th>Residence</th><th>Collection</th><th>Price</th><th>Status</th><th>Availability</th><th>Updated</th><th>Actions</th>
            </tr></thead><tbody>
              {filtered.map(p => {
                const cover = coverImage(p, media.filter(m => m.property_id === p.id));
                return <tr key={p.id}>
                  <td><div className="flex center gap-12">
                    {cover ? // eslint-disable-next-line @next/next/no-img-element
                      <img src={cover} alt="" className="thumb" loading="lazy" /> : <div className="thumb" style={{ background: 'var(--navy)' }} />}
                    <div style={{ minWidth: 160 }}><Link href={`/admin/properties/${p.id}/edit`} style={{ color: 'var(--ivory)', fontWeight: 600 }}>{p.title}</Link>
                      <p className="tiny muted">{p.city} · {p.bedrooms} bed · {p.area_sqft} sq ft</p></div>
                  </div></td>
                  <td>{p.category}{p.featured && <Star size={12} className="gold" style={{ marginLeft: 6, verticalAlign: 'middle' }} />}</td>
                  <td className="gold" style={{ whiteSpace: 'nowrap' }}>{formatPrice(p.price, p.currency, true)}</td>
                  <td><StatusBadge tone={p.status === 'published' ? 'green' : 'muted'}>{p.status}</StatusBadge></td>
                  <td><select className="select" style={{ padding: '6px 28px 6px 10px', fontSize: 12, width: 130, backgroundPosition: 'right 8px center' }}
                    value={p.availability} disabled={busy === p.id}
                    onChange={e => void changeAvailability(p, e.target.value as Availability)}>
                    {(['available', 'reserved', 'sold', 'rented'] as const).map(a => <option key={a} value={a}>{a}</option>)}
                  </select></td>
                  <td className="tiny muted" style={{ whiteSpace: 'nowrap' }}>{formatDate(p.updated_at)}</td>
                  <td><div className="table-actions">
                    <Link className="btn btn-ghost btn-icon btn-sm" href={`/admin/properties/${p.id}/edit`} title="Edit"><Pencil size={14} /></Link>
                    <button className="btn btn-ghost btn-icon btn-sm" disabled={busy === p.id} title={p.status === 'published' ? 'Unpublish' : 'Publish'}
                      onClick={() => void act(p.id, () => updateProperty(owner.client!, p.id, { title: p.title, status: p.status === 'published' ? 'draft' : 'published' }), p.status === 'published' ? 'Property unpublished. It is no longer visible publicly.' : 'Property published. It is now visible on the public website.')}>
                      {p.status === 'published' ? <EyeOff size={14} /> : <Eye size={14} />}</button>
                    <button className="btn btn-ghost btn-icon btn-sm" disabled={busy === p.id} title={p.featured ? 'Remove from signature' : 'Feature'}
                      onClick={() => void act(p.id, () => updateProperty(owner.client!, p.id, { title: p.title, featured: !p.featured }), p.featured ? 'Removed from the signature collection.' : 'Added to the signature collection.')}>
                      {p.featured ? <StarOff size={14} /> : <Star size={14} />}</button>
                    <button className="btn btn-ghost btn-icon btn-sm" disabled={busy === p.id} title="Duplicate"
                      onClick={() => void act(p.id, async () => { const r = await duplicateProperty(owner.client!, p); return { error: r.error }; }, 'A draft copy has been created.')}><Copy size={14} /></button>
                    <button className="btn btn-danger btn-icon btn-sm" disabled={busy === p.id} title="Delete" onClick={() => setConfirm(p)}><Trash2 size={14} /></button>
                    <Link className="btn btn-ghost btn-icon btn-sm" href={`/properties/${p.slug}`} target="_blank" title="View public page"><ArrowUpRight size={14} /></Link>
                  </div></td>
                </tr>;
              })}
            </tbody></table></div>}
      </div>

      <Modal open={Boolean(confirm)} onClose={() => setConfirm(null)} title="Delete this property?">
        <p className="small muted">You are about to permanently delete <strong style={{ color: 'var(--ivory)' }}>{confirm?.title}</strong>. Its media records are removed by the database cascade; stored objects may remain and can be cleared in the media library. This cannot be undone.</p>
        <Notice tone="warning" className="mt-16">The public listing will disappear immediately.</Notice>
        <div className="flex between gap-12 mt-24 wrap" style={{ width: '100%' }}>
          <button className="btn btn-ghost" onClick={() => setConfirm(null)}>Cancel</button>
          <button className="btn btn-danger" disabled={busy === confirm?.id} onClick={async () => {
            if (!confirm || !owner.client) return;
            setBusy(confirm.id);
            const result = await deleteProperty(owner.client, confirm.id);
            setBusy(null); setConfirm(null);
            setFeedback(result.error ? { tone: 'error', text: result.error } : { tone: 'success', text: 'Property deleted.' });
            await load();
          }}><Trash2 size={15} /> Delete permanently</button>
        </div>
      </Modal>
    </div>
  );
}
