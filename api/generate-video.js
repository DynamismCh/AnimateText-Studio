import { InferenceClient } from '@huggingface/inference';
import { Readable } from 'node:stream';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Use POST to generate a video.' });
  }

  const token = process.env.HF_TOKEN;
  if (!token) {
    return res.status(503).json({
      error: 'Text-to-video API is not configured yet. Add HF_TOKEN in the Vercel project environment variables. The token must have Inference Providers permission.'
    });
  }

  const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
  if (!prompt) return res.status(400).json({ error: 'Enter a story or video prompt first.' });
  if (prompt.length > 1800) return res.status(400).json({ error: 'Please keep the prompt under 1,800 characters.' });

  try {
    const client = new InferenceClient(token);
    const video = await client.textToVideo({
      inputs: prompt,
      model: 'Wan-AI/Wan2.1-T2V-1.3B:fal-ai'
    });
    if (!video || typeof video.arrayBuffer !== 'function') {
      throw new Error('The video provider returned an unexpected response.');
    }
    if (!video.size) throw new Error('The video provider returned an empty video.');
    res.setHeader('Content-Type', video.type || 'video/mp4');
    res.setHeader('Content-Disposition', 'inline; filename="animate-text-video.mp4"');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Length', String(video.size));
    return Readable.fromWeb(video.stream()).pipe(res);
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown provider error.';
    const lower = detail.toLowerCase();
    const status = lower.includes('unauthorized') || lower.includes('token') || lower.includes('permission') ? 502 : 503;
    return res.status(status).json({
      error: 'The text-to-video provider could not complete this request.',
      detail: detail.slice(0, 500),
      hint: 'Check the HF_TOKEN secret, provider access and available inference credits. Video generation may take longer than the serverless request limit.'
    });
  }
}
