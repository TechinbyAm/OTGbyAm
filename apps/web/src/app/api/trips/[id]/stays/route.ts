import sql from '@/app/api/utils/sql';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const rows = await sql`
      SELECT * FROM trip_stays WHERE trip_id = ${id} ORDER BY check_in_date ASC
    `;
    const stays = rows.map((r) => ({
      id: r.id,
      name: r.name,
      checkInDate: r.check_in_date,
      checkOutDate: r.check_out_date,
      address: r.address,
      confirmationNumber: r.confirmation_number,
      notes: r.notes,
    }));
    return Response.json(stays);
  } catch (e) {
    console.error('GET /api/trips/[id]/stays error:', e);
    return Response.json({ error: 'Failed to load stays' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: tripId } = await params;
    const body = await request.json();
    const { id, name, checkInDate, checkOutDate, address, confirmationNumber, notes } = body;
    await sql`
      INSERT INTO trip_stays (id, trip_id, name, check_in_date, check_out_date, address, confirmation_number, notes)
      VALUES (${id}, ${tripId}, ${name}, ${checkInDate}, ${checkOutDate}, ${address}, ${confirmationNumber}, ${notes})
    `;
    return Response.json({ success: true });
  } catch (e) {
    console.error('POST /api/trips/[id]/stays error:', e);
    return Response.json({ error: 'Failed to create stay' }, { status: 500 });
  }
}
