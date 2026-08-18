import sql from '@/app/api/utils/sql';
import { parseAttachmentWithGemini } from '@/app/api/utils/gemini';
import {
  BOOKINGS_JSON_INSTRUCTIONS,
  insertBookings,
  summarizeResults,
  type ParsedBooking,
} from '@/app/api/utils/bookings';

const ATTACHMENT_PARSER_PROMPT = `You are a travel booking document parser. Extract structured booking data from the attached file (a confirmation PDF, screenshot, or photo of a booking — it may cover a single booking or a full itinerary with several).
${BOOKINGS_JSON_INSTRUCTIONS}`;

const ACCEPTED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/webp',
]);

// Inline base64 payloads are limited (Gemini caps requests around 20MB); 15MB
// of raw file leaves headroom after base64's ~33% size inflation.
const MAX_FILE_BYTES = 15 * 1024 * 1024;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: tripId } = await params;
    const body = await request.json();
    const { fileBase64, mimeType } = body;

    if (!fileBase64 || !mimeType) {
      return Response.json({ error: 'No file provided' }, { status: 400 });
    }
    if (!ACCEPTED_MIME_TYPES.has(mimeType)) {
      return Response.json({ error: `Unsupported file type: ${mimeType}` }, { status: 400 });
    }
    const approxBytes = (fileBase64.length * 3) / 4;
    if (approxBytes > MAX_FILE_BYTES) {
      return Response.json({ error: 'File too large (max 15MB)' }, { status: 400 });
    }

    const tripRows = await sql`SELECT id FROM trips WHERE id = ${tripId}`;
    if (tripRows.length === 0) {
      return Response.json({ error: 'Trip not found' }, { status: 404 });
    }

    let parsed: { bookings: ParsedBooking[] };
    try {
      parsed = await parseAttachmentWithGemini(ATTACHMENT_PARSER_PROMPT, fileBase64, mimeType);
    } catch (err) {
      console.error('Gemini attachment parse error:', err);
      return Response.json({ error: 'AI parsing failed' }, { status: 500 });
    }

    const bookings = parsed.bookings ?? [];
    if (bookings.length === 0) {
      return Response.json({ error: 'Could not identify any bookings in that file' }, { status: 422 });
    }

    const results = await insertBookings(sql, tripId, bookings, 'Added via attachment upload');
    const summary = summarizeResults(results);
    if (summary.count === 0 && summary.duplicateCount > 0) {
      return Response.json({ error: 'Already in this trip — nothing new to add' }, { status: 409 });
    }

    return Response.json({ success: true, ...summary });
  } catch (e) {
    console.error('POST /api/trips/[id]/parse-attachment error:', e);
    return Response.json({ error: 'Failed to parse attachment' }, { status: 500 });
  }
}
