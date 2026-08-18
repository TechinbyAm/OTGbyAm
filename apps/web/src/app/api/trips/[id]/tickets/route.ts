import sql from '@/app/api/utils/sql';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const rows = await sql`
      SELECT * FROM trip_tickets WHERE trip_id = ${id} ORDER BY date ASC, time ASC
    `;
    const tickets = rows.map((r) => ({
      id: r.id,
      name: r.name,
      date: r.date,
      time: r.time,
      location: r.location,
      confirmationNumber: r.confirmation_number,
      notes: r.notes,
    }));
    return Response.json(tickets);
  } catch (e) {
    console.error('GET /api/trips/[id]/tickets error:', e);
    return Response.json({ error: 'Failed to load tickets' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: tripId } = await params;
    const body = await request.json();
    const { id, name, date, time, location, confirmationNumber, notes } = body;
    await sql`
      INSERT INTO trip_tickets (id, trip_id, name, date, time, location, confirmation_number, notes)
      VALUES (${id}, ${tripId}, ${name}, ${date}, ${time}, ${location}, ${confirmationNumber}, ${notes})
    `;
    return Response.json({ success: true });
  } catch (e) {
    console.error('POST /api/trips/[id]/tickets error:', e);
    return Response.json({ error: 'Failed to create ticket' }, { status: 500 });
  }
}
