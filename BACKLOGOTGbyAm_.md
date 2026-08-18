# On The Go by Am — Backlog

Prioritized build order for everything scoped but not yet built. Companion to `README.md` (stack, porting notes, current feature set) and `README_newfeatures.md` (Discovery + content/guides detail).

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

### 1.1 Trip detail view (double-click a trip card) — `NOT BUILT`
Read-first presentation view, separate from the tabbed editor. Editing stays in the editor.

- **Header:** existing gradient/stamp treatment — title, destination, dates, capacity
- **Overlay, bottom-right of header:** destination-local date/time + live weather, "departures board" style, sitting on top of the gradient rather than pushing content down
- **Tabs directly under the header:** Stay · Transportation · Activities · Tickets
  - Activities pulls from the existing day-by-day `itinerary`
  - Stay / Transportation / Tickets read from the `bookings` array the Plan editor already writes to
- **Below the tabs:** trip highlight section — `DECISION NEEDED`, visual reference pending from owner
- Weather/time source: likely Google Maps Platform (weather + time zone) — `DECISION NEEDED`, owner confirming API access

### 1.2 Postmark inbound email intake — `NOT BUILT`
Forwarded confirmations become structured booking data.

- Postmark server with an **Inbound** stream; inbound webhook pointed at a Next.js API route
- Routing by convention off the `To` address or a subject tag — one shared inbox, no per-trip DNS setup
- Webhook must verify requests genuinely originate from Postmark
- **Two parse paths, merged:**
  - Email **body text** → Claude (server-side, existing `/api/claude` route) for structured extraction
  - **PDF/doc attachments** and **linked confirmation pages** → Firecrawl (document parsing + `/extract` endpoints)
- Results merge into the trip's existing `bookings` array — a second entry point into the same store the manual UI writes to, not a parallel system
- Tickets with a specific date/time also surface as a stop on that day in Activities, keeping the itinerary the single source of truth for day-by-day flow
- Arriving items default to `booked` provenance (see 0.1)

---

## Priority 2 — Discovery

### 2.1 Discovery tab — `NOT BUILT`
Full spec in `README_newfeatures.md`. Summary:

- Fourth top-level tab, after Advisor. **Private-only** for now; model kept clean for a future public layer, but no public UI and no draft/published states
- **Assume low parse fidelity by design** — IG/TikTok content is behind login walls; any LLM asked to parse those links will hallucinate. Previously tested and confirmed to produce false information
- **Intake paths:**
  1. Paste-a-link + owner annotates destination and "why I saved this" (primary manual path; AI must not fabricate details from unreadable links)
  2. Pinterest board OAuth sync (the one high-fidelity automated path)
  3. Manual quick-add
- **AI role:** enrichment over owner-entered data (theme classification, region grouping, pattern surfacing) — never extraction from blocked URLs
- **Promote to trip:** select discoveries → pre-fills a new trip in Plan with source links attached
- **Advisor context:** discoveries feed the Advisor so "what should I build next?" answers from what the owner has actually been saving

---

## Priority 3 — Content & guides

### 3.1 Content & guide creation from itineraries — `NOT BUILT`
Full spec in `README_newfeatures.md`. Summary:

- **Mobile-first responsive web**, not native. Same Next.js app, generation logic server-side
- Consider PWA (installable, and newer Android/Chrome supports PWA share targets — recovers some share-sheet convenience without going native)
- **Output types:** trip guide (PDF + copyable) · social content (per-platform drafts) · post-trip recap
- Flow: itinerary + bookings + notes → server-side AI generation with brand voice as system prompt → editable draft → export
- **Gated by 0.1:** only `verified`/`booked` items may be exported into published content
- `DECISION NEEDED`: MVP output type — guides (product value) vs. social posts (marketing value)

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
- **All AI calls server-side** via the shared `/api/claude` route (see main README porting notes)

## Open decisions blocking work

| # | Decision | Blocks |
|---|---|---|
| 1 | Weather/time API confirmation (Google?) | 1.1 |
| 2 | Trip highlight section — visual reference | 1.1 |
| 3 | Content MVP: guides vs. social posts | 3.1 |
| 4 | Map itinerary view: yes/no | 5.2 |
