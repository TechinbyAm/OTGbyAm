import sql from '@/app/api/utils/sql';

function mapRow(r: any) {
  return {
    id: r.id,
    sourceUrl: r.source_url ?? '',
    platform: r.platform ?? 'manual',
    title: r.title ?? '',
    destination: r.destination ?? '',
    themeGuess: r.theme_guess ?? '',
    notes: r.notes ?? '',
    imageUrl: r.image_url ?? '',
    status: r.status,
    promotedTripId: r.promoted_trip_id ?? null,
    createdAt: r.created_at,
  };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const rows = await sql`SELECT * FROM discoveries WHERE id = ${id}`;
    if (rows.length === 0) {
      return Response.json({ error: 'Discovery not found' }, { status: 404 });
    }
    return Response.json(mapRow(rows[0]));
  } catch (e) {
    console.error('GET /api/discoveries/[id] error:', e);
    return Response.json({ error: 'Failed to load discovery' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { sourceUrl, platform, title, destination, themeGuess, notes, imageUrl, status } = body;

    if (!destination || !String(destination).trim()) {
      return Response.json({ error: 'Destination is required' }, { status: 400 });
    }

    const existing = await sql`SELECT id FROM discoveries WHERE id = ${id}`;
    if (existing.length === 0) {
      return Response.json({ error: 'Discovery not found' }, { status: 404 });
    }

    await sql`
      UPDATE discoveries
      SET
        source_url = ${sourceUrl ?? ''},
        platform = ${platform ?? 'manual'},
        title = ${title ?? ''},
        destination = ${destination},
        theme_guess = ${themeGuess ?? ''},
        notes = ${notes ?? ''},
        image_url = ${imageUrl ?? ''},
        status = ${status ?? 'new'}
      WHERE id = ${id}
    `;
    return Response.json({ success: true });
  } catch (e) {
    console.error('PUT /api/discoveries/[id] error:', e);
    return Response.json({ error: 'Failed to update discovery' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await sql`DELETE FROM discoveries WHERE id = ${id}`;
    return Response.json({ success: true });
  } catch (e) {
    console.error('DELETE /api/discoveries/[id] error:', e);
    return Response.json({ error: 'Failed to delete discovery' }, { status: 500 });
  }
}
