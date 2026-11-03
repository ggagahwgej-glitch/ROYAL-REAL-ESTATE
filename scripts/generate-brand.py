#!/usr/bin/env python3
"""Generate the IMPERIAL ROYAL refined monogram brand kit.

Produces the React Emblem component plus every static SVG lockup from one
definition, so the favicon, header, footer and brand wall can never drift.

Run: python3 scripts/generate-brand.py
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

PALETTES = {
    "gold": dict(a="#F2E3BE", b="#D4B36A", c="#A9823F", d="#E5D1A0", e="#F7EBCF",
                 ink="#0A0C12", line="#D9BC78", soft="#8A6A34", word="#F4F0E7", sub="#A9ADB7"),
    "light": dict(a="#8A6A34", b="#6E5227", c="#5B4320", d="#7A5C2C", e="#4A3518",
                  ink="#FBF7EC", line="#8A6A34", soft="#B79A63", word="#17140D", sub="#6B6252"),
    "mono": dict(a="#C6A45A", b="#C6A45A", c="#B08F4B", d="#C6A45A", e="#C6A45A",
                 ink="#0D0E11", line="#C6A45A", soft="#8C7240", word="#F4F0E7", sub="#A9ADB7"),
}


def mark(p, uid="ir"):
    """Return the inner SVG of the 240x280 refined monogram."""
    return f"""
<defs>
  <linearGradient id="{uid}-foil" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="{p['a']}"/><stop offset=".28" stop-color="{p['b']}"/>
    <stop offset=".56" stop-color="{p['c']}"/><stop offset=".80" stop-color="{p['d']}"/>
    <stop offset="1" stop-color="{p['e']}"/>
  </linearGradient>
  <linearGradient id="{uid}-shield" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="{p['b']}" stop-opacity=".16"/>
    <stop offset="1" stop-color="{p['c']}" stop-opacity=".04"/>
  </linearGradient>
  <radialGradient id="{uid}-glow" cx=".5" cy=".42" r=".6">
    <stop offset="0" stop-color="{p['b']}" stop-opacity=".20"/>
    <stop offset="1" stop-color="{p['b']}" stop-opacity="0"/>
  </radialGradient>
</defs>

<!-- refined shield, double hairline -->
<path d="M120 44 L206 84 V158 C206 212 170 250 120 270 C70 250 34 212 34 158 V84 Z"
      fill="url(#{uid}-shield)" stroke="url(#{uid}-foil)" stroke-width="2.2" stroke-linejoin="round"/>
<path d="M120 53 L197 89 V157 C197 206 164 241 120 260 C76 241 43 206 43 157 V89 Z"
      fill="none" stroke="{p['line']}" stroke-width=".8" opacity=".55"/>
<circle cx="120" cy="148" r="86" fill="url(#{uid}-glow)"/>

<!-- imperial crown -->
<path d="M72 62 L78 26 L100 48 L120 20 L140 48 L162 26 L168 62 Z"
      fill="url(#{uid}-foil)" stroke="{p['a']}" stroke-width="1.1" stroke-linejoin="round"/>
<path d="M72 62 H168" stroke="{p['a']}" stroke-width="1.4"/>
<rect x="70" y="63" width="100" height="9" rx="1.5" fill="url(#{uid}-foil)" stroke="{p['a']}" stroke-width=".8"/>
<circle cx="120" cy="35" r="3.2" fill="{p['ink']}" opacity=".75"/>
<circle cx="82" cy="42" r="2.2" fill="{p['ink']}" opacity=".6"/>
<circle cx="158" cy="42" r="2.2" fill="{p['ink']}" opacity=".6"/>
<path d="M120 20 V44 M78 26 L100 48 M162 26 L140 48" stroke="{p['ink']}" stroke-width=".7" opacity=".32"/>

<!-- hairline rules framing the monogram -->
<path d="M74 96 H166" stroke="{p['line']}" stroke-width=".8" opacity=".7"/>
<path d="M74 208 H166" stroke="{p['line']}" stroke-width=".8" opacity=".7"/>
<circle cx="120" cy="96" r="2" fill="{p['b']}"/>
<circle cx="120" cy="208" r="2" fill="{p['b']}"/>

<!-- IR monogram: font-independent serif, gold foil -->
<text x="120" y="186" text-anchor="middle" fill="url(#{uid}-foil)"
      font-family="Georgia,'Times New Roman',serif" font-size="104" font-weight="400"
      letter-spacing="-6" style="paint-order:stroke" stroke="{p['c']}" stroke-width=".45">IR</text>
<text x="120" y="186" text-anchor="middle" fill="none" stroke="{p['a']}" stroke-width=".35" stroke-opacity=".65"
      font-family="Georgia,'Times New Roman',serif" font-size="104" font-weight="400" letter-spacing="-6">IR</text>

<!-- founding mark -->
<text x="120" y="230" text-anchor="middle" fill="{p['line']}"
      font-family="Georgia,'Times New Roman',serif" font-size="10.5" letter-spacing="3.4">EST · MMXXIV</text>
<path d="M120 240 l5 6 -5 6 -5 -6 Z" fill="url(#{uid}-foil)"/>
"""


def emblem_svg(tone="gold", w=240, h=280):
    p = PALETTES[tone]
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 280" width="{w}" height="{h}" '
            f'role="img" aria-label="Imperial Royal monogram">'
            + mark(p, f"ir-{tone}") + "</svg>")


def wordmark_svg(tone="gold", footer=False):
    p = PALETTES[tone]
    ew, eh = (132, 154) if footer else (112, 131)
    W, H = (660, 190) if footer else (620, 150)
    ey = (H - eh) // 2
    inner = (f'<svg xmlns="http://www.w3.org/2000/svg" x="10" y="{ey}" width="{ew}" height="{eh}" '
             f'viewBox="0 0 240 280">' + mark(p, f"wm-{tone}") + "</svg>")
    bx = 10 + ew + 26
    size = 47 if footer else 43
    sub = 11 if footer else 10
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" aria-label="Imperial Royal Real Estate">
<defs><linearGradient id="wmfoil-{tone}" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="{p['a']}"/><stop offset=".5" stop-color="{p['b']}"/><stop offset="1" stop-color="{p['d']}"/>
</linearGradient></defs>
{inner}
<path d="M{bx-14} {H*0.24} V{H*0.76}" stroke="{p['line']}" stroke-width="1" opacity=".55"/>
<text x="{bx}" y="{H*0.47}" fill="{p['word']}" font-family="Georgia,'Times New Roman',serif" font-size="{size}" letter-spacing="7">IMPERIAL</text>
<text x="{bx+2}" y="{H*0.70}" fill="url(#wmfoil-{tone})" font-family="Georgia,'Times New Roman',serif" font-style="italic" font-size="{size}" letter-spacing="9">ROYAL</text>
<text x="{bx+2}" y="{H*0.86}" fill="{p['sub']}" font-family="Georgia,'Times New Roman',serif" font-size="{sub}" letter-spacing="5.2">REAL ESTATE · PRIVATE RESIDENCES</text>
</svg>'''


def write(path, content):
    (ROOT / path).write_text(content)
    print("  ", path)


def main():
    print("Generating refined IMPERIAL ROYAL brand kit")
    for tone, name in [("gold", "emblem-gold"), ("light", "emblem-light"), ("mono", "emblem-mono")]:
        write(f"public/brand/{name}.svg", emblem_svg(tone))
    write("public/brand/logo-horizontal.svg", wordmark_svg("gold"))
    write("public/brand/logo-light.svg", wordmark_svg("light"))
    write("public/brand/logo-footer.svg", wordmark_svg("gold", footer=True))
    write("public/brand/favicon.svg", emblem_svg("gold", 64, 64))
    write("public/favicon.svg", emblem_svg("gold", 64, 64))
    write("app/icon.svg", emblem_svg("gold", 64, 64))

    # React component: identical geometry, dynamic gradient ids via useId.
    component = '''/* ==================================================================
   IMPERIAL ROYAL — refined monogram (generated by scripts/generate-brand.py)
   A fine double-hairline shield, imperial crown and gold-foil IR monogram.
   Pure vector, font-independent serif, crisp from favicon to brand wall.
================================================================== */
'use client';
import { useId } from 'react';

export type EmblemTone = 'gold' | 'mono' | 'light';

const PALETTES: Record<EmblemTone, { a: string; b: string; c: string; d: string; e: string; ink: string; line: string }> = {
  gold:  { a: '#F2E3BE', b: '#D4B36A', c: '#A9823F', d: '#E5D1A0', e: '#F7EBCF', ink: '#0A0C12', line: '#D9BC78' },
  mono:  { a: '#C6A45A', b: '#C6A45A', c: '#B08F4B', d: '#C6A45A', e: '#C6A45A', ink: '#0D0E11', line: '#C6A45A' },
  light: { a: '#8A6A34', b: '#6E5227', c: '#5B4320', d: '#7A5C2C', e: '#4A3518', ink: '#FBF7EC', line: '#8A6A34' },
};

export function Emblem({ tone = 'gold', className, title = 'Imperial Royal monogram', style }: {
  tone?: EmblemTone; className?: string; title?: string; style?: React.CSSProperties;
}) {
  const raw = useId();
  const id = raw.replace(/[^a-zA-Z0-9_-]/g, '');
  const p = PALETTES[tone];
  const foil = `foil-${id}`, shield = `shield-${id}`, glow = `glow-${id}`;
  return (
    <svg viewBox="0 0 240 280" className={className} style={style} role="img" aria-label={title} xmlns="http://www.w3.org/2000/svg">
      <title>{title}</title>
      <defs>
        <linearGradient id={foil} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={p.a} /><stop offset=".28" stopColor={p.b} />
          <stop offset=".56" stopColor={p.c} /><stop offset=".80" stopColor={p.d} />
          <stop offset="1" stopColor={p.e} />
        </linearGradient>
        <linearGradient id={shield} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.b} stopOpacity=".16" />
          <stop offset="1" stopColor={p.c} stopOpacity=".04" />
        </linearGradient>
        <radialGradient id={glow} cx=".5" cy=".42" r=".6">
          <stop offset="0" stopColor={p.b} stopOpacity=".20" />
          <stop offset="1" stopColor={p.b} stopOpacity="0" />
        </radialGradient>
      </defs>
      <path d="M120 44 L206 84 V158 C206 212 170 250 120 270 C70 250 34 212 34 158 V84 Z" fill={`url(#${shield})`} stroke={`url(#${foil})`} strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M120 53 L197 89 V157 C197 206 164 241 120 260 C76 241 43 206 43 157 V89 Z" fill="none" stroke={p.line} strokeWidth=".8" opacity=".55" />
      <circle cx="120" cy="148" r="86" fill={`url(#${glow})`} />
      <path d="M72 62 L78 26 L100 48 L120 20 L140 48 L162 26 L168 62 Z" fill={`url(#${foil})`} stroke={p.a} strokeWidth="1.1" strokeLinejoin="round" />
      <path d="M72 62 H168" stroke={p.a} strokeWidth="1.4" />
      <rect x="70" y="63" width="100" height="9" rx="1.5" fill={`url(#${foil})`} stroke={p.a} strokeWidth=".8" />
      <circle cx="120" cy="35" r="3.2" fill={p.ink} opacity=".75" />
      <circle cx="82" cy="42" r="2.2" fill={p.ink} opacity=".6" />
      <circle cx="158" cy="42" r="2.2" fill={p.ink} opacity=".6" />
      <path d="M120 20 V44 M78 26 L100 48 M162 26 L140 48" stroke={p.ink} strokeWidth=".7" opacity=".32" />
      <path d="M74 96 H166 M74 208 H166" stroke={p.line} strokeWidth=".8" opacity=".7" />
      <circle cx="120" cy="96" r="2" fill={p.b} /><circle cx="120" cy="208" r="2" fill={p.b} />
      <text x="120" y="186" textAnchor="middle" fill={`url(#${foil})`} fontFamily="Georgia,'Times New Roman',serif" fontSize="104" fontWeight="400" letterSpacing="-6" stroke={p.c} strokeWidth=".45" style={{ paintOrder: 'stroke' }}>IR</text>
      <text x="120" y="186" textAnchor="middle" fill="none" stroke={p.a} strokeWidth=".35" strokeOpacity=".65" fontFamily="Georgia,'Times New Roman',serif" fontSize="104" fontWeight="400" letterSpacing="-6">IR</text>
      <text x="120" y="230" textAnchor="middle" fill={p.line} fontFamily="Georgia,'Times New Roman',serif" fontSize="10.5" letterSpacing="3.4">EST · MMXXIV</text>
      <path d="M120 240 l5 6 -5 6 -5 -6 Z" fill={`url(#${foil})`} />
    </svg>
  );
}

export default Emblem;
'''
    write("components/brand/Emblem.tsx", component)


if __name__ == "__main__":
    main()
