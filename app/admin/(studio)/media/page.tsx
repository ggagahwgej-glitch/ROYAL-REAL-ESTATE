'use client';
import { useCallback, useEffect, useState } from 'react';
import { Images, Film, HardDrive, Image as ImageIcon, Trash2, RefreshCw } from 'lucide-react';
import { MediaManager } from '@/components/admin/MediaManager';
import { EmptyState, Notice } from '@/components/ui/UI';
import { useOwner } from '@/lib/hooks/useOwner';
import { getOwnerMedia, getOwnerProperties } from '@/lib/supabase/queries';
import { deletePropertyMedia } from '@/lib/supabase/storage';
import type { Property, PropertyMedia } from '@/lib/types';
import { formatBytes, truncate } from '@/lib/utils';

export default function AdminMediaPage() {
  const owner = useOwner();
  const [properties, setProperties] = useState<Property[]>([]);
  const [media, setMedia] = useState<PropertyMedia[]>([]);
  const [selected, setSelected] = useState('');
  const [tab, setTab] = useState<'manage' | 'all'>('manage');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!owner.client) return;
    setLoading(true);
    const [p, m] = await Promise.all([getOwnerProperties(owner.client), getOwnerMedia(owner.client)]);
    if (p.error) setError(p.error);
    else { setProperties(p.data ?? []); if (!selected && p.data?.length) setSelected(p.data[0].id); }
    if (m.error) setError(m.error); else { setMedia(m.data ?? []); setError(null); }
    setLoading(false);
  }, [owner.client, selected, error]);
  useEffect(() => { void load(); }, [owner.client]); // eslint-disable-line react-hooks/exhaustive-deps

  const images = media.filter(m => m.kind === 'image');
  const videos = media.filter(m => m.kind === 'video');
  const bytes = media.reduce((n, m) => n + (m.file_size ?? 0), 0);

  return (
    <div className="grid gap-24">
      <div className="flex between center gap-16 wrap">
        <div><p className="eyebrow no-line">Asset library</p><h2 className="admin-title mt-8">Media management</h2>
          <p className="small muted mt-8">Upload, preview, reorder, replace and remove property images and films.</p></div>
        <button className="btn btn-ghost btn-sm" onClick={() => void load()}><RefreshCw size={14} /> Refresh</button>
      </div>
      {feedback && <Notice tone="success">{feedback}</Notice>}
      {error && <Notice tone="error" title="Media library could not be loaded">{error}</Notice>}

      <div className="stat-grid">
        <div className="stat-card"><div className="icon"><Images /></div><p className="num">{loading ? '—' : media.length}</p><p className="lbl">Total assets</p></div>
        <div className="stat-card"><div className="icon"><ImageIcon /></div><p className="num">{loading ? '—' : images.length}</p><p className="lbl">Images</p></div>
        <div className="stat-card"><div className="icon"><Film /></div><p className="num">{loading ? '—' : videos.length}</p><p className="lbl">Videos</p></div>
        <div className="stat-card"><div className="icon"><HardDrive /></div><p className="num" style={{ fontSize: '1.9rem' }}>{loading ? '—' : formatBytes(bytes)}</p><p className="lbl">Stored volume</p></div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'manage' ? 'active' : ''}`} onClick={() => setTab('manage')}>Manage by property</button>
        <button className={`tab ${tab === 'all' ? 'active' : ''}`} onClick={() => setTab('all')}>All assets</button>
      </div>

      {tab === 'manage' && <>
        <div className="admin-card">
          <div className="field"><label className="label" htmlFor="media-property">Select a residence</label>
            <select id="media-property" className="select" value={selected} onChange={e => setSelected(e.target.value)}>
              <option value="">— Choose a property —</option>
              {properties.map(p => <option key={p.id} value={p.id}>{p.title} ({media.filter(m => m.property_id === p.id).length} assets)</option>)}
            </select></div>
        </div>
        {selected ? <MediaManager key={selected} propertyId={selected} client={owner.client} title={`Media · ${properties.find(p => p.id === selected)?.title ?? ''}`} />
          : <EmptyState icon={<Images />} title="Choose a residence" description={properties.length ? 'Select a property above to manage its gallery.' : 'Create a property first, then upload media for it.'} />}
      </>}

      {tab === 'all' && <div className="admin-card">
        <div className="admin-card-head"><h3 className="h3">All stored assets</h3><span className="badge badge-gold">{media.length}</span></div>
        {loading ? <div className="grid gap-12">{[0, 1, 2].map(i => <div key={i} className="skeleton" style={{ height: 70 }} />)}</div>
          : media.length === 0 ? <EmptyState icon={<Images />} title="The library is empty" description="Upload media from the “Manage by property” tab." />
            : <div className="media-grid">{media.map(m => <div className="media-tile" key={m.id}>
              <div className="media-thumb">{m.kind === 'video' ? <video src={m.public_url} muted preload="metadata" /> : // eslint-disable-next-line @next/next/no-img-element
                <img src={m.public_url} alt={m.alt_text ?? ''} loading="lazy" />}</div>
              <div className="media-body"><p className="tiny" style={{ color: 'var(--ivory)' }}>{truncate(properties.find(p => p.id === m.property_id)?.title ?? 'Unknown property', 32)}</p>
                <p className="tiny muted mt-8">{m.kind} · {formatBytes(m.file_size)} {m.is_cover && '· cover'}</p></div>
              <div className="media-actions"><button className="btn btn-danger btn-sm" onClick={async () => {
                if (!owner.client || !window.confirm('Remove this asset permanently?')) return;
                const res = await deletePropertyMedia(owner.client, m);
                if (res.error) { setError(res.error); return; }
                setError(null);
                setFeedback(res.warning ?? 'Asset removed.');
                await load();
              }}><Trash2 size={13} /> Remove</button></div>
            </div>)}</div>}
      </div>}
    </div>
  );
}
