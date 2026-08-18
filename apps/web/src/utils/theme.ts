// Design tokens for On The Go by Am — web.
// Source of truth for COLORS/GRADIENT is `apps/mobile/src/utils/theme.ts`; keep
// the two in sync. FONTS differs by platform on purpose: mobile uses Expo
// font-family identifiers (e.g. `PlayfairDisplay_600SemiBold`), web uses CSS
// font-family strings loaded via FONT_LINK below.
// Full reference: DESIGN.md at the project root.

export const COLORS = {
  ink: '#14213D',
  cloud: '#F7F5F1',
  teal: '#2C5F5A',
  navy: '#07325f',
  gold: '#C9A227',
  terracotta: '#C4622A',
  white: '#FFFFFF',
  gray: '#6B6B6B',
  // Derived/opacity variants — web-only convenience tints, not yet mirrored
  // on mobile's theme.ts (RN styling doesn't need the same border/tint set).
  // Numeric suffix = opacity percentage; unsuffixed = the most-used tint for
  // that color (kept unsuffixed for backward compatibility with earlier use).
  goldDark: '#8a6c1a',
  goldTint: 'rgba(201,162,39,0.06)',
  goldTint12: 'rgba(201,162,39,0.12)',
  tealTint05: 'rgba(44,95,90,0.05)',
  tealTint07: 'rgba(44,95,90,0.07)',
  tealTint08: 'rgba(44,95,90,0.08)',
  tealTint: 'rgba(44,95,90,0.1)',
  tealTint20: 'rgba(44,95,90,0.2)',
  tealTint25: 'rgba(44,95,90,0.25)',
  tealTint30: 'rgba(44,95,90,0.3)',
  navyTint: 'rgba(7,50,95,0.1)',
  terracottaTint05: 'rgba(196,98,42,0.05)',
  terracottaTint: 'rgba(196,98,42,0.1)',
  terracottaTint30: 'rgba(196,98,42,0.3)',
  whiteTint08: 'rgba(255,255,255,0.08)',
  whiteTint10: 'rgba(255,255,255,0.1)',
  whiteTint12: 'rgba(255,255,255,0.12)',
  whiteTint15: 'rgba(255,255,255,0.15)',
  whiteTint18: 'rgba(255,255,255,0.18)',
  whiteTint70: 'rgba(255,255,255,0.7)',
  shadowLight: 'rgba(0,0,0,0.15)',
  shadowMedium: 'rgba(0,0,0,0.25)',
  // Not part of the brand palette — a status/success color (green), used for
  // positive-state indicators. Named here since it repeats, not because it's
  // brand-derived.
  successTint: 'rgba(74,222,128,0.15)',
  border: 'rgba(20,33,61,0.12)',
  borderFaint: 'rgba(20,33,61,0.05)',
  borderFaint06: 'rgba(20,33,61,0.06)',
  borderLight: 'rgba(20,33,61,0.1)',
  borderMedium: 'rgba(20,33,61,0.15)',
  borderDashed: 'rgba(20,33,61,0.2)',
};

// Matches mobile's `GRADIENT` (apps/mobile/src/utils/theme.ts) — same teal→navy
// diagonal. Web expresses it as CSS directly rather than RN's start/end pairs.
export const GRADIENT = {
  // Card headers, primary brand surfaces — explicit color stops.
  header: `linear-gradient(135deg, ${COLORS.teal} 0%, ${COLORS.navy} 60%)`,
  // Trip detail page hero — same diagonal, later color stop.
  headerAlt: `linear-gradient(135deg, ${COLORS.teal} 0%, ${COLORS.navy} 80%)`,
  // Buttons, message bubbles — simple two-stop diagonal, no explicit position.
  solid: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.navy})`,
};

export const FONTS = {
  display: 'Playfair Display, serif',
  mono: 'DM Mono, monospace',
  body: 'DM Sans, sans-serif',
};

export const FONT_LINK =
  'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,600;0,700;1,500&family=DM+Sans:wght@400;500;700&family=DM+Mono:wght@400;500&display=swap';

export const THEMES = [
  { id: 'coastal-reset', label: 'Coastal Reset', icon: '〜' },
  { id: 'culinary-crawl', label: 'Culinary Crawl', icon: '✦' },
  { id: 'wellness-retreat', label: 'Wellness Retreat', icon: '◎' },
  { id: 'city-immersion', label: 'City Immersion', icon: '▣' },
  { id: 'adventure-edge', label: 'Adventure Edge', icon: '▲' },
  { id: 'slow-village', label: 'Slow Village', icon: '◈' },
] as const;
