import sql from '@/app/api/utils/sql';
import { parseWithGemini } from '@/app/api/utils/gemini';
import {
  BOOKINGS_JSON_INSTRUCTIONS,
  insertBookings,
  summarizeResults,
  type ParsedBooking,
} from '@/app/api/utils/bookings';

type PostmarkInbound = {
  From: string;
  To: string;
  Subject: string;
  TextBody: string;
  HtmlBody: string;
};

const EMAIL_PARSER_PROMPT = `You are a travel booking email parser. Extract structured data from confirmation emails.
${BOOKINGS_JSON_INSTRUCTIONS}`;

export async function POST(request: Request) {
  try {
    const body: PostmarkInbound = await request.json();
    const { To, Subject, TextBody, HtmlBody } = body;

    // Extract trip ID from the To address (e.g. trip_abc123@yourdomain.com)
    const match = To.match(/trip_([a-zA-Z0-9_-]+)@/);
    if (!match) {
      console.error('Invalid trip email format:', To);
      return Response.json({ error: 'Invalid trip email' }, { status: 400 });
    }
    const tripId = `trip_${match[1]}`;

    // Verify trip exists
    const tripRows = await sql`SELECT id FROM trips WHERE id = ${tripId}`;
    if (tripRows.length === 0) {
      console.error('Trip not found:', tripId);
      return Response.json({ error: 'Trip not found' }, { status: 404 });
    }

    // Trim email body to avoid hitting token limits
    const emailContent = (TextBody || HtmlBody || '').slice(0, 8000);

    let parsed: { bookings: ParsedBooking[] };
    try {
      parsed = await parseWithGemini(EMAIL_PARSER_PROMPT, `Subject: ${Subject}\n\n${emailContent}`);
    } catch (err) {
      console.error('Gemini parsing error:', err);
      return Response.json({ error: 'AI parsing failed' }, { status: 500 });
    }

    console.log('Parsed email result:', JSON.stringify(parsed, null, 2));

    const bookings = parsed.bookings ?? [];
    if (bookings.length === 0) {
      console.error('No bookings identified in email');
      return Response.json({ error: 'Could not identify any bookings in the email' }, { status: 422 });
    }

    const results = await insertBookings(sql, tripId, bookings, 'Auto-populated from inbound email');
    const summary = summarizeResults(results);

    return Response.json({ success: true, ...summary });
  } catch (e) {
    console.error('POST /api/postmark-inbound error:', e);
    return Response.json({ error: 'Failed to process inbound email' }, { status: 500 });
  }
}
