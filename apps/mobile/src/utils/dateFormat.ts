// Dates are stored/sorted internally as ISO (YYYY-MM-DD, optionally with a
// trailing " HH:MM") since that's what sorts and parses correctly everywhere
// else in the app (fmtDate, buildUnifiedTimeline). These two functions are
// the only place raw-text date fields convert to/from the DD-MM-YYYY format
// users actually type and read.

export function isoToDisplayDate(iso: string): string {
  if (!iso) return '';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})(.*)$/);
  if (!m) return iso; // not ISO-shaped (e.g. still mid-edit) — pass through
  const [, y, mo, d, rest] = m;
  return `${d}-${mo}-${y}${rest}`;
}

// Returns null while the typed text isn't yet a complete, plausible date —
// callers should keep showing the raw typed text but not commit it until
// this returns a value.
export function displayToIsoDate(display: string): string | null {
  const m = display.match(/^(\d{2})-(\d{2})-(\d{4})(.*)$/);
  if (!m) return null;
  const [, d, mo, y, rest] = m;
  const day = Number(d);
  const month = Number(mo);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${y}-${mo}-${d}${rest}`;
}
