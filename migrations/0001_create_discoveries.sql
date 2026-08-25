-- Discovery feature (T2). Standalone top-level entity, matching `trips`'
-- table conventions: text columns, client-supplied text id, timestamptz
-- created_at with now() default. Not a trip_* child table — discoveries
-- are a shared pool, not scoped to any single trip.
--
-- promoted_trip_id: set when a discovery is promoted into a trip via the
-- "Start a trip from these" flow. ON DELETE SET NULL (not CASCADE, unlike
-- trip_* child tables) — deleting the resulting trip shouldn't delete the
-- discovery that inspired it, just clear the link.

CREATE TABLE IF NOT EXISTS discoveries (
  id TEXT PRIMARY KEY,
  source_url TEXT,
  platform TEXT,
  title TEXT,
  destination TEXT,
  theme_guess TEXT,
  notes TEXT,
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  promoted_trip_id TEXT REFERENCES trips(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
