#!/usr/bin/env python3
"""Generate the IMPERIAL ROYAL brand kit from the traced knight-helmet crest.

`prepare-crest.mjs` turns the client's original drawing into
`public/brand/royal-crest.svg` — a true vector mark dressed in champagne gold
over crimson lacquer, plus every raster size. This script reuses that same
vector (never a bitmap) inside every lockup, so:

  * the horizontal / footer / light wordmarks stay sharp at any size;
  * the favicons ship a 96 px palette PNG (a vector favicon would cost more
    bytes on every tab request than it saves);
  * the React Emblem and the static lockups can never drift apart.

Run: python3 scripts/generate-brand.py
"""
from __future__ import annotations
import base64
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BRAND = ROOT / "public" / "brand"

subprocess.run(["node", str(ROOT / "scripts" / "prepare-crest.mjs")], check=True, cwd=ROOT)

MASTER = (BRAND / "royal-crest.svg").read_text()
VIEWBOX = re.search(r'viewBox="([^"]+)"', MASTER).group(1)
# defs (path + gradients + clip) and the painted art, reused verbatim
DEFS = MASTER.split("<defs>")[1].split("</defs>")[0]
ART = MASTER.split("</defs>")[1].rsplit("</svg>", 1)[0]

# Single-colour engraving variant for one-colour print and embossing.
MONO_DEFS = """    <linearGradient id="mono" x1=".14" y1="0" x2=".86" y2="1">
      <stop offset="0" stop-color="#FFFFFF"/><stop offset=".55" stop-color="#C9C7C2"/><stop offset="1" stop-color="#8E8B85"/>
    </linearGradient>
    <linearGradient id="monoDeep" x1=".2" y1="0" x2=".8" y2="1">
      <stop offset="0" stop-color="#9C9992"/><stop offset="1" stop-color="#5B5954"/>
    </linearGradient>
"""

FAVICON_PNG = base64.b64encode((BRAND / "royal-crest-96.png").read_bytes()).decode("ascii")
FAVICON_HREF = "data:image/png;base64," + FAVICON_PNG


def crest(width: int, height: int, x: int = 0, y: int = 0, mono: bool = False) -> str:
    """Nest the vector mark inside another SVG, in the mark's own coordinate space."""
    defs, art = (MONO_DEFS + DEFS, ART) if mono else (DEFS, ART)
    if mono:
        art = art.replace("url(#gold)", "url(#mono)").replace("url(#lacquer)", "url(#monoDeep)")
    return (f'<svg x="{x}" y="{y}" width="{width}" height="{height}" viewBox="{VIEWBOX}">'
            f"<defs>{defs}</defs>{art}</svg>")


def emblem_svg(tone: str) -> str:
    mono = tone == "mono"
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 384" role="img" aria-label="Imperial Royal knight-helmet crest">
  <title>Imperial Royal — sovereign knight crest, {tone} edition</title>
  {crest(384, 384, mono=mono)}
</svg>
'''


def favicon_svg() -> str:
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 384" role="img" aria-label="Imperial Royal knight-helmet crest">
  <title>Imperial Royal — sovereign knight crest, favicon</title>
  <image x="0" y="0" width="384" height="384" href="{FAVICON_HREF}"/>
</svg>
'''


def lockup_svg(tone: str) -> str:
    dark = tone != "light"
    word = "#F4F0E7" if dark else "#17140D"
    sub = "#C6A45A" if dark else "#7A5C2C"
    rule = "rgba(198,164,90,.42)" if dark else "rgba(110,82,39,.38)"
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 660 150" role="img" aria-label="Imperial Royal — private real estate office">
  <title>Imperial Royal — Private Real Estate Office, Est. MMXXIV</title>
  {crest(144, 144, x=4, y=3)}
  <line x1="166" y1="24" x2="166" y2="126" stroke="{rule}" stroke-width="1"/>
  <text x="190" y="65" font-family="Cormorant Garamond, Georgia, serif" font-size="43" font-weight="500"
        letter-spacing="9" fill="{word}">IMPERIAL</text>
  <text x="190" y="107" font-family="Cormorant Garamond, Georgia, serif" font-size="43" font-style="italic"
        letter-spacing="9" fill="#C6A45A">ROYAL</text>
  <text x="192" y="131" font-family="Inter, Arial, sans-serif" font-size="8.5" font-weight="600"
        letter-spacing="3.6" fill="{sub}">PRIVATE REAL ESTATE OFFICE · EST. MMXXIV</text>
</svg>
'''


TARGETS = {
    "public/brand/emblem-gold.svg": emblem_svg("gold"),
    "public/brand/emblem-light.svg": emblem_svg("light"),
    "public/brand/emblem-mono.svg": emblem_svg("mono"),
    "public/brand/favicon.svg": favicon_svg(),
    "public/favicon.svg": favicon_svg(),
    "app/icon.svg": favicon_svg(),
    "public/brand/logo-horizontal.svg": lockup_svg("gold"),
    "public/brand/logo-light.svg": lockup_svg("light"),
    "public/brand/logo-footer.svg": lockup_svg("gold"),
}

EMBLEM_TSX = '''/* ==================================================================
   IMPERIAL ROYAL — sovereign knight-helmet crest
   The client's own helmet drawing, traced to vector and dressed in
   champagne gold over crimson lacquer by scripts/prepare-crest.mjs.
   Master artwork: public/brand/royal-crest-source.png (never redrawn)
   Vector master:  public/brand/royal-crest.svg
   Served set:     transparent WebP 96/192/384 + palette-PNG fallback
================================================================== */
export type EmblemTone = 'gold' | 'mono' | 'light';

/** CSS filters keep one artwork consistent across dark, mono and light uses. */
const FILTERS: Record<EmblemTone, string> = {
  gold: 'none',
  mono: 'grayscale(1) contrast(1.06) brightness(1.08)',
  light: 'brightness(1.03) contrast(1.02)',
};

/** 1x/2x/3x sources for the emblem's real display sizes (36–88 px). */
const SRCSET = '/brand/royal-crest-96.webp 1x, /brand/royal-crest-192.webp 2x, /brand/royal-crest-384.webp 3x';

export function Emblem({ tone = 'gold', className, title = 'Imperial Royal sovereign knight crest', style }: {
  tone?: EmblemTone; className?: string; title?: string; style?: React.CSSProperties;
}) {
  return (
    <picture>
      <source type="image/webp" srcSet={SRCSET} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/royal-crest.png"
        alt={title}
        draggable={false}
        width={1024}
        height={1024}
        decoding="async"
        className={className}
        style={{
          width: '100%', height: '100%', objectFit: 'contain', display: 'block',
          filter: FILTERS[tone], ...style,
        }}
      />
    </picture>
  );
}

export default Emblem;
'''

for rel, content in TARGETS.items():
    (ROOT / rel).write_text(content)
(ROOT / "components" / "brand" / "Emblem.tsx").write_text(EMBLEM_TSX)

print(f"Vector lockups: {len(TARGETS)} (crest reused from royal-crest.svg, {len(MASTER) // 1024} KB master)")
print("React emblem: components/brand/Emblem.tsx (96/192/384 srcSet + PNG fallback)")
print("Raster icons: favicon-16/32/64, apple-touch-icon, brand-mark-192, brand-mark-512")
print("Print: royal-crest.svg (lossless at any size) + royal-crest-4096.png")
