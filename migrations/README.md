# Migrations

This app has no migration runner (no drizzle, no prisma, no `.sql`-file executor). Schema changes historically happened as one-off SQL run directly in Neon's web console, with no tracked record. This folder exists to fix the "no record" half of that — it's a plain, numbered log of every schema change, applied manually.

## Convention

- One file per change: `NNNN_description.sql`, zero-padded, sequential.
- Each file is idempotent where practical (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`) so re-running a file that already applied is a no-op, not an error.
- Apply by running the file's SQL — either paste it into Neon's console, or run it via the same `@neondatabase/serverless` client the app already uses (`node -e "..."` against `DATABASE_URL`).
- After applying, note it here.

## Applied

| File | Applied | Notes |
|---|---|---|
| `0001_create_discoveries.sql` | 2026-08-18 | Discovery feature (T2). Applied directly via the Neon connection already in `apps/web/.env`. |
| `0002_add_source_links_to_trips.sql` | 2026-08-25 | `sourceLinks` field on trips (T3), for promote-to-trip (T8). Applied directly; confirmed existing trips got the `[]` default with no data loss. |
