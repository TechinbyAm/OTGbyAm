import sql from '@/app/api/utils/sql';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const rows = await sql`
      SELECT * FROM trip_activities WHERE trip_id = ${id} ORDER BY date ASC, time ASC
    `;
    const activities = rows.map((r) => ({
      id: r.id,
      date: r.date,
      time: r.time,
      title: r.title,
      description: r.description,
      location: r.location,
      linkedTicketId: r.linked_ticket_id,
    }));
    return Response.json(activities);
  } catch (e) {
    console.error('GET /api/trips/[id]/activities error:', e);
    return Response.json({ error: 'Failed to load activities' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: tripId } = await params;
    const body = await request.json();
    const { id, date, time, title, description, location, linkedTicketId } = body;
    await sql`
      INSERT INTO trip_activities (id, trip_id, date, time, title, description, location, linked_ticket_id)
      VALUES (${id}, ${tripId}, ${date}, ${time}, ${title}, ${description}, ${location}, ${linkedTicketId})
    `;
    return Response.json({ success: true });
  } catch (e) {
    console.error('POST /api/trips/[id]/activities error:', e);
    return Response.json({ error: 'Failed to create activity' }, { status: 500 });
  }
}
