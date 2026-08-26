import sql from '@/app/api/utils/sql';

export async function GET() {
  try {
    const rows = await sql`
      SELECT * FROM trips ORDER BY created_at DESC
    `;
    const trips = rows.map((r) => ({
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
      sourceLinks: r.source_links ?? [],
    }));
    return Response.json(trips);
  } catch (e) {
    console.error('GET /api/trips error:', e);
    return Response.json({ error: 'Failed to load trips' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      id,
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
      sourceLinks,
    } = body;
    await sql`
      INSERT INTO trips (id, title, destination, theme, start_date, end_date, capacity, status, price_from, notes, affiliate_links, source_links)
      VALUES (${id}, ${title}, ${destination}, ${theme}, ${startDate}, ${endDate}, ${capacity}, ${status}, ${priceFrom}, ${notes}, ${JSON.stringify(affiliateLinks ?? [])}, ${JSON.stringify(sourceLinks ?? [])})
    `;
    return Response.json({ success: true });
  } catch (e) {
    console.error('POST /api/trips error:', e);
    return Response.json({ error: 'Failed to create trip' }, { status: 500 });
  }
}
