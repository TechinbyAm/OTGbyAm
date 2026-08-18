import sql from '@/app/api/utils/sql';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; ticketId: string }> }
) {
  try {
    const { id: tripId, ticketId } = await params;
    const body = await request.json();
    const { name, date, time, location, confirmationNumber, notes } = body;
    await sql`
      UPDATE trip_tickets
      SET name = ${name}, date = ${date}, time = ${time}, location = ${location},
          confirmation_number = ${confirmationNumber}, notes = ${notes}
      WHERE id = ${ticketId} AND trip_id = ${tripId}
    `;
    // Keep the mirrored activity entry (if any) in sync with the ticket.
    await sql`
      UPDATE trip_activities
      SET date = ${date}, time = ${time}, title = ${name}, location = ${location}
      WHERE linked_ticket_id = ${ticketId} AND trip_id = ${tripId}
    `;
    return Response.json({ success: true });
  } catch (e) {
    console.error('PUT /api/trips/[id]/tickets/[ticketId] error:', e);
    return Response.json({ error: 'Failed to update ticket' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; ticketId: string }> }
) {
  try {
    const { id: tripId, ticketId } = await params;
    await sql`DELETE FROM trip_activities WHERE linked_ticket_id = ${ticketId} AND trip_id = ${tripId}`;
    await sql`DELETE FROM trip_tickets WHERE id = ${ticketId} AND trip_id = ${tripId}`;
    return Response.json({ success: true });
  } catch (e) {
    console.error('DELETE /api/trips/[id]/tickets/[ticketId] error:', e);
    return Response.json({ error: 'Failed to delete ticket' }, { status: 500 });
  }
}
