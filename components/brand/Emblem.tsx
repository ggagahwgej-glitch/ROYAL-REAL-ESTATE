'use client';
import { useId } from 'react';

/* ==================================================================
   ORIGINAL ROYAL GOLDEN EMBLEM
   Hand-drawn heraldic geometry: imperial crown, symmetric shield,
   stylised lion head with engraved mane facets. No generic house or
   building icon, no third-party logo. Pure vector — scales cleanly
   from a 16px favicon to a large brand wall.
================================================================== */
export type EmblemTone = 'gold' | 'mono' | 'light';

const PALETTES: Record<EmblemTone, {
  stops: [string, string, string, string, string];
  deep: [string, string];
  face: [string, string, string];
  shield: string; ink: string; line: string; shade: string;
}> = {
  gold: {
    stops: ['#E5D1A0', '#C6A45A', '#927442', '#D4B36A', '#E5D1A0'],
    deep: ['#C6A45A', '#6C5227'], face: ['#F0DDAE', '#C6A45A', '#8A6A36'],
    shield: '#101827', ink: '#090B10', line: '#E5D1A0', shade: '#6C5227',
  },
  mono: {
    stops: ['#C6A45A', '#C6A45A', '#C6A45A', '#C6A45A', '#C6A45A'],
    deep: ['#B08F4B', '#8C7240'], face: ['#C6A45A', '#C6A45A', '#B08F4B'],
    shield: '#0D0E11', ink: '#1A1408', line: '#D4B36A', shade: '#8C7240',
  },
  light: {
    stops: ['#8A6A34', '#6E5227', '#5B4320', '#7A5C2C', '#8A6A34'],
    deep: ['#7A5C2C', '#3F2E14'], face: ['#9C7A3C', '#6E5227', '#4A3518'],
    shield: '#F7F3E9', ink: '#241B0C', line: '#6E5227', shade: '#3F2E14',
  },
};

const MANE = 'M 120.0 70.0 L 133.9 93.7 L 157.2 79.2 L 158.5 106.6 L 185.8 104.6 L 174.2 129.4 L 199.4 140.4 L 177.6 157.0 L 194.8 178.4 L 167.7 182.9 L 173.0 209.9 L 147.0 201.4 L 139.1 227.7 L 120.0 208.0 L 100.9 227.7 L 93.0 201.4 L 67.0 209.9 L 72.3 182.9 L 45.2 178.4 L 62.4 157.0 L 40.6 140.4 L 65.8 129.4 L 54.2 104.6 L 81.5 106.6 L 82.8 79.2 L 106.1 93.7 Z';
const FACETS = 'M120 70 L120 96 M158.5 106.6 L148 128 M185.8 104.6 L158 122 M199.4 140.4 L166 142 M194.8 178.4 L164 166 M173 209.9 L150 186 M139.1 227.7 L136 196 M100.9 227.7 L104 196 M67 209.9 L90 186 M45.2 178.4 L76 166 M40.6 140.4 L74 142 M54.2 104.6 L82 122 M81.5 106.6 L92 128 M82.8 79.2 L106 100';

export function Emblem({
  tone = 'gold', className, title = 'Imperial Royal crest', style,
}: { tone?: EmblemTone; className?: string; title?: string; style?: React.CSSProperties }) {
  const raw = useId();
  const uid = raw.replace(/[^a-zA-Z0-9_-]/g, '');
  const p = PALETTES[tone];
  const gold = `g-${uid}`, deep = `d-${uid}`, face = `f-${uid}`, clip = `c-${uid}`;
  return (
    <svg viewBox="0 0 240 280" className={className} style={style} role="img" aria-label={title} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={gold} x1="0" y1="0" x2="1" y2="1">
          {p.stops.map((c, i) => <stop key={i} offset={[0, .32, .62, .85, 1][i]} stopColor={c} />)}
        </linearGradient>
        <linearGradient id={deep} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.deep[0]} /><stop offset="1" stopColor={p.deep[1]} />
        </linearGradient>
        <linearGradient id={face} x1="0" y1="0" x2="1" y2="1">
          {p.face.map((c, i) => <stop key={i} offset={[0, .5, 1][i]} stopColor={c} />)}
        </linearGradient>
        <clipPath id={clip}><path d="M40 76 H200 V156 C200 202 166 232 120 250 C74 232 40 202 40 156 Z" /></clipPath>
      </defs>
      {/* Crown */}
      <path d="M52 50 L62 14 L92 38 L120 8 L148 38 L178 14 L188 50 Z" fill={`url(#${gold})`} stroke={p.line} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M52 50 L62 14 L92 38 M188 50 L178 14 L148 38 M120 8 L120 50" fill="none" stroke={p.shade} strokeWidth="1" opacity=".65" />
      <circle cx="120" cy="30" r="4" fill={p.ink} stroke={p.line} strokeWidth="1.5" />
      <circle cx="77" cy="34" r="2.6" fill={p.ink} stroke={p.line} strokeWidth="1" />
      <circle cx="163" cy="34" r="2.6" fill={p.ink} stroke={p.line} strokeWidth="1" />
      <rect x="48" y="50" width="144" height="13" rx="2" fill={`url(#${gold})`} stroke={p.line} strokeWidth="1" />
      <path d="M56 56.5 H184" stroke={p.shade} strokeWidth="1" opacity=".8" />
      {/* Shield */}
      <path d="M28 66 H212 V158 C212 210 172 244 120 264 C68 244 28 210 28 158 Z" fill={p.shield} stroke={`url(#${gold})`} strokeWidth="5" />
      <path d="M40 76 H200 V156 C200 202 166 232 120 250 C74 232 40 202 40 156 Z" fill="none" stroke={p.stops[1]} strokeWidth="1.2" opacity=".75" />
      <g clipPath={`url(#${clip})`}>
        <path d={MANE} fill={`url(#${deep})`} stroke={p.line} strokeWidth="1.2" />
        <path d={FACETS} stroke={p.line} strokeWidth=".9" opacity=".5" fill="none" />
        <path d="M78 122 L92 112 L98 138 Z M162 122 L148 112 L142 138 Z" fill={`url(#${gold})`} stroke={p.shade} strokeWidth="1" />
        <path d="M88 122 L120 106 L152 122 L160 146 L150 186 L120 214 L90 186 L80 146 Z" fill={`url(#${face})`} stroke={p.shade} strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M88 122 L120 106 L152 122 L146 138 L120 128 L94 138 Z" fill={p.stops[3]} stroke={p.shade} strokeWidth="1" />
        <path d="M120 128 L120 106" stroke={p.shade} strokeWidth="1" opacity=".6" />
        <path d="M92 146 L114 140 L116 150 L96 154 Z" fill={p.stops[2]} opacity=".9" />
        <path d="M148 146 L126 140 L124 150 L144 154 Z" fill={p.stops[2]} opacity=".9" />
        <path d="M94 158 Q104 150 114 158 Q104 165 94 158 Z" fill={p.ink} stroke={p.line} strokeWidth="1.2" />
        <path d="M146 158 Q136 150 126 158 Q136 165 146 158 Z" fill={p.ink} stroke={p.line} strokeWidth="1.2" />
        <circle cx="104" cy="157" r="2" fill={p.line} /><circle cx="136" cy="157" r="2" fill={p.line} />
        <path d="M120 166 L138 176 L132 194 L120 200 L108 194 L102 176 Z" fill={p.stops[0]} stroke={p.shade} strokeWidth="1" />
        <path d="M112 176 L128 176 L120 186 Z" fill={p.ink} />
        <path d="M120 186 L120 194 M120 194 Q112 202 106 196 M120 194 Q128 202 134 196" fill="none" stroke={p.shade} strokeWidth="1.6" strokeLinecap="round" />
        <path d="M96 170 L104 180 M144 170 L136 180" stroke={p.shade} strokeWidth="1" opacity=".7" />
      </g>
      <path d="M120 252 L120 262 M104 246 L120 256 L136 246" fill="none" stroke={p.stops[1]} strokeWidth="1.2" opacity=".7" />
      <circle cx="120" cy="255" r="2.4" fill={p.stops[0]} />
    </svg>
  );
}

export default Emblem;
