import { useEffect, useRef, useState } from 'react';
import { AudioLines, Download, LoaderCircle, Music2, Play, Upload, MessageCircle } from 'lucide-react';

const STARTER_SCRIPT = 'Sunny: Hi, Bloop! Are you ready for an adventure?\nBloop: I think so! Is there going to be snacks?\nSunny: Maybe. Let’s find out together!';
function base64ToBlob(base64: string, type: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}

export default function AudioWorkshop({ videoUrl = '', onDialogueReady }: { videoUrl?: string; onDialogueReady?: (url: string) => void }) {
  const [script, setScript] = useState(STARTER_SCRIPT);
  const [sunnyVoice, setSunnyVoice] = useState('Kore');
  const [bloopVoice, setBloopVoice] = useState('Puck');
  const [style, setStyle] = useState('Playful, warm, expressive children’s cartoon dialogue. Sunny sounds cheerful and friendly; Bloop sounds curious and funny. Speak clearly at a natural pace.');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Write dialogue for Sunny and Bloop, then generate a voice track.');
  const [audioUrl, setAudioUrl] = useState('');
  const [audioFileName, setAudioFileName] = useState('sunny-and-bloop-dialogue.wav');
  const [musicUrl, setMusicUrl] = useState('');
  const [musicName, setMusicName] = useState('');
  const [effectsUrl, setEffectsUrl] = useState('');
  const [effectsName, setEffectsName] = useState('');
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState('');
  const [uploadedVideoName, setUploadedVideoName] = useState('');
  const [uploadedVideoFile, setUploadedVideoFile] = useState<File | null>(null);
  const [sunnyLine, setSunnyLine] = useState('Hi, Bloop! Are you ready for an adventure?');
  const [bloopLine, setBloopLine] = useState('I think so! Is there going to be snacks?');
  const [sunnyLineAudioUrl, setSunnyLineAudioUrl] = useState('');
  const [bloopLineAudioUrl, setBloopLineAudioUrl] = useState('');
  const [speakerBusy, setSpeakerBusy] = useState<'Sunny' | 'Bloop' | ''>('');
  const [lipSyncSpeaker, setLipSyncSpeaker] = useState<'Sunny' | 'Bloop'>('Sunny');
  const [lipSyncBusy, setLipSyncBusy] = useState(false);
  const [lipSyncStatus, setLipSyncStatus] = useState('Choose a saved video with one character visible, then generate that character’s line.');
  const [lipSyncVideoUrl, setLipSyncVideoUrl] = useState('');
  const [lipSyncDownloadBusy, setLipSyncDownloadBusy] = useState(false);
  const [mouthX, setMouthX] = useState(50);
  const [mouthY, setMouthY] = useState(58);
  const [mouthWidth, setMouthWidth] = useState(12);
  const [mouthHeight, setMouthHeight] = useState(7);
  const [mixBusy, setMixBusy] = useState(false);
  const [mixedUrl, setMixedUrl] = useState('');
  const [mixStatus, setMixStatus] = useState('Generate a video and voice track, then combine them here.');
  const mixedUrlRef = useRef('');
  const audioUrlRef = useRef('');
  const musicUrlRef = useRef('');
  const effectsUrlRef = useRef('');
  const uploadedVideoUrlRef = useRef('');
  const sunnyLineAudioUrlRef = useRef('');
  const bloopLineAudioUrlRef = useRef('');
  const lipSyncVideoUrlRef = useRef('');
  const sourceVideoUrl = uploadedVideoUrl || videoUrl;

  useEffect(() => () => {
    [audioUrlRef.current, musicUrlRef.current, effectsUrlRef.current, uploadedVideoUrlRef.current, sunnyLineAudioUrlRef.current, bloopLineAudioUrlRef.current, lipSyncVideoUrlRef.current, mixedUrlRef.current].forEach((url) => { if (url) URL.revokeObjectURL(url); });
  }, []);

  function replaceLocalAudio(file: File, kind: 'music' | 'effects') {
    if (!file.type.startsWith('audio/')) { setStatus('Please choose an audio file such as MP3, WAV, or OGG.'); return; }
    const url = URL.createObjectURL(file);
    if (kind === 'music') {
      if (musicUrlRef.current) URL.revokeObjectURL(musicUrlRef.current);
      musicUrlRef.current = url; setMusicUrl(url); setMusicName(file.name);
      setStatus('Background music loaded for preview. It is not mixed into the video yet.');
    } else {
      if (effectsUrlRef.current) URL.revokeObjectURL(effectsUrlRef.current);
      effectsUrlRef.current = url; setEffectsUrl(url); setEffectsName(file.name);
      setStatus('Sound effects loaded for preview. They are not mixed into the video yet.');
    }
  }

  function replaceSourceVideo(file?: File) {
    if (!file) return;
    if (!file.type.startsWith('video/')) { setMixStatus('Please choose a video file, such as MP4 or WebM.'); return; }
    const url = URL.createObjectURL(file);
    if (uploadedVideoUrlRef.current) URL.revokeObjectURL(uploadedVideoUrlRef.current);
    uploadedVideoUrlRef.current = url;
    setUploadedVideoUrl(url);
    setUploadedVideoName(file.name);
    setUploadedVideoFile(file);
    setLipSyncVideoUrl('');
    setLipSyncStatus('Video selected. Generate a voice line for Sunny or Bloop, then run lip-sync.');
    setMixedUrl('');
    setMixStatus('Your existing video is ready. Add dialogue/music/effects and export it below.');
  }

  async function generateSpeakerVoice(speaker: 'Sunny' | 'Bloop') {
    const line = (speaker === 'Sunny' ? sunnyLine : bloopLine).trim();
    if (!line) { setLipSyncStatus('Enter a short line for ' + speaker + ' first.'); return; }
    setSpeakerBusy(speaker);
    setLipSyncStatus('Generating a separate ' + speaker + ' voice clip…');
    try {
      const response = await fetch('/api/voice', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script: line, speaker, sunnyVoice, bloopVoice, style })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Could not generate the speaker voice.');
      if (typeof data.audioBase64 !== 'string') throw new Error('The speech service returned no audio file.');
      const blob = base64ToBlob(data.audioBase64, data.mimeType || 'audio/wav');
      if (!blob.size) throw new Error('The generated voice clip was empty.');
      const url = URL.createObjectURL(blob);
      if (speaker === 'Sunny') {
        if (sunnyLineAudioUrlRef.current) URL.revokeObjectURL(sunnyLineAudioUrlRef.current);
        sunnyLineAudioUrlRef.current = url; setSunnyLineAudioUrl(url);
      } else {
        if (bloopLineAudioUrlRef.current) URL.revokeObjectURL(bloopLineAudioUrlRef.current);
        bloopLineAudioUrlRef.current = url; setBloopLineAudioUrl(url);
      }
      setLipSyncSpeaker(speaker);
      setLipSyncStatus(speaker + ' voice clip is ready. Use a video showing ' + speaker + ' alone or clearly in front for best results.');
    } catch (error) {
      setLipSyncStatus(error instanceof Error ? error.message : 'Could not generate the speaker voice.');
    } finally { setSpeakerBusy(''); }
  }

  async function runLipSync() {
    const audioUrl = lipSyncSpeaker === 'Sunny' ? sunnyLineAudioUrl : bloopLineAudioUrl;
    if (!uploadedVideoFile) { setLipSyncStatus('Choose a video file from your computer first.'); return; }
    if (!audioUrl) { setLipSyncStatus('Generate the selected character’s separate voice clip first.'); return; }
    if (typeof MediaRecorder === 'undefined') { setLipSyncStatus('This browser cannot export video. Please use a recent version of Chrome or Edge.'); return; }
    setLipSyncBusy(true); setLipSyncStatus('Preparing local lip-sync. No GPU or external lip-sync service is used…');
    let context: AudioContext | undefined; let recorder: MediaRecorder | undefined; let animationFrame = 0;
    let video: HTMLVideoElement | undefined; let audio: HTMLAudioElement | undefined; let canvasStream: MediaStream | undefined; let outputStream: MediaStream | undefined;
    try {
      video = document.createElement('video'); video.src = uploadedVideoUrl; video.muted = true; video.playsInline = true; video.preload = 'auto';
      await new Promise<void>((resolve, reject) => { video!.onloadedmetadata = () => resolve(); video!.onerror = () => reject(new Error('Could not read the selected video. Please choose a playable MP4 or WebM file.')); video!.load(); });
      if (!video.videoWidth || !video.videoHeight || !Number.isFinite(video.duration)) throw new Error('The selected video has no readable dimensions or duration.');
      const canvas = document.createElement('canvas'); canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Your browser could not create the animation canvas.');
      context = new AudioContext(); const destination = context.createMediaStreamDestination(); const analyser = context.createAnalyser(); analyser.fftSize = 1024; const audioData = new Uint8Array(analyser.fftSize);
      audio = new Audio(audioUrl); audio.preload = 'auto'; const source = context.createMediaElementSource(audio); source.connect(analyser); analyser.connect(destination);
      canvasStream = canvas.captureStream(30); outputStream = new MediaStream([...canvasStream.getVideoTracks(), ...destination.stream.getAudioTracks()]);
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus') ? 'video/webm;codecs=vp8,opus' : 'video/webm'; recorder = new MediaRecorder(outputStream, { mimeType });
      const chunks: BlobPart[] = []; recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      const finished = new Promise<Blob>((resolve, reject) => { recorder!.onstop = () => { const blob = new Blob(chunks, { type: recorder!.mimeType || 'video/webm' }); if (blob.size) resolve(blob); else reject(new Error('The exported clip was empty. Please try again.')); }; recorder!.onerror = () => reject(new Error('The browser could not encode the local lip-sync video.')); });
      const drawFrame = () => {
        if (!ctx || !video) return; if (video.readyState >= 2) ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        analyser.getByteTimeDomainData(audioData); let sum = 0; for (let i = 0; i < audioData.length; i++) { const sample = (audioData[i] - 128) / 128; sum += sample * sample; }
        const rms = Math.sqrt(sum / audioData.length); const openness = Math.min(1, Math.max(0, (rms - 0.012) * 16));
        const cx = canvas.width * mouthX / 100; const cy = canvas.height * mouthY / 100; const w = canvas.width * mouthWidth / 100; const h = canvas.height * mouthHeight / 100 * (0.15 + openness);
        if (openness > 0.06) { ctx.save(); ctx.translate(cx, cy); ctx.fillStyle = '#32151a'; ctx.beginPath(); ctx.ellipse(0, 0, w / 2, Math.max(2, h / 2), 0, 0, Math.PI * 2); ctx.fill();
          if (openness > 0.32) { ctx.fillStyle = '#f8e9d8'; ctx.beginPath(); ctx.ellipse(0, -h * 0.17, w * 0.34, Math.max(1, h * 0.13), 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#d94b63'; ctx.beginPath(); ctx.ellipse(0, h * 0.18, w * 0.23, Math.max(1, h * 0.14), 0, 0, Math.PI * 2); ctx.fill(); } ctx.restore(); }
        animationFrame = requestAnimationFrame(drawFrame);
      };
      await context.resume(); video.currentTime = 0; audio.currentTime = 0; await video.play(); await audio.play(); drawFrame(); recorder.start(250);
      const durationMs = Math.max(video.duration, Number.isFinite(audio.duration) ? audio.duration : 0) * 1000;
      setLipSyncStatus('Recording locally. Keep this tab open until export finishes…'); await new Promise<void>((resolve) => window.setTimeout(resolve, Math.min(durationMs, 180000) + 300));
      cancelAnimationFrame(animationFrame); if (recorder.state !== 'inactive') recorder.stop(); const blob = await finished; const resultUrl = URL.createObjectURL(blob);
      if (lipSyncVideoUrlRef.current) URL.revokeObjectURL(lipSyncVideoUrlRef.current); lipSyncVideoUrlRef.current = resultUrl; setLipSyncVideoUrl(resultUrl);
      setLipSyncStatus('Local mouth animation exported for ' + lipSyncSpeaker + '. Preview it and adjust position/size if needed. This uses audio volume, not AI phoneme-perfect lip-sync.');
      video.pause(); audio.pause(); canvasStream.getTracks().forEach((track) => track.stop()); outputStream.getTracks().forEach((track) => track.stop()); await context.close();
    } catch (error) { cancelAnimationFrame(animationFrame); if (recorder && recorder.state !== 'inactive') recorder.stop(); if (canvasStream) canvasStream.getTracks().forEach((track) => track.stop()); if (outputStream) outputStream.getTracks().forEach((track) => track.stop()); if (context && context.state !== 'closed') await context.close().catch(() => undefined); setLipSyncStatus(error instanceof Error ? error.message : 'Could not create the local lip-sync video.');
    } finally { setLipSyncBusy(false); }
  }

  async function downloadLipSyncVideo() {
    if (!lipSyncVideoUrl) return;
    setLipSyncDownloadBusy(true);
    try {
      const response = await fetch(lipSyncVideoUrl);
      if (!response.ok) throw new Error('The hosted result could not be downloaded directly.');
      const blob = await response.blob();
      if (!blob.size) throw new Error('The downloaded result was empty.');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = 'sunny-bloop-lip-synced.mp4';
      document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      window.open(lipSyncVideoUrl, '_blank', 'noopener,noreferrer');
      setLipSyncStatus('Opened the hosted result in a new tab because direct download was blocked. Use the player’s download option or Save video as.');
    } finally { setLipSyncDownloadBusy(false); }
  }

  async function generateSpeech() {
    setBusy(true); setStatus('Generating a multi-speaker voice track with Gemini…');
    try {
      const response = await fetch('/api/voice', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script, sunnyVoice, bloopVoice, style })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Speech generation failed.');
      if (typeof data.audioBase64 !== 'string') throw new Error('The speech service returned no audio file.');
      const blob = base64ToBlob(data.audioBase64, data.mimeType || 'audio/wav');
      if (!blob.size) throw new Error('The generated audio file was empty.');
      const url = URL.createObjectURL(blob);
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = url; setAudioUrl(url); onDialogueReady?.(url);
      setAudioFileName('sunny-and-bloop-dialogue.wav');
      setStatus('Voice track ready. Preview it below, then download the WAV file.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not generate the voice track.');
    } finally { setBusy(false); }
  }

  function downloadSpeech() {
    if (!audioUrl) return;
    const link = document.createElement('a'); link.href = audioUrl; link.download = audioFileName;
    document.body.appendChild(link); link.click(); link.remove();
  }

  async function createFinishedVideo() {
    if (!sourceVideoUrl) { setMixStatus('Generate a WAN video or choose a video from your computer first.'); return; }
    if (!audioUrl && !musicUrl && !effectsUrl) { setMixStatus('Generate character voices or upload music/effects first.'); return; }
    if (typeof MediaRecorder === 'undefined') { setMixStatus('Your browser does not support in-browser video export. Please try a recent version of Chrome or Edge.'); return; }
    setMixBusy(true); setMixStatus('Preparing video and audio tracks…');
    let audioContext: AudioContext | undefined;
    let recorder: MediaRecorder | undefined;
    let videoElement: HTMLVideoElement | undefined;
    const audioElements: HTMLAudioElement[] = [];
    const streamTracks: MediaStreamTrack[] = [];
    try {
      videoElement = document.createElement('video');
      videoElement.crossOrigin = 'anonymous';
      videoElement.playsInline = true;
      videoElement.preload = 'auto';
      videoElement.muted = true;
      videoElement.src = sourceVideoUrl;
      await new Promise<void>((resolve, reject) => {
        videoElement!.onloadedmetadata = () => resolve();
        videoElement!.onerror = () => reject(new Error('Could not load the generated video. Its hosted link may have expired; generate or reopen the clip and try again.'));
        videoElement!.load();
      });
      if (!Number.isFinite(videoElement.duration) || videoElement.duration <= 0) throw new Error('The generated video duration could not be read.');
      const capture = (videoElement as HTMLVideoElement & { captureStream?: () => MediaStream; mozCaptureStream?: () => MediaStream }).captureStream || (videoElement as HTMLVideoElement & { mozCaptureStream?: () => MediaStream }).mozCaptureStream;
      if (!capture) throw new Error('This browser cannot capture video for export. Please use the latest Chrome or Edge.');
      const videoStream = capture.call(videoElement);
      streamTracks.push(...videoStream.getVideoTracks());
      if (!streamTracks.length) throw new Error('The browser did not provide a video track for export.');
      audioContext = new AudioContext();
      const destination = audioContext.createMediaStreamDestination();
      const addAudio = (url: string, volume: number, loop: boolean) => {
        if (!url) return;
        const element = new Audio(url);
        element.crossOrigin = 'anonymous';
        element.preload = 'auto';
        element.loop = loop;
        audioElements.push(element);
        const source = audioContext!.createMediaElementSource(element);
        const gain = audioContext!.createGain();
        gain.gain.value = volume;
        source.connect(gain); gain.connect(destination);
      };
      addAudio(audioUrl, 1, false);
      addAudio(musicUrl, 0.18, true);
      addAudio(effectsUrl, 0.32, true);
      streamTracks.push(...destination.stream.getAudioTracks());
      const mixedStream = new MediaStream(streamTracks);
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus') ? 'video/webm;codecs=vp8,opus' : 'video/webm';
      recorder = new MediaRecorder(mixedStream, { mimeType });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      const finished = new Promise<Blob>((resolve, reject) => {
        recorder!.onstop = () => {
          const blob = new Blob(chunks, { type: recorder!.mimeType || 'video/webm' });
          if (!blob.size) reject(new Error('The exported video was empty. Please try again.'));
          else resolve(blob);
        };
        recorder!.onerror = () => reject(new Error('The browser could not encode the finished video.'));
      });
      await audioContext.resume();
      await videoElement.play();
      for (const element of audioElements) {
        try { element.currentTime = 0; await element.play(); } catch { /* Reported below if all tracks fail to start. */ }
      }
      recorder.start(250);
      setMixStatus('Recording the finished clip with mixed audio. Keep this tab open…');
      await new Promise<void>((resolve) => {
        videoElement!.onended = () => resolve();
        window.setTimeout(resolve, Math.ceil(videoElement!.duration * 1000) + 1500);
      });
      if (recorder.state !== 'inactive') recorder.stop();
      const blob = await finished;
      const url = URL.createObjectURL(blob);
      if (mixedUrlRef.current) URL.revokeObjectURL(mixedUrlRef.current);
      mixedUrlRef.current = url; setMixedUrl(url);
      setMixStatus('Finished video exported as WebM with the available audio tracks mixed in. The current WAN clip is only about 3.5 seconds, so keep dialogue very short to avoid cutting off speech.');
      videoElement.pause();
      audioElements.forEach((element) => { element.pause(); element.src = ''; });
      await audioContext.close();
    } catch (error) {
      if (recorder && recorder.state !== 'inactive') recorder.stop();
      audioElements.forEach((element) => { element.pause(); element.src = ''; });
      if (audioContext && audioContext.state !== 'closed') await audioContext.close().catch(() => undefined);
      setMixStatus(error instanceof Error ? error.message : 'Could not export the finished video. Try again in Chrome or Edge.');
    } finally {
      setMixBusy(false);
    }
  }

  function downloadMixedVideo() {
    if (!mixedUrl) return;
    const link = document.createElement('a'); link.href = mixedUrl; link.download = 'sunny-and-bloop-finished-episode.webm';
    document.body.appendChild(link); link.click(); link.remove();
  }

  const voices = ['Kore','Puck','Charon','Aoede','Leda','Orus','Zephyr','Fenrir'];

  return <section className="wan-panel wan-audio-panel">
    <h2><AudioLines size={19} /> 4. Audio Workshop — voices, music &amp; effects</h2>
    <p className="wan-help">Generate a dialogue track for both characters, then preview your own background music and sound effects. Audio generation uses your existing server-side Gemini API key; free quotas apply.</p>
    <label className="wan-label" htmlFor="dialogue-script">Dialogue script (start each line with Sunny: or Bloop:)</label>
    <textarea id="dialogue-script" className="wan-audio-script" value={script} onChange={(event) => setScript(event.target.value)} maxLength={5000} placeholder={'Sunny: Hello!\nBloop: Hi there!'} />
    <div className="wan-audio-options">
      <div><label className="wan-label" htmlFor="sunny-voice">Sunny's voice</label><select id="sunny-voice" value={sunnyVoice} onChange={(event) => setSunnyVoice(event.target.value)}>{voices.map((voice) => <option key={voice} value={voice}>{voice}</option>)}</select></div>
      <div><label className="wan-label" htmlFor="bloop-voice">Bloop's voice</label><select id="bloop-voice" value={bloopVoice} onChange={(event) => setBloopVoice(event.target.value)}>{voices.map((voice) => <option key={voice} value={voice}>{voice}</option>)}</select></div>
    </div>
    <label className="wan-label" htmlFor="voice-style">Acting style</label>
    <input id="voice-style" className="wan-audio-text-input" value={style} onChange={(event) => setStyle(event.target.value)} maxLength={300} />
    <button className="wan-generate" onClick={() => void generateSpeech()} disabled={busy || !script.trim() || !/(sunny|bloop)\s*:/i.test(script)}>{busy ? <><LoaderCircle className="wan-spin" size={18} /> Generating voices…</> : <><AudioLines size={18} /> Generate character voices</>}</button>
    {audioUrl && <div className="wan-audio-result"><strong>Generated dialogue</strong><audio controls src={audioUrl} /><button className="wan-download" onClick={downloadSpeech}><Download size={17} /> Download dialogue WAV</button></div>}
    <p className="wan-status" aria-live="polite">{status}</p>
    <div className="wan-audio-options wan-audio-upload-grid">
      <div className="wan-audio-asset">
        <h3><Music2 size={16} /> Background music</h3>
        <label className="wan-upload"><Upload size={16} /> {musicName ? 'Replace music' : 'Upload music'}<input type="file" accept="audio/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) replaceLocalAudio(file, 'music'); event.currentTarget.value = ''; }} /></label>
        {musicUrl && <><p className="wan-audio-filename">{musicName}</p><audio controls src={musicUrl} /></>}
      </div>
      <div className="wan-audio-asset">
        <h3><AudioLines size={16} /> Sound effects</h3>
        <label className="wan-upload"><Upload size={16} /> {effectsName ? 'Replace effects' : 'Upload sound effects'}<input type="file" accept="audio/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) replaceLocalAudio(file, 'effects'); event.currentTarget.value = ''; }} /></label>
        {effectsUrl && <><p className="wan-audio-filename">{effectsName}</p><audio controls src={effectsUrl} /></>}
      </div>
    </div>
    <div className="wan-audio-mixer">
      <h3><Play size={16} /> Finished video exporter</h3>
      <p className="wan-help">Use the generated WAN clip above, or load a video you already saved on your computer. This lets you test export without spending more video-generation quota.</p>
      <label className="wan-upload"><Upload size={16} /> {uploadedVideoName ? 'Choose a different video' : 'Use a video from your computer'}<input type="file" accept="video/*,.mp4,.webm,.mov" onChange={(event) => { replaceSourceVideo(event.target.files?.[0]); event.currentTarget.value = ''; }} /></label>
      {uploadedVideoUrl && <div className="wan-audio-result"><strong>Selected video: {uploadedVideoName}</strong><video controls playsInline preload="metadata" src={uploadedVideoUrl} /></div>}
      <button className="wan-generate" onClick={() => void createFinishedVideo()} disabled={mixBusy || !sourceVideoUrl || (!audioUrl && !musicUrl && !effectsUrl)}>{mixBusy ? <><LoaderCircle className="wan-spin" size={18} /> Exporting finished video…</> : <><Music2 size={18} /> Mix audio and export video</>}</button>
      <p className="wan-status" aria-live="polite">{mixStatus}</p>
      {mixedUrl && <div className="wan-audio-result"><strong>Finished video with audio</strong><video controls playsInline preload="metadata" src={mixedUrl} /><button className="wan-download" onClick={downloadMixedVideo}><Download size={17} /> Download finished WebM video</button></div>}
    </div>
    <div className="wan-audio-mixer wan-lipsync-panel">
      <h3><MessageCircle size={16} /> Character lip-sync — Sunny &amp; Bloop</h3>
      <p className="wan-help">Free local fallback: animate a mouth overlay from the voice volume directly in your browser. It uses no GPU service or extra quota. This is best for simple cartoon faces; adjust the mouth position and size below.</p>
      <label className="wan-label" htmlFor="sunny-lipsync-line">Sunny’s line</label>
      <textarea id="sunny-lipsync-line" className="wan-audio-script" value={sunnyLine} onChange={(event) => setSunnyLine(event.target.value)} maxLength={700} placeholder="Write Sunny's line…" />
      <button className="wan-download" onClick={() => void generateSpeakerVoice('Sunny')} disabled={Boolean(speakerBusy) || !sunnyLine.trim()}>{speakerBusy === 'Sunny' ? <LoaderCircle className="wan-spin" size={17} /> : <AudioLines size={17} />} Generate Sunny voice</button>
      {sunnyLineAudioUrl && <audio controls src={sunnyLineAudioUrl} />}
      <label className="wan-label" htmlFor="bloop-lipsync-line">Bloop’s line</label>
      <textarea id="bloop-lipsync-line" className="wan-audio-script" value={bloopLine} onChange={(event) => setBloopLine(event.target.value)} maxLength={700} placeholder="Write Bloop's line…" />
      <button className="wan-download" onClick={() => void generateSpeakerVoice('Bloop')} disabled={Boolean(speakerBusy) || !bloopLine.trim()}>{speakerBusy === 'Bloop' ? <LoaderCircle className="wan-spin" size={17} /> : <AudioLines size={17} />} Generate Bloop voice</button>
      {bloopLineAudioUrl && <audio controls src={bloopLineAudioUrl} />}
      <label className="wan-label" htmlFor="lipsync-speaker">Which character is speaking in this video?</label>
      <select id="lipsync-speaker" value={lipSyncSpeaker} onChange={(event) => setLipSyncSpeaker(event.target.value as 'Sunny' | 'Bloop')}><option value="Sunny">Sunny</option><option value="Bloop">Bloop</option></select>
      <p className="wan-help">The video selected in this section’s exporter is used as the source. Choose a local MP4/WebM/MOV file there first. For the most reliable test, use a clip showing only Sunny when syncing Sunny, and only Bloop when syncing Bloop.</p>
      <div className="wan-audio-options">
        <div><label className="wan-label" htmlFor="mouth-x">Mouth left/right: {mouthX}%</label><input id="mouth-x" type="range" min="5" max="95" value={mouthX} onChange={(event) => setMouthX(Number(event.target.value))} /></div>
        <div><label className="wan-label" htmlFor="mouth-y">Mouth up/down: {mouthY}%</label><input id="mouth-y" type="range" min="5" max="95" value={mouthY} onChange={(event) => setMouthY(Number(event.target.value))} /></div>
        <div><label className="wan-label" htmlFor="mouth-width">Mouth width: {mouthWidth}%</label><input id="mouth-width" type="range" min="3" max="30" value={mouthWidth} onChange={(event) => setMouthWidth(Number(event.target.value))} /></div>
        <div><label className="wan-label" htmlFor="mouth-height">Mouth height: {mouthHeight}%</label><input id="mouth-height" type="range" min="2" max="20" value={mouthHeight} onChange={(event) => setMouthHeight(Number(event.target.value))} /></div>
      </div>
      <p className="wan-help">Position is measured as a percentage of the video frame. Set it over the character’s mouth, then adjust width and height. The mouth opens when the voice is louder and closes during pauses.</p>
      <button className="wan-generate" onClick={() => void runLipSync()} disabled={lipSyncBusy || !uploadedVideoFile || !(lipSyncSpeaker === 'Sunny' ? sunnyLineAudioUrl : bloopLineAudioUrl)}>{lipSyncBusy ? <><LoaderCircle className="wan-spin" size={18} /> Creating local mouth animation…</> : <><MessageCircle size={18} /> Animate {lipSyncSpeaker}’s mouth (free)</>}</button>
      <p className="wan-status" aria-live="polite">{lipSyncStatus}</p>
      {lipSyncVideoUrl && <div className="wan-audio-result"><strong>Lip-synced result</strong><video controls playsInline preload="metadata" src={lipSyncVideoUrl} /><button className="wan-download" onClick={() => void downloadLipSyncVideo()} disabled={lipSyncDownloadBusy}>{lipSyncDownloadBusy ? <LoaderCircle className="wan-spin" size={17} /> : <Download size={17} />} Download lip-synced video</button></div>}
    </div>
    <p className="wan-quota-note">The browser combines the generated video with your dialogue, music and effects locally; no extra paid video service is used. The current WAN clip is about 3.5 seconds long, so dialogue may be cut short if it is too long. Use audio you own or have permission to use.</p>
  </section>;
}
