# DESIGN.md — On The Go by Am

The canonical reference for this app's visual language. Every new feature and every design review should calibrate against this file, not re-derive patterns from `page.tsx` by inspection. If a new pattern gets introduced, add it here in the same commit — a stale DESIGN.md is worse than none (see `TODOS.md`: "Missing DESIGN.md").

Source of truth for tokens in code: `apps/mobile/src/utils/theme.ts` (`COLORS`/`GRADIENT`/`FONTS`). Web currently duplicates these as inline hex in `apps/web/src/app/page.tsx` — extraction to `apps/web/src/utils/theme.ts` is planned (see the Discovery + Content Creation plan, task T1). Once that lands, both platforms should import from a `theme.ts`, not redeclare values.

## Color

| Name | Hex | Use |
|---|---|---|
| ink | `#14213D` | Primary text, icons on light backgrounds |
| cloud | `#F7F5F1` | Page/section background |
| teal | `#2C5F5A` | Gradient start, accent icons, active-state text |
| navy | `#07325f` | Gradient end, active tab background |
| gold | `#C9A227` | Stamp badges, eyebrow-label accents, dashed borders |
| terracotta | `#C4622A` | Secondary icon accents (dates, metadata) |
| border | `rgba(20,33,61,0.12)` | Card borders |
| border (dashed/empty) | `rgba(20,33,61,0.2)` | Empty-state dashed borders |

**Gradient:** `linear-gradient(135deg, #2C5F5A 0%, #07325f 60%)` — teal→navy diagonal. Used on card headers and primary surfaces. Mobile expresses the same gradient via `react-native-linear-gradient` start/end coordinates (`{x:0,y:0}` → `{x:1,y:1}`), since RN has no CSS angle syntax.

## Typography

| Role | Font | Notes |
|---|---|---|
| Display (headers, titles) | Playfair Display | Loaded weights: 500, 600, 700, italic 500. Web via Google Fonts CDN link; mobile via `@expo-google-fonts/playfair-display` (`PlayfairDisplay_600SemiBold`, `_700Bold`, `_500Medium_Italic`) |
| Body / UI | DM Sans | Weights 400, 500, 700 |
| Data / captions / eyebrow labels | DM Mono | Weights 400, 500. Always uppercase + wide tracking (`tracking-widest` / `tracking-[0.2em]`) when used as a label |

Eyebrow-label convention: `text-[9px]` to `text-[10px]`, DM Mono, uppercase, gold or white/60 depending on background. Example: the "Itinerary" label above a trip's day list, or a theme's label inside a `StampBadge`.

## Iconography

Themes use single-glyph icons, not imported icon-library assets — part of the brand's handwritten/stamp feel:

| Theme id | Label | Glyph |
|---|---|---|
| coastal-reset | Coastal Reset | 〜 |
| culinary-crawl | Culinary Crawl | ✦ |
| wellness-retreat | Wellness Retreat | ◎ |
| city-immersion | City Immersion | ▣ |
| adventure-edge | Adventure Edge | ▲ |
| slow-village | Slow Village | ◈ |

Source: `apps/web/src/app/page.tsx`'s `THEMES` array (mirrored in `apps/mobile/src/utils/trips.ts`). Functional icons (calendar, map pin, etc.) come from `lucide-react` on web at `size={13}`–`14`, colored terracotta or ink depending on role — never gold (gold is reserved for the stamp-badge/theme-glyph system).

## Core components

### StampBadge
A dashed-gold circle, `w-20 h-20` (or `w-14 h-14` "small" variant), containing the theme glyph and (full-size only) the theme's first word as an eyebrow label underneath. `border-2 border-dashed` in gold, `rgba(201,162,39,0.06)` fill. This is the app's signature motif — reused wherever a theme needs a visual anchor, not just on trip cards.

```
┌ ─ ─ ─ ─ ┐
│    ✦    │   ← glyph, text-xl
│ CULINARY│   ← DM Mono, 8px, uppercase, gold
└ ─ ─ ─ ─ ┘
  dashed gold border, 2px, rounded-full
```

### Card pattern (TripCard, and its derivatives)
`rounded-2xl`, white background, `border` in the light ink-tint above, `hover:shadow-lg`. Structure:
1. **Header band** — padded gradient block (teal→navy), containing a `StampBadge`, a DM Mono eyebrow label (theme name, white/60), a Playfair Display title (white, 600 weight), and a subtitle line with an icon.
2. **Body** — white, `p-5`, metadata rows (icon + text, terracotta icon accent), then content-specific detail (e.g. itinerary preview with numbered teal circle markers).

This pattern extends to non-trip content — e.g. Discovery's cards (see the Discovery + Content Creation design doc) reuse the exact same gradient-header-band + `StampBadge` structure, with the theme glyph standing in for a photo rather than introducing a new card shape. **Real scraped/synced photos (Pinterest, pasted links) are deliberately never rendered on cards** — decided during that plan's design review specifically to avoid visual chaos from inconsistent external imagery breaking the card system above.

### Empty states
`rounded-2xl border border-dashed p-10 text-center`, dashed border in the ink-tint above (`rgba(20,33,61,0.2)`), centered content, one warm, specific sentence — never generic ("No items found"). Example (real, from `page.tsx:1170`): *"Nothing planned yet. Start your first 2027 trip."* The sentence should name what's missing and suggest the next action in the same breath.

### Tab navigation
Pill-style nav, `rounded-full` buttons, active tab gets navy (`#07325f`) background with white text; inactive tabs are transparent with ink text. `gap-1`, `px-3 py-1.5`, `text-sm`.

### Buttons (primary action)
`rounded-full`, gradient fill (teal→navy), white text — the same gradient as card headers, reinforcing one consistent "this is an important action" visual language across the app.

### Checkbox / multi-select (new pattern, introduced for Discovery)
No checkbox existed anywhere in the app before the Discovery feature. Established convention: unchecked state is a dashed-gold circle (derived from `StampBadge`'s motif, not a generic browser checkbox); checked state fills with the teal→navy gradient. Implementation: a real `<input type="checkbox">`, visually hidden, with the styled circle as its `<label>` — native keyboard focus and screen-reader semantics for free, custom visuals layered on top. Minimum 44×44px tappable hit area regardless of the visible circle's smaller size (proportion to the card).

### Toasts / error feedback
`sonner` (`toast.success(...)` / `toast.error(...)`), already used 5+ places in `apps/web/src/app/page.tsx` and `providers.tsx`. Mobile has `sonner-native` installed but not yet used by any feature. New error states should reuse this, not invent a new pattern. **Known bug, not a pattern to copy:** some existing toast copy says "check the logs panel for details" — no logs panel exists anywhere in the app (see `TODOS.md`).

## Layout conventions

- Grid breakpoints (Explore/Plan tab card grids, and the pattern new grids should match): `sm:grid-cols-2 lg:grid-cols-3`.
- Filter/tag chips that don't fit one row on mobile: horizontal scroll, single row — not wrap. Matches how affiliate-link pills already behave.
- Dates display as `DD-MM-YYYY` in the UI; storage stays ISO (`YYYY-MM-DD`) internally. Conversion via `isoToDisplayDate`/`displayToIsoDate` (mirrored on both platforms).

## Platform notes

- Web loads fonts via a Google Fonts CDN `<link>` (`FONT_LINK` constant in `page.tsx`). Mobile loads the same three families via `@expo-google-fonts/*` packages — Metro redirects all `@expo-google-fonts/*` imports to a single `@expo-google-fonts/dev` package (see `metro.config.js`).
- The gradient is expressed differently per platform (CSS `linear-gradient` on web, `expo-linear-gradient` start/end coordinates on mobile) but must always resolve to the same visual teal→navy diagonal.
- OS-level text-scaling (accessibility font size) is capped at 1.3× on mobile (`Text.defaultProps.maxFontSizeMultiplier`) to prevent layout breakage in tight card UI — a real device-only bug found and fixed earlier in this project's development.

## Maintenance

This file was written 2026-08-17 by reverse-engineering the app's actual shipped code (`page.tsx`, `apps/mobile/src/utils/theme.ts`) plus the full design review conducted for the Discovery + Content Creation feature. It documents what exists today, not aspirational direction. When a future feature establishes a new pattern (new component shape, new interaction convention, new color use), update this file in the same PR — don't let it drift back into "reconstruct it from `page.tsx`" territory.
