'use client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Search, MapPin, ChevronDown } from 'lucide-react';
import { PROPERTY_CATEGORIES } from '@/lib/utils';

export function SearchBar() {
  const router = useRouter();
  const [type, setType] = useState<'all' | 'buy' | 'rent'>('all');
  const [q, setQ] = useState('');
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState('');
  const [beds, setBeds] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const p = new URLSearchParams();
    if (type !== 'all') p.set('type', type);
    if (q.trim()) p.set('q', q.trim());
    if (location.trim()) p.set('location', location.trim());
    if (category) p.set('category', category);
    if (beds) p.set('bedrooms', beds);
    router.push(`/properties${p.toString() ? `?${p}` : ''}`);
  };

  return (
    <div className="search-bar container">
      <div className="search-card">
        <div className="search-tabs" role="tablist" aria-label="Listing type">
          {(['all', 'buy', 'rent'] as const).map(t => (
            <button key={t} role="tab" aria-selected={type === t} className={`search-tab ${type === t ? 'active' : ''}`} onClick={() => setType(t)}>
              {t === 'all' ? 'All Residences' : t === 'buy' ? 'For Sale' : 'For Rent'}
            </button>
          ))}
        </div>
        <form className="search-grid" onSubmit={submit}>
          <div className="field">
            <label className="label" htmlFor="hero-q">Keyword</label>
            <div className="input-wrap"><Search size={15} style={{ position: 'absolute', left: 14, color: 'var(--gold)' }} />
              <input id="hero-q" className="input" style={{ paddingLeft: 38 }} placeholder="Residence, estate, address…" value={q} onChange={e => setQ(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label className="label" htmlFor="hero-loc">Location</label>
            <div className="input-wrap"><MapPin size={15} style={{ position: 'absolute', left: 14, color: 'var(--gold)' }} />
              <input id="hero-loc" className="input" style={{ paddingLeft: 38 }} placeholder="City or region" value={location} onChange={e => setLocation(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label className="label" htmlFor="hero-cat">Collection</label>
            <div className="input-wrap">
              <select id="hero-cat" className="select" value={category} onChange={e => setCategory(e.target.value)}>
                <option value="">All collections</option>
                {PROPERTY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="field">
            <label className="label" htmlFor="hero-beds">Bedrooms</label>
            <div className="input-wrap">
              <select id="hero-beds" className="select" value={beds} onChange={e => setBeds(e.target.value)}>
                <option value="">Any</option>{[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}+ bedrooms</option>)}
              </select>
              <ChevronDown size={14} style={{ display: 'none' }} />
            </div>
          </div>
          <button type="submit" className="btn btn-gold" style={{ minWidth: 150 }}><Search size={16} /> Search</button>
        </form>
      </div>
    </div>
  );
}
