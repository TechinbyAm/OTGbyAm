import sql from '@/app/api/utils/sql';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const rows = await sql`SELECT * FROM trips WHERE id = ${id}`;
    if (rows.length === 0) {
      return Response.json({ error: 'Trip not found' }, { status: 404 });
    }
    const r = rows[0];
    const trip = {
      id: r.id,
      title: r.title,
      destination: r.destination,
      theme: r.theme,
      startDate: r.start_date,
      endDate: r.end_date,
      capacity: r.capacity,
      status: r.status,
      priceFrom: r.price_from,
      notes: r.notes,
      affiliateLinks: r.affiliate_links ?? [],
      tripEmail: r.trip_email ?? '',
    };
    return Response.json(trip);
  } catch (e) {
    console.error('GET /api/trips/[id] error:', e);
    return Response.json({ error: 'Failed to load trip' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      title,
      destination,
      theme,
      startDate,
      endDate,
      capacity,
      status,
      priceFrom,
      notes,
      affiliateLinks,
    } = body;
    await sql`
      UPDATE trips
      SET
        title = ${title},
        destination = ${destination},
        theme = ${theme},
        start_date = ${startDate},
        end_date = ${endDate},
        capacity = ${capacity},
        status = ${status},
        price_from = ${priceFrom},
        notes = ${notes},
        affiliate_links = ${JSON.stringify(affiliateLinks ?? [])}
      WHERE id = ${id}
    `;
    return Response.json({ success: true });
  } catch (e) {
    console.error('PUT /api/trips/[id] error:', e);
    return Response.json({ error: 'Failed to update trip' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await sql`DELETE FROM trips WHERE id = ${id}`;
    return Response.json({ success: true });
  } catch (e) {
    console.error('DELETE /api/trips/[id] error:', e);
    return Response.json({ error: 'Failed to delete trip' }, { status: 500 });
  }
}
