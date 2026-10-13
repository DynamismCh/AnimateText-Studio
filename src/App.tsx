import { useEffect, useMemo, useState } from 'react';
import { api, resolveMediaUrl } from './lib/api';
import { Film, Upload, Sparkles, Play, Pause, Download, Trash2, Plus, Clapperboard, Wand2, Mic2, Volume2, Music, VolumeX, Users, Smile } from 'lucide-react';

type Character={id:string;name:string;url:string;path:string};
type ActorAction={characterId:string;action:'idle'|'walk'|'run'|'jump'|'talk'|'meet';expression:'smile'|'happy'|'excited'|'curious'|'surprised'|'sad'|'calm';x:number};
type Shot={
 text:string; dialogue:string; duration:number;
 motion:'walk'|'run'|'bounce'|'float'|'zoom'|'pan'|'idle';
 camera:'wide'|'medium'|'close';
 expression:'happy'|'excited'|'curious'|'surprised'|'sad'|'calm';
 interaction?:string;
 actorActions?:ActorAction[];
 imageUrl?:string;
};
type Episode={title:string;logline:string;shots:Shot[]};

function App(){
 const [seriesTitle,setSeriesTitle]=useState('My Children’s Cartoon');
 const [episodeTitle,setEpisodeTitle]=useState('Episode 1: The Adventure Begins');
 const [idea,setIdea]=useState('A brave little robot discovers a glowing door in a friendly forest and learns that being curious can lead to wonderful adventures.');
 const [characters,setCharacters]=useState<Character[]>([]);
 const [selected,setSelected]=useState<string[]>([]);
 const [episode,setEpisode]=useState<Episode|null>(null);
 const [shotIndex,setShotIndex]=useState(0);
 const [playing,setPlaying]=useState(false);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('Upload one or more characters and create your first episode.');
 const [exporting,setExporting]=useState(false);
 const [elapsed,setElapsed]=useState(0);
 const [voices,setVoices]=useState<SpeechSynthesisVoice[]>([]);
 const [voiceName,setVoiceName]=useState('');
 const [musicOn,setMusicOn]=useState(true);
 const [sfxOn,setSfxOn]=useState(true);
 const shot=episode?.shots[shotIndex];
 const totalDuration=useMemo(()=>episode?.shots.reduce((n,s)=>n+s.duration,0)||0,[episode]);

 useEffect(()=>{
  const loadVoices=()=>setVoices(window.speechSynthesis.getVoices());
  loadVoices(); window.speechSynthesis.addEventListener('voiceschanged',loadVoices);
  return()=>window.speechSynthesis.removeEventListener('voiceschanged',loadVoices);
 },[]);
 useEffect(()=>{
  if(!playing||!shot)return;
  window.speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance(shot.dialogue||shot.text);
  const v=voices.find(x=>x.name===voiceName)||voices.find(x=>x.lang.toLowerCase().startsWith('en'));
  if(v)u.voice=v; u.rate=.92; u.pitch=1.12; u.volume=.9; window.speechSynthesis.speak(u);
  return()=>window.speechSynthesis.cancel();
 },[playing,shotIndex,episode,voices,voiceName]);
 useEffect(()=>{
  if(!playing||!episode||!shot)return;
  setElapsed(0); const started=performance.now();
  const timer=window.setInterval(()=>{
   const sec=(performance.now()-started)/1000; setElapsed(sec);
   if(sec>=shot.duration){clearInterval(timer); if(shotIndex<episode.shots.length-1)setShotIndex(v=>v+1);else setPlaying(false);}
  },80);
  return()=>clearInterval(timer);
 },[playing,shotIndex,episode]);

 async function addCharacter(file:File){
  if(!file.type.startsWith('image/'))return setMessage('Please choose an image file for your character.');
  setBusy(true); setMessage('Saving your character...');
  try{
   const reader=new FileReader();
   const data=await new Promise<string>((resolve,reject)=>{reader.onload=()=>resolve(String(reader.result).split(',')[1]||'');reader.onerror=reject;reader.readAsDataURL(file);});
   const res=await api.post('/api/characters',{name:file.name.replace(/\.[^.]+$/,''),data,mimeType:file.type});
   const c=res.data.character as Character;
   setCharacters(p=>[...p,c]); setSelected(p=>p.length<3?[...p,c.id]:p); setMessage('Character saved. You can select up to 3 characters for an episode.');
  }catch{setMessage('Could not save the character. Please try again.')}finally{setBusy(false)}
 }
 async function createEpisode(){
  if(!idea.trim())return setMessage('Describe the story first.');
  if(!selected.length)return setMessage('Select at least one character first.');
  setBusy(true);setPlaying(false);setMessage('Directing scenes, separating the action into character layers, and generating 4 animated shots...');
  try{
   const chosen=characters.filter(c=>selected.includes(c.id)).slice(0,3);
   const res=await api.post('/api/create-episode',{seriesTitle,episodeTitle,idea,characters:chosen.map(c=>({id:c.id,name:c.name}))});
   setEpisode(res.data.episode as Episode);setShotIndex(0);setElapsed(0);
   setMessage('Episode ready. Play it to see characters walk, run, talk, smile and interact.');
  }catch{setMessage('Episode creation failed. Try a shorter story or try again.')}finally{setBusy(false)}
 }
 async function removeCharacter(id:string){
  try{await api.delete('/api/characters/'+id)}catch{}
  setCharacters(p=>p.filter(c=>c.id!==id));setSelected(p=>p.filter(x=>x!==id));
  if(selected.includes(id)&&selected.length===1)setEpisode(null);
 }
 function previewVoice(){
  if(!shot)return; window.speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance(shot.dialogue||shot.text||'Hello! Let us begin our adventure.');
  const v=voices.find(x=>x.name===voiceName)||voices.find(x=>x.lang.toLowerCase().startsWith('en'));
  if(v)u.voice=v;u.rate=.92;u.pitch=1.12;u.volume=1;window.speechSynthesis.speak(u);
 }
 function actorClass(a:ActorAction){
  return 'actor '+a.action+' '+a.expression+(a.action==='meet'?' meet':'');
 }
 async function exportEpisode(){
  if(!episode)return;
  setExporting(true);setPlaying(false);window.speechSynthesis.cancel();setMessage('Rendering the character animation and audio into WebM...');
  const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;
  const ctx=canvas.getContext('2d');if(!ctx){setExporting(false);return}
  const mime=MediaRecorder.isTypeSupported('video/webm;codecs=vp9')?'video/webm;codecs=vp9':'video/webm';
  const audioCtx=new AudioContext(),audioDest=audioCtx.createMediaStreamDestination(),master=audioCtx.createGain();
  master.gain.value=.24;master.connect(audioDest);
  const playTone=(freq:number,start:number,duration:number,gainValue:number)=>{const osc=audioCtx.createOscillator(),gain=audioCtx.createGain();osc.type='sine';osc.frequency.value=freq;gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(gainValue,start+.03);gain.gain.exponentialRampToValueAtTime(.001,start+duration);osc.connect(gain);gain.connect(master);osc.start(start);osc.stop(start+duration+.05)};
  let audioTime=audioCtx.currentTime+.08;
  for(const s of episode.shots){if(musicOn)[261.63,329.63,392,329.63].forEach((n,i)=>playTone(n,audioTime+i*.32,.42,.035));if(sfxOn)playTone(s.motion==='run'?330:s.motion==='walk'?220:520,audioTime+.05,.16,.08);audioTime+=s.duration}
  const stream=canvas.captureStream(30);stream.addTrack(audioDest.stream.getAudioTracks()[0]);
  const recorder=new MediaRecorder(stream,{mimeType}),chunks:Blob[]=[];recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};recorder.start();
  for(const s of episode.shots){
   const scene=new Image();scene.crossOrigin='anonymous';scene.src=resolveMediaUrl(s.imageUrl);await new Promise<void>(r=>{scene.onload=()=>r();scene.onerror=()=>r()});
   const actorData=(s.actorActions||[]).map(a=>({a,c:characters.find(c=>c.id===a.characterId)})).filter(x=>x.c);
   const actorImgs=await Promise.all(actorData.map(async x=>{const img=new Image();img.crossOrigin='anonymous';img.src=resolveMediaUrl(x.c!.url);await new Promise<void>(r=>{img.onload=()=>r();img.onerror=()=>r()});return {...x,img}}));
   const frames=Math.max(30,Math.round(s.duration*30));
   for(let f=0;f<frames;f++){
    const p=f/Math.max(1,frames-1);ctx.clearRect(0,0,1280,720);ctx.fillStyle='#172554';ctx.fillRect(0,0,1280,720);
    if(scene.complete&&scene.naturalWidth){const scale=Math.max(1280/scene.width,720/scene.height);const w=scene.width*scale,h=scene.height*scale;ctx.drawImage(scene,(1280-w)/2,(720-h)/2,w,h)}
    for(const x of actorImgs){
     const a=x.a,img=x.img;const base=Math.min(360/Math.max(1,img.width),430/Math.max(1,img.height));const w=img.width*base,h=img.height*base;
     const start=a.x||50;let pos=start;
     if(a.action==='walk')pos=start+(p-.5)*220;if(a.action==='run')pos=start+(p-.5)*420;if(a.action==='meet')pos=start+(p-.5)*(start<50?420:-420);
     const bob=a.action==='jump'?Math.abs(Math.sin(p*Math.PI*4))*55:a.action==='walk'||a.action==='run'?Math.abs(Math.sin(p*Math.PI*6))*13:Math.sin(p*Math.PI*2)*5;
     ctx.save();ctx.translate(pos*12.8,(720-h)/2+bob);ctx.scale(a.action==='run'&&Math.sin(p*Math.PI*8)<0?-1:1,1);ctx.drawImage(img,-w/2,-h/2,w,h);ctx.restore();
    }
    ctx.fillStyle='rgba(0,0,0,.62)';ctx.fillRect(48,580,1184,105);ctx.fillStyle='#ddd6fe';ctx.font='600 19px sans-serif';ctx.fillText((s.interaction||s.expression).toUpperCase()+' • '+s.camera.toUpperCase(),72,610);ctx.fillStyle='#fff';ctx.font='700 29px sans-serif';ctx.fillText((s.dialogue||s.text).slice(0,90),72,654);
    await new Promise(r=>requestAnimationFrame(r));
   }
  }
  recorder.stop();await new Promise<void>(r=>{recorder.onstop=()=>r()});await audioCtx.close();
  const blob=new Blob(chunks,{type:'video/webm'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=episodeTitle.toLowerCase().replace(/[^a-z0-9]+/g,'-')+'.webm';a.click();URL.revokeObjectURL(url);setExporting(false);setMessage('Episode rendered successfully.');
 }

 return <div className="min-h-screen bg-slate-950 text-white">
  <header className="border-b border-white/10 px-5 py-4 flex items-center justify-between"><div className="flex items-center gap-3"><div className="logo"><Clapperboard size={22}/></div><div><h1 className="font-bold text-xl">AnimateText Studio</h1><p className="text-xs text-slate-400">Children’s animated-series creator</p></div></div><div className="badge"><Sparkles size={13}/> Real character motion • interaction • dialogue</div></header>
  <main className="max-w-7xl mx-auto p-5 grid lg:grid-cols-[370px_1fr] gap-5">
   <aside className="space-y-4">
    <section className="panel"><h2 className="section-title"><Clapperboard size={17}/> Series & episode</h2><label className="label">Series name</label><input className="input mb-2" value={seriesTitle} onChange={e=>setSeriesTitle(e.target.value)}/><label className="label">Episode name</label><input className="input" value={episodeTitle} onChange={e=>setEpisodeTitle(e.target.value)}/></section>
    <section className="panel"><h2 className="section-title"><Wand2 size={17}/> Story</h2><textarea className="input h-32" value={idea} onChange={e=>setIdea(e.target.value)} placeholder="Describe the children's story..."/><button className="primary w-full mt-3" onClick={createEpisode} disabled={busy}><Sparkles size={17}/>{busy?'Directing episode...':'Make animated episode'}</button><p className="hint mt-2">The director creates 4 scenes and choreographs each selected character independently.</p></section>
    <section className="panel"><h2 className="section-title"><Users size={17}/> Cast</h2><p className="hint">Select up to 3 characters. They can walk, run, jump, talk, smile and meet each other.</p><div className="space-y-2 mt-3">{characters.map(c=><div key={c.id} className={'character-card '+(selected.includes(c.id)?'selected':'')} onClick={()=>setSelected(p=>p.includes(c.id)?p.filter(x=>x!==c.id):p.length<3?[...p,c.id]:p)}><img src={resolveMediaUrl(c.url)} alt={c.name}/><span>{c.name}</span><span className="text-xs text-slate-500">{selected.includes(c.id)?'Selected':''}</span><button className="ml-auto text-slate-500 hover:text-red-400" onClick={e=>{e.stopPropagation();removeCharacter(c.id)}}><Trash2 size={15}/></button></div>)}{!characters.length&&<div className="empty">No characters yet.</div>}</div><label className="icon-btn cursor-pointer mt-3"><Plus size={18}/><input type="file" accept="image/*" className="hidden" onChange={e=>e.target.files?.[0]&&addCharacter(e.target.files[0])}/></label></section>
    <section className="panel"><h2 className="section-title"><Volume2 size={17}/> Audio</h2><label className="label">Preview voice</label><div className="flex gap-2"><select className="input" value={voiceName} onChange={e=>setVoiceName(e.target.value)}><option value="">Automatic English voice</option>{voices.map(v=><option key={v.name} value={v.name}>{v.name} ({v.lang})</option>)}</select><button className="icon-btn" onClick={previewVoice} disabled={!episode}><Volume2 size={17}/></button></div><div className="audio-toggles"><button className={'audio-toggle '+(musicOn?'on':'')} onClick={()=>setMusicOn(v=>!v)}>{musicOn?<Music/>:<VolumeX/>} Background music</button><button className={'audio-toggle '+(sfxOn?'on':'')} onClick={()=>setSfxOn(v=>!v)}>{sfxOn?<Volume2/>:<VolumeX/>} Sound effects</button></div><p className="hint">Audio is included in exported WebM.</p></section>
    <section className="panel"><h2 className="section-title">Storyboard</h2>{episode?.shots.map((s,i)=><button key={i} onClick={()=>{setShotIndex(i);setPlaying(false);setElapsed(0)}} className={'scene-row '+(i===shotIndex?'active':'')}><span>{i+1}</span><span className="truncate">{s.dialogue||s.text}</span><small>{s.duration}s</small></button>)}{!episode&&<div className="empty">Your episode shots will appear here.</div>}</section>
   </aside>
   <section>
    <div className="stage">
     {shot?<><img className="scene-background" src={resolveMediaUrl(shot.imageUrl)} alt="Animated scene background"/><div className="actors">{(shot.actorActions||selected.map((id,i)=>({characterId:id,action:'idle',expression:'happy',x:28+i*22} as ActorAction))).map(a=>{const c=characters.find(x=>x.id===a.characterId);return c?<div key={a.characterId} className={actorClass(a)} style={{left:(a.x||50)+'%'}}><img src={c.url} alt={c.name}/>{a.expression==='smile'&&<span className="smile-badge"><Smile size={18}/></span>} {a.action==='talk'&&<span className="talk-badge">•••</span>}</div>:null})}</div><div className="camera-badge">{shot.camera} • {shot.expression} • {shot.motion}</div><div className="caption"><Mic2 size={16} style={{display:'inline',marginRight:6}}/>{shot.dialogue||shot.text}</div>{shot.interaction&&<div className="interaction-badge"><Users size={14}/>{shot.interaction}</div>}</>:<div className="stage-placeholder"><Film size={48}/><b>Your animated series will appear here</b><span>Upload characters and make an episode.</span></div>}
    </div>
    <div className="controls panel mt-3"><button className="control" onClick={()=>setPlaying(v=>!v)} disabled={!episode}>{playing?<Pause/>:<Play/>}{playing?'Pause':'Play'}</button><div className="timeline"><div className="progress" style={{width:episode?((shotIndex+(elapsed/(shot?.duration||1)))/episode.shots.length)*100+'%':'0%'}}/></div><button className="control primary" onClick={exportEpisode} disabled={!episode||exporting}><Download/>{exporting?'Rendering...':'Export episode'}</button></div>
    <div className="mt-3 text-sm text-slate-400">{message}{totalDuration?' • '+totalDuration+' seconds':''}</div>
    {episode&&<div className="episode-info panel mt-4"><b>{episode.title}</b><p>{episode.logline}</p></div>}
   </section>
  </main>
 </div>
}
export default App;