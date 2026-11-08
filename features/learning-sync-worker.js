// Living Manifesto v0.5.5: first-party, zero-new-service synchronisation and provenance graph.
// The app has one private account. No paid APIs, model inference or external network calls.
function studioBlank(){return {version:1,reviews:{},paths:[],links:[]}}
const studioValidId=x=>/^[0-9a-f-]{8,80}$/i.test(String(x||''));
const studioStr=(x,n)=>String(x==null?'':x).trim().slice(0,n);
function studioValidate(raw){
 if(!raw||raw.version!==1||!raw.reviews||typeof raw.reviews!=='object'||Array.isArray(raw.reviews)||!Array.isArray(raw.paths)||!Array.isArray(raw.links))throw Error('Invalid Learning Studio v1 data');
 const state=studioBlank();
 for(const [sourceId,items] of Object.entries(raw.reviews).slice(0,250)){
  if(!studioValidId(sourceId)||!Array.isArray(items))continue;
  state.reviews[sourceId]=items.slice(0,20).filter(x=>x&&typeof x==='object').map(x=>({
   title:studioStr(x.title,200),question:studioStr(x.question,400),answer:studioStr(x.answer,3000),
   confidence:['low','medium','high'].includes(x.confidence)?x.confidence:'medium',
   created_at:studioStr(x.created_at,40),next_review:studioStr(x.next_review,40)
  })).filter(x=>x.answer.length>=20);
 }
 for(const path of raw.paths.slice(0,25)){
  if(!path||!Array.isArray(path.items))continue;
  const name=studioStr(path.name,60);if(name.length<2)continue;
  state.paths.push({name,items:path.items.slice(0,100).filter(x=>studioValidId(x?.id)).map(x=>({id:x.id,title:studioStr(x.title,160)}))});
 }
 for(const link of raw.links.slice(0,250)){
  if(!studioValidId(link?.from)||!studioValidId(link?.to)||link.from===link.to||!['supports','challenges','extends','questions'].includes(link?.kind))continue;
  const reason=studioStr(link.reason,600);if(reason.length<10)continue;
  state.links.push({from:link.from,to:link.to,fromTitle:studioStr(link.fromTitle,160),toTitle:studioStr(link.toTitle,160),kind:link.kind,reason});
 }
 if(JSON.stringify(state).length>250000)throw Error('Learning state exceeds the bounded free storage limit');
 return state;
}
async function studioTable(env){
 await env.DB.prepare("CREATE TABLE IF NOT EXISTS studio_state (key TEXT PRIMARY KEY, content TEXT NOT NULL, revision INTEGER NOT NULL, updated_at TEXT NOT NULL)").run();
}
async function studioRow(env){
 await studioTable(env);
 return env.DB.prepare("SELECT content,revision,updated_at FROM studio_state WHERE key='owner'").first();
}
async function studioStateRoute(req,env){
 if(req.method!=='GET'&&req.method!=='POST')return failure('Method not allowed',405);
 const current=await studioRow(env);
 if(req.method==='GET')return json({state:current?JSON.parse(current.content):studioBlank(),revision:current?current.revision:0,updated_at:current?.updated_at||null});
 const data=await payload(req,300000);
 if(!Number.isSafeInteger(data.expected_revision)||data.expected_revision<0)return failure('A nonnegative expected revision is required',422);
 let cleaned;
 try{cleaned=studioValidate(data.state)}catch(e){return failure(e.message,422)}
 const serialized=JSON.stringify(cleaned),stamp=now();
 if(!current){
  if(data.expected_revision!==0)return failure('Learning state was updated on another device. Reload and merge.',409);
  const inserted=await env.DB.prepare("INSERT INTO studio_state(key,content,revision,updated_at) VALUES('owner',?,1,?) ON CONFLICT(key) DO NOTHING").bind(serialized,stamp).run();
  if(Number(inserted.meta?.changes)!==1)return failure('Concurrent learning update. Reload and merge.',409);
  return json({ok:true,revision:1,updated_at:stamp});
 }
 if(current.revision!==data.expected_revision)return failure('Learning state was updated on another device. Reload and merge.',409);
 const updated=await env.DB.prepare("UPDATE studio_state SET content=?,revision=revision+1,updated_at=? WHERE key='owner' AND revision=?").bind(serialized,stamp,data.expected_revision).run();
 if(Number(updated.meta?.changes)!==1)return failure('Concurrent learning update. Reload and merge.',409);
 return json({ok:true,revision:data.expected_revision+1,updated_at:stamp});
}
// This is a provenance graph, not a model claim that two sources agree.
// Only the author's stored extracted labels and manually written source links are used.
async function knowledgeGraphRoute(req,env){
 if(req.method!=='GET')return failure('Method not allowed',405);
 const sources=await rows(env.DB.prepare("SELECT id,title,summary,disciplines FROM sources ORDER BY created_at DESC LIMIT 400"));
 const ideas=await rows(env.DB.prepare("SELECT id,source_id,statement,excerpt,tags FROM ideas ORDER BY created_at DESC LIMIT 1200"));
 const known=new Map(sources.map(s=>[s.id,{id:s.id,title:studioStr(s.title,180)||'Untitled source'}]));
 const concepts=new Map();
 function attach(term,sourceId,basis,evidence){
  if(!known.has(sourceId))return;
  const label=studioStr(term,80).replace(/\s+/g,' ');
  const key=label.toLowerCase();
  if(label.length<3||key==='other'||key==='general'||key==='misc'||key==='none')return;
  if(!concepts.has(key))concepts.set(key,{id:'concept:'+key,label,mentions:new Map()});
  const item=concepts.get(key);
  const old=item.mentions.get(sourceId);
  if(!old||basis==='idea tag')item.mentions.set(sourceId,{source_id:sourceId,title:known.get(sourceId).title,basis,evidence:studioStr(evidence,360)});
 }
 for(const s of sources){
  let tags;try{tags=JSON.parse(s.disciplines||'[]')}catch{tags=[]}
  if(Array.isArray(tags))for(const label of tags.slice(0,12))if(typeof label==='string')attach(label,s.id,'analysis discipline',s.summary);
 }
 for(const i of ideas){
  let tags;try{tags=JSON.parse(i.tags||'[]')}catch{tags=[]}
  if(Array.isArray(tags))for(const label of tags.slice(0,12))if(typeof label==='string')attach(label,i.source_id,'idea tag',i.excerpt||i.statement);
 }
 const shared=[...concepts.values()].filter(x=>x.mentions.size>=2).sort((a,b)=>b.mentions.size-a.mentions.size||a.label.localeCompare(b.label)).slice(0,60)
  .map(x=>({id:x.id,label:x.label,mentions:[...x.mentions.values()].slice(0,35)}));
 const row=await studioRow(env);let links=[];
 if(row)try{links=studioValidate(JSON.parse(row.content)).links.filter(x=>known.has(x.from)&&known.has(x.to)).slice(-200)}catch{}
 return json({ok:true,sources:[...known.values()],concepts:shared,manual_links:links,
  disclosure:'Shared concepts are derived from saved analysis labels and grounded excerpts. Labels are not proof that the sources support one another. Source-to-source links are your own interpretations.',
  limits:'Up to 400 sources, 1200 ideas, 60 shared concepts and 200 manual links. No AI inference or paid services.'});
}
