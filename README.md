# On The Go by Am

Private, small-group travel brand site — hard cap of 10 guests per trip, curated themes, an AI travel advisor, and AI-assisted itinerary/booking parsing. Monorepo: Next.js web app + Expo mobile app sharing one Neon Postgres database.

## Stack

- **Web** — `apps/web`: Next.js 16 (App Router), React 19, Tailwind, better-auth
- **Mobile** — `apps/mobile`: Expo / React Native, expo-router
- **Database** — Neon serverless Postgres (`@neondatabase/serverless`), raw SQL via tagged templates — no ORM, no migration tool yet (see `docs/TODOS.md`)
- **AI** — Gemini only (`gemini-flash-latest` via `@google/genai`). There is **no Anthropic-backed route anywhere in this codebase** — every AI call (Advisor chat, document/URL/text parsing, inbound email parsing) goes through `apps/web/src/app/api/utils/gemini.ts` or an individual route handler. If you find a doc claiming otherwise, it's stale — that architecture was the original plan and was superseded during implementation.
- **Deployment** — `publisher/` holds the Vercel/open-next deploy tooling

## Quick start

```bash
corepack enable
yarn install

# Web (port 4000)
corepack yarn workspace web dev
# verify: curl http://localhost:4000 should return 200

# Mobile (Expo, port 8081 by default)
cd apps/mobile && npx expo start
```

### Environment variables

Neither `apps/web/.env` nor `apps/mobile/.env` is committed (gitignored). Copy the real values from wherever you're storing them and set these keys:

**`apps/web/.env`** — `DATABASE_URL`, `BETTER_AUTH_URL`, `BETTER_AUTH_TRUSTED_ORIGINS`, `GOOGLE_PLACES_API_KEY`, `WEATHER_API_KEY` (WeatherAPI.com, not Google), `GEMINI_API_KEY`. `ANYTHING_PROJECT_TOKEN` is a leftover from the original anything.com scaffold — not used by anything in this repo's own code.

**`apps/mobile/.env`** — mostly `EXPO_PUBLIC_*` values inherited from the same original scaffold; `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` is the one confirmed in active use. Check `apps/mobile/.env` directly for the current full list before assuming any entry is required.

### Verify it's actually working, not just running

- Web: `curl http://localhost:4000/api/trips` should return JSON, not an error
- Web typecheck: `cd apps/web && corepack yarn typecheck` should exit clean
- Mobile: open the Expo dev tools URL it prints, confirm the app loads in a simulator/device

## Project docs

- **`docs/DESIGN.md`** — the visual design system (colors, type, components, patterns). Calibrate against this, don't re-derive from `page.tsx`.
- **`docs/BACKLOG.md`** — prioritized build order for everything scoped but not yet built.
- **`docs/TODOS.md`** — smaller findable issues and deferred work, with full context on each.

## Origin

This app was originally scaffolded on anything.com (a no-code/AI app builder), then ported to and actively developed with Claude Code. That origin explains a few things you'll notice: some leftover `EXPO_PUBLIC_CREATE_*`/`ANYTHING_*` env vars from the original platform, and the absence of conventional engineering scaffolding (this README, tests, migrations) until it was added directly.
