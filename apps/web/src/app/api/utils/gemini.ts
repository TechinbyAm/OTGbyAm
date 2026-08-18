// Direct Gemini calls, replacing the anything.com `/integrations/*` proxy
// (which needs NEXT_PUBLIC_CREATE_BASE_URL — unavailable outside the
// platform's hosted sandbox). Uses GEMINI_API_KEY instead.
async function callGemini(systemPrompt: string, parts: Array<Record<string, unknown>>): Promise<any> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not set');
  }
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini error: ${err}`);
  }
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('No content returned from Gemini');
  }
  return JSON.parse(text);
}

export async function parseWithGemini(systemPrompt: string, userContent: string): Promise<any> {
  return callGemini(systemPrompt, [{ text: userContent }]);
}

// Attachments (PDF/image confirmations) sent as inline base64 — Gemini reads
// PDFs and images natively, no separate document-parsing service needed.
export async function parseAttachmentWithGemini(
  systemPrompt: string,
  fileBase64: string,
  mimeType: string
): Promise<any> {
  return callGemini(systemPrompt, [
    { inlineData: { mimeType, data: fileBase64 } },
    { text: 'Extract the booking details from this file.' },
  ]);
}
