# TODOS

## Multi-destination trip support

**What:** Trips currently model exactly one destination as a single string field (`destination` column on `trips`, `Trip.destination: string` on both platforms). Add real support for a trip spanning multiple destinations.

**Why:** Surfaced while designing the Discovery feature's "promote to trip" flow — if someone selects discoveries for a multi-stop trip (e.g. a Guatemala + Belize combined trip), there's currently no way to represent that as one trip.

**Pros:** Matches how real trips often work (multi-city itineraries); unblocks the promote-to-trip flow for genuinely multi-destination selections instead of forcing a reject-and-retry.

**Cons:** Real schema change, not a UI tweak. Touches: `trips` table (destination → array or a `trip_destinations` join table), `Trip` type on both `apps/web/src/app/page.tsx` and `apps/mobile/src/utils/trips.ts`, the `DestinationInput` component, Advisor's `tripContext` string-building in `apps/web/src/app/api/advisor/route.ts`, and the trip-matching logic at `apps/web/src/app/page.tsx:998-1003` (`findMatchingTrip`, which currently does an exact single-string destination match). Needs its own design/plan pass, not a side effect of the Discovery feature.

**Context:** Found during `/plan-eng-review` of the Discovery + Content Creation plan (2026-08-13, design doc: `OTGbyAm-amberirvin-none-design-20260813-022136.md`). Interim behavior: Discovery's promote-to-trip flow rejects mixed-destination selections with a clear message ("select discoveries for one destination at a time") until this is built.

**Depends on / blocked by:** Nothing blocks starting this. Should land before or alongside any future work that assumes multi-stop trips (e.g. richer itinerary/guide generation across multiple cities).

## ~~Missing DESIGN.md~~ — DONE (2026-08-17)

`DESIGN.md` written (now living in `docs/`, moved there in the same pass as this note), ahead of schedule (originally sequenced after T1/theme.ts extraction — done directly from `apps/mobile/src/utils/theme.ts` plus the design review's documented patterns instead, since DESIGN.md defining the system first is cleaner than waiting for code to consolidate it). Keep the maintenance habit below in mind for future patterns.

**What:** No `DESIGN.md` exists anywhere in the repo. All design decisions currently live either as hardcoded values inline in `apps/web/src/app/page.tsx` (soon `apps/web/src/utils/theme.ts`), in `apps/mobile/src/utils/theme.ts`, or scattered across individual plan/design docs like this one.

**Why:** Surfaced in `/plan-design-review` (Pass 5, Design System Alignment) while reviewing the Discovery + Content Creation design doc. This review had to reverse-engineer the app's actual design conventions (card patterns, empty-state language, eyebrow-label styling, THEMES glyph set) directly from `page.tsx` rather than checking them against a documented system — workable once, but it's exactly the kind of drift risk that compounds: the next feature's reviewer (human or AI) has to redo that archaeology, and small inconsistencies get easier to introduce unnoticed.

**Pros:** One canonical reference for colors/type/spacing/component patterns that every future feature (and every future design review) calibrates against instead of re-deriving from source. Directly serves the "zero design drift" priority already driving this session's work. Low effort relative to value — most of the content already exists in `apps/mobile/src/utils/theme.ts` and the new `apps/web/src/utils/theme.ts` (T1 in this plan); it mostly needs to be written down with the established UI patterns (card shapes, empty-state copy convention, eyebrow-label rules) added around the token values.

**Cons:** Another file to keep in sync — a DESIGN.md that drifts from the actual code is arguably worse than no DESIGN.md, since it creates false confidence. Needs a light maintenance habit (update it when a new pattern is established, e.g. this plan's new checkbox pattern and the photo-free uniform grid) or it decays like any other doc.

**Context:** Found during `/plan-design-review` of the Discovery + Content Creation plan (2026-08-13/17, design doc: `OTGbyAm-amberirvin-none-design-20260813-022136.md`). Best sequenced right after T1 (theme.ts extraction) lands, since that's when the token values are consolidated in one place for the first time on web.

**Depends on / blocked by:** Best done after T1 (theme.ts extraction) so the token source is already consolidated. Not a blocker for shipping Discovery or Content Creation.

## Fix dead "check the logs panel" toast copy

**What:** The error toast copy at `apps/web/src/app/page.tsx:939` and `:959` tells the user to "check the logs panel for details" — no logs panel exists anywhere in the app.

**Why:** Users hitting a save/update failure are pointed at something that doesn't exist — a small but real trust-eroding dead end. Also a risk of the same broken phrasing getting copied into new error messages (already avoided in the two new critical-gap failure modes from this plan, but worth closing at the source).

**Pros:** Cheap, immediate correctness fix — either rewrite the message (e.g. "Could not save trip — try again") or build the logs panel the message promises.

**Cons:** Cosmetic, not blocking; zero functional impact.

**Context:** Found during `/plan-devex-review` of the Discovery + Content Creation plan (2026-08-13/17, design doc: `OTGbyAm-amberirvin-none-design-20260813-022136.md`). Pre-existing bug, unrelated to that plan's diff — logged here instead of fixed as part of it.

**Depends on / blocked by:** Nothing.

## Postmark inbound webhook has no origin verification

**What:** `apps/web/src/app/api/postmark-inbound/route.ts` accepts any POST request claiming a valid trip ID (`trip_<id>@...` in the `To` field) with zero authentication — no Postmark signature or shared-secret check.

**Why:** `docs/BACKLOG.md`'s original spec for this feature explicitly called for verifying requests genuinely originate from Postmark; that part was never built. Anyone who knows or guesses a trip's inbound email address (a predictable format) can POST fabricated "confirmation" data that gets parsed by Gemini and inserted into that trip's real bookings.

**Pros:** Closes a real, if currently low-severity, gap — this app is single-tenant/private, so the practical blast radius today is low, but the endpoint is genuinely open to anyone on the internet who can reach it.

**Cons:** Requires knowing Postmark's actual verification mechanism (webhook signing, or a shared secret in the URL/header) and provisioning it — not purely a code change, may need a Postmark dashboard config step too.

**Context:** Found while cross-checking `docs/BACKLOG.md` against the real code (2026-08-18) — the backlog claimed this item was `NOT BUILT` in full; reading the actual route showed the core parse/merge path is built but this specific requirement was silently dropped.

**Depends on / blocked by:** Nothing blocks starting this. Worth doing before this endpoint sees real inbound traffic.

## Discovery filter chips are a long keyboard detour to the first card

**What:** Reaching the first discovery card's selection checkbox via keyboard takes ~15 Tab presses from the top of the page — the 7 individually-focusable theme filter chips (`apps/web/src/components/DiscoveryTab.tsx`) account for most of that.

**Why:** Found during manual testing (2026-08-27) — the checkbox itself is fully keyboard-functional (confirmed: focusable, `Space` toggles it, now has a clearly visible gold focus ring after the same testing pass fixed that), but the *path* to it is long enough that a keyboard user can reasonably conclude "this doesn't work" before ever reaching it.

**Pros:** A roving-tabindex pattern (arrow keys move between chips, only one Tab stop for the whole group — the correct ARIA pattern for a set of mutually exclusive filter buttons, similar to a radio group) would cut ~6 tab stops down to 1.

**Cons:** Real interaction-model change to the filter chips, more test surface, not something to bundle into a bug-fix pass — deserves its own scoped pass.

**Context:** Found while investigating a user report that "keyboard doesn't work to check the card" — the checkbox toggle logic itself was correct, but this tab-order length was a real contributing factor to why it felt broken in practice.

**Depends on / blocked by:** Nothing blocks starting this.
