import { Client, handle_file } from '@gradio/client';

export const config = {
  maxDuration: 60,
  api: { bodyParser: { sizeLimit: '4mb' } }
};

const SPACE = 'zerogpu-aoti/wan2-2-fp8da-aoti-faster';
const SPACE_URL = 'https://zerogpu-aoti-wan2-2-fp8da-aoti-faster.hf.space';
const NEGATIVE_PROMPT = 'blurry, distorted body, extra limbs, flicker, text, watermark, static image';

function findVideo(value) {
  if (!value) return '';
  if (typeof value === 'string') {
    if (/^https?:\/\//i.test(value)) return value;
    if (value.startsWith('/')) return SPACE_URL + value;
    return '';
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findVideo(item);
      if (found) return found;
    }
    return '';
  }
  if (typeof value === 'object') {
    if (typeof value.url === 'string' && value.url) {
      return value.url.startsWith('/') ? SPACE_URL + value.url : value.url;
    }
    for (const key of ['video', 'output', 'data', 'value', 'files', 'path']) {
      if (key in value) {
        const found = findVideo(value[key]);
        if (found) return found;
      }
    }
  }
  return '';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Use POST to generate a video.' });
  }

  const imageBase64 = typeof req.body?.imageBase64 === 'string' ? req.body.imageBase64 : '';
  const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
  if (!imageBase64) return res.status(400).json({ error: 'Choose a character image first.' });
  if (imageBase64.length > 3_600_000) return res.status(413).json({ error: 'The image is too large. Try a smaller character image.' });
  if (!prompt) return res.status(400).json({ error: 'Enter a motion prompt first.' });

  try {
    const imageBuffer = Buffer.from(imageBase64, 'base64');
    const client = await Client.connect(SPACE, { timeout: 60000 });
    const result = await client.predict('/generate_video', [
      handle_file(imageBuffer),
      prompt.slice(0, 1200),
      4,
      NEGATIVE_PROMPT,
      2.5,
      1,
      1,
      42,
      true
    ]);
    const videoUrl = findVideo(result?.data?.[0] ?? result?.data);
    if (!videoUrl) {
      return res.status(502).json({
        error: 'Wan 2.2 Fast responded, but the app could not identify its video output.',
        detail: 'Open the Space API page to check whether its output format has changed.'
      });
    }
    return res.status(200).json({ videoUrl });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown upstream error.';
    const lower = detail.toLowerCase();
    const status = lower.includes('timeout') || lower.includes('timed out') ? 504 : 502;
    return res.status(status).json({
      error: 'AnimateText Studio could not complete the Wan 2.2 Fast request.',
      detail: detail.slice(0, 500),
      hint: 'The public Space may be busy, require a free-account login, or have exhausted its available GPU quota. No paid provider key is used by this route.'
    });
  }
}
