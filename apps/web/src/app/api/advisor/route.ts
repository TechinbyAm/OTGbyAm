import { THEMES } from '@/utils/theme';

function fmtDate(d: string) {
  if (!d) return 'TBD';
  const dt = new Date(d + 'T00:00:00');
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function themeLabel(id: string) {
  return THEMES.find((t) => t.id === id)?.label ?? id;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { messages, trips } = body;

    const tripContext = trips?.length
      ? `Existing trips being planned:\n${trips
          .map(
            (t: {
              id: string;
              title: string;
              theme: string;
              destination: string;
              startDate: string;
              endDate: string;
              capacity: number;
              status: string;
            }) =>
              `- id=${t.id} | "${t.title || 'Untitled'}" | ${themeLabel(t.theme)} | ${t.destination || 'TBD'} | ${fmtDate(t.startDate)}–${fmtDate(t.endDate)} | cap ${t.capacity} | status: ${t.status}`
          )
          .join('\n')}`
      : 'No trips have been added yet.';

    const systemPrompt = `You are the AI travel advisor for "On The Go by Am," an upscale, small-group (max 10 guests) private trip brand. Themes on offer: ${THEMES.map((t) => t.label).join(', ')}.

IMPORTANT FORMATTING RULES:
- Never use markdown formatting. No asterisks, no bold (**text**), no italics (*text*), no pound signs for headers.
- Use plain text only. Use numbered lists (1. 2. 3.) or dashes (- item) for lists.
- Keep responses tight (under 150 words) unless the user asks for more depth.

ACTIVITY SUGGESTIONS:
- When asked to suggest activities, recommend specific, named experiences for the destination — not generic advice.
- Tailor suggestions to the trip theme: Coastal Reset = beach clubs, sunrise swims, boat days; Culinary Crawl = specific markets, chef's tables, food tours; Wellness Retreat = spas, sound baths, yoga studios; City Immersion = neighborhoods, galleries, local guides; Adventure Edge = hikes, dives, climbs; Slow Village = farmstays, walking routes, local artisans.
- When suggesting a full day plan, format it as: Day 1: [brief description]. Day 2: [brief description]. etc.

TWO DIFFERENT SAVE ACTIONS — pick the right one, they are not interchangeable:

1. ADDING ONE THING to an existing trip (e.g. "add a brunch on day 2", "book that hike for Tuesday", "add this to my Guatemala trip") — the user already has a trip in the list above and wants a single activity/meal/tour attached to it. Do NOT rewrite or restate the whole itinerary. End your response with this exact line on its own, using the real id= value from the trip list above:
ACTIVITY_DATA:{"tripId":"[the trip's id from the list above]","title":"[short activity name]","date":"[YYYY-MM-DD if known, else empty string]","time":"[HH:MM 24h if known, else empty string]","location":"[venue/area]","description":"[one line]"}
Only use this when the trip already exists in the list above — never invent a tripId.

2. PROPOSING OR SAVING A WHOLE NEW TRIP (no matching existing trip, or the user is planning from scratch) — end your response with this exact line on its own:
TRIP_DATA:{"title":"[trip title]","destination":"[city, country]","theme":"[one of: coastal-reset, culinary-crawl, wellness-retreat, city-immersion, adventure-edge, slow-village]","notes":"[Day 1: activity. Day 2: activity. Day 3: activity.]","startDate":"","endDate":"","capacity":8,"priceFrom":""}

You are aware of all trips including drafts — when a user references an existing trip by name or destination for a single addition, use ACTIVITY_DATA with that trip's real id. Only ever emit ONE of ACTIVITY_DATA or TRIP_DATA per response, never both.

Be specific, opinionated, and concise — like a well-traveled friend with great taste, not a generic bot.

${tripContext}`;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('GEMINI_API_KEY not set');
      return Response.json({ error: 'Advisor unavailable' }, { status: 502 });
    }

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:streamGenerateContent?alt=sse&key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: messages.map((m: { role: string; content: string }) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
          })),
        }),
      }
    );

    if (!res.ok || !res.body) {
      const err = await res.text();
      console.error('Gemini error:', err);
      return Response.json({ error: 'Advisor unavailable' }, { status: 502 });
    }

    // Gemini streams SSE frames of `{candidates:[{content:{parts:[{text}]}}]}`.
    // The frontend just concatenates raw text chunks, so unwrap each frame's
    // delta text and re-stream it as plain text.
    const geminiBody = res.body;
    const plainTextStream = new ReadableStream({
      async start(controller) {
        const reader = geminiBody.getReader();
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        let buffer = '';
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';
            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const jsonStr = line.slice(6).trim();
              if (!jsonStr) continue;
              try {
                const parsed = JSON.parse(jsonStr);
                const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text) controller.enqueue(encoder.encode(text));
              } catch {
                /* ignore malformed frame */
              }
            }
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(plainTextStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (e) {
    console.error('POST /api/advisor error:', e);
    return Response.json({ error: 'Failed to reach advisor' }, { status: 500 });
  }
}
