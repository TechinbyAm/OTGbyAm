import { describe, it, expect } from 'vitest';
import { COLORS, GRADIENT, FONTS, THEMES } from './theme';

describe('theme tokens', () => {
  it('THEMES has exactly the 6 established themes, each with id/label/icon', () => {
    expect(THEMES).toHaveLength(6);
    const ids = THEMES.map((t) => t.id);
    expect(ids).toEqual([
      'coastal-reset',
      'culinary-crawl',
      'wellness-retreat',
      'city-immersion',
      'adventure-edge',
      'slow-village',
    ]);
    for (const t of THEMES) {
      expect(t.label.length).toBeGreaterThan(0);
      expect(t.icon.length).toBeGreaterThan(0);
    }
  });

  it('COLORS carries the real brand palette, not placeholder values', () => {
    expect(COLORS.ink).toBe('#14213D');
    expect(COLORS.cloud).toBe('#F7F5F1');
    expect(COLORS.teal).toBe('#2C5F5A');
    expect(COLORS.navy).toBe('#07325f');
    expect(COLORS.gold).toBe('#C9A227');
    expect(COLORS.terracotta).toBe('#C4622A');
  });

  it('GRADIENT.header is the teal-to-navy diagonal at the documented stops', () => {
    expect(GRADIENT.header).toBe(`linear-gradient(135deg, ${COLORS.teal} 0%, ${COLORS.navy} 60%)`);
  });

  it('FONTS uses real CSS font-family strings, not Expo font identifiers', () => {
    expect(FONTS.display).toBe('Playfair Display, serif');
    expect(FONTS.mono).toBe('DM Mono, monospace');
    expect(FONTS.body).toBe('DM Sans, sans-serif');
  });
});
