export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const input = searchParams.get('input') || '';

    if (!input || input.length < 2) {
      return Response.json({ predictions: [] });
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      console.error('GOOGLE_PLACES_API_KEY not set');
      return Response.json({ predictions: [] });
    }

    const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'suggestions.placePrediction.text,suggestions.placePrediction.placeId',
      },
      body: JSON.stringify({
        input,
        includedPrimaryTypes: ['locality', 'administrative_area_level_3'],
      }),
    });

    if (!res.ok) {
      console.error('Places API error:', res.status, await res.text());
      return Response.json({ predictions: [] });
    }

    const data = await res.json();
    const predictions = (data.suggestions || []).map(
      (s: { placePrediction: { text: { text: string }; placeId: string } }) => ({
        description: s.placePrediction.text.text,
        place_id: s.placePrediction.placeId,
      })
    );
    return Response.json({ predictions });
  } catch (e) {
    console.error('GET /api/places error:', e);
    return Response.json({ predictions: [] });
  }
}
