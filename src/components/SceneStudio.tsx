import { useEffect, useRef, useState } from 'react';
import { Download, Film, LoaderCircle, WandSparkles } from 'lucide-react';
import type { LocalCharacter } from '../lib/localCharacters';

type Action = 'walk' | 'run' | 'jump' | 'wave' | 'dance' | 'talk';
type Scene = { id: number; text: string; action: Action; background: number };
const backgrounds = [
  { sky: '#8ed8ff', ground: '#83d878' }, { sky: '#ffc7e5', ground: '#f4a8c7' },
  { sky: '#70d9ef', ground: '#229fc2' }, { sky: '#25305f', ground: '#404a80' },
  { sky: '#ffe3a1', ground: '#e6bd61' },
];
const starter = 'Sunny waves hello to Bloop in the park.\nThey walk together to explore a colourful garden.\nSuddenly, Bloop jumps with excitement when they find a giant flower!\nThe friends dance and laugh before heading home.';
function actionFor(text: string): Action {
  const s = text.toLowerCase();
  if (/run|chase|quickly|race/.test(s)) return 'run';
  if (/jump|leap|hop/.test(s)) return 'jump';
  if (/wave|hello|goodbye|greet/.test(s)) return 'wave';
  if (/dance|music|party/.test(s)) return 'dance';
  if (/walk|travel|explore|arrive/.test(s)) return 'walk';
  return 'talk';
}
function makeScenes(story: string): Scene[] {
  return story.split(/(?<=[.!?])\s+|\n+/).map((text) => text.trim()).filter(Boolean).slice(0, 6)
    .map((text, index) => ({ id: index + 1, text, action: actionFor(text), background: index % backgrounds.length }));
}

export default function SceneStudio({ characters }: { characters: LocalCharacter[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef(new Map<string, HTMLImageElement>());
  const scenesRef = useRef<Scene[]>(makeScenes(starter));
  const activeRef = useRef(false);
  const exportingRef = useRef(false);
  const startRef = useRef(0);
  const [title, setTitle] = useState('Sunny and Bloop: A Little Adventure');
  const [story, setStory] = useState(starter);
  const [scenes, setScenes] = useState<Scene[]>(() => makeScenes(starter));
  const [primary, setPrimary] = useState('');
  const [secondary, setSecondary] = useState('');
  const [previewing, setPreviewing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [status, setStatus] = useState('Write a short story, build scenes, preview, then export a video directly to your device.');
  const [exportUrl, setExportUrl] = useState('');

  useEffect(() => { scenesRef.current = scenes; }, [scenes]);
  useEffect(() => {
    setPrimary((current) => characters.some((c) => c.id === current) ? current : (characters[0]?.id || ''));
    setSecondary((current) => characters.some((c) => c.id === current) ? current : (characters[1]?.id || characters[0]?.id || ''));
    characters.forEach((character) => {
      if (!imagesRef.current.has(character.id)) {
        const image = new Image(); image.src = character.url; imagesRef.current.set(character.id, image);
      }
    });
  }, [characters]);
  useEffect(() => () => { activeRef.current = false; exportingRef.current = false; if (exportUrl) URL.revokeObjectURL(exportUrl); }, [exportUrl]);

  function draw(time: number, staticFrame = false) {
    const canvas = canvasRef.current, ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const w = canvas.width, h = canvas.height, list = scenesRef.current;
    const elapsed = staticFrame ? 0 : Math.max(0, (time - startRef.current) / 1000);
    const duration = 4, total = Math.max(1, list.length) * duration;
    const pos = elapsed % total, index = Math.min(Math.max(0, list.length - 1), Math.floor(pos / duration));
    const t = (pos % duration) / duration;
    const scene = list[index] || { id: 1, text: 'Add a story to begin.', action: 'talk' as Action, background: 0 };
    const bg = backgrounds[scene.background] || backgrounds[0];
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, bg.sky); gradient.addColorStop(1, bg.ground);
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,.65)';
    for (let i = 0; i < 5; i++) { const x = ((i * 153 + 30 + (scene.action === 'run' ? t * 80 : 0)) % (w + 80)) - 40; ctx.beginPath(); ctx.ellipse(x, 60 + (i % 2) * 35, 27, 11, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = bg.ground; ctx.fillRect(0, h * .72, w, h * .28);
    for (let i = 0; i < 6; i++) { const x = 25 + i * 112; ctx.fillStyle = '#397d43'; ctx.fillRect(x, h * .62, 5, h * .13); ctx.fillStyle = '#f5c94c'; ctx.beginPath(); ctx.arc(x + 2, h * .6, 17, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#54a65a'; ctx.beginPath(); ctx.arc(x - 7, h * .63, 11, 0, Math.PI * 2); ctx.fill(); }
    const ids = [primary, secondary].filter((id, i, all) => id && all.indexOf(id) === i).slice(0, 2);
    ids.forEach((id, i) => {
      const image = imagesRef.current.get(id); if (!image?.complete || !image.naturalWidth) return;
      let x = i === 0 ? w * .34 : w * .66, bob = Math.sin(t * Math.PI * 4 + i) * 4;
      if (scene.action === 'walk' || scene.action === 'run') x += Math.sin(t * Math.PI * 2) * (scene.action === 'run' ? 38 : 18) * (i === 0 ? 1 : -1);
      if (scene.action === 'jump') bob -= Math.abs(Math.sin(t * Math.PI * 2)) * 48;
      if (scene.action === 'dance') { bob -= Math.abs(Math.sin(t * Math.PI * 4)) * 20; x += Math.sin(t * Math.PI * 4 + i) * 18; }
      const scale = Math.min(w * .24 / image.naturalWidth, h * .58 / image.naturalHeight), iw = image.naturalWidth * scale, ih = image.naturalHeight * scale;
      ctx.save(); if (scene.action === 'wave') ctx.rotate(Math.sin(t * Math.PI * 6) * .035);
      ctx.drawImage(image, x - iw / 2, h * .68 - ih + bob, iw, ih); ctx.restore();
      if (scene.action === 'run') { ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 3; for (let m = 0; m < 3; m++) { ctx.beginPath(); ctx.moveTo(x - iw * .45 - m * 9, h * .68 - 20 - m * 10); ctx.lineTo(x - iw * .45 - 14 - m * 9, h * .68 - 20 - m * 10); ctx.stroke(); } }
    });
    ctx.fillStyle = 'rgba(13,22,43,.78)'; ctx.fillRect(18, h - 68, w - 36, 48);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 18px system-ui,sans-serif'; ctx.textAlign = 'center';
    const subtitle = scene.text.length > 76 ? scene.text.slice(0, 73) + '…' : scene.text;
    ctx.fillText(subtitle, w / 2, h - 39, w - 54);
    ctx.font = '12px system-ui,sans-serif'; ctx.textAlign = 'right'; ctx.fillText('SCENE ' + (index + 1) + ' / ' + list.length, w - 20, 24);
    if (!staticFrame) setSceneIndex(index);
  }

  useEffect(() => {
    let frame = 0;
    const loop = (time: number) => {
      if (activeRef.current || exportingRef.current) draw(time);
      else draw(0, true);
      if (activeRef.current || exportingRef.current) frame = requestAnimationFrame(loop);
    };
    draw(0, true);
    if (previewing || exporting) frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [previewing, exporting, scenes, primary, secondary]);

  function buildScenes() {
    const next = makeScenes(story);
    if (!next.length) { setStatus('Enter at least one sentence first.'); return; }
    setScenes(next); scenesRef.current = next; setSceneIndex(0);
    setStatus('Built ' + next.length + ' scenes locally. No WAN GPU credits were used.');
  }
  function togglePreview() {
    if (previewing) { activeRef.current = false; setPreviewing(false); setStatus('Preview paused.'); }
    else { startRef.current = performance.now(); activeRef.current = true; setPreviewing(true); setStatus('Previewing local scene animation.'); }
  }
  async function exportVideo() {
    const canvas = canvasRef.current;
    if (!canvas || !characters.length) { setStatus('Upload at least one character above first.'); return; }
    if (typeof MediaRecorder === 'undefined' || !canvas.captureStream) { setStatus('Use an updated Chrome or Edge browser to export video.'); return; }
    if (!scenes.length) { setStatus('Build scenes from your story first.'); return; }
    activeRef.current = false; setPreviewing(false); exportingRef.current = true; setExporting(true);
    setStatus('Rendering locally. Keep this tab open until the video downloads…');
    const stream = canvas.captureStream(24);
    try {
      const mime = ['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find((type) => MediaRecorder.isTypeSupported(type)) || '';
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      const stopped = new Promise<Blob>((resolve, reject) => {
        recorder.onstop = () => { const blob = new Blob(chunks, { type: recorder.mimeType || 'video/webm' }); blob.size ? resolve(blob) : reject(new Error('The exported video was empty. Try again.')); };
        recorder.onerror = () => reject(new Error('Browser video encoding failed. Try fewer scenes.'));
      });
      startRef.current = performance.now(); recorder.start(250);
      await new Promise((resolve) => window.setTimeout(resolve, Math.min(scenes.length * 4000, 24000)));
      exportingRef.current = false; if (recorder.state !== 'inactive') recorder.stop();
      const blob = await stopped, url = URL.createObjectURL(blob);
      setExportUrl((old) => { if (old) URL.revokeObjectURL(old); return url; });
      const safeTitle = (title.trim() || 'animate-text-episode').replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 60);
      const link = document.createElement('a'); link.href = url; link.download = safeTitle + '.webm'; document.body.appendChild(link); link.click(); link.remove();
      setStatus('Video downloaded to this device as WebM. It is not uploaded to cloud storage.');
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Could not export the episode.'); }
    finally { exportingRef.current = false; setExporting(false); stream.getTracks().forEach((track) => track.stop()); }
  }

  return <section className="wan-panel scene-studio-panel">
    <h2><Film size={19} /> 4. Lightweight scene-to-video studio</h2>
    <p className="wan-help">Turn a story into short animated scenes without WAN GPU credits. This first version uses a lightweight local scene planner and procedural 2D motion, then exports a WebM video in your browser. It is not yet a full AI video diffusion model.</p>
    <div className="scene-studio-grid">
      <div className="scene-studio-controls">
        <label className="wan-label" htmlFor="scene-title">Episode title</label><input id="scene-title" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} />
        <label className="wan-label" htmlFor="scene-story">Story / script</label><textarea id="scene-story" value={story} onChange={(e) => setStory(e.target.value)} rows={5} maxLength={2400} placeholder="Write one sentence per scene…" />
        <div className="scene-studio-buttons"><button className="wan-generate" onClick={buildScenes} disabled={exporting}><WandSparkles size={17} /> Build scenes</button><button className="wan-download" onClick={togglePreview} disabled={exporting}>{previewing ? 'Pause preview' : 'Preview animation'}</button></div>
        <label className="wan-label" htmlFor="scene-primary">Main character</label><select id="scene-primary" value={primary} onChange={(e) => setPrimary(e.target.value)} disabled={!characters.length}>{!characters.length && <option value="">Upload a character above first</option>}{characters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <label className="wan-label" htmlFor="scene-secondary">Second character</label><select id="scene-secondary" value={secondary} onChange={(e) => setSecondary(e.target.value)} disabled={!characters.length}>{characters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <button className="wan-download" onClick={() => void exportVideo()} disabled={exporting || !characters.length}>{exporting ? <><LoaderCircle className="wan-spin" size={17} /> Rendering episode…</> : <><Download size={17} /> Export &amp; download video</>}</button>
        <p className="wan-status" aria-live="polite">{status}</p><p className="wan-help">Transparent character images work best. Rendering uses your computer, so keep scenes short on low-memory laptops.</p>
      </div>
      <div className="scene-studio-preview"><canvas ref={canvasRef} width={800} height={450} aria-label="Local animated episode preview" />
        <div className="scene-studio-scene-list">{scenes.map((scene, index) => <div className={'scene-studio-scene ' + (index === sceneIndex ? 'active' : '')} key={scene.id}><strong>Scene {index + 1} · {scene.action}</strong><span>{scene.text}</span></div>)}</div>
        {exportUrl && <div className="scene-studio-export"><strong>Last exported video</strong><video controls playsInline src={exportUrl} /><a href={exportUrl} download={(title || 'episode') + '.webm'}>Download again</a></div>}
      </div>
    </div>
  </section>;
}
