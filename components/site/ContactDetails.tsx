'use client';
import { MapPin, Phone, Mail, MessageCircle } from 'lucide-react';
import { useSiteSettings } from '@/lib/hooks/useSiteData';
import { whatsappLink } from '@/lib/utils';

export function ContactDetails() {
  const { settings } = useSiteSettings();
  const wa = whatsappLink(settings.whatsapp);
  const items = [
    { Icon: MapPin, label: 'Private office', value: settings.address, href: null },
    { Icon: Phone, label: 'Telephone', value: settings.contact_phone, href: `tel:${(settings.contact_phone ?? '').replace(/[^+\d]/g, '')}` },
    { Icon: Mail, label: 'Correspondence', value: settings.contact_email, href: `mailto:${settings.contact_email}` },
    { Icon: MessageCircle, label: 'WhatsApp', value: settings.whatsapp, href: wa },
  ];
  return (
    <div className="grid grid-2 gap-16 mt-32">
      {items.map(({ Icon, label, value, href }) => (
        <div className="card" key={label} style={{ padding: 22 }}>
          <Icon size={19} className="gold mb-16" />
          <p className="tiny muted uppercase">{label}</p>
          {href && value ? <a href={href} className="small" style={{ color: 'var(--ivory)', display: 'block', marginTop: 6, wordBreak: 'break-word' }} target={href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer">{value}</a>
            : <p className="small" style={{ color: 'var(--ivory)', marginTop: 6 }}>{value || '—'}</p>}
        </div>
      ))}
    </div>
  );
}
