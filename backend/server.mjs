import { createServer } from 'node:http';
import { mkdir, readFile, writeFile, unlink, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const root = process.cwd();
const dataRoot = path.join(root, 'data');
const characterRoot = path.join(dataRoot, 'characters');
const sceneRoot = path.join(dataRoot, 'scenes');
const port = Number(process.env.PORT || 8787);
const maxBodyBytes = 12 * 1024 * 1024;

await Promise.all([mkdir(characterRoot, { recursive: true }), mkdir(sceneRoot, { recursive: true })]);

const mimeExtensions = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
};

function send(res, status, value, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
  res.end(type.startsWith('application/json') ? JSON.stringify(value) : value);
}

async function bodyJson(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (Buffer.byteLength(raw) > maxBodyBytes) throw new Error('Request is too large. Please use a smaller character image.');
  }
  return raw ? JSON.parse(raw) : {};
}

function safeName(value) {
  return String(value || 'character').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 48) || 'character';
}

function sceneSvg(index, story) {
  const palettes = [
    ['#b7e7ff', '#e9f8ff', '#71bf76', '#3e8d5a'],
    ['#ffdfb0', '#fff4d6', '#e6a65b', '#a95c4a'],
    ['#c9c4ff', '#f3eaff', '#86c5a1', '#467d71'],
    ['#a8e4e0', '#e4fbf6', '#8fc56f', '#477c48'],
  ];
  const [sky, glow, hill, ground] = palettes[index % palettes.length];
  const sunX = [1030, 210, 1020, 260][index % 4];
  const title = ['A bright new day', 'A surprising discovery', 'A little challenge', 'A happy ending'][index % 4];
  const safeTitle = title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
    <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${sky}"/><stop offset="1" stop-color="${glow}"/></linearGradient></defs>
    <rect width="1280" height="720" fill="url(#sky)"/>
    <circle cx="${sunX}" cy="130" r="65" fill="#fff4a8" opacity=".9"/>
    <g fill="#fff" opacity=".7"><ellipse cx="270" cy="150" rx="95" ry="24"/><ellipse cx="320" cy="135" rx="52" ry="32"/><ellipse cx="820" cy="220" rx="115" ry="27"/><ellipse cx="870" cy="202" rx="55" ry="34"/></g>
    <path d="M0 430 Q180 300 370 420 T760 410 T1280 385 V720 H0Z" fill="${hill}"/>
    <path d="M0 535 Q220 455 430 540 T850 510 T1280 520 V720 H0Z" fill="${ground}"/>
    <path d="M480 720 Q560 620 625 555 Q700 495 760 500 Q810 520 855 720Z" fill="#f3e1a2" opacity=".85"/>
    <g fill="#fff" opacity=".65"><circle cx="150" cy="560" r="5"/><circle cx="210" cy="610" r="4"/><circle cx="1050" cy="570" r="5"/><circle cx="1110" cy="630" r="4"/></g>
    <g transform="translate(130 300)" opacity=".8"><rect x="0" y="65" width="22" height="130" rx="8" fill="#805a42"/><circle cx="10" cy="40" r="68" fill="#4d9c65"/><circle cx="-30" cy="75" r="45" fill="#65b875"/><circle cx="47" cy="78" r="46" fill="#3d8c59"/></g>
    <g transform="translate(1080 320)" opacity=".85"><rect x="0" y="60" width="22" height="130" rx="8" fill="#805a42"/><circle cx="10" cy="35" r="70" fill="#4d9c65"/><circle cx="-30" cy="72" r="45" fill="#65b875"/><circle cx="47" cy="78" r="46" fill="#3d8c59"/></g>
    <text x="640" y="85" text-anchor="middle" font-family="Verdana, sans-serif" font-size="28" font-weight="700" fill="#264653" opacity=".85">${safeTitle}</text>
  </svg>`;
}

function makeShots(idea, characters) {
  const story = idea.trim().replace(/\s+/g, ' ').slice(0, 1200);
  const names = characters.map((c) => c.name);
  const lead = names[0] || 'Our hero';
  const friend = names[1] || 'a new friend';
  const third = names[2];
  const dialogue = [
    `${lead}: What a wonderful day to explore!`,
    `${lead}: Look what I found! ${friend}, come and see!`,
    `${friend}: We can solve this together!`,
    third ? `${lead}: We did it together, ${friend} and ${third}!` : `${lead}: Working together makes every adventure better!`,
  ];
  const texts = [
    `${lead} begins an adventure. ${story}`,
    `${lead} discovers something unexpected and calls for help.`,
    `${lead} and ${friend} work together to solve the problem.`,
    `The friends celebrate their discovery and learn something new.`,
  ];
  return texts.map((text, i) => ({
    text: text.slice(0, 180),
    dialogue: dialogue[i].slice(0, 180),
    duration: 5,
    motion: ['walk', 'run', 'bounce', 'idle'][i],
    camera: ['wide', 'medium', 'close', 'wide'][i],
    expression: ['curious', 'surprised', 'excited', 'happy'][i],
    interaction: ['Starting the adventure', 'Sharing a discovery', 'Helping each other', 'Celebrating together'][i],
    imageUrl: `/media/scenes/scene-${i}.svg`,
    actorActions: characters.map((c, ci) => ({
      characterId: c.id,
      action: i === 0 ? (ci === 0 ? 'walk' : 'idle') : i === 1 ? (ci === 0 ? 'run' : 'meet') : i === 2 ? (ci === 0 ? 'talk' : 'jump') : 'idle',
      expression: ['curious', 'excited', 'happy', 'smile'][i],
      x: Math.max(18, Math.min(82, 28 + ci * (characters.length > 1 ? 38 / (characters.length - 1) : 0))),
    })),
  }));
}

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, '');
  const url = new URL(req.url || '/', 'http://localhost');
  try {
    if (req.method === 'GET' && url.pathname.startsWith('/media/')) {
      const relative = decodeURIComponent(url.pathname.slice('/media/'.length));
      const target = path.resolve(dataRoot, relative);
      if (!target.startsWith(dataRoot + path.sep)) return send(res, 400, { message: 'Invalid file path.' });
      if (!existsSync(target)) return send(res, 404, { message: 'File not found.' });
      const ext = path.extname(target).toLowerCase();
      const type = ext === '.svg' ? 'image/svg+xml' : ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.webp' ? 'image/webp' : 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': type, 'Access-Control-Allow-Origin': '*' });
      return res.end(await readFile(target));
    }

    if (req.method === 'POST' && url.pathname === '/api/characters') {
      const b = await bodyJson(req);
      if (!b.data || !b.mimeType || !String(b.mimeType).startsWith('image/')) return send(res, 400, { message: 'Please provide a valid image.' });
      const ext = mimeExtensions[b.mimeType];
      if (!ext) return send(res, 400, { message: 'Please use PNG, JPG, WEBP or GIF character images.' });
      const id = randomUUID();
      const filename = id + ext;
      await writeFile(path.join(characterRoot, filename), Buffer.from(b.data, 'base64'));
      return send(res, 201, { character: { id, name: safeName(b.name), url: `/media/characters/${filename}`, path: `characters/${filename}` } });
    }

    if (req.method === 'DELETE' && url.pathname.startsWith('/api/characters/')) {
      const id = url.pathname.split('/').pop();
      const files = await readdir(characterRoot);
      for (const file of files.filter((name) => name.startsWith(id + '.'))) await unlink(path.join(characterRoot, file));
      return send(res, 200, { deleted: true });
    }

    if (req.method === 'POST' && url.pathname === '/api/create-episode') {
      const b = await bodyJson(req);
      if (!b.idea?.trim() || !Array.isArray(b.characters) || !b.characters.length) return send(res, 400, { message: 'A story and at least one character are required.' });
      const characters = b.characters.slice(0, 3).filter((c) => typeof c.id === 'string' && typeof c.name === 'string');
      if (!characters.length) return send(res, 400, { message: 'Please select at least one valid character.' });
      for (let i = 0; i < 4; i++) {
        const svg = sceneSvg(i, b.idea);
        await writeFile(path.join(sceneRoot, `scene-${i}.svg`), svg, 'utf8');
      }
      return send(res, 200, { episode: { title: String(b.episodeTitle || 'Episode 1').slice(0, 100), logline: String(b.idea).slice(0, 300), shots: makeShots(String(b.idea), characters) } });
    }

    if (req.method === 'GET' && url.pathname === '/api/health') return send(res, 200, { ok: true, mode: 'free-local' });
    return send(res, 404, { message: 'Route not found.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    const status = message.includes('too large') ? 413 : 500;
    return send(res, status, { message });
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`AnimateText Studio local backend listening on http://localhost:${port}`);
});
