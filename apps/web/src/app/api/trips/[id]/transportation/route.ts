import sql from '@/app/api/utils/sql';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const rows = await sql`
      SELECT * FROM trip_transportation WHERE trip_id = ${id} ORDER BY departure_time ASC
    `;
    const transportation = rows.map((r) => ({
      id: r.id,
      type: r.type,
      departureLocation: r.departure_location,
      arrivalLocation: r.arrival_location,
      departureTime: r.departure_time,
      arrivalTime: r.arrival_time,
      confirmationNumber: r.confirmation_number,
      notes: r.notes,
    }));
    return Response.json(transportation);
  } catch (e) {
    console.error('GET /api/trips/[id]/transportation error:', e);
    return Response.json({ error: 'Failed to load transportation' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: tripId } = await params;
    const body = await request.json();
    const {
      id,
      type,
      departureLocation,
      arrivalLocation,
      departureTime,
      arrivalTime,
      confirmationNumber,
      notes,
    } = body;
    await sql`
      INSERT INTO trip_transportation (id, trip_id, type, departure_location, arrival_location, departure_time, arrival_time, confirmation_number, notes)
      VALUES (${id}, ${tripId}, ${type}, ${departureLocation}, ${arrivalLocation}, ${departureTime}, ${arrivalTime}, ${confirmationNumber}, ${notes})
    `;
    return Response.json({ success: true });
  } catch (e) {
    console.error('POST /api/trips/[id]/transportation error:', e);
    return Response.json({ error: 'Failed to create transportation' }, { status: 500 });
  }
}
