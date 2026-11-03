'use client';
import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Send, CheckCircle2, MessageCircle, AlertCircle } from 'lucide-react';
import { Notice } from '@/components/ui/UI';
import { useSupabaseConfig } from '@/lib/hooks/useSupabaseConfig';
import { getSupabaseClient } from '@/lib/supabase/factory';
import { submitInquiry } from '@/lib/supabase/queries';
import { validateEmail, validatePassword } from '@/lib/auth/owner';
import { whatsappLink } from '@/lib/utils';
import type { SiteSettings } from '@/lib/types';

export function InquiryForm({ propertyId, propertyTitle, settings, compact = false, heading = 'Enquire about this residence' }: {
  propertyId?: string | null; propertyTitle?: string; settings?: Partial<SiteSettings> | null; compact?: boolean; heading?: string;
}) {
  const config = useSupabaseConfig();
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: propertyTitle ? `I would like to arrange a private viewing of ${propertyTitle}.` : '' });
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const wa = whatsappLink(settings?.whatsapp, propertyTitle ? `Hello, I would like to enquire about ${propertyTitle}.` : 'Hello, I would like to speak with an advisor.');

  useEffect(() => {
    if (propertyTitle) setForm(f => ({ ...f, message: `I would like to arrange a private viewing of ${propertyTitle}.` }));
  }, [propertyTitle]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (form.name.trim().length < 2) next.name = 'Please enter your name.';
    const emailError = validateEmail(form.email);
    if (emailError) next.email = emailError;
    if (form.message.trim().length < 10) next.message = 'Please add a short message (at least 10 characters).';
    if (form.phone && form.phone.replace(/[^0-9]/g, '').length < 8) next.phone = 'Enter a valid phone number.';
    setErrors(next);
    if (Object.keys(next).length) return;

    if (!config.config) { setStatus('error'); setMessage('The enquiry system is not connected yet. Please use the email or WhatsApp contact options below.'); return; }
    const client = getSupabaseClient(config.config);
    if (!client) { setStatus('error'); setMessage('The connection is unavailable. Please try again shortly.'); return; }
    setBusy(true); setStatus('idle'); setMessage('');
    const result = await submitInquiry(client, { ...form, property_id: propertyId ?? null, source: propertyId ? 'property' : 'contact' });
    setBusy(false);
    if (result.error) { setStatus('error'); setMessage(`Your enquiry could not be sent: ${result.error}`); return; }
    setStatus('success');
    setMessage('Thank you. Your enquiry has been received securely and a private advisor will be in touch shortly.');
    setForm({ name: '', email: '', phone: '', message: propertyTitle ? `I would like to arrange a private viewing of ${propertyTitle}.` : '' });
  };

  return (
    <div className={compact ? '' : 'admin-card'} style={compact ? undefined : { padding: 26 }}>
      {!compact && <><p className="eyebrow no-line mb-8">Private enquiry</p><h3 className="h3 mb-16">{heading}</h3>
        <p className="small muted mb-24">Every enquiry is handled personally and in confidence.</p></>}
      <form onSubmit={submit} className="grid gap-16" noValidate>
        <div className="field"><label className="label" htmlFor="inq-name">Full name</label>
          <input id="inq-name" className={`input ${errors.name ? 'input-error' : ''}`} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Your name" autoComplete="name" />
          {errors.name && <span className="field-error"><AlertCircle size={13} />{errors.name}</span>}</div>
        <div className="form-grid">
          <div className="field"><label className="label" htmlFor="inq-email">Email</label>
            <input id="inq-email" type="email" className={`input ${errors.email ? 'input-error' : ''}`} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" autoComplete="email" />
            {errors.email && <span className="field-error"><AlertCircle size={13} />{errors.email}</span>}</div>
          <div className="field"><label className="label" htmlFor="inq-phone">Phone <span className="muted">(optional)</span></label>
            <input id="inq-phone" type="tel" className={`input ${errors.phone ? 'input-error' : ''}`} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+91 …" autoComplete="tel" />
            {errors.phone && <span className="field-error"><AlertCircle size={13} />{errors.phone}</span>}</div>
        </div>
        <div className="field"><label className="label" htmlFor="inq-message">Message</label>
          <textarea id="inq-message" className={`textarea ${errors.message ? 'input-error' : ''}`} value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} placeholder="Tell us what you are looking for…" />
          {errors.message && <span className="field-error"><AlertCircle size={13} />{errors.message}</span>}</div>

        {status === 'success' && <Notice tone="success" title="Enquiry received"><CheckCircle2 size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> {message}</Notice>}
        {status === 'error' && <Notice tone="error" title="We could not send your enquiry">{message} You can also email <a className="gold" href={`mailto:${settings?.contact_email ?? 'concierge@imperialroyal.com'}`}>{settings?.contact_email ?? 'our concierge'}</a>.</Notice>}
        {!config.config && config.initialized && <Notice tone="warning">Live enquiries require a Supabase connection. <Link href="/admin/configuration" className="gold">Configure the backend</Link> or contact us directly.</Notice>}

        <button className="btn btn-gold btn-block" type="submit" disabled={busy}>
          {busy ? <><span className="spinner" /> Sending securely…</> : <><Send size={15} /> Send Private Enquiry</>}
        </button>
        {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-block"><MessageCircle size={15} /> WhatsApp an Advisor</a>}
        <p className="tiny muted text-center">Your details are used only to respond to this enquiry. Submissions are protected by Row Level Security.</p>
      </form>
    </div>
  );
}
