import { useEffect, useMemo, useState } from 'react';
import { resolveMediaUrl } from './lib/api';
import { deleteSavedCharacter, loadSavedCharacters, saveCharacterImage } from './lib/localCharacters';
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

let interactiveSegmenterPromise: Promise<any> | null = null;
async function getInteractiveSegmenter(){
 if(!interactiveSegmenterPromise){
  interactiveSegmenterPromise=(async()=>{
   const visionUrl='https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm';
   const vision:any=await import(/* @vite-ignore */ visionUrl);
   const files=await vision.FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm');
   return vision.InteractiveSegmenter.createFromOptions(files,{
    baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/interactive_segmenter/magic_touch/float32/1/magic_touch.tflite'},
    outputCategoryMask:false,outputConfidenceMasks:true
   });
  })().catch(error=>{interactiveSegmenterPromise=null;throw error});
 }
 return interactiveSegmenterPromise;
}

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
 const [segmentFile,setSegmentFile]=useState<File|null>(null);
 const [segmentPreview,setSegmentPreview]=useState('');
 const [segmentBusy,setSegmentBusy]=useState(false);
 const [segmentStatus,setSegmentStatus]=useState('Choose a full scene image, then click directly on the character you want to separate.');
 const shot=episode?.shots[shotIndex];
 const totalDuration=useMemo(()=>episode?.shots.reduce((n,s)=>n+s.duration,0)||0,[episode]);

 useEffect(()=>{
  loadSavedCharacters().then(setCharacters).catch(()=>setMessage('Browser storage is unavailable. Please use a normal browser window and try again.'));
 },[]);

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

 function beginSceneCutout(file:File){
  if(!file.type.startsWith('image/')){setMessage('Please choose an image file.');return}
  if(file.size>20*1024*1024){setMessage('Please choose an image smaller than 20 MB.');return}
  if(segmentPreview.startsWith('blob:'))URL.revokeObjectURL(segmentPreview);
  setSegmentFile(file);setSegmentPreview(URL.createObjectURL(file));
  setSegmentStatus('Loading the free browser segmentation model. The first load may take a little while.');
 }
 async function cutOutCharacter(event:React.MouseEvent<HTMLImageElement>){
  if(!segmentFile||!segmentPreview||segmentBusy)return;
  const rect=event.currentTarget.getBoundingClientRect();
  const x=Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width));
  const y=Math.max(0,Math.min(1,(event.clientY-rect.top)/rect.height));
  setSegmentBusy(true);setSegmentStatus('Separating the character from the background on this page...');
  try{
   const img=new Image();img.src=segmentPreview;
   await new Promise<void>((resolve,reject)=>{img.onload=()=>resolve();img.onerror=()=>reject(new Error('Could not read that image.'))});
   const segmenter=await getInteractiveSegmenter();
   const result:any=await new Promise((resolve,reject)=>{
    try{segmenter.segment(img,{keypoint:{x,y}},(value:any)=>value?resolve(value):reject(new Error('The segmenter returned no mask.')))}
    catch(error){reject(error)}
   });
   const mask=result.confidenceMasks?.[0];
   if(!mask)throw new Error('No character mask was found. Try clicking near the middle of the character, away from the background.');
   const mw=mask.width,mh=mask.height,values=mask.getAsFloat32Array();
   const scale=Math.min(1,1200/Math.max(img.naturalWidth,img.naturalHeight));
   const canvas=document.createElement('canvas');
   canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
   const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Your browser could not prepare the cutout.');
   ctx.drawImage(img,0,0,canvas.width,canvas.height);
   const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
   for(let py=0;py<canvas.height;py++){
    const my=Math.min(mh-1,Math.floor(py/canvas.height*mh));
    for(let px=0;px<canvas.width;px++){
     const mx=Math.min(mw-1,Math.floor(px/canvas.width*mw));
     const confidence=values[my*mw+mx];
     const index=(py*canvas.width+px)*4;
     const alpha=Math.max(0,Math.min(1,(confidence-.18)/.55));
     pixels.data[index+3]=Math.round(pixels.data[index+3]*alpha);
    }
   }
   ctx.putImageData(pixels,0,0);
   const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Could not create the transparent character image.')),'image/png'));
   const base=segmentFile.name.replace(/\.[^.]+$/,'').slice(0,36)||'character';
   await addCharacter(new File([blob],base+'-cutout.png',{type:'image/png'}));
   setSegmentStatus('Cutout added to your cast. If the edges look wrong, try another click on the character.');
   setSegmentFile(null);URL.revokeObjectURL(segmentPreview);setSegmentPreview('');
  }catch(error){
   setSegmentStatus(error instanceof Error?error.message:'Could not separate that character. Try another image or click a different part of the character.');
  }finally{setSegmentBusy(false)}
 }
 async function addCharacter(file:File){
  if(!file.type.startsWith('image/'))return setMessage('Please choose an image file for your character.');
  setBusy(true); setMessage('Preparing and saving your character on this device...');
  try{
   const c=await saveCharacterImage(file);
   setCharacters(p=>[...p,c]); setSelected(p=>p.length<3?[...p,c.id]:p);
   setMessage('Character saved on this device. You can select up to 3 characters for an episode.');
  }catch(error){
   setMessage(error instanceof Error?error.message:'Could not save this character. Please try another image.');
  }finally{setBusy(false)}
 }
 function sceneBackground(index:number){
  const palettes=[['#b7e7ff','#e9f8ff','#71bf76','#3e8d5a'],['#ffdfb0','#fff4d6','#e6a65b','#a95c4a'],['#c9c4ff','#f3eaff','#86c5a1','#467d71'],['#a8e4e0','#e4fbf6','#8fc56f','#477c48']];
  const [sky,glow,hill,ground]=palettes[index%palettes.length];
  const sunX=[1030,210,1020,260][index%4];
  const headings=['A bright new day','A surprising discovery','A little challenge','A happy ending'];
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720"><defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${sky}"/><stop offset="1" stop-color="${glow}"/></linearGradient></defs><rect width="1280" height="720" fill="url(#sky)"/><circle cx="${sunX}" cy="130" r="65" fill="#fff4a8"/><g fill="#fff" opacity=".7"><ellipse cx="270" cy="150" rx="95" ry="24"/><ellipse cx="320" cy="135" rx="52" ry="32"/><ellipse cx="820" cy="220" rx="115" ry="27"/></g><path d="M0 430 Q180 300 370 420 T760 410 T1280 385 V720 H0Z" fill="${hill}"/><path d="M0 535 Q220 455 430 540 T850 510 T1280 520 V720 H0Z" fill="${ground}"/><path d="M480 720 Q560 620 625 555 Q700 495 760 500 Q810 520 855 720Z" fill="#f3e1a2" opacity=".85"/><g transform="translate(130 300)" opacity=".8"><rect x="0" y="65" width="22" height="130" rx="8" fill="#805a42"/><circle cx="10" cy="40" r="68" fill="#4d9c65"/><circle cx="-30" cy="75" r="45" fill="#65b875"/></g><g transform="translate(1080 320)" opacity=".85"><rect x="0" y="60" width="22" height="130" rx="8" fill="#805a42"/><circle cx="10" cy="35" r="70" fill="#4d9c65"/><circle cx="-30" cy="72" r="45" fill="#65b875"/></g><text x="640" y="85" text-anchor="middle" font-family="Verdana,sans-serif" font-size="28" font-weight="700" fill="#264653">${headings[index%headings.length]}</text></svg>`;
  return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
 }
 function createEpisode(){
  if(!idea.trim())return setMessage('Describe the story first.');
  if(!selected.length)return setMessage('Select at least one character first.');
  const chosen=characters.filter(c=>selected.includes(c.id)).slice(0,3);
  if(!chosen.length)return setMessage('Upload and select at least one character first.');
  setBusy(true);setPlaying(false);setMessage('Creating a four-scene storyboard with your characters...');
  const lead=chosen[0].name,friend=chosen[1]?.name||'a new friend',third=chosen[2]?.name;
  const lines=[
   `${lead}: What a wonderful day to explore!`,
   `${lead}: Look what I found! ${friend}, come and see!`,
   `${friend}: We can solve this together!`,
   third?`${lead}: We did it together, ${friend} and ${third}!`:`${lead}: Working together makes every adventure better!`
  ];
  const texts=[
   `${lead} begins an adventure. ${idea.trim().replace(/\s+/g,' ').slice(0,150)}`,
   `${lead} discovers something unexpected and calls for help.`,
   `${lead} and ${friend} work together to solve the problem.`,
   'The friends celebrate their discovery and learn something new.'
  ];
  const shots:Shot[]=texts.map((text,i)=>({
   text:text.slice(0,180),dialogue:lines[i].slice(0,180),duration:5,
   motion:['walk','run','bounce','idle'][i] as Shot['motion'],
   camera:['wide','medium','close','wide'][i] as Shot['camera'],
   expression:['curious','surprised','excited','happy'][i] as Shot['expression'],
   interaction:['Starting the adventure','Sharing a discovery','Helping each other','Celebrating together'][i],
   imageUrl:sceneBackground(i),
   actorActions:chosen.map((character,ci)=>({
    characterId:character.id,
    action:(i===0?(ci===0?'walk':'idle'):i===1?(ci===0?'run':'meet'):i===2?(ci===0?'talk':'jump'):'idle') as ActorAction['action'],
    expression:['curious','excited','happy','smile'][i] as ActorAction['expression'],
    x:Math.max(18,Math.min(82,28+ci*(chosen.length>1?38/(chosen.length-1):0)))
   }))
  }));
  setEpisode({title:episodeTitle||'Episode 1',logline:idea.trim().slice(0,300),shots});
  setShotIndex(0);setElapsed(0);setMessage('Episode ready. Play it to see your characters move, talk and interact. No server connection is required.');
  setBusy(false);
 }
 async function removeCharacter(id:string){
  const character=characters.find(c=>c.id===id);
  try{await deleteSavedCharacter(id)}catch{}
  if(character?.url.startsWith('blob:'))URL.revokeObjectURL(character.url);
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
  if(!episode||exporting)return;
  if(!('MediaRecorder' in window)||!('captureStream' in HTMLCanvasElement.prototype)){
   setMessage('Video export is not supported by this browser. Please try the latest Chrome or Edge.');return;
  }
  setExporting(true);setPlaying(false);window.speechSynthesis.cancel();setMessage('Rendering your animated episode. Keep this tab open until the download starts...');
  let audioCtx:AudioContext|undefined;
  let stream:MediaStream|undefined;
  try{
  const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Your browser could not start the video renderer.');
  const mime=MediaRecorder.isTypeSupported('video/webm;codecs=vp9')?'video/webm;codecs=vp9':MediaRecorder.isTypeSupported('video/webm;codecs=vp8')?'video/webm;codecs=vp8':'video/webm';
  audioCtx=new AudioContext();await audioCtx.resume();
  const audioDest=audioCtx.createMediaStreamDestination(),master=audioCtx.createGain();
  master.gain.value=.24;master.connect(audioDest);
  const playTone=(freq:number,start:number,duration:number,gainValue:number)=>{const osc=audioCtx!.createOscillator(),gain=audioCtx!.createGain();osc.type='sine';osc.frequency.value=freq;gain.gain.setValueAtTime(.0001,start);gain.gain.linearRampToValueAtTime(gainValue,start+.03);gain.gain.exponentialRampToValueAtTime(.0001,start+duration);osc.connect(gain);gain.connect(master);osc.start(start);osc.stop(start+duration+.05)};
  let audioTime=audioCtx.currentTime+.12;
  for(const s of episode.shots){if(musicOn)[261.63,329.63,392,329.63].forEach((n,i)=>playTone(n,audioTime+i*.32,.42,.035));if(sfxOn)playTone(s.motion==='run'?330:s.motion==='walk'?220:520,audioTime+.05,.16,.08);audioTime+=s.duration}
  stream=canvas.captureStream(30);stream.addTrack(audioDest.stream.getAudioTracks()[0]);
  const recorder=new MediaRecorder(stream,{mimeType}),chunks:Blob[]=[];recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};recorder.start(250);
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
     const start=(a.x||50)*12.8;let offset=0;
     if(a.action==='walk')offset=(p-.5)*190;
     if(a.action==='run')offset=(p-.5)*300;
     if(a.action==='meet')offset=(p-.5)*(start<640?250:-250);
     const bob=a.action==='jump'?Math.abs(Math.sin(p*Math.PI*4))*55:a.action==='walk'||a.action==='run'?Math.abs(Math.sin(p*Math.PI*6))*13:Math.sin(p*Math.PI*2)*5;
     const facingLeft=(a.action==='run'||a.action==='walk')&&Math.sin(p*Math.PI*6)<0;
     ctx.save();ctx.translate(Math.max(w/2+8,Math.min(1280-w/2-8,start+offset)),(720-h)/2+bob);ctx.scale(facingLeft?-1:1,1);ctx.drawImage(img,-w/2,-h/2,w,h);ctx.restore();
    }
    ctx.fillStyle='rgba(0,0,0,.62)';ctx.fillRect(48,580,1184,105);ctx.fillStyle='#ddd6fe';ctx.font='600 19px sans-serif';ctx.fillText((s.interaction||s.expression).toUpperCase()+' • '+s.camera.toUpperCase(),72,610);ctx.fillStyle='#fff';ctx.font='700 29px sans-serif';ctx.fillText((s.dialogue||s.text).slice(0,90),72,654);
    await new Promise(r=>requestAnimationFrame(r));
   }
  }
  await new Promise<void>((resolve,reject)=>{
   recorder.onerror=()=>reject(new Error('The browser stopped recording the video.'));
   recorder.onstop=()=>chunks.length?resolve():reject(new Error('The browser created an empty video. Please try again.'));
   recorder.stop();
  });
  const blob=new Blob(chunks,{type:recorder.mimeType||'video/webm'});
  if(!blob.size)throw new Error('The exported video is empty. Please try again in Chrome or Edge.');
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=(episodeTitle||'animated-episode').toLowerCase().replace(/[^a-z0-9]+/g,'-')+'.webm';
  document.body.appendChild(a);a.click();a.remove();window.setTimeout(()=>URL.revokeObjectURL(url),60000);
  setMessage('Video downloaded. It is a WebM file; open it in a browser or compatible video player.');
  }catch(error){
   setMessage(error instanceof Error?error.message:'Video export failed. Please try again in Chrome or Edge.');
  }finally{
   stream?.getTracks().forEach(track=>track.stop());
   if(audioCtx&&audioCtx.state!=='closed')await audioCtx.close().catch(()=>undefined);
   setExporting(false);
  }
 }

 return <div className="min-h-screen bg-slate-950 text-white">
  <header className="border-b border-white/10 px-5 py-4 flex items-center justify-between"><div className="flex items-center gap-3"><div className="logo"><Clapperboard size={22}/></div><div><h1 className="font-bold text-xl">AnimateText Studio</h1><p className="text-xs text-slate-400">Children’s animated-series creator</p></div></div><div className="badge"><Sparkles size={13}/> Real character motion • interaction • dialogue</div></header>
  <main className="max-w-7xl mx-auto p-5 grid lg:grid-cols-[370px_1fr] gap-5">
   <aside className="space-y-4">
    <section className="panel"><h2 className="section-title"><Clapperboard size={17}/> Series & episode</h2><label className="label">Series name</label><input className="input mb-2" value={seriesTitle} onChange={e=>setSeriesTitle(e.target.value)}/><label className="label">Episode name</label><input className="input" value={episodeTitle} onChange={e=>setEpisodeTitle(e.target.value)}/></section>
    <section className="panel"><h2 className="section-title"><Wand2 size={17}/> Story</h2><textarea className="input h-32" value={idea} onChange={e=>setIdea(e.target.value)} placeholder="Describe the children's story..."/><button className="primary w-full mt-3" onClick={createEpisode} disabled={busy}><Sparkles size={17}/>{busy?'Directing episode...':'Make animated episode'}</button><p className="hint mt-2">The director creates 4 scenes and choreographs each selected character independently.</p></section>
    <section className="panel"><h2 className="section-title"><Users size={17}/> Cast</h2><p className="hint">Select up to 3 characters. For a scene image that already contains the background, separate each character before animating.</p><label className="icon-btn cursor-pointer mt-3" title="Upload a scene image and separate a character"><Plus size={18}/><span className="text-xs ml-2">Separate character from scene</span><input type="file" accept="image/*" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f)beginSceneCutout(f);e.currentTarget.value=''}}/></label>{segmentPreview&&<div className="cutout-tool mt-3"><p className="hint mb-2">{segmentStatus}</p><p className="text-xs text-violet-200 mb-2">Click on the character in the image below. The image is processed in your browser; no upload to a separate AI service is needed.</p><img className={'cutout-source '+(segmentBusy?'busy':'')} src={segmentPreview} alt="Click the character you want to separate" onClick={cutOutCharacter}/><div className="flex gap-2 mt-2"><button className="control" onClick={()=>{if(segmentPreview.startsWith('blob:'))URL.revokeObjectURL(segmentPreview);setSegmentPreview('');setSegmentFile(null);setSegmentStatus('Choose a full scene image, then click directly on the character you want to separate.')}}>Cancel</button>{segmentBusy&&<span className="hint self-center">Working…</span>}</div></div>}<div className="space-y-2 mt-3">{characters.map(c=><div key={c.id} className={'character-card '+(selected.includes(c.id)?'selected':'')} onClick={()=>setSelected(p=>p.includes(c.id)?p.filter(x=>x!==c.id):p.length<3?[...p,c.id]:p)}><img src={resolveMediaUrl(c.url)} alt={c.name}/><span>{c.name}</span><span className="text-xs text-slate-500">{selected.includes(c.id)?'Selected':''}</span><button className="ml-auto text-slate-500 hover:text-red-400" onClick={e=>{e.stopPropagation();removeCharacter(c.id)}}><Trash2 size={15}/></button></div>)}{!characters.length&&<div className="empty">No characters yet.</div>}</div><label className="icon-btn cursor-pointer mt-3" title="Upload a character image with a transparent background"><Upload size={16}/><span className="text-xs ml-2">Add ready-made character</span><input type="file" accept="image/*" className="hidden" onChange={e=>e.target.files?.[0]&&addCharacter(e.target.files[0])}/></label></section>
    <section className="panel"><h2 className="section-title"><Volume2 size={17}/> Audio</h2><label className="label">Preview voice</label><div className="flex gap-2"><select className="input" value={voiceName} onChange={e=>setVoiceName(e.target.value)}><option value="">Automatic English voice</option>{voices.map(v=><option key={v.name} value={v.name}>{v.name} ({v.lang})</option>)}</select><button className="icon-btn" onClick={previewVoice} disabled={!episode}><Volume2 size={17}/></button></div><div className="audio-toggles"><button className={'audio-toggle '+(musicOn?'on':'')} onClick={()=>setMusicOn(v=>!v)}>{musicOn?<Music/>:<VolumeX/>} Background music</button><button className={'audio-toggle '+(sfxOn?'on':'')} onClick={()=>setSfxOn(v=>!v)}>{sfxOn?<Volume2/>:<VolumeX/>} Sound effects</button></div><p className="hint">Audio is included in exported WebM.</p></section>
    <section className="panel"><h2 className="section-title">Storyboard</h2>{episode?.shots.map((s,i)=><button key={i} onClick={()=>{setShotIndex(i);setPlaying(false);setElapsed(0)}} className={'scene-row '+(i===shotIndex?'active':'')}><span>{i+1}</span><span className="truncate">{s.dialogue||s.text}</span><small>{s.duration}s</small></button>)}{!episode&&<div className="empty">Your episode shots will appear here.</div>}</section>
   </aside>
   <section>
    <div className="stage">
     {shot?<><img className="scene-background" src={resolveMediaUrl(shot.imageUrl)} alt="Animated scene background"/><div className="actors">{(shot.actorActions||selected.map((id,i)=>({characterId:id,action:'idle',expression:'happy',x:28+i*22} as ActorAction))).map(a=>{const c=characters.find(x=>x.id===a.characterId);return c?<div key={a.characterId} className={actorClass(a)} style={{left:(a.x||50)+'%'}}><img src={resolveMediaUrl(c.url)} alt={c.name}/>{a.expression==='smile'&&<span className="smile-badge"><Smile size={18}/></span>} {a.action==='talk'&&<span className="talk-badge">•••</span>}</div>:null})}</div><div className="camera-badge">{shot.camera} • {shot.expression} • {shot.motion}</div><div className="caption"><Mic2 size={16} style={{display:'inline',marginRight:6}}/>{shot.dialogue||shot.text}</div>{shot.interaction&&<div className="interaction-badge"><Users size={14}/>{shot.interaction}</div>}</>:<div className="stage-placeholder"><Film size={48}/><b>Your animated series will appear here</b><span>Upload characters and make an episode.</span></div>}
    </div>
    <div className="controls panel mt-3"><button className="control" onClick={()=>setPlaying(v=>!v)} disabled={!episode}>{playing?<Pause/>:<Play/>}{playing?'Pause':'Play'}</button><div className="timeline"><div className="progress" style={{width:episode?((shotIndex+(elapsed/(shot?.duration||1)))/episode.shots.length)*100+'%':'0%'}}/></div><button className="control primary" onClick={exportEpisode} disabled={!episode||exporting}><Download/>{exporting?'Rendering...':'Export episode'}</button></div>
    <div className="mt-3 text-sm text-slate-400">{message}{totalDuration?' • '+totalDuration+' seconds':''}</div>
    {episode&&<div className="episode-info panel mt-4"><b>{episode.title}</b><p>{episode.logline}</p></div>}
   </section>
  </main>
 </div>
}
export default App;