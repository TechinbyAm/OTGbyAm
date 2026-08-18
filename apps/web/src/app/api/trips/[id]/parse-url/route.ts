import sql from '@/app/api/utils/sql';
import { parseWithGemini } from '@/app/api/utils/gemini';
import {
  BOOKINGS_JSON_INSTRUCTIONS,
  insertBookings,
  summarizeResults,
  type ParsedBooking,
} from '@/app/api/utils/bookings';

const URL_PARSER_PROMPT = `You are a travel booking page parser. Extract structured booking data from web page content.
${BOOKINGS_JSON_INSTRUCTIONS}`;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: tripId } = await params;
    const body = await request.json();
    const { url } = body;

    if (!url?.trim()) {
      return Response.json({ error: 'No URL provided' }, { status: 400 });
    }

    // Verify trip exists
    const tripRows = await sql`SELECT id FROM trips WHERE id = ${tripId}`;
    if (tripRows.length === 0) {
      return Response.json({ error: 'Trip not found' }, { status: 404 });
    }

    // Fetch the URL content
    let pageText = '';
    try {
      const pageRes = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TripAdvisorBot/1.0)' },
        signal: AbortSignal.timeout(10000),
      });
      if (!pageRes.ok) throw new Error(`Fetch failed: ${pageRes.status}`);
      const html = await pageRes.text();
      // Strip HTML tags for cleaner text
      pageText = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim()
        .slice(0, 8000);
    } catch (fetchErr) {
      console.error('URL fetch error:', fetchErr);
      return Response.json(
        { error: 'Could not fetch that URL. Try pasting the text directly.' },
        { status: 422 }
      );
    }

    let parsed: { bookings: ParsedBooking[] };
    try {
      parsed = await parseWithGemini(URL_PARSER_PROMPT, `URL: ${url}\n\nPage content:\n${pageText}`);
    } catch (err) {
      console.error('Gemini URL parse error:', err);
      return Response.json({ error: 'AI parsing failed' }, { status: 500 });
    }

    const bookings = parsed.bookings ?? [];
    if (bookings.length === 0) {
      return Response.json({ error: 'Could not identify any bookings at that URL' }, { status: 422 });
    }

    const results = await insertBookings(sql, tripId, bookings, 'Added via URL parse');
    const summary = summarizeResults(results);
    if (summary.count === 0 && summary.duplicateCount > 0) {
      return Response.json({ error: 'Already in this trip — nothing new to add' }, { status: 409 });
    }

    return Response.json({ success: true, ...summary });
  } catch (e) {
    console.error('POST /api/trips/[id]/parse-url error:', e);
    return Response.json({ error: 'Failed to parse URL' }, { status: 500 });
  }
}
