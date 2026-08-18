// Shared insert logic for a single parsed booking, used by every AI-parse
// entry point (URL, pasted text, uploaded attachment, inbound email) now that
// each of those can return MULTIPLE bookings from one document instead of
// being forced to pick just one.
export type ParsedBooking = {
  type: 'stay' | 'transportation' | 'ticket';
  stay?: {
    name: string;
    checkInDate: string;
    checkOutDate: string;
    address: string;
    confirmationNumber: string;
    notes: string;
  };
  transportation?: {
    type: string;
    departureLocation: string;
    arrivalLocation: string;
    departureTime: string;
    arrivalTime: string;
    confirmationNumber: string;
    notes: string;
  };
  ticket?: {
    name: string;
    date: string;
    time: string;
    location: string;
    confirmationNumber: string;
    notes: string;
  };
};

export type InsertResult = { type: string; status: 'added' | 'duplicate' | 'empty' };

// The BOOKINGS_JSON_SHAPE instruction block shared across every parser prompt.
export const BOOKINGS_JSON_INSTRUCTIONS = `A single document can contain MULTIPLE distinct bookings — e.g. a flight AND a hotel AND one or more activities/tours. Extract EVERY booking present, not just one.
For each booking, classify its type as exactly one of: "stay" (hotels/Airbnbs/accommodations), "transportation" (flights/trains/buses/transfers/rentals), "ticket" (tours/events/attractions/experiences/activities).
Dates must be YYYY-MM-DD format. Times must be HH:MM (24h) format. Use empty strings for fields not present.
Respond with ONLY JSON matching exactly this shape, no markdown fences, no extra keys:
{"bookings":[{"type":"stay","stay":{"name":"","checkInDate":"","checkOutDate":"","address":"","confirmationNumber":"","notes":""}},{"type":"transportation","transportation":{"type":"","departureLocation":"","arrivalLocation":"","departureTime":"","arrivalTime":"","confirmationNumber":"","notes":""}},{"type":"ticket","ticket":{"name":"","date":"","time":"","location":"","confirmationNumber":"","notes":""}}]}
Only include the sub-object matching each booking's own type (e.g. a "ticket" booking only needs a "ticket" key, not "stay" or "transportation"). If nothing bookable is found, respond with {"bookings":[]}.`;

const norm = (s: string) => (s || '').trim().toLowerCase();

// sql is a Neon tagged-template query function — typed loosely here since
// each route imports its own instance from ./sql and the codebase doesn't
// otherwise share Neon's generic types across files.
export async function insertBooking(
  sql: any,
  tripId: string,
  booking: ParsedBooking,
  activitySourceLabel: string
): Promise<InsertResult> {
  const uid = `${booking.type}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  if (booking.type === 'stay' && booking.stay) {
    const s = booking.stay;
    if (!s.name.trim() && !s.checkInDate.trim()) return { type: 'stay', status: 'empty' };

    const existing = await sql`SELECT id, name, check_in_date, confirmation_number FROM trip_stays WHERE trip_id = ${tripId}`;
    const isDuplicate = existing.some(
      (row: any) =>
        (s.confirmationNumber && norm(row.confirmation_number) === norm(s.confirmationNumber)) ||
        (norm(row.name) === norm(s.name) && row.check_in_date === s.checkInDate)
    );
    if (isDuplicate) return { type: 'stay', status: 'duplicate' };

    await sql`
      INSERT INTO trip_stays (id, trip_id, name, check_in_date, check_out_date, address, confirmation_number, notes)
      VALUES (${uid}, ${tripId}, ${s.name}, ${s.checkInDate}, ${s.checkOutDate}, ${s.address}, ${s.confirmationNumber}, ${s.notes})
    `;
    return { type: 'stay', status: 'added' };
  }

  if (booking.type === 'transportation' && booking.transportation) {
    const t = booking.transportation;
    if (!t.departureLocation.trim() && !t.arrivalLocation.trim()) {
      return { type: 'transportation', status: 'empty' };
    }

    const existing = await sql`SELECT id, departure_location, arrival_location, departure_time, confirmation_number FROM trip_transportation WHERE trip_id = ${tripId}`;
    const isDuplicate = existing.some(
      (row: any) =>
        (t.confirmationNumber && norm(row.confirmation_number) === norm(t.confirmationNumber)) ||
        (norm(row.departure_location) === norm(t.departureLocation) &&
          norm(row.arrival_location) === norm(t.arrivalLocation) &&
          row.departure_time === t.departureTime)
    );
    if (isDuplicate) return { type: 'transportation', status: 'duplicate' };

    await sql`
      INSERT INTO trip_transportation (id, trip_id, type, departure_location, arrival_location, departure_time, arrival_time, confirmation_number, notes)
      VALUES (${uid}, ${tripId}, ${t.type}, ${t.departureLocation}, ${t.arrivalLocation}, ${t.departureTime}, ${t.arrivalTime}, ${t.confirmationNumber}, ${t.notes})
    `;
    return { type: 'transportation', status: 'added' };
  }

  if (booking.type === 'ticket' && booking.ticket) {
    const tk = booking.ticket;
    if (!tk.name.trim()) return { type: 'ticket', status: 'empty' };

    const existing = await sql`SELECT id, name, date, confirmation_number FROM trip_tickets WHERE trip_id = ${tripId}`;
    const isDuplicate = existing.some(
      (row: any) =>
        (tk.confirmationNumber && norm(row.confirmation_number) === norm(tk.confirmationNumber)) ||
        (norm(row.name) === norm(tk.name) && row.date === tk.date)
    );
    if (isDuplicate) return { type: 'ticket', status: 'duplicate' };

    await sql`
      INSERT INTO trip_tickets (id, trip_id, name, date, time, location, confirmation_number, notes)
      VALUES (${uid}, ${tripId}, ${tk.name}, ${tk.date}, ${tk.time}, ${tk.location}, ${tk.confirmationNumber}, ${tk.notes})
    `;
    if (tk.date) {
      const activityId = `activity_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      await sql`
        INSERT INTO trip_activities (id, trip_id, date, time, title, description, location, linked_ticket_id)
        VALUES (${activityId}, ${tripId}, ${tk.date}, ${tk.time}, ${tk.name}, ${activitySourceLabel}, ${tk.location}, ${uid})
      `;
    }
    return { type: 'ticket', status: 'added' };
  }

  return { type: booking.type, status: 'empty' };
}

export function summarizeResults(results: InsertResult[]) {
  const added = results.filter((r) => r.status === 'added');
  const duplicates = results.filter((r) => r.status === 'duplicate');
  return {
    count: added.length,
    types: added.map((r) => r.type),
    duplicateCount: duplicates.length,
    duplicateTypes: duplicates.map((r) => r.type),
  };
}

export async function insertBookings(
  sql: any,
  tripId: string,
  bookings: ParsedBooking[],
  activitySourceLabel: string
): Promise<InsertResult[]> {
  const results: InsertResult[] = [];
  for (const booking of bookings) {
    results.push(await insertBooking(sql, tripId, booking, activitySourceLabel));
  }
  return results;
}
