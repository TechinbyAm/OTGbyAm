import sql from '@/app/api/utils/sql';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; stayId: string }> }
) {
  try {
    const { id: tripId, stayId } = await params;
    const body = await request.json();
    const { name, checkInDate, checkOutDate, address, confirmationNumber, notes } = body;
    await sql`
      UPDATE trip_stays
      SET name = ${name}, check_in_date = ${checkInDate}, check_out_date = ${checkOutDate},
          address = ${address}, confirmation_number = ${confirmationNumber}, notes = ${notes}
      WHERE id = ${stayId} AND trip_id = ${tripId}
    `;
    return Response.json({ success: true });
  } catch (e) {
    console.error('PUT /api/trips/[id]/stays/[stayId] error:', e);
    return Response.json({ error: 'Failed to update stay' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; stayId: string }> }
) {
  try {
    const { id: tripId, stayId } = await params;
    await sql`DELETE FROM trip_stays WHERE id = ${stayId} AND trip_id = ${tripId}`;
    return Response.json({ success: true });
  } catch (e) {
    console.error('DELETE /api/trips/[id]/stays/[stayId] error:', e);
    return Response.json({ error: 'Failed to delete stay' }, { status: 500 });
  }
}
