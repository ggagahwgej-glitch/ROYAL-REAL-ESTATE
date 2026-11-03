import { describe, expect, it } from 'vitest';
import { formatBytes, formatPrice, safeUrl, shortHash, slugify, whatsappLink } from '../lib/utils';

describe('formatting helpers', () => {
  it('slugifies titles into safe URL segments', () => {
    expect(slugify('The Aurelian Estate, Guwahati!')).toBe('the-aurelian-estate-guwahati');
    expect(slugify('  ')).toBe('property');
  });
  it('formats prices and byte sizes', () => {
    expect(formatPrice(50_000_000, 'INR')).toContain('5,00,00,000');
    expect(formatPrice(50_000_000, 'USD')).toContain('50,000,000');
    expect(formatPrice(null)).toBe('Price on request');
    expect(formatBytes(2 * 1024 * 1024)).toBe('2.0 MB');
    expect(formatBytes(null)).toBe('—');
  });
  it('builds safe WhatsApp links and rejects unsafe URLs', () => {
    expect(whatsappLink('+91 98764 00000', 'Hello')).toContain('wa.me/919876400000');
    expect(whatsappLink('abc')).toBeNull();
    expect(safeUrl('javascript:alert(1)')).toBeNull();
    expect(safeUrl('https://example.com')).toBe('https://example.com/');
  });
  it('produces a stable short hash', () => {
    expect(shortHash('abc')).toBe(shortHash('abc'));
    expect(shortHash('abc')).not.toBe(shortHash('def'));
  });
});
