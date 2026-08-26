-- sourceLinks field (T3). Separate from affiliate_links (revenue-tracking)
-- and notes (free-text) -- holds discovery source links attached when a
-- trip is created via "Start a trip from these" (promote-to-trip, T8).
-- Same jsonb-array-with-default pattern as affiliate_links.

ALTER TABLE trips ADD COLUMN IF NOT EXISTS source_links JSONB DEFAULT '[]'::jsonb;
