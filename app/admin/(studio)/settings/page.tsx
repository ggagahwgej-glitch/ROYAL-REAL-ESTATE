'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Save, UploadCloud, RefreshCw, Globe, Palette, Image as ImageIcon, Contact, Share2, Eye } from 'lucide-react';
import { Brand } from '@/components/brand/Brand';
import { Notice } from '@/components/ui/UI';
import { useOwner } from '@/lib/hooks/useOwner';
import { useSiteSettings } from '@/lib/hooks/useSiteData';
import { saveSiteSettings } from '@/lib/supabase/queries';
import { uploadBrandingAsset } from '@/lib/supabase/storage';
import type { SiteSettings } from '@/lib/types';

export default function AdminSettingsPage() {
  const owner = useOwner();
  const { settings, refresh } = useSiteSettings();
  const [form, setForm] = useState<SiteSettings>(settings);
  const [social, setSocial] = useState<Record<string, string>>(settings.social ?? {});
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [tab, setTab] = useState<'branding' | 'content' | 'contact' | 'seo'>('branding');
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => { setForm(settings); setSocial(settings.social ?? {}); }, [settings]);
  const set = <K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) => setForm(f => ({ ...f, [key]: value }));

  const upload = async (kind: 'logo_url' | 'favicon_url' | 'hero_image', file: File) => {
    if (!owner.client) { setFeedback({ tone: 'error', text: 'Sign in before uploading branding assets.' }); return; }
    setUploading(kind); setFeedback(null);
    const res = await uploadBrandingAsset(owner.client, file, kind === 'hero_image' ? 'hero' : kind === 'favicon_url' ? 'favicons' : 'logos');
    setUploading(null);
    if (res.error) { setFeedback({ tone: 'error', text: res.error }); return; }
    set(kind, res.data!.url);
    setFeedback({ tone: 'success', text: 'Asset uploaded to the public branding bucket and linked to your settings.' });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setFeedback(null);
    if (!form.business_name?.trim()) { setFeedback({ tone: 'error', text: 'Business name is required.' }); return; }
    if (!owner.client) { setFeedback({ tone: 'error', text: 'No authenticated owner session.' }); return; }
    setBusy(true);
    const payload: Partial<SiteSettings> = { ...form, social: { ...social } };
    const res = await saveSiteSettings(owner.client, payload);
    setBusy(false);
    if (res.error) { setFeedback({ tone: 'error', text: `Settings could not be saved: ${res.error}` }); return; }
    setFeedback({ tone: 'success', text: 'Website settings saved. Public pages pick up the changes on their next load.' });
    refresh();
  };

  const renderUploadField = (field: 'logo_url' | 'favicon_url' | 'hero_image', label: string, hint: string) => (
    <div className="field span-2">
      <label className="label">{label}</label>
      <div className="flex gap-12 wrap center">
        <input className="input" style={{ flex: 1, minWidth: 220 }} value={form[field] ?? ''} onChange={e => set(field, e.target.value)} placeholder="https://… or upload below" />
        <button type="button" className="btn btn-outline btn-sm" disabled={uploading === field} onClick={() => fileRefs.current[field]?.click()}>
          {uploading === field ? <><span className="spinner" /> Uploading…</> : <><UploadCloud size={14} /> Upload</>}</button>
      </div>
      <span className="hint">{hint}</span>
      <input ref={el => { fileRefs.current[field] = el; }} type="file" className="hidden" accept="image/jpeg,image/png,image/webp,image/avif,image/svg+xml"
        onChange={e => { const f = e.target.files?.[0]; if (f) void upload(field, f); e.target.value = ''; }} />
      {form[field] && <div className="mt-8" style={{ width: 90, height: 60, border: '1px solid var(--line-soft)', borderRadius: 4, overflow: 'hidden', background: 'var(--navy)' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={form[field]!} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /></div>}
    </div>
  );

  return (
    <form onSubmit={submit} className="grid gap-24">
      <div className="flex between center gap-16 wrap">
        <div><p className="eyebrow no-line">Public identity</p><h2 className="admin-title mt-8">Website settings</h2>
          <p className="small muted mt-8">Branding, contact details, hero content and search metadata for the public website.</p></div>
        <div className="flex gap-12 wrap"><button type="button" className="btn btn-ghost btn-sm" onClick={refresh}><RefreshCw size={14} /> Reload</button>
          <button className="btn btn-gold btn-sm" disabled={busy} type="submit"><Save size={14} /> {busy ? 'Saving…' : 'Save settings'}</button></div>
      </div>
      {feedback && <Notice tone={feedback.tone}>{feedback.text}</Notice>}

      <div className="admin-card flex between center gap-24 wrap">
        <div><p className="eyebrow no-line mb-8">Live brand preview</p><Brand variant="horizontal" href={null} />
          <p className="tiny muted mt-16">The royal golden emblem is used consistently across the website, studio and favicon.</p></div>
        <div className="grid grid-2 gap-16" style={{ minWidth: 240 }}>
          <div className="text-center"><p className="tiny muted mb-8">Emblem</p><div style={{ width: 48, height: 56, margin: '0 auto' }}><Brand variant="emblem" href={null} /></div></div>
          <div className="text-center"><p className="tiny muted mb-8">Monochrome</p><div style={{ width: 48, height: 56, margin: '0 auto' }}><Brand variant="mono" href={null} /></div></div>
        </div>
      </div>

      <div className="tabs">
        {([['branding', 'Branding', Palette], ['content', 'Hero & content', ImageIcon], ['contact', 'Contact & social', Contact], ['seo', 'SEO & footer', Globe]] as const).map(([id, label, Icon]) =>
          <button type="button" key={id} className={`tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}><Icon size={14} style={{ verticalAlign: 'middle', marginRight: 8 }} />{label}</button>)}
      </div>

      {tab === 'branding' && <div className="admin-card">
        <div className="admin-card-head"><h3 className="h3">Brand identity</h3><span className="badge badge-gold">Public</span></div>
        <div className="form-grid">
          <div className="field"><label className="label" htmlFor="s-name">Business name *</label><input id="s-name" className="input" value={form.business_name ?? ''} onChange={e => set('business_name', e.target.value)} /></div>
          <div className="field"><label className="label" htmlFor="s-tagline">Tagline</label><input id="s-tagline" className="input" value={form.tagline ?? ''} onChange={e => set('tagline', e.target.value)} /></div>
          {renderUploadField('logo_url', 'Logo asset', 'Overrides the SVG emblem in supported surfaces. JPG, PNG, WebP or SVG, max 5 MB.')}
          {renderUploadField('favicon_url', 'Favicon asset', 'Square asset recommended. The built-in royal emblem favicon remains the default.')}
          <div className="field span-2"><label className="label" htmlFor="s-accent">Approved accent colour</label>
            <div className="flex gap-12 wrap center"><input id="s-accent" type="color" value={form.theme?.accent ?? '#C6A45A'} onChange={e => set('theme', { ...form.theme, accent: e.target.value })} style={{ width: 64, height: 44, background: 'none', border: '1px solid var(--line)', borderRadius: 4 }} />
              <select className="select" style={{ flex: 1, minWidth: 200 }} value={form.theme?.accent ?? '#C6A45A'} onChange={e => set('theme', { ...form.theme, accent: e.target.value })}>
                <option value="#C6A45A">Champagne Gold · #C6A45A (brand standard)</option>
                <option value="#D4B36A">Metallic Gold · #D4B36A</option>
                <option value="#E5D1A0">Light Gold · #E5D1A0</option>
                <option value="#927442">Antique Gold · #927442</option>
              </select></div>
            <span className="hint">Approved design options only — the imperial midnight palette is preserved.</span></div>
        </div>
      </div>}

      {tab === 'content' && <div className="admin-card">
        <div className="admin-card-head"><h3 className="h3">Homepage hero</h3></div>
        <div className="form-grid">
          <div className="field span-2"><label className="label" htmlFor="s-hero-h">Hero heading</label><textarea id="s-hero-h" className="textarea" style={{ minHeight: 80 }} value={form.hero_heading ?? ''} onChange={e => set('hero_heading', e.target.value)} />
            <span className="hint">The phrase “Meets” splits the heading into two styled lines.</span></div>
          <div className="field span-2"><label className="label" htmlFor="s-hero-s">Supporting text</label><textarea id="s-hero-s" className="textarea" value={form.hero_subheading ?? ''} onChange={e => set('hero_subheading', e.target.value)} /></div>
          {renderUploadField('hero_image', 'Hero image', 'Wide 16:9 architectural photograph recommended. Leave blank to use the built-in imperial estate image.')}
        </div>
        <div className="mt-24"><a href="/" target="_blank" rel="noopener noreferrer" className="link-gold"><Eye size={14} /> Preview the homepage</a></div>
      </div>}

      {tab === 'contact' && <div className="admin-card">
        <div className="admin-card-head"><h3 className="h3">Contact details &amp; social links</h3><Share2 size={16} className="gold" /></div>
        <div className="form-grid">
          <div className="field"><label className="label" htmlFor="s-email">Public email</label><input id="s-email" type="email" className="input" value={form.contact_email ?? ''} onChange={e => set('contact_email', e.target.value)} /></div>
          <div className="field"><label className="label" htmlFor="s-phone">Telephone</label><input id="s-phone" className="input" value={form.contact_phone ?? ''} onChange={e => set('contact_phone', e.target.value)} /></div>
          <div className="field"><label className="label" htmlFor="s-wa">WhatsApp number</label><input id="s-wa" className="input" value={form.whatsapp ?? ''} onChange={e => set('whatsapp', e.target.value)} placeholder="+91 98764 00000" /><span className="hint">Used for WhatsApp enquiry buttons across the website.</span></div>
          <div className="field"><label className="label" htmlFor="s-addr">Office address</label><input id="s-addr" className="input" value={form.address ?? ''} onChange={e => set('address', e.target.value)} /></div>
          {['instagram', 'linkedin', 'facebook', 'youtube'].map(k => <div className="field" key={k}><label className="label" htmlFor={`s-${k}`}>{k.charAt(0).toUpperCase() + k.slice(1)} URL</label>
            <input id={`s-${k}`} className="input" value={social[k] ?? ''} onChange={e => setSocial({ ...social, [k]: e.target.value })} placeholder="https://" /></div>)}
        </div>
      </div>}

      {tab === 'seo' && <div className="admin-card">
        <div className="admin-card-head"><h3 className="h3">Search metadata &amp; footer</h3></div>
        <div className="form-grid">
          <div className="field span-2"><label className="label" htmlFor="s-seo-t">Default SEO title</label><input id="s-seo-t" className="input" value={form.seo_title ?? ''} onChange={e => set('seo_title', e.target.value)} /></div>
          <div className="field span-2"><label className="label" htmlFor="s-seo-d">Default meta description</label><textarea id="s-seo-d" className="textarea" value={form.seo_description ?? ''} onChange={e => set('seo_description', e.target.value)} /></div>
          <div className="field span-2"><label className="label" htmlFor="s-foot">Footer introduction</label><textarea id="s-foot" className="textarea" value={form.footer_text ?? ''} onChange={e => set('footer_text', e.target.value)} /></div>
          <div className="field span-2"><label className="label" htmlFor="s-footnote">Footer note</label><input id="s-footnote" className="input" value={form.footer_note ?? ''} onChange={e => set('footer_note', e.target.value)} /></div>
        </div>
        <Notice tone="info" className="mt-24">Property-specific metadata, canonical URLs, sitemap.xml, robots.txt and structured data are generated automatically per residence. All /admin routes are excluded from search indexing.</Notice>
      </div>}

      <div className="flex between gap-12 wrap">
        <p className="tiny muted">Only a verified owner can modify these settings — enforced by Row Level Security.</p>
        <button className="btn btn-gold" disabled={busy} type="submit"><Save size={15} /> {busy ? 'Saving…' : 'Save settings'}</button>
      </div>
    </form>
  );
}
