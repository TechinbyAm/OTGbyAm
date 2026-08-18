export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const location = searchParams.get('location');
    if (!location) {
      return Response.json({ error: 'Missing location parameter' }, { status: 400 });
    }

    const apiKey = process.env.WEATHER_API_KEY;
    if (!apiKey) {
      console.error('WEATHER_API_KEY not set');
      return Response.json({ error: 'Weather API key not configured' }, { status: 500 });
    }

    const res = await fetch(
      `https://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${encodeURIComponent(location)}&aqi=no`
    );

    if (!res.ok) {
      console.error('WeatherAPI error:', res.status, await res.text());
      return Response.json({ error: 'Failed to fetch weather' }, { status: res.status });
    }

    const data = await res.json();

    // localtime comes back as "2024-01-15 14:30" — parse to "2:30 PM"
    const rawLocaltime: string = data.location?.localtime ?? '';
    let localtime = '';
    if (rawLocaltime) {
      const timePart = rawLocaltime.split(' ')[1] ?? '';
      const [hStr, mStr] = timePart.split(':');
      const h = parseInt(hStr, 10);
      const m = mStr ?? '00';
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 === 0 ? 12 : h % 12;
      localtime = `${h12}:${m} ${ampm}`;
    }

    return Response.json({
      temp_f: data.current.temp_f,
      temp_c: data.current.temp_c,
      condition: data.current.condition.text,
      icon: `https:${data.current.condition.icon}`,
      localtime,
    });
  } catch (e) {
    console.error('GET /api/weather error:', e);
    return Response.json({ error: 'Failed to fetch weather' }, { status: 500 });
  }
}
