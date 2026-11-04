/* ==================================================================
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
