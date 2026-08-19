# On The Go by Am — Backlog

Prioritized build order for everything scoped but not yet built. Companion to `README.md` at the project root (stack, current feature set) and the Discovery + Content Creation design doc (approved, full detail — currently outside this repo, will be copied into `docs/plans/` once active edits slow down).

**Status key:** `NOT BUILT` — spec'd, ready to build · `DECISION NEEDED` — blocked on a choice · `BACKLOG` — deferred, not next up

---

## Priority 0 — Trust & grounding

*Everything the owner enters manually is real. Everything the AI proposes is currently unverified, and renders identically to real bookings. For a brand taking 10 paying guests somewhere, that gap gets closed first.*

### 0.1 Provenance state on every suggested item — `NOT BUILT`
**Highest value, lowest effort. Build before anything else.**

- Every itinerary stop and booking carries a status: `ai_suggestion` · `verified` · `booked`
- AI-generated content renders visibly differently — muted styling, explicit "unverified" marker — so it can never be mistaken for a confirmed reservation
- **Hard gate:** items still marked `ai_suggestion` cannot be published to Explore, and cannot be exported into a guide or content draft
- Promoting an item to `verified` is an explicit owner action
- Applies to: `generateItineraryFromAI` output, `extractTripFromChat` output, and anything from `parseBookingFromUrl` the owner hasn't confirmed
- Items entered manually or arriving via email intake default to `booked` (they came from a real confirmation)

### 0.2 Enable web search on the AI planning call sites — `NOT BUILT`
Small change; the pattern already works in `parseBookingFromUrl`.

- Add the `web_search` tool block to the Advisor chat call and the `generateItineraryFromAI` call
- Grounds suggestions in current web pages rather than training data — reduces (does not eliminate) closed venues and stale recommendations
- Does not replace 0.1; provenance marking still applies

### 0.3 Verify-a-stop action — `NOT BUILT`
- Per-stop button that searches for the place and reports back: does it exist, is it currently open, source link
- One tap replaces a manual search session
- On success, offers to promote the item from `ai_suggestion` → `verified`

### 0.4 Google Places cross-check — `NOT BUILT` · pairs with 1.1
- Resolve each stop against a real Google Place ID
- Returns existence, current hours, address — strongest grounding short of an actual booking
- Same platform as the weather/timezone overlay in 1.1, so build the Google Maps Platform integration once and use it for both

---

## Priority 1 — Trip detail view + real booking data

### 1.1 Trip detail view (double-click a trip card) — `BUILT`
Read-first presentation view, separate from the tabbed editor, at `apps/web/src/app/trips/[id]/page.tsx` (mirrored on mobile). Full edit/delete CRUD verified on both platforms.

- **Header:** gradient/stamp treatment — title, destination, dates, capacity. Built
- **Overlay, bottom-right of header:** destination-local date/time + live weather. Built — source is **WeatherAPI.com** (`WEATHER_API_KEY`, `apps/web/src/app/api/weather/route.ts`), not Google Maps Platform as originally guessed here
- **Tabs directly under the header:** Highlights · Stay · Transportation · Activities · Tickets. Built
- **Trip highlight section:** built as the "Overview" tab — day-by-day numbered rows (resolves the earlier open visual-reference question)

### 1.2 Postmark inbound email intake — `PARTIALLY BUILT`
Forwarded confirmations become structured booking data.

- Postmark **Inbound** stream → `apps/web/src/app/api/postmark-inbound/route.ts`. Built
- Routing by convention off the `To` address (`trip_<id>@...`) — one shared inbox, no per-trip DNS setup. Built
- Email **body text** → Gemini (`parseWithGemini`, not a shared `/api/claude` route — this app has no Anthropic-backed route anywhere, all AI calls are Gemini via `apps/web/src/app/api/utils/gemini.ts`) → merged into the trip's `bookings` via the shared `insertBookings` dedup path. Built
- **Not built:** Postmark origin/signature verification — the webhook currently accepts any POST claiming a valid trip ID with no authentication. Logged as a security gap in `docs/TODOS.md`
- **Not built:** PDF/doc attachment parsing via Firecrawl — only email body text is parsed today
- Tickets-surface-as-Activities-stop and default `booked` provenance: not yet verified against current code, re-check when finishing this item

---

## Priority 2 — Discovery

### 2.1 Discovery tab — `NOT BUILT`
Full spec approved via `/plan-eng-review` + `/plan-design-review` + `/plan-devex-review` (2026-08-13/17) — the design doc supersedes the original `README_newfeatures.md` summary below, with real architecture, scope reductions, and UX decisions folded in. Not yet copied into this repo (see note at the top of this doc). Original summary, still directionally accurate:

- Fourth top-level tab, after Advisor. **Private-only** for now, meaning private-to-the-instance (shared pool across every login), not private-per-account — matches the app's existing single-tenant data model
- **Assume low parse fidelity by design** — IG/TikTok content is behind login walls; any LLM asked to parse those links will hallucinate. Previously tested and confirmed to produce false information
- **Intake paths:**
  1. Paste-a-link + owner annotates destination and "why I saved this" (primary manual path; AI must not fabricate details from unreadable links)
  2. Pinterest board OAuth sync (the flagship automated path — ships via better-auth's `genericOAuth` plugin, not the platform-managed `socialProviders` block; on-demand "Sync now," not a standing cron job)
  3. Manual quick-add
- **AI role:** enrichment over owner-entered data (theme classification against the shared `THEMES` list, region grouping, pattern surfacing) — never extraction from blocked URLs
- **Promote to trip:** select discoveries (single destination only — mixed-destination selections rejected, see multi-destination trip support in `docs/TODOS.md`) → pre-fills a new trip in Plan with source links attached to a new `sourceLinks` field
- **Discovery cards never render real scraped/synced imagery** — decided during design review to avoid visual chaos; cards use the same gradient-header + `StampBadge` theme-glyph treatment as trip cards, `imageUrl` stored but never displayed
- **Advisor context:** discoveries feed the Advisor so "what should I build next?" answers from what's actually been saved

---

## Priority 3 — Content & guides

### 3.1 Content & guide creation from itineraries — `NOT BUILT`
Full spec approved alongside 2.1 (same design doc/review cycle) — supersedes the original `README_newfeatures.md` summary below.

- **Mobile-first responsive web**, not native. Same Next.js app, generation logic server-side
- Consider PWA (installable, and newer Android/Chrome supports PWA share targets — recovers some share-sheet convenience without going native)
- **MVP output type: Guides** (decided — not social posts). The "3 Days in ___" polished shareable guide from the day-by-day itinerary, exported as PDF + copyable text, styled with the app's real brand tokens (`docs/DESIGN.md`)
- Flow: itinerary + bookings + notes → server-side Gemini generation with brand voice as system prompt → editable draft → export
- **PDF export is client-side** (`@react-pdf/renderer` or `jsPDF`, real embedded font files + hand-built SVG gradient — not `window.print()`, not a server-side headless-browser service) — budgeted ~1 day, not a quick pick
- **Gated by 0.1:** only `verified`/`booked` items may be exported into published content

---

## Priority 4 — Phase 2 commerce (target Q2 2027, customer-facing)

All `BACKLOG`. These turn the platform from a personal planning tool into a customer-facing product.

- **4.1 Interest survey** — survey the audience on destination, budget, timing *before* committing to building a trip
- **4.2 Demand dashboard** — interest sliced by destination/budget/theme, so trip selection is evidence-driven
- **4.3 Booking approval + waitlist** — manual approval per spot; auto-waitlist once capacity hits. Enforce the 10-guest cap at the booking layer, not just the UI
- **4.4 Refundable expression-of-interest deposit** — reserve a "maybe" spot before full checkout; refundable if the trip doesn't fill
- **4.5 Inquiry → automated itinerary email**
- **4.6 Payment / deposit collection** (Stripe)
- **4.7 Document / reservation vault** — operator contracts and permits per trip (matters more now that Fora is no longer holding these)
- **4.8 Referral tracking** — which channel each lead came from

---

## Priority 5 — Later

- **5.1 Trip group chat** — auto-created per trip once someone books, for pre-trip logistics. `BACKLOG`, nice-to-have
- **5.2 Drag-and-drop map itinerary view** — `DECISION NEEDED`, owner undecided. Current up/down reordering covers the ordering need; a map view would add spatial/route logic at the cost of a mapping dependency

---

## Cross-cutting requirements

- **Mobile-responsive throughout.** Existing tabs, the tabbed trip editor, the detail view, and all new features must hold up at phone width. Build with this constraint, don't retrofit
- **Hard cap of 10 guests per trip**, enforced at the data layer once booking exists
- **All AI calls server-side.** No shared `/api/claude` route exists — this app is Gemini-only, via `apps/web/src/app/api/utils/gemini.ts` and individual route handlers (`parse-url`, `parse-confirmation`, `parse-attachment`, `postmark-inbound`, `advisor`). The original porting-notes README describes an Anthropic-based `/api/claude` route; that plan was superseded during implementation and the porting doc was never updated to match — don't trust that section of it

## Open decisions blocking work

| # | Decision | Blocks | Status |
|---|---|---|---|
| 1 | ~~Weather/time API confirmation~~ | 1.1 | **Resolved** — WeatherAPI.com, built |
| 2 | ~~Trip highlight section — visual reference~~ | 1.1 | **Resolved** — built as the "Overview" day-by-day rows |
| 3 | ~~Content MVP: guides vs. social posts~~ | 3.1 | **Resolved** — Guides |
| 4 | Map itinerary view: yes/no | 5.2 | Still open |
