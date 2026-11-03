'use client';
import { useEffect } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import type { PropertyMedia } from '@/lib/types';

export function Lightbox({ media, index, onClose, onIndex }: {
  media: PropertyMedia[]; index: number; onClose: () => void; onIndex: (i: number) => void;
}) {
  const current = media[index];
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onIndex((index + 1) % media.length);
      if (e.key === 'ArrowLeft') onIndex((index - 1 + media.length) % media.length);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [index, media.length, onClose, onIndex]);
  if (!current) return null;
  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label="Fullscreen media viewer" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <button className="lightbox-close" onClick={onClose} aria-label="Close viewer"><X size={20} /></button>
      {media.length > 1 && <>
        <button className="lightbox-nav" style={{ left: 20 }} onClick={() => onIndex((index - 1 + media.length) % media.length)} aria-label="Previous"><ChevronLeft size={22} /></button>
        <button className="lightbox-nav" style={{ right: 20 }} onClick={() => onIndex((index + 1) % media.length)} aria-label="Next"><ChevronRight size={22} /></button>
      </>}
      {current.kind === 'video'
        ? <video src={current.public_url} controls autoPlay playsInline style={{ maxWidth: 'min(92vw,1400px)', maxHeight: '80vh' }} />
        // eslint-disable-next-line @next/next/no-img-element
        : <img src={current.public_url} alt={current.alt_text ?? 'Property media'} />}
      <p className="lightbox-caption">{current.alt_text ?? 'Residence gallery'} · {index + 1} / {media.length}</p>
    </div>
  );
}
