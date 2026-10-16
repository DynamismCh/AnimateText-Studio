import { useEffect, useRef, useState } from 'react';
import { AudioLines, Download, Film, LoaderCircle, Music2, Upload, WandSparkles } from 'lucide-react';
import type { LocalCharacter } from '../lib/localCharacters';
import { getMotionFrame } from '../lib/lightweightMotionEngine';

type Action = 'walk' | 'run' | 'jump' | 'wave' | 'dance' | 'talk';
type Scene = { id: number; text: string; action: Action; background: number; duration: number };
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
    .map((text, index) => ({ id: index + 1, text, action: actionFor(text), background: index % backgrounds.length, duration: 4 }));
}

export default function SceneStudio({ characters }: { characters: LocalCharacter[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef(new Map<string, HTMLImageElement>());
  const scenesRef = useRef<Scene[]>(makeScenes(starter));
  const activeRef = useRef(false);
  const exportingRef = useRef(false);
  const startRef = useRef(0);
  const lastSceneIndexRef = useRef(-1);
  const [title, setTitle] = useState('Sunny and Bloop: A Little Adventure');
  const [story, setStory] = useState(starter);
  const [scenes, setScenes] = useState<Scene[]>(() => makeScenes(starter));
  const [primary, setPrimary] = useState('');
  const [secondary, setSecondary] = useState('');
  const [previewing, setPreviewing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [status, setStatus] = useState('Write a short story, build scenes, preview, then export a video directly to your device.');
  const [exportUrl, setExportUrl] = useState('');
  const [dialogueUrl, setDialogueUrl] = useState('');
  const [musicUrl, setMusicUrl] = useState('');
  const [effectsUrl, setEffectsUrl] = useState('');
  const [dialogueName, setDialogueName] = useState('');
  const [musicName, setMusicName] = useState('');
  const [effectsName, setEffectsName] = useState('');
  const dialogueRef = useRef('');
  const musicRef = useRef('');
  const effectsRef = useRef('');

  useEffect(() => { scenesRef.current = scenes; }, [scenes]);
  useEffect(() => {
    setPrimary((current) => characters.some((c) => c.id === current) ? current : (characters[0]?.id || ''));
    setSecondary((current) => characters.some((c) => c.id === current) ? current : (characters[1]?.id || characters[0]?.id || ''));
    characters.forEach((character) => {
      if (!imagesRef.current.has(character.id)) {
        const image = new Image(); image.onload = () => window.requestAnimationFrame(() => draw(0, true)); image.src = character.url; imagesRef.current.set(character.id, image);
      }
    });
  }, [characters]);
  useEffect(() => () => { activeRef.current = false; exportingRef.current = false; [exportUrl, dialogueRef.current, musicRef.current, effectsRef.current].forEach((url) => { if (url) URL.revokeObjectURL(url); }); }, [exportUrl]);

  function loadAudio(file: File | undefined, kind: 'dialogue' | 'music' | 'effects') {
    if (!file) return;
    if (!file.type.startsWith('audio/')) { setStatus('Please choose an audio file such as WAV, MP3, or OGG.'); return; }
    const url = URL.createObjectURL(file);
    if (kind === 'dialogue') { if (dialogueRef.current) URL.revokeObjectURL(dialogueRef.current); dialogueRef.current = url; setDialogueUrl(url); setDialogueName(file.name); }
    if (kind === 'music') { if (musicRef.current) URL.revokeObjectURL(musicRef.current); musicRef.current = url; setMusicUrl(url); setMusicName(file.name); }
    if (kind === 'effects') { if (effectsRef.current) URL.revokeObjectURL(effectsRef.current); effectsRef.current = url; setEffectsUrl(url); setEffectsName(file.name); }
    setStatus('Audio track loaded locally. It will be included when you export the episode.');
  }

  function draw(time: number, staticFrame = false) {
    const canvas = canvasRef.current, ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const w = canvas.width, h = canvas.height, list = scenesRef.current;
    const elapsed = staticFrame ? 0 : Math.max(0, (time - startRef.current) / 1000);
    const total = Math.max(1, list.reduce((sum, item) => sum + item.duration, 0));
    let pos = elapsed % total, index = 0;
    while (index < list.length - 1 && pos >= list[index].duration) { pos -= list[index].duration; index++; }
    const scene = list[index] || { id: 1, text: 'Add a story to begin.', action: 'talk' as Action, background: 0, duration: 4 };
    const t = Math.min(1, pos / Math.max(1, scene.duration));
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
      const motion = getMotionFrame(scene.action, t, i);
      const centerX = (i === 0 ? w * .34 : w * .66) + motion.x;
      const baseY = h * .68;
      const bob = motion.y;
      const scale = Math.min(w * .24 / image.naturalWidth, h * .58 / image.naturalHeight);
      const iw = image.naturalWidth * scale, ih = image.naturalHeight * scale;

      // Ground shadow makes jumps and hops easier to read without a GPU model.
      ctx.save();
      ctx.fillStyle = 'rgba(24,45,48,.2)';
      ctx.beginPath();
      ctx.ellipse(centerX, baseY + 4, Math.max(12, iw * .28 * motion.shadowScale), Math.max(3, ih * .025), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      if (motion.speedLines) {
        ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.78)'; ctx.lineWidth = 3;
        for (let m = 0; m < 3; m++) {
          const lineY = baseY - 24 - m * 14 + Math.sin(t * Math.PI * 8 + m) * 3;
          ctx.beginPath(); ctx.moveTo(centerX - iw * .52 - m * 8, lineY); ctx.lineTo(centerX - iw * .52 - 18 - m * 8, lineY); ctx.stroke();
        }
        ctx.restore();
      }

      ctx.save();
      ctx.translate(centerX, baseY + bob);
      ctx.rotate(motion.rotation);
      ctx.scale(motion.scaleX, motion.scaleY);
      ctx.drawImage(image, -iw / 2, -ih, iw, ih);
      ctx.restore();

      if (motion.sparkles) {
        ctx.save(); ctx.fillStyle = '#fff5a6';
        for (let s = 0; s < 3; s++) {
          const sparkleX = centerX + Math.sin(t * Math.PI * 4 + s * 2.1) * (iw * .42);
          const sparkleY = baseY - ih * (.72 + (s % 2) * .13) + Math.cos(t * Math.PI * 4 + s) * 8 + bob;
          ctx.beginPath(); ctx.arc(sparkleX, sparkleY, 3 + (s % 2), 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      }

      if (scene.action === 'talk' && motion.interaction > 0.35 && i === (Math.floor(t * 2) % Math.max(1, ids.length))) {
        const bubbleX = centerX + (i === 0 ? iw * .25 : -iw * .25);
        const bubbleY = baseY - ih - 24 + bob;
        ctx.save(); ctx.fillStyle = 'rgba(255,255,255,.94)';
        ctx.beginPath(); ctx.ellipse(bubbleX, bubbleY, 19, 12, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#44536a';
        for (let dot = 0; dot < 3; dot++) { ctx.beginPath(); ctx.arc(bubbleX - 7 + dot * 7, bubbleY, 2, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
      }
    });
    ctx.fillStyle = 'rgba(13,22,43,.78)'; ctx.fillRect(18, h - 68, w - 36, 48);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 18px system-ui,sans-serif'; ctx.textAlign = 'center';
    const subtitle = scene.text.length > 76 ? scene.text.slice(0, 73) + '…' : scene.text;
    ctx.fillText(subtitle, w / 2, h - 39, w - 54);
    ctx.font = '12px system-ui,sans-serif'; ctx.textAlign = 'right'; ctx.fillText('SCENE ' + (index + 1) + ' / ' + list.length, w - 20, 24);
    if (!staticFrame && lastSceneIndexRef.current !== index) { lastSceneIndexRef.current = index; setSceneIndex(index); }
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

  async function buildScenes() {
    if (!story.trim()) { setStatus('Enter a story first.'); return; }
    setPlanning(true); setStatus('Asking the lightweight AI planner to organise your story into scenes…');
    try {
      const response = await fetch('/api/assistant', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', text: 'Turn this children’s animation story into a JSON array of 1 to 6 scenes. Return ONLY valid JSON, no markdown. Each object must have text (short scene action/dialogue based on the story), action (exactly one of walk, run, jump, wave, dance, talk), background (integer 0 to 4), and duration (number of seconds from 2 to 10). Keep it child-friendly and do not add characters. Story: ' + story.slice(0, 2200) }],
          context: { status: 'Creating a local scene plan', selectedCharacterName: 'Sunny and Bloop', videoReady: false }
        })
      });
      const data = await response.json(); if (!response.ok) throw new Error(data?.error || 'AI scene planning is not available right now.');
      const raw = String(data.reply || '').trim();
      const start = raw.indexOf('['), end = raw.lastIndexOf(']');
      if (start < 0 || end < start) throw new Error('The AI planner returned an unexpected scene format.');
      const parsed = JSON.parse(raw.slice(start, end + 1));
      if (!Array.isArray(parsed)) throw new Error('The AI planner returned an unexpected scene format.');
      const allowed: Action[] = ['walk', 'run', 'jump', 'wave', 'dance', 'talk'];
      const aiScenes: Scene[] = parsed.slice(0, 6).filter((item: any) => item && typeof item.text === 'string' && item.text.trim()).map((item: any, index: number) => ({
        id: index + 1, text: item.text.trim().slice(0, 220),
        action: allowed.includes(item.action) ? item.action : actionFor(item.text),
        background: Number.isInteger(item.background) ? Math.max(0, Math.min(4, item.background)) : index % backgrounds.length,
        duration: Number.isFinite(item.duration) ? Math.max(2, Math.min(10, Number(item.duration))) : 4,
      }));
      if (!aiScenes.length) throw new Error('The AI planner did not return any usable scenes.');
      setScenes(aiScenes); scenesRef.current = aiScenes; setSceneIndex(0);
      setStatus('AI planned ' + aiScenes.length + ' scenes. Animation and export run locally, without WAN GPU credits.');
    } catch (error) {
      const fallback = makeScenes(story);
      if (!fallback.length) { setStatus(error instanceof Error ? error.message : 'Could not plan scenes.'); return; }
      setScenes(fallback); scenesRef.current = fallback; setSceneIndex(0);
      setStatus('AI planning was unavailable, so a simple local scene plan was created instead. ' + (error instanceof Error ? error.message : ''));
    } finally { setPlanning(false); }
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
      const audioTracks = [dialogueUrl ? { url: dialogueUrl, volume: 1, loop: false } : null, musicUrl ? { url: musicUrl, volume: 0.18, loop: true } : null, effectsUrl ? { url: effectsUrl, volume: 0.32, loop: true } : null].filter((track): track is { url: string; volume: number; loop: boolean } => Boolean(track));
      if (audioTracks.length) {
        audioContext = new AudioContext();
        const destination = audioContext.createMediaStreamDestination();
        audioTracks.forEach((track) => { const audio = new Audio(track.url); audio.preload = 'auto'; audio.loop = track.loop; audioElements.push(audio); const source = audioContext!.createMediaElementSource(audio); const gain = audioContext!.createGain(); gain.gain.value = track.volume; source.connect(gain); gain.connect(destination); });
        stream = new MediaStream([...canvasStream.getVideoTracks(), ...destination.stream.getAudioTracks()]);
        await audioContext.resume();
      }
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      const stopped = new Promise<Blob>((resolve, reject) => {
        recorder.onstop = () => { const blob = new Blob(chunks, { type: recorder.mimeType || 'video/webm' }); blob.size ? resolve(blob) : reject(new Error('The exported video was empty. Try again.')); };
        recorder.onerror = () => reject(new Error('Browser video encoding failed. Try fewer scenes.'));
      });
      startRef.current = performance.now();\n      audioElements.forEach((audio) => { audio.currentTime = 0; void audio.play().catch(() => setStatus('A track could not start. Check the audio file format and try again.')); });\n      recorder.start(250);
      const exportDurationMs = Math.min(scenes.reduce((sum, scene) => sum + scene.duration, 0) * 1000, 60000);
      await new Promise((resolve) => window.setTimeout(resolve, exportDurationMs));
      exportingRef.current = false; if (recorder.state !== 'inactive') recorder.stop();
      const blob = await stopped, url = URL.createObjectURL(blob);
      setExportUrl((old) => { if (old) URL.revokeObjectURL(old); return url; });
      const safeTitle = (title.trim() || 'animate-text-episode').replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 60);
      const link = document.createElement('a'); link.href = url; link.download = safeTitle + '.webm'; document.body.appendChild(link); link.click(); link.remove();
      setStatus('Video downloaded to this device as WebM' + (audioTracks.length ? ' with your selected audio tracks mixed in.' : '. No audio tracks were selected.') + ' It is not uploaded to cloud storage.');
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Could not export the episode.'); }
    finally { exportingRef.current = false; setExporting(false); stream.getTracks().forEach((track) => track.stop()); canvasStream.getTracks().forEach((track) => track.stop()); audioElements.forEach((audio) => { audio.pause(); audio.src = ''; }); if (audioContext && audioContext.state !== 'closed') await audioContext.close().catch(() => undefined); }
  }

  return <section className="wan-panel scene-studio-panel">
    <h2><Film size={19} /> 4. Lightweight scene-to-video studio</h2>
    <p className="wan-help">Use the AI assistant to plan scenes, then render simple 2D character motion in your browser and export a WebM. No WAN GPU credits are used for this scene-based workflow. It is a lightweight AI-assisted 2D generator, not photorealistic video diffusion.</p>
    <div className="scene-studio-grid">
      <div className="scene-studio-controls">
        <label className="wan-label" htmlFor="scene-title">Episode title</label><input id="scene-title" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} />
        <label className="wan-label" htmlFor="scene-story">Story / script</label><textarea id="scene-story" value={story} onChange={(e) => setStory(e.target.value)} rows={5} maxLength={2400} placeholder="Write one sentence per scene…" />
        <div className="scene-studio-buttons"><button className="wan-generate" onClick={buildScenes} disabled={exporting || planning}>{planning ? <><LoaderCircle className="wan-spin" size={17} /> Planning…</> : <><WandSparkles size={17} /> Build scenes</>}</button><button className="wan-download" onClick={togglePreview} disabled={exporting}>{previewing ? 'Pause preview' : 'Preview animation'}</button></div>
        <label className="wan-label" htmlFor="scene-primary">Main character</label><select id="scene-primary" value={primary} onChange={(e) => setPrimary(e.target.value)} disabled={!characters.length}>{!characters.length && <option value="">Upload a character above first</option>}{characters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <label className="wan-label" htmlFor="scene-secondary">Second character</label><select id="scene-secondary" value={secondary} onChange={(e) => setSecondary(e.target.value)} disabled={!characters.length}>{characters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <div className="scene-studio-audio">
          <strong><AudioLines size={15} /> Audio tracks for this episode</strong>
          <label className="wan-upload"><Upload size={15} /> {dialogueName || 'Add dialogue / voice track'}<input type="file" accept="audio/*" onChange={(e) => { loadAudio(e.target.files?.[0], 'dialogue'); e.currentTarget.value = ''; }} /></label>
          <label className="wan-upload"><Music2 size={15} /> {musicName || 'Add background music'}<input type="file" accept="audio/*" onChange={(e) => { loadAudio(e.target.files?.[0], 'music'); e.currentTarget.value = ''; }} /></label>
          <label className="wan-upload"><AudioLines size={15} /> {effectsName || 'Add sound effects'}<input type="file" accept="audio/*" onChange={(e) => { loadAudio(e.target.files?.[0], 'effects'); e.currentTarget.value = ''; }} /></label>
          {dialogueUrl && <audio controls preload="metadata" src={dialogueUrl} />}
          {musicUrl && <audio controls preload="metadata" src={musicUrl} />}
          {effectsUrl && <audio controls preload="metadata" src={effectsUrl} />}
          <p className="wan-help">Dialogue plays once; music and effects loop quietly during the episode. Use audio you own or have permission to use.</p>
        </div>
        <button className="wan-download" onClick={() => void exportVideo()} disabled={exporting || !characters.length}>{exporting ? <><LoaderCircle className="wan-spin" size={17} /> Rendering episode…</> : <><Download size={17} /> Export &amp; download video</>}</button>
        <p className="wan-status" aria-live="polite">{status}</p><p className="wan-help">Transparent character images work best. Rendering uses your computer, so keep scenes short on low-memory laptops.</p>
      </div>
      <div className="scene-studio-preview"><canvas ref={canvasRef} width={800} height={450} aria-label="Local animated episode preview" />
        <div className="scene-studio-scene-list">{scenes.map((scene, index) => <div className={'scene-studio-scene ' + (index === sceneIndex ? 'active' : '')} key={scene.id}><strong>Scene {index + 1}</strong><label className="scene-studio-script-label">Scene script <textarea aria-label={'Script for scene ' + (index + 1)} value={scene.text} maxLength={220} rows={2} onChange={(e) => setScenes((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, text: e.target.value } : item))} /></label><div className="scene-studio-scene-edit"><label>Action <select aria-label={'Action for scene ' + (index + 1)} value={scene.action} onChange={(e) => setScenes((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, action: e.target.value as Action } : item))}>{(['walk','run','jump','wave','dance','talk'] as Action[]).map((action) => <option key={action} value={action}>{action}</option>)}</select></label><label>Seconds <select aria-label={'Duration for scene ' + (index + 1)} value={scene.duration} onChange={(e) => setScenes((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, duration: Number(e.target.value) } : item))}>{[2,3,4,5,6,8,10].map((seconds) => <option key={seconds} value={seconds}>{seconds}s</option>)}</select></label><label className="scene-studio-background-label">Background <select aria-label={'Background for scene ' + (index + 1)} value={scene.background} onChange={(e) => setScenes((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, background: Number(e.target.value) } : item))}>{['Sunny park','Pink garden','Blue beach','Night sky','Golden meadow'].map((name, bgIndex) => <option key={name} value={bgIndex}>{name}</option>)}</select></label></div></div>)}</div>
        {exportUrl && <div className="scene-studio-export"><strong>Last exported video</strong><video controls playsInline src={exportUrl} /><a href={exportUrl} download={(title || 'episode') + '.webm'}>Download again</a></div>}
      </div>
    </div>
  </section>;
}
