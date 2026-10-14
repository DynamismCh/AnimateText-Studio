type RequestLike = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
  socket?: { remoteAddress?: string };
};
type ResponseLike = { status: (code: number) => ResponseLike; json: (body: unknown) => void; setHeader?: (name: string, value: string) => void };

const limits = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60 * 60 * 1000;
const MAX_REQUESTS = 8;

function header(req: RequestLike, name: string): string {
  const entry = Object.entries(req.headers ?? {}).find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1];
  return Array.isArray(entry) ? entry[0] ?? '' : entry ?? '';
}
function wavHeader(dataLength: number, sampleRate = 24000, channels = 1, bitsPerSample = 16): Uint8Array {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const write = (offset: number, value: string) => { for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i)); };
  write(0, 'RIFF'); view.setUint32(4, 36 + dataLength, true); write(8, 'WAVE');
  write(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, channels, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * bitsPerSample / 8, true);
  view.setUint16(32, channels * bitsPerSample / 8, true); view.setUint16(34, bitsPerSample, true);
  write(36, 'data'); view.setUint32(40, dataLength, true);
  return new Uint8Array(header);
}

export default async function handler(req: RequestLike, res: ResponseLike) {
  res.setHeader?.('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader?.('Allow', 'POST'); return res.status(405).json({ error: 'Use POST to generate speech.' }); }
  const origin = header(req, 'origin');
  const host = header(req, 'x-forwarded-host') || header(req, 'host');
  if (origin && host) {
    try { if (new URL(origin).host !== host) return res.status(403).json({ error: 'This endpoint only accepts requests from AnimateText Studio.' }); }
    catch { return res.status(403).json({ error: 'The request origin could not be verified.' }); }
  }
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(503).json({ error: 'Speech generation is not connected. Add GEMINI_API_KEY to Vercel and redeploy.' });
  const ip = header(req, 'x-forwarded-for').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
  const now = Date.now(); const current = limits.get(ip);
  if (current && current.resetAt > now && current.count >= MAX_REQUESTS) return res.status(429).json({ error: 'The voice tool reached its temporary limit of 8 requests per hour. Please wait before trying again.' });
  limits.set(ip, current && current.resetAt > now ? { count: current.count + 1, resetAt: current.resetAt } : { count: 1, resetAt: now + WINDOW_MS });

  const body = (req.body && typeof req.body === 'object' ? req.body : {}) as {
    script?: unknown; sunnyVoice?: unknown; bloopVoice?: unknown; style?: unknown; speaker?: unknown;
  };
  const script = typeof body.script === 'string' ? body.script.trim().slice(0, 5000) : '';
  if (!script) return res.status(400).json({ error: 'Enter dialogue first.' });
  const speaker = body.speaker === 'Sunny' || body.speaker === 'Bloop' ? body.speaker : '';
  if (!speaker && !/(sunny|bloop)\s*:/i.test(script)) return res.status(400).json({ error: 'Write each line with a speaker label, for example Sunny: Hello! or Bloop: Hi!' });

  const sunnyVoice = typeof body.sunnyVoice === 'string' ? body.sunnyVoice : 'Kore';
  const bloopVoice = typeof body.bloopVoice === 'string' ? body.bloopVoice : 'Puck';
  const allowed = new Set(['Kore','Puck','Charon','Aoede','Leda','Orus','Zephyr','Fenrir']);
  if (!allowed.has(sunnyVoice) || !allowed.has(bloopVoice)) return res.status(400).json({ error: 'Choose one of the available built-in voices.' });
  const selectedVoice = speaker === 'Sunny' ? sunnyVoice : speaker === 'Bloop' ? bloopVoice : '';
  const style = typeof body.style === 'string' ? body.style.slice(0, 300) : 'Playful, warm, expressive children’s cartoon dialogue. Sunny sounds cheerful and friendly; Bloop sounds curious and funny. Speak clearly at a natural pace.';
  const model = process.env.GEMINI_TTS_MODEL || 'gemini-2.5-flash-preview-tts';

  try {
    const upstream = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(key), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: style + (speaker ? '\nRead only this character’s dialogue aloud. Do not add words or say the character name. Preserve the wording.\n\n' : '\nRead this dialogue aloud. The labels Sunny and Bloop identify different speakers and should not be spoken aloud. Preserve the dialogue wording.\n\n') + script }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: speaker
            ? { voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedVoice } } }
            : { multiSpeakerVoiceConfig: { speakerVoiceConfigs: [
                { speaker: 'Sunny', voiceConfig: { prebuiltVoiceConfig: { voiceName: sunnyVoice } } },
                { speaker: 'Bloop', voiceConfig: { prebuiltVoiceConfig: { voiceName: bloopVoice } } }
              ] } }
        }
      }),
      signal: AbortSignal.timeout(60000)
    });
    const payload = await upstream.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string }; text?: string }> } }>;
      error?: { message?: string };
    };
    if (!upstream.ok) {
      if (upstream.status === 429) return res.status(429).json({ error: 'Gemini speech quota or rate limit reached. Wait for the free allowance to reset, then try again.' });
      if (upstream.status === 401 || upstream.status === 403) return res.status(502).json({ error: 'Gemini rejected the API key or does not allow this speech model for your account. Check the key and free-tier model availability.' });
      return res.status(502).json({ error: 'Speech provider error (' + upstream.status + '): ' + String(payload.error?.message ?? upstream.statusText).slice(0, 350) });
    }
    const audioPart = payload.candidates?.[0]?.content?.parts?.find((part) => part.inlineData?.data);
    if (!audioPart?.inlineData?.data) return res.status(502).json({ error: 'Gemini returned no audio. Try a shorter dialogue.' });
    const audio = Buffer.from(audioPart.inlineData.data, 'base64');
    const mime = audioPart.inlineData.mimeType ?? 'audio/pcm';
    let wav: Buffer;
    if (mime.includes('wav')) wav = audio;
    else {
      const headerBytes = Buffer.from(wavHeader(audio.length));
      wav = Buffer.concat([headerBytes, audio]);
    }
    return res.status(200).json({ audioBase64: wav.toString('base64'), mimeType: 'audio/wav', model });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(502).json({ error: message.toLowerCase().includes('timeout') ? 'Speech generation took too long. Try a shorter dialogue.' : 'Could not reach the speech provider. Please try again later.' });
  }
}
