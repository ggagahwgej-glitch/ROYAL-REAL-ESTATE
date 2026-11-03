'use client';
import { Star } from 'lucide-react';

/** Gold rating row. Renders nothing when no rating was published. */
export function Stars({ value, size = 14, showValue = false }: {
  value?: number | null; size?: number; showValue?: boolean;
}) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return null;
  const rating = Math.max(0, Math.min(5, Math.round(Number(value))));
  if (!rating) return null;
  return (
    <span className="stars" role="img" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} size={size} className={i < rating ? 'stars-on' : 'stars-off'}
          fill={i < rating ? 'currentColor' : 'none'} strokeWidth={1.4} />
      ))}
      {showValue && <span className="stars-value">{rating}.0</span>}
    </span>
  );
}
