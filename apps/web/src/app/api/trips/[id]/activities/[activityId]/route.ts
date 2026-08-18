import sql from '@/app/api/utils/sql';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; activityId: string }> }
) {
  try {
    const { id: tripId, activityId } = await params;
    const body = await request.json();
    const { date, time, title, description, location } = body;
    await sql`
      UPDATE trip_activities
      SET date = ${date}, time = ${time}, title = ${title}, description = ${description}, location = ${location}
      WHERE id = ${activityId} AND trip_id = ${tripId}
    `;
    return Response.json({ success: true });
  } catch (e) {
    console.error('PUT /api/trips/[id]/activities/[activityId] error:', e);
    return Response.json({ error: 'Failed to update activity' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; activityId: string }> }
) {
  try {
    const { id: tripId, activityId } = await params;
    await sql`DELETE FROM trip_activities WHERE id = ${activityId} AND trip_id = ${tripId}`;
    return Response.json({ success: true });
  } catch (e) {
    console.error('DELETE /api/trips/[id]/activities/[activityId] error:', e);
    return Response.json({ error: 'Failed to delete activity' }, { status: 500 });
  }
}
