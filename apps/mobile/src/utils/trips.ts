import fetchToWeb from '@/__create/fetch';

export type AffiliateLink = { label: string; url: string };

export type Trip = {
  id: string;
  title: string;
  destination: string;
  theme: string;
  startDate: string;
  endDate: string;
  capacity: number;
  status: 'draft' | 'published';
  priceFrom: string;
  notes: string;
  affiliateLinks: AffiliateLink[];
};

export type TripSuggestion = {
  title: string;
  destination: string;
  theme: string;
  notes: string;
  startDate: string;
  endDate: string;
  capacity: number;
  priceFrom: string;
};

export const THEMES = [
  { id: 'coastal-reset', label: 'Coastal Reset', icon: '〜' },
  { id: 'culinary-crawl', label: 'Culinary Crawl', icon: '✦' },
  { id: 'wellness-retreat', label: 'Wellness Retreat', icon: '◎' },
  { id: 'city-immersion', label: 'City Immersion', icon: '▣' },
  { id: 'adventure-edge', label: 'Adventure Edge', icon: '▲' },
  { id: 'slow-village', label: 'Slow Village', icon: '◈' },
] as const;

export function themeInfo(id: string) {
  return THEMES.find((t) => t.id === id) || THEMES[0];
}

export function emptyTrip(): Trip {
  const uid = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return {
    id: `trip_${uid}`,
    title: '',
    destination: '',
    theme: THEMES[0].id,
    startDate: '',
    endDate: '',
    capacity: 8,
    status: 'draft',
    priceFrom: '',
    notes: '',
    affiliateLinks: [],
  };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function fmtDate(d: string) {
  if (!d) return 'TBD';
  const parts = d.split('-').map(Number);
  if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) return d;
  const [year, month, day] = parts;
  return `${MONTHS[month - 1]} ${day}, ${year}`;
}

export function parseItinerary(notes: string): { subtitle: string | null; lines: string[] } {
  if (!notes) return { subtitle: null, lines: [] };

  if (/Day\s+\d+[\s]*[:\-–]/i.test(notes)) {
    const parts = notes
      .split(/(?=Day\s+\d+[\s]*[:\-–])/i)
      .map((s) => s.trim())
      .filter(Boolean);
    const firstIsDay = /^Day\s+\d+/i.test(parts[0]);
    const subtitle = !firstIsDay ? parts[0] : null;
    const lines = (firstIsDay ? parts : parts.slice(1)).slice(0, 3);
    return { subtitle, lines };
  }

  if (/^\d+[.)]/m.test(notes)) {
    const all = notes
      .split(/\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    const firstIsItem = /^\d+[.)]/.test(all[0]);
    return {
      subtitle: !firstIsItem ? all[0] : null,
      lines: (firstIsItem ? all : all.slice(1)).slice(0, 3),
    };
  }

  if (/^[-•*]/m.test(notes)) {
    const all = notes
      .split(/\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    const firstIsBullet = /^[-•*]/.test(all[0]);
    return {
      subtitle: !firstIsBullet ? all[0] : null,
      lines: (firstIsBullet ? all : all.slice(1))
        .filter((s) => /^[-•*]/.test(s))
        .map((s) => s.replace(/^[-•*]\s*/, ''))
        .slice(0, 3),
    };
  }

  const splitLines = notes
    .split(/\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (splitLines.length > 1) {
    return { subtitle: splitLines[0], lines: splitLines.slice(1, 4) };
  }

  return { subtitle: null, lines: [notes.slice(0, 90) + (notes.length > 90 ? '…' : '')] };
}

export async function fetchTrips(): Promise<Trip[]> {
  const res = await fetchToWeb('/api/trips');
  if (!res.ok) throw new Error('Failed to load trips');
  return res.json();
}

export async function createTrip(trip: Trip) {
  const res = await fetchToWeb('/api/trips', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(trip),
  });
  if (!res.ok) throw new Error('Failed to create trip');
}

export async function updateTrip(trip: Trip) {
  const res = await fetchToWeb(`/api/trips/${trip.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(trip),
  });
  if (!res.ok) throw new Error('Failed to update trip');
}

export async function deleteTrip(id: string) {
  const res = await fetchToWeb(`/api/trips/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete trip');
}
