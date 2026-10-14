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
 const [motionReference,setMotionReference]=useState<File|null>(null);
 const [motionPrompt,setMotionPrompt]=useState('A friendly character walks naturally, turns toward the camera, smiles, and waves. Keep the character design consistent.');
 const [aiMotionBusy,setAiMotionBusy]=useState(false);
 const [fastMotionBusy,setFastMotionBusy]=useState(false);
 const [fastMotionNote,setFastMotionNote]=useState('Use your selected character image to generate a short AI motion clip with Wan 2.2 Fast.');
 const [aiMotionResult,setAiMotionResult]=useState('');
 const [showAiMotionOnStage,setShowAiMotionOnStage]=useState(false);
 const [aiMotionNote,setAiMotionNote]=useState('Choose a short reference video to animate your selected transparent character.');
 const [textVideoBusy,setTextVideoBusy]=useState(false);
 const [textVideoNote,setTextVideoNote]=useState('Describe the video you want. The server-side API keeps your provider token out of the browser.');
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
 async function downloadCharacterForAi(){
  const character=characters.find(item=>selected.includes(item.id));
  if(!character){setMessage('Select a character in your cast first.');return}
  try{
   const response=await fetch(character.url);
   if(!response.ok)throw new Error('Could not read the selected character image.');
   const blob=await response.blob();
   const extension=blob.type.includes('webp')?'webp':blob.type.includes('jpeg')?'jpg':'png';
   const url=URL.createObjectURL(blob);
   const link=document.createElement('a');link.href=url;
   link.download=(character.name||'my-character').toLowerCase().replace(/[^a-z0-9]+/g,'-')+'-transparent.'+extension;
   document.body.appendChild(link);link.click();link.remove();
   window.setTimeout(()=>URL.revokeObjectURL(url),30000);
   setMessage('Character cutout downloaded. In the AI Motion Studio, upload it as the character image and add a short motion reference video.');
  }catch(error){setMessage(error instanceof Error?error.message:'Could not download this character.')}
 }
 async function generateTextVideo(){
  const prompt=[seriesTitle,episodeTitle,idea.trim()].filter(Boolean).join('. ').slice(0,1750);
  if(!idea.trim()){setTextVideoNote('Describe the story first.');return}
  setTextVideoBusy(true);setTextVideoNote('Sending your prompt to our server-side video API. Generation can take time.');
  try{
   const response=await fetch('/api/generate-video',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt})});
   if(!response.ok){
    let detail='The API request failed.';
    try{const data=await response.json();detail=[data.error,data.detail,data.hint].filter(Boolean).join(' ')}catch{}
    throw new Error(detail);
   }
   const blob=await response.blob();
   if(!blob.size)throw new Error('The API returned an empty video.');
   if(aiMotionResult.startsWith('blob:'))URL.revokeObjectURL(aiMotionResult);
   const url=URL.createObjectURL(blob);
   setAiMotionResult(url);setShowAiMotionOnStage(true);
   setTextVideoNote('Video generated. Preview it in the main stage or use the video controls below to save it.');
   setAiMotionNote('A text-to-video clip is loaded. Generate another motion-reference clip here if you want to test character animation.');
  }catch(error){
   setTextVideoNote(error instanceof Error?error.message:'Could not generate the video. Please try again.');
  }finally{setTextVideoBusy(false)}
 }

 async function generateWanFastVideo(){
  const character=characters.find(item=>selected.includes(item.id));
  if(!character){setFastMotionNote('Select a character in Cast first.');return}
  setFastMotionBusy(true);
  setAiMotionResult('');
  setFastMotionNote('Preparing your character image and connecting through the app server. The public Space may queue or limit free requests.');
  try{
   const source=await fetch(character.url);
   if(!source.ok)throw new Error('Could not read the selected character image. Try uploading it again.');
   const bitmap=await createImageBitmap(await source.blob());
   const maxSide=832;
   const scale=Math.min(1,maxSide/Math.max(bitmap.width,bitmap.height));
   const canvas=document.createElement('canvas');
   canvas.width=Math.max(1,Math.round(bitmap.width*scale));
   canvas.height=Math.max(1,Math.round(bitmap.height*scale));
   const ctx=canvas.getContext('2d');
   if(!ctx)throw new Error('Could not prepare the character image in this browser.');
   ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
   bitmap.close();
   const imageBase64=canvas.toDataURL('image/jpeg',0.86).split(',')[1];
   setFastMotionNote('Sending the image through AnimateText Studio to Wan 2.2 Fast. Please keep this tab open.');
   const response=await fetch('/api/wan-fast',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
     imageBase64,
     prompt:(motionPrompt.trim()||idea.trim()||'A friendly cartoon character comes alive, walks naturally, turns toward the camera, smiles and waves. Keep the character design consistent.').slice(0,1200)
    })
   });
   const result=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(result.error||result.detail||'The Wan 2.2 Fast server connection failed.');
   if(!result.videoUrl)throw new Error('The Space finished without returning a usable video link.');
   const playableUrl='/api/wan-fast-video?url='+encodeURIComponent(result.videoUrl);
   setAiMotionResult(playableUrl);
   setShowAiMotionOnStage(true);
   setFastMotionNote('Video ready. Play it in the preview below, or use the download link to save it.');
   setMessage('Wan 2.2 Fast generated a character-motion clip.');
  }catch(error){
   const detail=error instanceof Error?error.message:'Unknown connection or model error.';
   setFastMotionNote(detail+' If the Space is busy or its free GPU allowance is exhausted, try again later.');
  }finally{setFastMotionBusy(false)}
 }

 async function generateAiMotion(){
  const character=characters.find(item=>selected.includes(item.id));
  if(!character){setAiMotionNote('Select one character in Cast first.');return}
  if(!motionReference){setAiMotionNote('Upload a short reference video showing the movement you want.');return}
  if(motionReference.size>100*1024*1024){setAiMotionNote('Please use a reference video smaller than 100 MB.');return}
  setAiMotionBusy(true);setAiMotionResult('');setAiMotionNote('Connecting to the hosted AI model. This may take time if the free GPU is busy.');
  let aiStage='loading the AI client library';
  try{
   let clientModule:any;
   try{
    const esmUrl='https://esm.sh/@gradio/client@1.15.0?bundle';
    clientModule=await import(/* @vite-ignore */ esmUrl);
   }catch(firstImportError){
    const fallbackUrl='https://cdn.jsdelivr.net/npm/@gradio/client@1.15.0/+esm';
    clientModule=await import(/* @vite-ignore */ fallbackUrl);
   }
   const {Client,handle_file}:any=clientModule;
   if(typeof Client?.connect!=='function'||typeof handle_file!=='function')throw new Error('The browser could not load the AI client library. Check your internet connection, then refresh the app.');
   aiStage='connecting to the Hugging Face AI studio';
   let client:any;
   let connectError:any;
   const studioTargets=[
    'https://hugging-apps-wan2-2-animate-2-14b.hf.space',
    'hugging-apps/wan2-2-animate-2-14b'
   ];
   for(const target of studioTargets){
    for(let attempt=1;attempt<=2;attempt++){
     try{
      client=await Client.connect(target,{timeout:60000});
      connectError=null;
      break;
     }catch(error){
      connectError=error;
      if(attempt<2)await new Promise(resolve=>window.setTimeout(resolve,2000));
     }
    }
    if(client)break;
   }
   if(!client)throw new Error('The browser could not reach either the direct AI studio endpoint or its Hugging Face Space API after retries. '+(connectError instanceof Error?connectError.message:'No network detail was provided.')+' If the direct studio page also fails to load, the service or your network may be blocking access.');
   aiStage='reading the hosted model API';
   const apiInfo=await client.view_api();
   const endpoints=apiInfo?.named_endpoints||{};
   const endpointKey=Object.keys(endpoints).find(key=>key.replace(/^\//,'')==='animate')||Object.keys(endpoints).find(key=>key.toLowerCase().includes('animate'));
   if(!endpointKey)throw new Error('The hosted model did not expose its expected Animate endpoint. Open the hosted studio directly and try again later.');
   const parameters=endpoints[endpointKey]?.parameters||[];
   const response=await fetch(character.url);
   if(!response.ok)throw new Error('Could not load your selected character cutout.');
   const imageBlob=await response.blob();
   const imageFile=new File([imageBlob],(character.name||'character')+'.png',{type:imageBlob.type||'image/png'});
   const payload:any[]=[];
   let imageUsed=false,videoUsed=false;
   for(const param of parameters){
    const label=String(param.label||param.parameter_name||param.name||'').toLowerCase();
    const component=String(param.component||param.type||'').toLowerCase();
    if((component.includes('image')||label.includes('character image')||label==='image'||label.includes('reference image'))&&!imageUsed){
     payload.push(handle_file(imageFile));imageUsed=true;continue;
    }
    if((component.includes('video')||label.includes('driving video')||label.includes('reference video')||label==='video')&&!videoUsed){
     payload.push(handle_file(motionReference));videoUsed=true;continue;
    }
    if(label.includes('prompt')||label.includes('description')||label.includes('appearance')){
     payload.push(motionPrompt.trim()||idea.trim()||'A friendly character moves naturally.');continue;
    }
    if(label.includes('seed')){payload.push(42);continue}
    if(label.includes('background')&&component.includes('text')){payload.push('Keep the original scene consistent.');continue}
    if(param.parameter_default!==undefined&&param.parameter_default!==null){payload.push(param.parameter_default);continue}
    if(param.default!==undefined&&param.default!==null){payload.push(param.default);continue}
    if(component.includes('checkbox')){payload.push(false);continue}
    if(component.includes('slider')||component.includes('number')){payload.push(0);continue}
    if(component.includes('dropdown')&&Array.isArray(param.options)&&param.options.length){payload.push(param.options[0]);continue}
    if(component.includes('textbox')){payload.push('');continue}
    payload.push(null);
   }
   if(!imageUsed||!videoUsed)throw new Error('The hosted model API has changed and no longer exposes the expected character-image and driving-video inputs. Use the Open hosted AI studio link for now.');
   aiStage='sending your character and reference video to the GPU';
   setAiMotionNote('Sending your cutout and reference clip to the hosted GPU. Free generations can take several minutes or fail when the queue is busy.');
   const result=await client.predict(endpointKey,payload);
   const findMedia=(value:any):string=>{
    if(!value)return '';
    if(typeof value==='string')return /^https?:\/\//i.test(value)?value:'';
    if(Array.isArray(value)){for(const item of value){const found=findMedia(item);if(found)return found}return ''}
    if(typeof value==='object'){
     const url=typeof value.url==='string'?value.url:'';
     const path=typeof value.path==='string'?value.path:'';
     const candidate=url||path;
     if(candidate&&(/^https?:\/\//i.test(candidate)||candidate.startsWith('/file=')))return candidate.startsWith('/file=')?'https://hugging-apps-wan2-2-animate-2-14b.hf.space'+candidate:candidate;
     for(const key of ['video','output','data','value','files'])if(key in value){const found=findMedia(value[key]);if(found)return found}
    }
    return '';
   };
   const mediaUrl=findMedia(result?.data);
   if(!mediaUrl)throw new Error('The model returned a response, but no downloadable video URL could be detected. Try the hosted studio directly; its output format may have changed.');
   setAiMotionResult(mediaUrl);setShowAiMotionOnStage(true);setAiMotionNote('AI motion generation finished. The AI clip is now shown in the main stage. Preview it and download it below.');
  }catch(error){
   const detail=error instanceof Error?error.message:'Unknown network or model error.';
   const networkHint=/failed to fetch|networkerror|load failed|fetch/i.test(detail)
    ? ' This usually means the browser could not reach the hosted AI service. Refresh the page and retry; if it persists, open the hosted studio below to check its availability.'
    : ' If the free GPU is busy or rate-limited, open the hosted studio below and retry there.';
   setAiMotionNote('Failed while '+aiStage+': '+detail+networkHint);
  }finally{setAiMotionBusy(false)}
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
  <header className="border-b border-white/10 px-5 py-4 flex items-center justify-between"><div className="flex items-center gap-3"><div className="logo"><Clapperboard size={22}/></div><div><h1 className="font-bold text-xl">AnimateText Studio</h1><p className="text-xs text-slate-400">Children’s animated-series creator</p></div></div><div className="badge"><Sparkles size={13}/> Storyboard preview • AI motion</div></header>
  <main className="max-w-7xl mx-auto p-5 grid lg:grid-cols-[370px_1fr] gap-5">
   <aside className="space-y-4">
    <section className="panel"><h2 className="section-title"><Clapperboard size={17}/> Series & episode</h2><label className="label">Series name</label><input className="input mb-2" value={seriesTitle} onChange={e=>setSeriesTitle(e.target.value)}/><label className="label">Episode name</label><input className="input" value={episodeTitle} onChange={e=>setEpisodeTitle(e.target.value)}/></section>
    <section className="panel"><h2 className="section-title"><Wand2 size={17}/> Story</h2><textarea className="input h-32" value={idea} onChange={e=>setIdea(e.target.value)} placeholder="Describe the children's story..."/><button className="primary w-full mt-3" onClick={createEpisode} disabled={busy}><Sparkles size={17}/>{busy?'Directing episode...':'Make animated episode'}</button><p className="hint mt-2">Creates a 4-scene storyboard with simple placeholder movement. For real body movement, generate a clip in AI Motion Lab using a short motion-reference video.</p></section>
    <section className="panel"><h2 className="section-title"><Users size={17}/> Cast</h2><p className="hint">Select up to 3 characters. For a scene image that already contains the background, separate each character before animating.</p><label className="icon-btn cursor-pointer mt-3" title="Upload a scene image and separate a character"><Plus size={18}/><span className="text-xs ml-2">Separate character from scene</span><input type="file" accept="image/*" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f)beginSceneCutout(f);e.currentTarget.value=''}}/></label>{segmentPreview&&<div className="cutout-tool mt-3"><p className="hint mb-2">{segmentStatus}</p><p className="text-xs text-violet-200 mb-2">Click on the character in the image below. The image is processed in your browser; no upload to a separate AI service is needed.</p><img className={'cutout-source '+(segmentBusy?'busy':'')} src={segmentPreview} alt="Click the character you want to separate" onClick={cutOutCharacter}/><div className="flex gap-2 mt-2"><button className="control" onClick={()=>{if(segmentPreview.startsWith('blob:'))URL.revokeObjectURL(segmentPreview);setSegmentPreview('');setSegmentFile(null);setSegmentStatus('Choose a full scene image, then click directly on the character you want to separate.')}}>Cancel</button>{segmentBusy&&<span className="hint self-center">Working…</span>}</div></div>}<div className="space-y-2 mt-3">{characters.map(c=><div key={c.id} className={'character-card '+(selected.includes(c.id)?'selected':'')} onClick={()=>setSelected(p=>p.includes(c.id)?p.filter(x=>x!==c.id):p.length<3?[...p,c.id]:p)}><img src={resolveMediaUrl(c.url)} alt={c.name}/><span>{c.name}</span><span className="text-xs text-slate-500">{selected.includes(c.id)?'Selected':''}</span><button className="ml-auto text-slate-500 hover:text-red-400" onClick={e=>{e.stopPropagation();removeCharacter(c.id)}}><Trash2 size={15}/></button></div>)}{!characters.length&&<div className="empty">No characters yet.</div>}</div><label className="icon-btn cursor-pointer mt-3" title="Upload a character image with a transparent background"><Upload size={16}/><span className="text-xs ml-2">Add ready-made character</span><input type="file" accept="image/*" className="hidden" onChange={e=>e.target.files?.[0]&&addCharacter(e.target.files[0])}/></label></section>
    <section className="panel ai-motion-panel"><h2 className="section-title"><Film size={17}/> Text-to-Video API <span className="beta-tag">NEW</span></h2><p className="hint">Turn your story description into a short AI-generated video. This uses our own server-side API route, so provider credentials are never exposed in the browser.</p><button className="primary w-full mt-3" onClick={generateTextVideo} disabled={textVideoBusy||!idea.trim()}>{textVideoBusy?'Generating video…':'Generate video from story text'}</button><p className="hint mt-2">{textVideoNote}</p><p className="hint mt-2">Setup note: the API needs an HF_TOKEN secret in Vercel with Inference Providers permission. Video inference may use paid provider credits and is not guaranteed to be free.</p>{textVideoBusy&&<div className="motion-loading"><span className="motion-spinner"/><span>Waiting for the hosted video model. Keep this tab open.</span></div>}{aiMotionResult&&<div className="ai-result mt-3"><video controls playsInline src={aiMotionResult} className="w-full rounded-lg"/><a className="ai-motion-link mt-2" href={aiMotionResult} target="_blank" rel="noreferrer" download="animate-text-video.mp4"><Download size={16}/> Open or download video</a></div>}</section>
    <section className="panel ai-motion-panel"><h2 className="section-title"><Film size={17}/> Wan 2.2 Fast <span className="beta-tag">FREE DEMO</span></h2><p className="hint">Animate your selected character image with Wan 2.2 Fast. This calls the public Hugging Face Space directly, so no paid inference-provider key is needed. Free shared GPU access is limited and may queue.</p><label className="label mt-3">Character motion prompt</label><textarea className="input h-20" value={motionPrompt} onChange={e=>setMotionPrompt(e.target.value)} placeholder="Describe how your character should move..."/><button className="primary w-full mt-3" onClick={generateWanFastVideo} disabled={!selected.length||fastMotionBusy}>{fastMotionBusy?'Generating with Wan 2.2 Fast…':'Animate selected character'}</button><p className="hint mt-2">{fastMotionNote}</p>{fastMotionBusy&&<div className="motion-loading"><span className="motion-spinner"/><span>Waiting for Wan 2.2 Fast. Keep this tab open.</span></div>}{aiMotionResult&&<div className="ai-result mt-3"><video controls playsInline src={aiMotionResult} className="w-full rounded-lg"/><a className="ai-motion-link mt-2" href={aiMotionResult} target="_blank" rel="noreferrer" download="wan-2-2-fast-character.mp4"><Download size={16}/> Open or download generated video</a><button className="control mt-2 w-full" onClick={()=>setShowAiMotionOnStage(true)}><Play size={16}/> Show AI clip in main stage</button></div>}<p className="hint mt-2"><a className="ai-motion-link" href="https://huggingface.co/spaces/zerogpu-aoti/wan2-2-fp8da-aoti-faster" target="_blank" rel="noreferrer">Open the original Wan 2.2 Fast Space ↗</a></p></section>
    <section className="panel ai-motion-panel"><h2 className="section-title"><Sparkles size={17}/> AI Motion Lab <span className="beta-tag">BETA</span></h2><p className="hint">Generate real AI-driven character movement with a hosted GPU. Nothing heavy is installed on your laptop.</p><label className="label mt-3">Motion reference video</label><input className="input" type="file" accept="video/*" onChange={e=>{setMotionReference(e.target.files?.[0]||null);setAiMotionResult('');setAiMotionNote(e.target.files?.[0]?'Reference clip selected. Select a character above, then generate.':'Choose a short reference clip.')}}/><p className="hint mt-1">Use a short clip showing the movement you want. Keep it small to reduce upload time.</p><label className="label mt-3">Motion instructions</label><textarea className="input h-20" value={motionPrompt} onChange={e=>setMotionPrompt(e.target.value)} placeholder="Describe how the character should move..."/><button className="primary w-full mt-3" onClick={generateAiMotion} disabled={!selected.length||!motionReference||aiMotionBusy}>{aiMotionBusy?'Generating AI motion…':'Generate AI character motion'}</button><p className="hint mt-2">{aiMotionNote}</p>{aiMotionBusy&&<div className="motion-loading"><span className="motion-spinner"/><span>Waiting for the hosted AI GPU. Please keep this tab open.</span></div>}{aiMotionResult&&<div className="ai-result mt-3"><video controls playsInline src={aiMotionResult} className="w-full rounded-lg" /><button className="control mt-2 w-full" onClick={()=>setShowAiMotionOnStage(true)}><Play size={16}/> Show AI clip in main stage</button><button className="control mt-2 w-full" onClick={()=>setShowAiMotionOnStage(false)}><Clapperboard size={16}/> Return to storyboard preview</button><a className="ai-motion-link mt-2" href={aiMotionResult} target="_blank" rel="noreferrer" download><Download size={16}/> Open or download generated motion</a></div>}<details className="mt-3"><summary className="hint cursor-pointer">Fallback and troubleshooting</summary><p className="hint mt-2">If the public model is paused, overloaded, or changes its API, try the hosted studio directly. Free GPU access is limited and generation is not guaranteed.</p><button className="control mt-2" onClick={downloadCharacterForAi} disabled={!selected.length}><Download size={16}/> Download selected character cutout</button><a className="ai-motion-link mt-2" href="https://huggingface.co/spaces/hugging-apps/wan2-2-animate-2-14b" target="_blank" rel="noreferrer"><Sparkles size={16}/> Open hosted Wan Animate studio ↗</a></details></section>
    <section className="panel"><h2 className="section-title"><Volume2 size={17}/> Audio</h2><label className="label">Preview voice</label><div className="flex gap-2"><select className="input" value={voiceName} onChange={e=>setVoiceName(e.target.value)}><option value="">Automatic English voice</option>{voices.map(v=><option key={v.name} value={v.name}>{v.name} ({v.lang})</option>)}</select><button className="icon-btn" onClick={previewVoice} disabled={!episode}><Volume2 size={17}/></button></div><div className="audio-toggles"><button className={'audio-toggle '+(musicOn?'on':'')} onClick={()=>setMusicOn(v=>!v)}>{musicOn?<Music/>:<VolumeX/>} Background music</button><button className={'audio-toggle '+(sfxOn?'on':'')} onClick={()=>setSfxOn(v=>!v)}>{sfxOn?<Volume2/>:<VolumeX/>} Sound effects</button></div><p className="hint">Audio is included in exported WebM.</p></section>
    <section className="panel"><h2 className="section-title">Storyboard</h2>{episode?.shots.map((s,i)=><button key={i} onClick={()=>{setShotIndex(i);setPlaying(false);setElapsed(0)}} className={'scene-row '+(i===shotIndex?'active':'')}><span>{i+1}</span><span className="truncate">{s.dialogue||s.text}</span><small>{s.duration}s</small></button>)}{!episode&&<div className="empty">Your episode shots will appear here.</div>}</section>
   </aside>
   <section>
    <div className="stage">
     {shot?<>{showAiMotionOnStage&&aiMotionResult&&<video className="ai-motion-stage-video" src={aiMotionResult} autoPlay loop muted playsInline controls aria-label="AI-generated character motion"/>}<img className="scene-background" src={resolveMediaUrl(shot.imageUrl)} alt="Animated scene background"/><div className="actors">{(shot.actorActions||selected.map((id,i)=>({characterId:id,action:'idle',expression:'happy',x:28+i*22} as ActorAction))).map(a=>{const c=characters.find(x=>x.id===a.characterId);return c?<div key={a.characterId} className={actorClass(a)} style={{left:(a.x||50)+'%'}}><img src={resolveMediaUrl(c.url)} alt={c.name}/>{a.expression==='smile'&&<span className="smile-badge"><Smile size={18}/></span>} {a.action==='talk'&&<span className="talk-badge">•••</span>}</div>:null})}</div><div className="camera-badge">{shot.camera} • {shot.expression} • {shot.motion}</div><div className="caption"><Mic2 size={16} style={{display:'inline',marginRight:6}}/>{shot.dialogue||shot.text}</div>{shot.interaction&&<div className="interaction-badge"><Users size={14}/>{shot.interaction}</div>}</>:<div className="stage-placeholder"><Film size={48}/><b>Your animated series will appear here</b><span>Upload characters and make an episode.</span></div>}
    </div>
    <div className="controls panel mt-3"><button className="control" onClick={()=>setPlaying(v=>!v)} disabled={!episode}>{playing?<Pause/>:<Play/>}{playing?'Pause':'Play'}</button><div className="timeline"><div className="progress" style={{width:episode?((shotIndex+(elapsed/(shot?.duration||1)))/episode.shots.length)*100+'%':'0%'}}/></div><button className="control primary" onClick={exportEpisode} disabled={!episode||exporting}><Download/>{exporting?'Rendering...':'Export episode'}</button></div>
    <div className="mt-3 text-sm text-slate-400">{message}{totalDuration?' • '+totalDuration+' seconds':''}</div>
    {episode&&<div className="episode-info panel mt-4"><b>{episode.title}</b><p>{episode.logline}</p></div>}
   </section>
  </main>
 </div>
}
export default App;