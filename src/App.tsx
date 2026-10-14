import { useEffect, useState } from 'react';
import { Bug, Download, Film, ImagePlus, LoaderCircle, MessageCircle, Play, Send, Trash2, WandSparkles } from 'lucide-react';
import AudioWorkshop from './components/AudioWorkshop';
import { deleteSavedCharacter, loadSavedCharacters, saveCharacterImage, type LocalCharacter } from './lib/localCharacters';

const SPACE = 'zerogpu-aoti/wan2-2-fp8da-aoti-faster';
const SPACE_URL = 'https://zerogpu-aoti-wan2-2-fp8da-aoti-faster.hf.space';
const NEGATIVE_PROMPT = 'blurry, distorted body, extra limbs, flicker, text, watermark, static image';
type AssistantMessage = { role: 'user' | 'model'; text: string };
type DiagnosticEntry = { time: string; message: string };

function findVideo(value: any): string {
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

export default function App() {
  const [characters, setCharacters] = useState<LocalCharacter[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [prompt, setPrompt] = useState('A friendly cartoon character walks naturally, turns toward the camera, smiles and waves. Keep the original character design, colours and proportions consistent. Smooth full-body movement, stable camera, cheerful children’s animation.');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Upload a character, describe its movement, then generate a short video with WAN 2.2.');
  const [videoUrl, setVideoUrl] = useState('');
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [assistantMessages, setAssistantMessages] = useState<AssistantMessage[]>([{ role: 'model', text: 'Hi! I can help with Sunny and Bloop stories, animation prompts, and troubleshooting. I receive the app status and any recorded error when you send a message.' }]);
  const [assistantInput, setAssistantInput] = useState('');
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [lastError, setLastError] = useState('');
  const [diagnostics, setDiagnostics] = useState<DiagnosticEntry[]>([]);

  useEffect(() => {
    let active = true;
    loadSavedCharacters()
      .then((saved) => {
        if (!active) {
          saved.forEach((character) => URL.revokeObjectURL(character.url));
          return;
        }
        setCharacters(saved);
        if (saved[0]) setSelectedId(saved[0].id);
      })
      .catch(() => setStatus('Browser storage is unavailable. Please use a normal browser window and refresh the app.'));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const record = (message: string) => {
      const entry = { time: new Date().toISOString(), message: message.slice(0, 1000) };
      setDiagnostics((current) => [...current, entry].slice(-20));
      setLastError(entry.message);
    };
    const onError = (event: ErrorEvent) => record('Browser error: ' + event.message + (event.filename ? ' (' + event.filename + ':' + event.lineno + ')' : ''));
    const onRejection = (event: PromiseRejectionEvent) => record('Unhandled promise rejection: ' + String(event.reason));
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  async function sendAssistantMessage(override?: string) {
    const text = (override ?? assistantInput).trim();
    if (!text || assistantBusy) return;
    const nextMessages: AssistantMessage[] = [...assistantMessages, { role: 'user' as const, text }].slice(-10);
    setAssistantMessages(nextMessages);
    setAssistantInput('');
    setAssistantBusy(true);
    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages,
          context: {
            status, lastError, prompt,
            selectedCharacterName: characters.find((item) => item.id === selectedId)?.name ?? 'None selected',
            videoReady: Boolean(videoUrl)
          }
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'The assistant could not answer.');
      setAssistantMessages((current) => [...current, { role: 'model' as const, text: String(data.reply) }].slice(-12));
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unknown assistant error.';
      setAssistantMessages((current) => [...current, { role: 'model' as const, text: 'I could not reply: ' + detail }].slice(-12));
      setDiagnostics((current) => [...current, { time: new Date().toISOString(), message: 'AI assistant: ' + detail }].slice(-20));
    } finally {
      setAssistantBusy(false);
    }
  }

  function downloadDiagnostics() {
    const report = {
      app: 'AnimateText Studio',
      createdAt: new Date().toISOString(),
      currentStatus: status,
      latestError: lastError || 'No error recorded',
      selectedCharacter: characters.find((item) => item.id === selectedId)?.name ?? 'None selected',
      motionPrompt: prompt,
      videoPreviewAvailable: Boolean(videoUrl),
      recentEvents: diagnostics,
      browser: navigator.userAgent,
      note: 'This report excludes API keys and does not include uploaded character image data.'
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'animate-text-studio-diagnostics.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  async function addCharacter(file?: File) {
    if (!file) return;
    setStatus('Preparing your character image…');
    try {
      const character = await saveCharacterImage(file);
      setCharacters((current) => [...current, character]);
      setSelectedId(character.id);
      setVideoUrl('');
      setStatus('Character saved on this device. You can generate a clip when you are ready.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not save this character image.');
    }
  }

  async function removeCharacter(character: LocalCharacter) {
    try {
      await deleteSavedCharacter(character.id);
      URL.revokeObjectURL(character.url);
      const remaining = characters.filter((item) => item.id !== character.id);
      setCharacters(remaining);
      if (selectedId === character.id) setSelectedId(remaining[0]?.id || '');
      setVideoUrl('');
      setStatus('Character removed from this device.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not remove this character.');
    }
  }

  async function generateVideo() {
    const character = characters.find((item) => item.id === selectedId);
    if (!character) {
      setStatus('Upload and select a character image first.');
      return;
    }
    if (!prompt.trim()) {
      setStatus('Describe the movement you want first.');
      return;
    }

    setBusy(true);
    setVideoUrl('');
    setStatus('Connecting directly to the official WAN 2.2 Fast Space. This may take a few minutes; keep this tab open.');
    try {
      const imageResponse = await fetch(character.url);
      if (!imageResponse.ok) throw new Error('Could not read the selected character image. Please upload it again.');
      const imageBlob = await imageResponse.blob();
      const imageFile = new File([imageBlob], (character.name || 'character') + '.webp', { type: imageBlob.type || 'image/webp' });

      const { Client, handle_file } = await import('@gradio/client');
      const client = await Client.connect(SPACE, {
        status_callback: (spaceStatus: any) => {
          if (spaceStatus?.status === 'running') setStatus('WAN 2.2 is ready. Submitting your character and motion prompt…');
          else if (spaceStatus?.status === 'sleeping' || spaceStatus?.status === 'building') setStatus('Waking up the WAN 2.2 service. Please wait…');
          else if (spaceStatus?.status === 'error' || spaceStatus?.status === 'space_error') setStatus('The WAN 2.2 service is reporting a problem. Please try again later.');
        }
      });

      setStatus('WAN 2.2 is processing your request. Please wait and avoid refreshing the page.');
      const result: { data?: any[] } = await client.predict('/generate_video', {
        input_image: handle_file(imageFile),
        prompt: prompt.trim().slice(0, 1200),
        steps: 6,
        negative_prompt: NEGATIVE_PROMPT,
        duration_seconds: 3.5,
        guidance_scale: 1,
        guidance_scale_2: 1,
        seed: Math.floor(Math.random() * 2147483647),
        randomize_seed: true
      });
      const generatedUrl = findVideo(result?.data?.[0] ?? result?.data);
      if (!generatedUrl) throw new Error('WAN 2.2 returned a response, but AnimateText Studio could not find the video link. The Space may have changed its output format.');
      setVideoUrl(generatedUrl);
      setLastError('');
      setStatus('Video generated. Play it below and save it soon—the hosted file link may be temporary.');
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unknown error.';
      setLastError(detail);
      setDiagnostics((current) => [...current, { time: new Date().toISOString(), message: 'WAN generation: ' + detail }].slice(-20));
      const lower = detail.toLowerCase();
      if (lower.includes('quota') || lower.includes('zero gpu') || lower.includes('daily') || lower.includes('rate limit')) {
        setStatus('WAN 2.2 free GPU quota or rate limit reached. Your prompt and character are safe; wait for the allowance to reset before trying again. Details: ' + detail);
      } else {
        setStatus('WAN 2.2 could not generate the clip. Check whether the original Space is available and whether your free allowance has reset. Details: ' + detail);
      }
    } finally {
      setBusy(false);
    }
  }

  async function downloadVideo() {
    if (!videoUrl) return;
    setDownloadBusy(true);
    try {
      const response = await fetch(videoUrl);
      if (!response.ok) throw new Error('The hosted video link is no longer available.');
      const blob = await response.blob();
      if (!blob.size) throw new Error('The video download was empty.');
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = 'wan2-2-generated-video.mp4';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
      setStatus('Download started. Check your browser’s Downloads folder.');
    } catch {
      window.open(videoUrl, '_blank', 'noopener,noreferrer');
      setStatus('The browser could not download the hosted file directly, so the video was opened in a new tab. Use the video player’s download option or right-click and choose Save video as.');
    } finally {
      setDownloadBusy(false);
    }
  }

  return (
    <div className="wan-app">
      <header className="wan-header">
        <div className="wan-brand"><div className="wan-logo"><Film size={23} /></div><div><h1>AnimateText Studio</h1><p>WAN 2.2 character animation</p></div></div>
        <a href="https://huggingface.co/spaces/zerogpu-aoti/wan2-2-fp8da-aoti-faster" target="_blank" rel="noreferrer">Open original WAN 2.2 ↗</a>
      </header>

      <main className="wan-layout">
        <section className="wan-panel">
          <h2><ImagePlus size={18} /> 1. Choose a character</h2>
          <p className="wan-help">Upload a clear character image. A transparent PNG or WebP usually works best. Your images are saved in this browser on this device.</p>
          <label className="wan-upload">
            <ImagePlus size={18} /> Upload character image
            <input type="file" accept="image/*" onChange={(event) => { void addCharacter(event.target.files?.[0]); event.currentTarget.value = ''; }} />
          </label>
          <div className="wan-characters">
            {characters.map((character) => (
              <div key={character.id} className={'wan-character ' + (selectedId === character.id ? 'selected' : '')}>
                <button className="wan-character-select" onClick={() => { setSelectedId(character.id); setVideoUrl(''); }}>
                  <img src={character.url} alt={character.name} />
                  <span>{character.name}</span>
                  <small>{selectedId === character.id ? 'Selected' : 'Select'}</small>
                </button>
                <button className="wan-delete" title={'Remove ' + character.name} onClick={() => void removeCharacter(character)}><Trash2 size={15} /></button>
              </div>
            ))}
            {!characters.length && <div className="wan-empty">No saved characters yet. Upload an image to begin.</div>}
          </div>

          <h2 className="wan-prompt-heading"><WandSparkles size={18} /> 2. Describe the movement</h2>
          <label className="wan-label" htmlFor="motion-prompt">Motion prompt</label>
          <textarea id="motion-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} maxLength={1200} placeholder="Describe how your character should move…" />
          <p className="wan-help">Tip: describe the action, facial expression, camera movement, and background. Keep the prompt focused on one simple action for the best chance of a clean short clip.</p>
          <button className="wan-generate" onClick={() => void generateVideo()} disabled={busy || !selectedId || !prompt.trim()}>
            {busy ? <><LoaderCircle className="wan-spin" size={18} /> Generating with WAN 2.2…</> : <><WandSparkles size={18} /> Generate 3.5-second video</>}
          </button>
          <p className="wan-status" aria-live="polite">{status}</p>
          <p className="wan-quota-note">WAN 2.2 uses a shared free GPU allowance. Each generation can use quota, so avoid repeated tests when the service reports a limit.</p>
        </section>

        <section className="wan-panel wan-output-panel">
          <h2><Play size={18} /> 3. Preview and save your video</h2>
          {videoUrl ? (
            <div className="wan-video-result">
              <video controls playsInline preload="metadata" src={videoUrl} />
              <button className="wan-download" onClick={() => void downloadVideo()} disabled={downloadBusy}>
                {downloadBusy ? <LoaderCircle className="wan-spin" size={18} /> : <Download size={18} />}
                {downloadBusy ? 'Preparing download…' : 'Download video'}
              </button>
              <a className="wan-open-link" href={videoUrl} target="_blank" rel="noreferrer">Open hosted video in a new tab ↗</a>
              <p className="wan-help">Save the clip soon. WAN-hosted output links can be temporary and may stop working later.</p>
            </div>
          ) : (
            <div className="wan-video-empty"><Film size={44} /><strong>Your generated video will appear here</strong><span>Choose a character, describe one movement, and generate a clip.</span></div>
          )}
        </section>
      </main>

      <AudioWorkshop />

      <section className="wan-panel wan-assistant-panel">
        <div className="wan-assistant-heading">
          <div><h2><MessageCircle size={19} /> 5. Studio assistant</h2><p className="wan-help">Get help with Sunny and Bloop, scene ideas, movement prompts, and the latest app error.</p></div>
          <button className="wan-diagnostics" onClick={downloadDiagnostics} title="Download a report you can share when troubleshooting"><Bug size={16} /> Export diagnostics</button>
        </div>
        <div className="wan-chat-log" aria-live="polite">
          {assistantMessages.map((message, index) => <div key={index} className={'wan-chat-message ' + (message.role === 'user' ? 'wan-chat-user' : 'wan-chat-model')}><strong>{message.role === 'user' ? 'You' : 'Studio assistant'}</strong><p>{message.text}</p></div>)}
          {assistantBusy && <div className="wan-chat-message wan-chat-model"><strong>Studio assistant</strong><p><LoaderCircle className="wan-spin" size={14} /> Thinking…</p></div>}
        </div>
        <form className="wan-chat-form" onSubmit={(event) => { event.preventDefault(); void sendAssistantMessage(); }}>
          <textarea aria-label="Message the studio assistant" value={assistantInput} onChange={(event) => setAssistantInput(event.target.value)} maxLength={2000} rows={2} placeholder="Ask for a Sunny and Bloop scene, a better animation prompt, or help with an error…" />
          <button className="wan-send" type="submit" disabled={assistantBusy || !assistantInput.trim()}><Send size={17} /> Send</button>
        </form>
        <div className="wan-quick-actions">
          <button onClick={() => void sendAssistantMessage('Help me plan a short, funny Sunny and Bloop episode with three scenes and simple actions that WAN 2.2 can animate.')}>Plan a Sunny &amp; Bloop episode</button>
          <button onClick={() => void sendAssistantMessage('Improve my current movement prompt for a clear, smooth character animation. Keep it simple and preserve the character design.')}>Improve movement prompt</button>
          <button disabled={!lastError || assistantBusy} onClick={() => void sendAssistantMessage('Please diagnose this latest app error and give me the safest next steps: ' + lastError)}>Diagnose latest error</button>
        </div>
        <p className="wan-quota-note">The assistant uses a Gemini API key stored on the server. If it is not configured yet, it will explain the setup. Free-tier limits apply; do not share passwords or API keys in chat.</p>
      </section>
      <footer className="wan-footer">Built around the original public WAN 2.2 Fast Space. AnimateText Studio does not add paid video providers or install AI models on your laptop.</footer>
    </div>
  );
}
