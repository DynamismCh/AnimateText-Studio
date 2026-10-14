import { Readable } from 'node:stream';

// Video responses can take longer than the default serverless function window.
export const config = { maxDuration: 60 };

const ALLOWED_HOSTS = ['hf.space', 'huggingface.co', 'hf.co'];

function isAllowedHost(hostname) {
  const host = hostname.toLowerCase();
  return ALLOWED_HOSTS.some((domain) => host === domain || host.endsWith('.' + domain));
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).json({ error: 'Use GET to load the generated video.' });
  }

  const rawUrl = typeof req.query?.url === 'string' ? req.query.url : '';
  if (!rawUrl) return res.status(400).json({ error: 'The video URL is missing.' });

  let target;
  try {
    target = new URL(rawUrl);
  } catch {
    return res.status(400).json({ error: 'The video URL is invalid.' });
  }

  if (target.protocol !== 'https:' || !isAllowedHost(target.hostname)) {
    return res.status(400).json({ error: 'The video must come from an approved Hugging Face video host.' });
  }

  try {
    const headers = {};
    if (req.headers.range) headers.Range = req.headers.range;
    const upstream = await fetch(target.toString(), { method: req.method, headers, redirect: 'follow' });

    if (!upstream.ok && upstream.status !== 206) {
      const status = upstream.status === 404 ? 404 : 502;
      return res.status(status).json({
        error: 'The generated video is no longer available from the model host.',
        detail: 'Try generating the clip again; hosted demo files can expire.'
      });
    }

    const contentType = upstream.headers.get('content-type') || 'video/mp4';
    if (!contentType.toLowerCase().startsWith('video/') && !contentType.toLowerCase().includes('octet-stream')) {
      const preview = await upstream.text().catch(() => '');
      return res.status(502).json({
        error: 'The model host did not return a video file to AnimateText Studio.',
        detail: `Received content type: ${contentType}. ${preview.slice(0, 180)}`
      });
    }
    res.status(upstream.status);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('Accept-Ranges', upstream.headers.get('accept-ranges') || 'bytes');
    const contentLength = upstream.headers.get('content-length');
    const contentRange = upstream.headers.get('content-range');
    if (contentLength) res.setHeader('Content-Length', contentLength);
    if (contentRange) res.setHeader('Content-Range', contentRange);

    const wantsDownload = req.query?.download === '1';
    res.setHeader('Content-Disposition', wantsDownload
      ? 'attachment; filename="wan-2-2-fast-character.mp4"'
      : 'inline; filename="wan-2-2-fast-character.mp4"');

    if (req.method === 'HEAD' || !upstream.body) return res.end();
    Readable.fromWeb(upstream.body).on('error', () => {
      if (!res.headersSent) res.status(502);
      res.end();
    }).pipe(res);
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown video proxy error.';
    return res.status(502).json({
      error: 'AnimateText Studio could not load the generated video.',
      detail: detail.slice(0, 300)
    });
  }
}
