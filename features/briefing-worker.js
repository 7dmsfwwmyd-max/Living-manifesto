// Living Manifesto v0.5.8 · deterministic daily briefing, no new model calls.
// This is an attention queue from private SAVED data, not a live news service.
// All due times and the capture/analysis timestamps are explicitly distinguished.
const BR_ID=/^[a-f0-9-]{8,80}$/i;
const BR_KEY=/^(source|review|evidence|processing|concept|connection):[a-f0-9-]{8,170}$/i;
const brText=(v,n)=>String(v==null?'':v).trim().slice(0,n);
function brDate(t){const d=Date.parse(String(t||''));return Number.isFinite(d)?d:0}
function brAge(t,reference){const d=brDate(t);return d?Math.max(0,(reference-d)/86400000):365}
function brList(s){try{const x=JSON.parse(s||'[]');return Array.isArray(x)?x.filter(v=>typeof v==='string').slice(0,10):[]}catch{return []}}
async function brPreferences(env){
 const exists=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='briefing_preferences'").first();
 return exists?await rows(env.DB.prepare('SELECT item_key,hidden_until,revision,updated_at FROM briefing_preferences ORDER BY updated_at DESC LIMIT 300')):[];
}
function brHide(p,ref){if(!p||!p.hidden_until)return false;return brDate(p.hidden_until)>ref}
async function brRead(env){
 const stamp=now(),ref=brDate(stamp);
 const sources=await rows(env.DB.prepare('SELECT id,title,summary,status,retrieval,error,created_at,updated_at,disciplines,length(body) AS body_length,attempts FROM sources ORDER BY created_at DESC LIMIT 100'));
 const known=new Map(sources.map(s=>[s.id,s]));
 const auditTable=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='evidence_audits'").first();
 const audits=auditTable?await rows(env.DB.prepare('SELECT source_id,content,verified_at FROM evidence_audits ORDER BY verified_at DESC LIMIT 100')):[];
 const auditMap=new Map(audits.map(x=>[x.source_id,x]));
 const evergreenTable=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='evergreen_notes'").first();
 const concepts=evergreenTable?await rows(env.DB.prepare('SELECT id,title,thesis,source_refs,archived,updated_at FROM evergreen_notes WHERE archived=0 ORDER BY updated_at DESC LIMIT 30')):[];
 const studioTable=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='studio_state'").first();
 const stored=studioTable?await env.DB.prepare("SELECT content FROM studio_state WHERE key='owner'").first():null;
 let learning={reviews:{},paths:[],links:[]};
 if(stored)try{
  const val=JSON.parse(stored.content);
  if(val.version===1&&val.reviews&&typeof val.reviews==='object'&&!Array.isArray(val.reviews)){
   learning={reviews:val.reviews,paths:Array.isArray(val.paths)?val.paths.slice(0,25):[],links:Array.isArray(val.links)?val.links.slice(0,250):[]};
  }
 }catch{}
 const reviewed=new Set(Object.keys(learning.reviews).filter(id=>Array.isArray(learning.reviews[id])&&learning.reviews[id].length));
 const important=new Set(learning.paths.flatMap(x=>Array.isArray(x.items)?x.items.slice(0,100).map(y=>y.id):[]).filter(x=>BR_ID.test(String(x||''))));
 const entries=[];
 const push=(value)=>{if(value&&BR_KEY.test(value.key))entries.push(value)};
 const due=Object.entries(learning.reviews).slice(0,250).flatMap(([id,list])=>{
  if(!BR_ID.test(id)||!Array.isArray(list)||!list.length)return[];
  const latest=list[0],t=brDate(latest.next_review);
  if(!t||t>ref)return[];
  return [{id,title:brText(known.get(id)?.title||latest.title||'Previously studied source',170),due:latest.next_review,confidence:latest.confidence}];
 }).sort((a,b)=>brDate(a.due)-brDate(b.due)).slice(0,12);
 for(const d of due)push({key:'review:'+d.id,kind:'review',title:d.title,explanation:'Active recall due '+brText(d.due,10)+' · last confidence '+brText(d.confidence,16),why:'A review you scheduled after studying this source.',source_id:d.id,due_at:d.due,score:120+Math.min(40,brAge(d.due,ref)*5),action_label:'Review source'});
 for(const s of sources){
  if(!BR_ID.test(s.id))continue;
  const age=brAge(s.created_at,ref),title=brText(s.title||'Untitled source',170);
  if(s.status==='ready'&&!reviewed.has(s.id)&&age<=30){
   push({key:'source:'+s.id,kind:'reading',title,explanation:brText(s.summary,300)||'Analysed source ready to study.',why:'Saved '+brText(s.created_at,10)+(important.has(s.id)?' · Included in your own learning path':'')+'. This is its capture date, not its publication date.',source_id:s.id,captured_at:s.created_at,score:80+(important.has(s.id)?18:0)+Math.max(0,15-Math.round(age)),action_label:'Read and understand'});
  }
  if(['queued','awaiting_content','awaiting_ai','failed','processing'].includes(s.status)){
   const next=s.status==='awaiting_content'?'Add readable source text':s.status==='failed'&&s.attempts>=3?'Manual review needed':s.status==='processing'?'In progress':s.status==='awaiting_ai'?'Free AI currently unavailable':'Awaiting processing';
   push({key:'processing:'+s.id,kind:'processing',title,explanation:next+(s.error?' · '+brText(s.error,170):''),why:'Source capture is not yet a completed analysis. Attempt count: '+Number(s.attempts||0)+'.',source_id:s.id,score:75+(s.status==='awaiting_content'||s.status==='failed'?18:0),action_label:'Inspect processing'});
  }
  if(s.status==='ready'){
   const audit=auditMap.get(s.id);
   let anchored=0,claims=0,missing=0;
   if(audit)try{const a=JSON.parse(audit.content);claims=a.counts?.claims||0;anchored=a.counts?.anchored||0;missing=a.counts?.missing_or_unmatched||0}catch{}
   if(!audit||missing>0){
    push({key:'evidence:'+s.id,kind:'evidence',title,
     explanation:audit?missing+' of '+claims+' extracted claims lack matching saved-text excerpts.':'No recorded evidence audit yet.',
     why:audit?'Excerpt location is not independent fact-checking.':'Run a deterministic quotation check; this does not invoke AI.',
     source_id:s.id,score:77+(missing>0?12:0),action_label:'Inspect evidence'});
   }
  }
 }
 for(const n of concepts){
  if(!BR_ID.test(n.id))continue;
  let refs=[];try{const v=JSON.parse(n.source_refs||'[]');refs=Array.isArray(v)?v:[]}catch{}
  if(!refs.length){
   push({key:'concept:'+n.id,kind:'concept',title:brText(n.title,140),explanation:brText(n.thesis,260),why:'Evergreen concept has no linked source evidence. This is your working idea, not a verified finding.',concept_id:n.id,score:78,action_label:'Develop concept'});
  }
 }
 for(const l of learning.links.slice(-80).reverse()){
  if(!BR_ID.test(l?.from)||!BR_ID.test(l?.to)||l.from===l.to)continue;
  const key='connection:'+l.from+'-'+l.to;
  const kind=['supports','challenges','extends','questions'].includes(l.kind)?l.kind:'relates';
  const from=brText(known.get(l.from)?.title||l.fromTitle||'Saved source',90),to=brText(known.get(l.to)?.title||l.toTitle||'Saved source',90);
  push({key,kind:'connection',title:from+' / '+to,explanation:brText(l.reason,250),
   why:'A '+kind+' relationship you wrote between two saved sources, not AI-confirmed agreement.',
   source_id:l.from,other_source_id:l.to,score:62+(kind==='challenges'?13:0),action_label:'Explore connection'});
 }
 const priority={review:0,processing:1,evidence:2,reading:3,concept:4,connection:5};
 entries.sort((a,b)=>b.score-a.score||(priority[a.kind]??10)-(priority[b.kind]??10)||a.key.localeCompare(b.key));
 const preferences=await brPreferences(env),prefMap=new Map(preferences.map(p=>[p.item_key,p]));
 let hiddenCount=0;
 const selected=entries.filter(x=>{if(brHide(prefMap.get(x.key),ref)){hiddenCount++;return false}return true}).slice(0,24);
 const hidden=preferences.filter(p=>brHide(p,ref)).slice(0,15).map(p=>({key:p.item_key,hidden_until:p.hidden_until,revision:p.revision}));
 return {version:'0.5.8',generated_at:stamp,items:selected.map(x=>({...x,preference_revision:prefMap.get(x.key)?.revision||0})),
  hidden,counts:{due_reviews:due.length,processing:sources.filter(x=>x.status!=='ready').length,
   eligible_items:entries.length,hidden: hiddenCount,displayed:selected.length,concepts_missing_sources:concepts.filter(n=>{try{return !JSON.parse(n.source_refs||'[]').length}catch{return true}}).length},
  limits:{sources:100,review_sources:250,concepts:30,manual_links:80,display_items:24},
  methodology:'Transparent deterministic priority based on due study reviews, processing gaps, stored-text evidence checks, manually saved reading paths and recent CAPTURES. No live discovery, publication-date inference, AI ranking or factual corroboration.'};
}
async function brAction(req,env){
 if(req.method!=='POST')return failure('Method not allowed',405);
 const p=await payload(req,3000);
 if(!BR_KEY.test(p.item_key||'')||!['dismiss','snooze_1d','snooze_7d','restore'].includes(p.action))return failure('Invalid briefing action',422);
 if(!Number.isSafeInteger(p.expected_revision)||p.expected_revision<0)return failure('Expected nonnegative revision required',422);
 await env.DB.prepare('CREATE TABLE IF NOT EXISTS briefing_preferences (item_key TEXT PRIMARY KEY,hidden_until TEXT NOT NULL,revision INTEGER NOT NULL,updated_at TEXT NOT NULL)').run();
 const existing=await env.DB.prepare('SELECT revision FROM briefing_preferences WHERE item_key=?').bind(p.item_key).first();
 if((existing?.revision||0)!==p.expected_revision)return failure('Briefing was updated on another device. Refresh before changing it.',409);
 const stamp=now(),until=p.action==='dismiss'?'9999-12-31T23:59:59.000Z':p.action==='restore'?'':new Date(Date.now()+(p.action==='snooze_1d'?1:7)*86400000).toISOString();
 let result;
 if(!existing){
  result=await env.DB.prepare('INSERT INTO briefing_preferences(item_key,hidden_until,revision,updated_at) VALUES(?,?,1,?) ON CONFLICT(item_key) DO NOTHING').bind(p.item_key,until,stamp).run();
 }else{
  result=await env.DB.prepare('UPDATE briefing_preferences SET hidden_until=?,revision=revision+1,updated_at=? WHERE item_key=? AND revision=?').bind(until,stamp,p.item_key,p.expected_revision).run();
 }
 if(Number(result.meta?.changes)!==1)return failure('Concurrent briefing edit. Refresh and retry.',409);
 return json({ok:true,item_key:p.item_key,revision:p.expected_revision+1,hidden_until:until});
}
