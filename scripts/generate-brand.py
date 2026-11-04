#!/usr/bin/env python3
"""Generate the IMPERIAL ROYAL brand kit from the client's 3D gold/crimson render.

`prepare-crest.mjs` keys the black studio background out of the client's artwork,
centres it on a square stage, traces the silhouette for the tab icons and exports
the whole raster set. This script embeds that same artwork — never a re-drawing —
into every SVG lockup, so:

  * the emblem, horizontal, footer and light lockups are self-contained and
    visually identical to the site;
  * the mono lockup uses the single-colour engraving raster;
  * the favicons ship a 96 px palette PNG (a heavier payload on every tab
    request buys nothing at 16 px);
  * the React Emblem and the static kit can never drift apart.

Run: python3 scripts/generate-brand.py
"""
from __future__ import annotations
import base64
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BRAND = ROOT / "public" / "brand"

subprocess.run(["node", str(ROOT / "scripts" / "prepare-crest.mjs")], check=True, cwd=ROOT)


def payload(name: str) -> str:
    return "data:image/png;base64," + base64.b64encode((BRAND / name).read_bytes()).decode("ascii")


CREST = payload("royal-crest-384.png")        # full colour, for the lockups and emblems
MONO = payload("royal-crest-mono-384.png")    # single-colour engraving edition
FAVICON = payload("royal-crest-96.png")       # tab-size payload


def emblem_svg(tone: str) -> str:
    href = MONO if tone == "mono" else CREST
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 384" role="img" aria-label="Imperial Royal knight-helmet crest">
  <title>Imperial Royal — sovereign knight crest, gold and crimson ({tone} edition)</title>
  <image x="0" y="0" width="384" height="384" href="{href}"/>
</svg>
'''


def favicon_svg() -> str:
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 384" role="img" aria-label="Imperial Royal knight-helmet crest">
  <title>Imperial Royal — sovereign knight crest, favicon</title>
  <image x="0" y="0" width="384" height="384" href="{FAVICON}"/>
</svg>
'''


def lockup_svg(tone: str) -> str:
    dark = tone != "light"
    word = "#F4F0E7" if dark else "#17140D"
    sub = "#C6A45A" if dark else "#7A5C2C"
    rule = "rgba(198,164,90,.42)" if dark else "rgba(110,82,39,.38)"
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 660 150" role="img" aria-label="Imperial Royal — private real estate office">
  <title>Imperial Royal — Private Real Estate Office, Est. MMXXIV</title>
  <image x="4" y="3" width="144" height="144" href="{CREST}"/>
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
   The client's own 3D gold-and-crimson render, keyed out of its black
   studio background by scripts/prepare-crest.mjs. Never redrawn.
   Master artwork: public/brand/royal-crest-source.png
   Served set:     transparent WebP 96/192/384 + palette-PNG fallback
================================================================== */
export type EmblemTone = 'gold' | 'mono' | 'light';

/** CSS filters keep one artwork consistent across dark, mono and light uses. */
const FILTERS: Record<EmblemTone, string> = {
  gold: 'none',
  mono: 'grayscale(1) contrast(1.05) brightness(1.06)',
  light: 'brightness(1.02)',
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
        width={512}
        height={512}
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

print(f"SVG lockups: {len(TARGETS)} (client render embedded at 384 px, mono uses the engraving raster)")
print("React emblem: components/brand/Emblem.tsx (96/192/384 srcSet + PNG fallback)")
print("Raster icons: favicon-16/32 (vector silhouette), favicon-64, apple-touch, brand-mark-192/512")
print("Print: royal-crest-2048.png · design: royal-crest.svg (embedded 1024)")
