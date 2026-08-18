import fetchToWeb from '@/__create/fetch';
import type { Trip } from './trips';

export type TripWithEmail = Trip & { tripEmail: string };

export type Weather = {
  temp_f: number;
  temp_c: number;
  condition: string;
  icon: string;
  localtime: string;
};

export type Stay = {
  id: string;
  name: string;
  checkInDate: string;
  checkOutDate: string;
  address: string;
  confirmationNumber: string;
  notes: string;
};

export type Transportation = {
  id: string;
  type: string;
  departureLocation: string;
  arrivalLocation: string;
  departureTime: string;
  arrivalTime: string;
  confirmationNumber: string;
  notes: string;
};

export type Ticket = {
  id: string;
  name: string;
  date: string;
  time: string;
  location: string;
  confirmationNumber: string;
  notes: string;
};

export type Activity = {
  id: string;
  date: string;
  time: string;
  title: string;
  description: string;
  location: string;
  linkedTicketId: string | null;
};

export type TimelineEntry = {
  key: string;
  date: string;
  time: string;
  title: string;
  subtitle: string;
  location: string;
  source: 'stay' | 'transportation' | 'ticket' | 'activity';
  sourceId: string;
  badge?: string;
};

export function buildUnifiedTimeline(
  stays: Stay[],
  transportation: Transportation[],
  tickets: Ticket[],
  activities: Activity[]
): TimelineEntry[] {
  const entries: TimelineEntry[] = [];

  stays.forEach((s) => {
    if (s.checkInDate) {
      entries.push({
        key: `stay-in-${s.id}`,
        sourceId: s.id,
        date: s.checkInDate,
        time: '00:00',
        title: `Check-in: ${s.name || 'Accommodation'}`,
        subtitle: s.address || '',
        location: s.address || '',
        source: 'stay',
        badge: 'Stay',
      });
    }
    if (s.checkOutDate) {
      entries.push({
        key: `stay-out-${s.id}`,
        sourceId: s.id,
        date: s.checkOutDate,
        time: '23:59',
        title: `Check-out: ${s.name || 'Accommodation'}`,
        subtitle: s.address || '',
        location: s.address || '',
        source: 'stay',
        badge: 'Stay',
      });
    }
  });

  transportation.forEach((t) => {
    const depDate = t.departureTime
      ? t.departureTime.split(' ')[0] || t.departureTime.split('T')[0]
      : '';
    const depTime = t.departureTime ? t.departureTime.split(' ')[1] || '' : '';
    const arrDate = t.arrivalTime ? t.arrivalTime.split(' ')[0] || t.arrivalTime.split('T')[0] : '';
    const arrTime = t.arrivalTime ? t.arrivalTime.split(' ')[1] || '' : '';
    if (depDate) {
      entries.push({
        key: `transport-dep-${t.id}`,
        sourceId: t.id,
        date: depDate,
        time: depTime || '00:00',
        title: `${t.type || 'Flight'}: ${t.departureLocation} → ${t.arrivalLocation}`,
        subtitle: t.confirmationNumber ? `#${t.confirmationNumber}` : '',
        location: t.departureLocation || '',
        source: 'transportation',
        badge: t.type || 'Flight',
      });
    }
    if (arrDate && arrDate !== depDate) {
      entries.push({
        key: `transport-arr-${t.id}`,
        sourceId: t.id,
        date: arrDate,
        time: arrTime || '23:59',
        title: `Arrives: ${t.arrivalLocation}`,
        subtitle: `From ${t.departureLocation}`,
        location: t.arrivalLocation || '',
        source: 'transportation',
        badge: t.type || 'Flight',
      });
    }
  });

  tickets.forEach((tk) => {
    if (tk.date) {
      entries.push({
        key: `ticket-${tk.id}`,
        sourceId: tk.id,
        date: tk.date,
        time: tk.time || '12:00',
        title: tk.name || 'Event',
        subtitle: tk.location || '',
        location: tk.location || '',
        source: 'ticket',
        badge: 'Ticket',
      });
    }
  });

  const ticketIds = new Set(tickets.map((tk) => tk.id));
  activities.forEach((a) => {
    if (a.linkedTicketId && ticketIds.has(a.linkedTicketId)) return;
    entries.push({
      key: `activity-${a.id}`,
      sourceId: a.id,
      date: a.date || '',
      time: a.time || '12:00',
      title: a.title || 'Activity',
      subtitle: a.description || '',
      location: a.location || '',
      source: 'activity',
      badge: 'Activity',
    });
  });

  entries.sort((a, b) => {
    if (a.date < b.date) return -1;
    if (a.date > b.date) return 1;
    if (a.time < b.time) return -1;
    if (a.time > b.time) return 1;
    return 0;
  });

  return entries;
}

export async function fetchTripDetail(id: string): Promise<TripWithEmail> {
  const res = await fetchToWeb(`/api/trips/${id}`);
  if (!res.ok) throw new Error('Failed to load trip');
  return res.json();
}

export async function fetchWeather(location: string): Promise<Weather | null> {
  const res = await fetchToWeb(`/api/weather?location=${encodeURIComponent(location)}`);
  if (!res.ok) return null;
  return res.json();
}

export async function fetchStays(tripId: string): Promise<Stay[]> {
  const res = await fetchToWeb(`/api/trips/${tripId}/stays`);
  return res.ok ? res.json() : [];
}

export async function fetchTransportation(tripId: string): Promise<Transportation[]> {
  const res = await fetchToWeb(`/api/trips/${tripId}/transportation`);
  return res.ok ? res.json() : [];
}

export async function fetchTickets(tripId: string): Promise<Ticket[]> {
  const res = await fetchToWeb(`/api/trips/${tripId}/tickets`);
  return res.ok ? res.json() : [];
}

export async function fetchActivities(tripId: string): Promise<Activity[]> {
  const res = await fetchToWeb(`/api/trips/${tripId}/activities`);
  return res.ok ? res.json() : [];
}

function randomId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function createStay(tripId: string, form: Omit<Stay, 'id'>) {
  const id = randomId('stay');
  const res = await fetchToWeb(`/api/trips/${tripId}/stays`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, ...form }),
  });
  if (!res.ok) throw new Error('Failed to save stay');
}

export async function createTransportation(tripId: string, form: Omit<Transportation, 'id'>) {
  const id = randomId('transport');
  const res = await fetchToWeb(`/api/trips/${tripId}/transportation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, ...form }),
  });
  if (!res.ok) throw new Error('Failed to save transportation');
}

export async function createTicket(tripId: string, form: Omit<Ticket, 'id'>) {
  const id = randomId('ticket');
  const res = await fetchToWeb(`/api/trips/${tripId}/tickets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, ...form }),
  });
  if (!res.ok) throw new Error('Failed to save ticket');
}

export async function createActivity(
  tripId: string,
  form: Omit<Activity, 'id' | 'linkedTicketId'>
) {
  const id = randomId('activity');
  const res = await fetchToWeb(`/api/trips/${tripId}/activities`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, ...form, linkedTicketId: null }),
  });
  if (!res.ok) throw new Error('Failed to save activity');
}

export async function updateStay(tripId: string, id: string, form: Omit<Stay, 'id'>) {
  const res = await fetchToWeb(`/api/trips/${tripId}/stays/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(form),
  });
  if (!res.ok) throw new Error('Failed to update stay');
}

export async function deleteStay(tripId: string, id: string) {
  const res = await fetchToWeb(`/api/trips/${tripId}/stays/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete stay');
}

export async function updateTransportation(
  tripId: string,
  id: string,
  form: Omit<Transportation, 'id'>
) {
  const res = await fetchToWeb(`/api/trips/${tripId}/transportation/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(form),
  });
  if (!res.ok) throw new Error('Failed to update transportation');
}

export async function deleteTransportation(tripId: string, id: string) {
  const res = await fetchToWeb(`/api/trips/${tripId}/transportation/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete transportation');
}

export async function updateTicket(tripId: string, id: string, form: Omit<Ticket, 'id'>) {
  const res = await fetchToWeb(`/api/trips/${tripId}/tickets/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(form),
  });
  if (!res.ok) throw new Error('Failed to update ticket');
}

export async function deleteTicket(tripId: string, id: string) {
  const res = await fetchToWeb(`/api/trips/${tripId}/tickets/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete ticket');
}

export async function updateActivity(
  tripId: string,
  id: string,
  form: Omit<Activity, 'id' | 'linkedTicketId'>
) {
  const res = await fetchToWeb(`/api/trips/${tripId}/activities/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(form),
  });
  if (!res.ok) throw new Error('Failed to update activity');
}

export async function deleteActivity(tripId: string, id: string) {
  const res = await fetchToWeb(`/api/trips/${tripId}/activities/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete activity');
}

// Parsers return { count, types } since one document can hold multiple
// bookings (e.g. a flight + a hotel + activities) instead of just one.
export function summarizeBookings(types: string[]): string {
  const labels: Record<string, string> = { stay: 'stay', transportation: 'transportation', ticket: 'ticket' };
  const counts: Record<string, number> = {};
  types.forEach((t) => {
    counts[t] = (counts[t] || 0) + 1;
  });
  return Object.entries(counts)
    .map(([type, n]) => `${n} ${labels[type] || type}${n > 1 ? 's' : ''}`)
    .join(', ');
}

// Appends a note when the parser skipped items already in the trip (matched
// by confirmation number, or by name/route + date) so silent skips are visible.
export function withDuplicateNote(base: string, duplicateCount: number): string {
  if (!duplicateCount) return base;
  return `${base} (${duplicateCount} already in this trip, skipped)`;
}

export async function parseUrl(tripId: string, url: string) {
  const res = await fetchToWeb(`/api/trips/${tripId}/parse-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.error || 'Could not parse that URL.');
  }
  return res.json();
}

export async function parseConfirmationText(tripId: string, text: string) {
  const res = await fetchToWeb(`/api/trips/${tripId}/parse-confirmation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error('Could not parse that text. Try pasting more of the confirmation.');
  return res.json();
}

export async function parseAttachment(tripId: string, fileBase64: string, mimeType: string) {
  const res = await fetchToWeb(`/api/trips/${tripId}/parse-attachment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileBase64, mimeType }),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.error || 'Could not parse that file.');
  }
  return res.json();
}
