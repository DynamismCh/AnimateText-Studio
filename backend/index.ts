import { router, json, error, storage, ai } from '@appdeploy/sdk';

const clean=(s:string)=>s.replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,70);

export const handler=router({
 'POST /api/characters':[async({body})=>{
  const b=body as {name?:string;data?:string;mimeType?:string};
  if(!b?.data||!b?.mimeType)return error('Image data is required',400);
  const id=crypto.randomUUID(),path='characters/'+id+'-'+clean(b.name||'character');
  const ok=await storage.write([{path,content:b.data,contentType:b.mimeType}]);
  if(!ok[0])return error('Could not store character',500);
  const urls=await storage.url([path]);
  return json({character:{id,name:b.name||'Character',url:urls[0].url,path}});
 }],
 'DELETE /api/characters/:id':[async({params})=>{
  const listed=await storage.list({prefix:'characters/'});
  const path=listed.paths.find(p=>p.includes(params.id));if(path)await storage.delete([path]);
  return json({deleted:true});
 }],
 'POST /api/create-episode':[async({body})=>{
  const b=body as {seriesTitle?:string;episodeTitle?:string;idea?:string;characters?:{id:string;name:string}[]};
  if(!b?.idea?.trim()||!b.characters?.length)return error('Story and at least one character are required',400);
  const listed=await storage.list({prefix:'characters/'});
  const selected=b.characters.slice(0,3).map(c=>({meta:c,path:listed.paths.find(p=>p.includes(c.id))})).filter(x=>x.path);
  if(!selected.length)return error('Selected characters were not found',404);
  const stored=await storage.read(selected.map(x=>x.path!));
  try{
   const cast=selected.map((x,i)=>({id:x.meta.id,name:x.meta.name,data:stored[i]?.content})).filter(x=>x.data);
   const plan=await ai.generate({
    system:'You are a professional children’s animation director. Create cheerful, age-appropriate scenes and choreograph real character actions. Return only structured JSON.',
    prompt:'Create exactly 4 shots for a children’s animated episode. Story: '+b.idea+'. Cast: '+cast.map(c=>c.name).join(', ')+'. The important change: each generated image must be a CLEAN BACKGROUND/ENVIRONMENT ONLY. Do not draw any characters, people, animals, robots, faces, silhouettes or character figures in the background. Leave open foreground space for animated character layers. Each shot needs text, short dialogue, duration 3-6 seconds, camera, expression, motion, interaction, and actorActions. For every cast member used in a shot, actorActions needs characterId, action (idle,walk,run,jump,talk,meet), expression (smile,happy,excited,curious,surprised,sad,calm), and x position from 15 to 85. Use meet when characters approach/interact. Make actions vary across shots. Keep dialogue short.',
    schema:{type:'object',properties:{logline:{type:'string'},shots:{type:'array',items:{type:'object',properties:{text:{type:'string'},dialogue:{type:'string'},duration:{type:'number'},motion:{type:'string'},camera:{type:'string'},expression:{type:'string'},interaction:{type:'string'},actorActions:{type:'array',items:{type:'object',properties:{characterId:{type:'string'},action:{type:'string'},expression:{type:'string'},x:{type:'number'}},required:['characterId','action','expression','x']}}},required:['text','dialogue','duration','motion','camera','expression','interaction','actorActions']}}},required:['logline','shots']},
    maxTokens:2200,thinkingMode:'FAST'
   });
   const parsed=JSON.parse(plan.text),validMotion=new Set(['walk','run','bounce','float','zoom','pan','idle']),validCamera=new Set(['wide','medium','close']),validExpr=new Set(['happy','excited','curious','surprised','sad','calm']),validAction=new Set(['idle','walk','run','jump','talk','meet']),raw=Array.isArray(parsed.shots)?parsed.shots.slice(0,4):[];
   if(!raw.length)return error('The story did not produce any shots',503);
   const backgrounds=await Promise.all(raw.map(async(s)=>{
    const prompt=String(s.visualPrompt||'').slice(0,850)+' Bright polished 2D children’s TV animation environment only. NO CHARACTERS, NO PEOPLE, NO ANIMALS, NO FIGURES, NO SILHOUETTES, no text, no watermark. Leave a clear foreground for separately animated character layers.';
    const base=await ai.imageGen({prompt,maxOutputBytes:700000});
    return {source:s,image:base.image};
   }));
   const shots:any[]=[];
   for(const item of backgrounds){
    const s=item.source,basePath='episodes/'+crypto.randomUUID()+'.png';
    const saved=await storage.write([{path:basePath,content:item.image.data,contentType:item.image.mimeType}]);
    if(!saved[0])return error('Could not save scene background',500);
    const baseUrl=await storage.url([basePath]);
    const actions=Array.isArray(s.actorActions)?s.actorActions.map((a:any)=>({characterId:String(a.characterId),action:validAction.has(a.action)?a.action:'idle',expression:a.expression==='smile'||validExpr.has(a.expression)?a.expression:'happy',x:Math.min(85,Math.max(15,Number(a.x)||50))})).filter((a:any)=>cast.some(c=>c.id===a.characterId)):[];
    shots.push({text:String(s.text||'').slice(0,180),dialogue:String(s.dialogue||'').slice(0,180),duration:Math.min(6,Math.max(3,Number(s.duration)||4)),motion:validMotion.has(s.motion)?s.motion:'idle',camera:validCamera.has(s.camera)?s.camera:'medium',expression:validExpr.has(s.expression)?s.expression:'happy',interaction:String(s.interaction||'').slice(0,100),actorActions,imageUrl:baseUrl[0].url});
   }
   return json({episode:{title:b.episodeTitle||'Episode 1',logline:String(parsed.logline||b.idea).slice(0,300),shots}});
  }catch(e){console.error('episode generation failed',e);return error('Episode generation is temporarily unavailable. Please try again.',503);}
 }]
});