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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const destination = searchParams.get('destination');
    const theme = searchParams.get('theme');

    let rows;
    if (destination && theme) {
      rows = await sql`
        SELECT * FROM discoveries
        WHERE destination ILIKE ${`%${destination}%`} AND theme_guess = ${theme}
        ORDER BY created_at DESC
      `;
    } else if (destination) {
      rows = await sql`
        SELECT * FROM discoveries WHERE destination ILIKE ${`%${destination}%`} ORDER BY created_at DESC
      `;
    } else if (theme) {
      rows = await sql`
        SELECT * FROM discoveries WHERE theme_guess = ${theme} ORDER BY created_at DESC
      `;
    } else {
      rows = await sql`SELECT * FROM discoveries ORDER BY created_at DESC`;
    }

    return Response.json(rows.map(mapRow));
  } catch (e) {
    console.error('GET /api/discoveries error:', e);
    return Response.json({ error: 'Failed to load discoveries' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, sourceUrl, platform, title, destination, themeGuess, notes, imageUrl } = body;

    if (!destination || !String(destination).trim()) {
      return Response.json({ error: 'Destination is required' }, { status: 400 });
    }

    await sql`
      INSERT INTO discoveries (id, source_url, platform, title, destination, theme_guess, notes, image_url, status)
      VALUES (${id}, ${sourceUrl ?? ''}, ${platform ?? 'manual'}, ${title ?? ''}, ${destination}, ${themeGuess ?? ''}, ${notes ?? ''}, ${imageUrl ?? ''}, 'new')
    `;
    return Response.json({ success: true });
  } catch (e) {
    console.error('POST /api/discoveries error:', e);
    return Response.json({ error: 'Failed to create discovery' }, { status: 500 });
  }
}
