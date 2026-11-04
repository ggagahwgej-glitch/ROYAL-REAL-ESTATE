'use client';
import { useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { UploadCloud, Image as ImageIcon, Trash2, Star, ArrowUp, ArrowDown, RefreshCw, Replace, PlayCircle, Check, X, AlertCircle } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { EmptyState, Notice } from '@/components/ui/UI';
import {
  deletePropertyMedia, reorderMedia, replaceMedia, setCoverMedia, updateMediaAlt,
  uploadPropertyMedia, validateMediaFile, type UploadProgress,
} from '@/lib/supabase/storage';
import { getMediaForProperty } from '@/lib/supabase/queries';
import type { PropertyMedia, QueryResult } from '@/lib/types';
import { formatBytes } from '@/lib/utils';

type Action = () => Promise<QueryResult<unknown>>;

export function MediaManager({ propertyId, client, title = 'Property media' }: {
  propertyId: string; client: SupabaseClient | null; title?: string;
}) {
  const [items, setItems] = useState<PropertyMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error' | 'warning'; text: string } | null>(null);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [drag, setDrag] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<PropertyMedia | null>(null);
  const [editingAlt, setEditingAlt] = useState<string | null>(null);
  const [altValue, setAltValue] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const replaceRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const load = useCallback(async () => {
    if (!client) {
      // Never leave an endless skeleton when the session is not ready yet.
      setLoading(false);
      setError('No authenticated Supabase client is available. Sign in as the owner to manage media.');
      return;
    }
    setLoading(true);
    const res = await getMediaForProperty(client, propertyId);
    if (res.error) setError(res.error);
    else { setItems(res.data ?? []); setError(null); }
    setLoading(false);
  }, [client, propertyId]);
  useEffect(() => { void load(); }, [load]);

  /** Every write goes through here so a lost session produces a message, not a TypeError. */
  const requireClient = (): SupabaseClient | null => {
    if (!client) {
      setNotice({ tone: 'error', text: 'Your owner session is not available. Sign in again before changing media.' });
      return null;
    }
    return client;
  };

  const handleFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (!list.length) return;
    const c = requireClient();
    if (!c) return;
    const invalid = list.map(validateMediaFile).find(v => !v.ok);
    if (invalid) { setNotice({ tone: 'error', text: invalid.error ?? 'Invalid file.' }); return; }
    setNotice(null); setProgress({ completed: 0, total: list.length, currentFile: list[0].name });
    const result = await uploadPropertyMedia(c, propertyId, list, setProgress);
    setProgress(null);
    if (result.error) { setNotice({ tone: 'error', text: result.error }); return; }
    setNotice({ tone: 'success', text: `${list.length} ${list.length === 1 ? 'file' : 'files'} uploaded to Supabase Storage and saved to the database. Published listings show them on their next page load.` });
    if (result.warning) setNotice({ tone: 'warning', text: result.warning });
    await load();
  };

  const onInput = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) void handleFiles(e.target.files);
    e.target.value = '';
  };
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setDrag(false);
    if (e.dataTransfer.files?.length) void handleFiles(e.dataTransfer.files);
  };

  /** Returns true only when the write actually succeeded. */
  const run = async (id: string, action: Action, msg: string): Promise<boolean> => {
    setBusy(id); setNotice(null);
    try {
      const result = await action();
      if (result.error) { setNotice({ tone: 'error', text: result.error }); return false; }
      if (result.warning) { setNotice({ tone: 'warning', text: result.warning }); return false; }
      setNotice({ tone: 'success', text: msg });
      await load();
      return true;
    } catch (e) {
      setNotice({ tone: 'error', text: e instanceof Error ? e.message : 'The operation could not be completed.' });
      return false;
    } finally { setBusy(null); }
  };

  const withClient = (fn: (c: SupabaseClient) => Action): Action => {
    const c = requireClient();
    return c ? fn(c) : async () => ({ data: null, error: 'Not authenticated.' });
  };

  return (
    <div className="admin-card">
      <div className="admin-card-head"><div><h3 className="h3">{title}</h3><p className="tiny muted mt-8">{items.length} {items.length === 1 ? 'item' : 'items'} · images and videos are stored in Supabase Storage</p></div>
        <button className="btn btn-ghost btn-sm" onClick={() => void load()}><RefreshCw size={14} /> Refresh</button></div>

      {notice && <Notice tone={notice.tone} className="mb-16">{notice.text}</Notice>}
      {error && <Notice tone="error" className="mb-16" title="Media could not be loaded">{error}</Notice>}

      <div className={`dropzone ${drag ? 'drag' : ''}`} onClick={e => { if (!(e.target as HTMLElement).closest('input')) inputRef.current?.click(); }}
        onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={onDrop}
        role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}>
        <UploadCloud />
        <p className="h4">Drop images or videos here</p>
        <p className="small muted mt-8">or click to browse · JPG, PNG, WebP, AVIF, GIF (12 MB) · MP4 / WebM video (120 MB). MP4 H.264 is recommended; MOV may not play in every browser.</p>
        {progress && <div className="mt-16"><p className="tiny gold flex center gap-8" style={{ justifyContent: 'center' }}><span className="spinner" /> Uploading {progress.currentFile} — {progress.completed}/{progress.total}</p>
          <div style={{ height: 4, background: 'var(--line-soft)', borderRadius: 2, marginTop: 10 }}><div style={{ height: '100%', width: `${(progress.completed / Math.max(1, progress.total)) * 100}%`, background: 'var(--gold)', borderRadius: 2, transition: 'width .3s' }} /></div></div>}
        <input ref={inputRef} type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif,image/gif,video/mp4,video/webm,video/quicktime,.jpg,.jpeg,.png,.webp,.avif,.mp4,.webm,.mov" onChange={onInput} onClick={e => e.stopPropagation()} className="hidden" />
      </div>

      <div className="mt-24">
        {loading ? <div className="media-grid">{[0, 1, 2].map(i => <div key={i} className="skeleton" style={{ height: 220, borderRadius: 6 }} />)}
          </div> : items.length === 0 ? <EmptyState icon={<ImageIcon />} title="No media yet"
            description="Upload images to create the gallery. The first image can be set as the cover." /> : (
          <div className="media-grid">
            {items.map((m, i) => (
              <div className="media-tile" key={m.id}>
                <div className="media-thumb">
                  {m.kind === 'video'
                    ? <video src={m.public_url} muted playsInline preload="metadata" />
                    // eslint-disable-next-line @next/next/no-img-element
                    : <img src={m.public_url} alt={m.alt_text ?? 'Property media'} loading="lazy" />}
                  {m.kind === 'video' && <PlayCircle size={22} className="gold" style={{ position: 'absolute' }} />}
                  {m.is_cover && <span className="badge badge-gold media-cover-tag"><Star size={10} /> Cover</span>}
                </div>
                <div className="media-body">
                  {editingAlt === m.id
                    ? <div className="flex gap-8"><input className="input" style={{ padding: '6px 8px', fontSize: 12 }} value={altValue} onChange={e => setAltValue(e.target.value)} autoFocus />
                        <button className="btn btn-ghost btn-icon btn-sm" title="Save" onClick={() => void run(m.id, withClient(c => () => updateMediaAlt(c, m.id, altValue)), 'Description updated.').then(ok => { if (ok) setEditingAlt(null); })}><Check size={14} /></button>
                        <button className="btn btn-ghost btn-icon btn-sm" title="Cancel" onClick={() => setEditingAlt(null)}><X size={14} /></button></div>
                    : <button className="tiny muted" style={{ background: 'none', border: 0, textAlign: 'left', padding: 0, wordBreak: 'break-all' }} onClick={() => { setEditingAlt(m.id); setAltValue(m.alt_text ?? ''); }} title="Edit description">{m.alt_text || 'Add a description…'}</button>}
                  <p className="tiny muted mt-8">{m.kind} · {formatBytes(m.file_size)} · #{i + 1}</p>
                </div>
                <div className="media-actions">
                  <button className="btn btn-ghost btn-icon btn-sm" title="Move up" disabled={i === 0 || busy === m.id} onClick={() => { const next = [...items]; [next[i - 1], next[i]] = [next[i], next[i - 1]]; void run(m.id, withClient(c => () => reorderMedia(c, next)), 'Order updated.'); }}><ArrowUp size={13} /></button>
                  <button className="btn btn-ghost btn-icon btn-sm" title="Move down" disabled={i === items.length - 1 || busy === m.id} onClick={() => { const next = [...items]; [next[i + 1], next[i]] = [next[i], next[i + 1]]; void run(m.id, withClient(c => () => reorderMedia(c, next)), 'Order updated.'); }}><ArrowDown size={13} /></button>
                  <button className="btn btn-ghost btn-icon btn-sm" title="Set as cover" disabled={m.is_cover || m.kind === 'video' || busy === m.id} onClick={() => void run(m.id, withClient(c => () => setCoverMedia(c, propertyId, m.id)), 'Cover image updated.')}><Star size={13} /></button>
                  <button className="btn btn-ghost btn-icon btn-sm" title="Replace file" disabled={busy === m.id} onClick={() => replaceRefs.current[m.id]?.click()}><Replace size={13} /></button>
                  <button className="btn btn-danger btn-icon btn-sm" title="Remove" disabled={busy === m.id} onClick={() => setConfirmDelete(m)}><Trash2 size={13} /></button>
                  <input type="file" className="hidden" accept={m.kind === 'video' ? 'video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov' : 'image/jpeg,image/png,image/webp,image/avif,image/gif,.jpg,.jpeg,.png,.webp,.avif,.gif'}
                    ref={el => { replaceRefs.current[m.id] = el; }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) void run(m.id, withClient(c => () => replaceMedia(c, m, f)), 'Media replaced.'); e.target.value = ''; }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {confirmDelete && <div className="notice notice-warning mt-24" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <AlertCircle /><span style={{ flex: 1, minWidth: 200 }}>Remove <strong>{confirmDelete.alt_text || 'this media item'}</strong>? The database record and the stored object are both deleted.</span>
        <div className="flex gap-8"><button className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(null)}>Cancel</button>
          <button className="btn btn-danger btn-sm" onClick={() => { const m = confirmDelete; setConfirmDelete(null); void run(m.id, withClient(c => () => deletePropertyMedia(c, m)), 'Media removed.'); }}>Remove</button></div>
      </div>}
    </div>
  );
}
