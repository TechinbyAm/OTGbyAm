import sql from '@/app/api/utils/sql';
import { parseWithGemini } from '@/app/api/utils/gemini';
import {
  BOOKINGS_JSON_INSTRUCTIONS,
  insertBookings,
  summarizeResults,
  type ParsedBooking,
} from '@/app/api/utils/bookings';

const CONFIRMATION_PARSER_PROMPT = `You are a travel booking confirmation parser. Extract structured data from booking confirmations, receipts, or itinerary text.
${BOOKINGS_JSON_INSTRUCTIONS}`;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: tripId } = await params;
    const body = await request.json();
    const { text } = body;

    if (!text?.trim()) {
      return Response.json({ error: 'No confirmation text provided' }, { status: 400 });
    }

    // Verify trip exists
    const tripRows = await sql`SELECT id FROM trips WHERE id = ${tripId}`;
    if (tripRows.length === 0) {
      return Response.json({ error: 'Trip not found' }, { status: 404 });
    }

    let parsed: { bookings: ParsedBooking[] };
    try {
      parsed = await parseWithGemini(CONFIRMATION_PARSER_PROMPT, text.slice(0, 8000));
    } catch (err) {
      console.error('Gemini parse error:', err);
      return Response.json({ error: 'AI parsing failed' }, { status: 500 });
    }

    console.log('Manual parse result:', JSON.stringify(parsed, null, 2));

    const bookings = parsed.bookings ?? [];
    if (bookings.length === 0) {
      return Response.json({ error: 'Could not identify a booking in that text' }, { status: 422 });
    }

    const results = await insertBookings(sql, tripId, bookings, 'Added via manual confirmation parse');
    const summary = summarizeResults(results);
    if (summary.count === 0 && summary.duplicateCount > 0) {
      return Response.json({ error: 'Already in this trip — nothing new to add' }, { status: 409 });
    }

    return Response.json({ success: true, ...summary });
  } catch (e) {
    console.error('POST /api/trips/[id]/parse-confirmation error:', e);
    return Response.json({ error: 'Failed to parse confirmation' }, { status: 500 });
  }
}
