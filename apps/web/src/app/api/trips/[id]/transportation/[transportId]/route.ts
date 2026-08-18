import sql from '@/app/api/utils/sql';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; transportId: string }> }
) {
  try {
    const { id: tripId, transportId } = await params;
    const body = await request.json();
    const {
      type,
      departureLocation,
      arrivalLocation,
      departureTime,
      arrivalTime,
      confirmationNumber,
      notes,
    } = body;
    await sql`
      UPDATE trip_transportation
      SET type = ${type}, departure_location = ${departureLocation}, arrival_location = ${arrivalLocation},
          departure_time = ${departureTime}, arrival_time = ${arrivalTime},
          confirmation_number = ${confirmationNumber}, notes = ${notes}
      WHERE id = ${transportId} AND trip_id = ${tripId}
    `;
    return Response.json({ success: true });
  } catch (e) {
    console.error('PUT /api/trips/[id]/transportation/[transportId] error:', e);
    return Response.json({ error: 'Failed to update transportation' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; transportId: string }> }
) {
  try {
    const { id: tripId, transportId } = await params;
    await sql`DELETE FROM trip_transportation WHERE id = ${transportId} AND trip_id = ${tripId}`;
    return Response.json({ success: true });
  } catch (e) {
    console.error('DELETE /api/trips/[id]/transportation/[transportId] error:', e);
    return Response.json({ error: 'Failed to delete transportation' }, { status: 500 });
  }
}
