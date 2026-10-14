import { useEffect, useRef, useState } from 'react';
import { AudioLines, Download, LoaderCircle, Music2, Play, Upload } from 'lucide-react';

const STARTER_SCRIPT = 'Sunny: Hi, Bloop! Are you ready for an adventure?\nBloop: I think so! Is there going to be snacks?\nSunny: Maybe. Let’s find out together!';

function base64ToBlob(base64: string, type: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}

export default function AudioWorkshop({ videoUrl = '' }: { videoUrl?: string }) {
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
  const [mixBusy, setMixBusy] = useState(false);
  const [mixedUrl, setMixedUrl] = useState('');
  const [mixStatus, setMixStatus] = useState('Generate a video and voice track, then combine them here.');
  const mixedUrlRef = useRef('');
  const audioUrlRef = useRef('');
  const musicUrlRef = useRef('');
  const effectsUrlRef = useRef('');

  useEffect(() => () => {
    [audioUrlRef.current, musicUrlRef.current, effectsUrlRef.current, mixedUrlRef.current].forEach((url) => { if (url) URL.revokeObjectURL(url); });
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
      audioUrlRef.current = url; setAudioUrl(url);
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
    if (!videoUrl) { setMixStatus('Generate a WAN video first.'); return; }
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
      videoElement.src = videoUrl;
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
      <p className="wan-help">{videoUrl ? 'A WAN clip is available. Combine it with your generated dialogue and any uploaded music/effects.' : 'Generate a WAN clip in section 3 first. Then return here to add audio and export one video.'}</p>
      <button className="wan-generate" onClick={() => void createFinishedVideo()} disabled={mixBusy || !videoUrl || (!audioUrl && !musicUrl && !effectsUrl)}>{mixBusy ? <><LoaderCircle className="wan-spin" size={18} /> Exporting finished video…</> : <><Music2 size={18} /> Mix audio and export video</>}</button>
      <p className="wan-status" aria-live="polite">{mixStatus}</p>
      {mixedUrl && <div className="wan-audio-result"><strong>Finished video with audio</strong><video controls playsInline preload="metadata" src={mixedUrl} /><button className="wan-download" onClick={downloadMixedVideo}><Download size={17} /> Download finished WebM video</button></div>}
    </div>
    <p className="wan-quota-note">The browser combines the generated video with your dialogue, music and effects locally; no extra paid video service is used. The current WAN clip is about 3.5 seconds long, so dialogue may be cut short if it is too long. Use audio you own or have permission to use.</p>
  </section>;
}
