'use client';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Notice({ tone = 'info', title, children, className }: {
  tone?: 'info' | 'success' | 'error' | 'warning'; title?: string; children?: ReactNode; className?: string;
}) {
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'error' ? AlertCircle : tone === 'warning' ? AlertTriangle : Info;
  return <div className={cn('notice', `notice-${tone}`, className)} role={tone === 'error' ? 'alert' : 'status'}>
    <Icon /><div>{title && <strong className="notice-title">{title}</strong>}{children}</div>
  </div>;
}

export function EmptyState({ icon, title, description, action }: {
  icon?: ReactNode; title: string; description?: string; action?: ReactNode;
}) {
  return <div className="empty-state">
    {icon ?? <AlertCircle />}
    <h3 className="h3">{title}</h3>
    {description && <p className="muted small measure" style={{ margin: '0 auto' }}>{description}</p>}
    {action && <div className="mt-24">{action}</div>}
  </div>;
}

export function Loading({ label = 'Loading…', className }: { label?: string; className?: string }) {
  return <div className={cn('loading-center', className)}><span className="spinner spinner-lg" /><span>{label}</span></div>;
}

export function SkeletonCard() { return <div className="card-skeleton skeleton" />; }

export function StatusBadge({ children, tone = 'muted' }: { children: ReactNode; tone?: 'gold' | 'green' | 'red' | 'muted' | 'blue' }) {
  return <span className={cn('badge', `badge-${tone}`)}>{children}</span>;
}

export function Modal({ open, onClose, title, children, footer, wide }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean;
}) {
  const headingId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Keyboard users land inside the dialog instead of behind the overlay.
    panelRef.current?.focus();
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="lightbox" style={{ background: 'rgba(4,5,8,.88)', padding: 20 }} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={headingId}
        className="admin-card" style={{ width: wide ? 'min(100%, 900px)' : 'min(100%, 520px)', maxHeight: '86vh', overflowY: 'auto', animation: 'modalIn .28s cubic-bezier(.22,.61,.36,1)', borderColor: 'var(--line)', outline: 'none' }}>
        <div className="admin-card-head"><h3 className="h3" id={headingId}>{title}</h3>
          <button className="btn-icon btn-sm btn-ghost" onClick={onClose} aria-label="Close"><X size={16} /></button></div>
        {children}
        {footer && <div className="flex between gap-12 mt-24 wrap">{footer}</div>}
      </div>
    </div>
  );
}

export function InlineBusy({ label }: { label: string }) { return <span className="flex center gap-8 small muted"><Loader2 size={14} className="spinner" />{label}</span>; }
