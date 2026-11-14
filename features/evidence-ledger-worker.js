// Source-grounded claim–evidence ledger v1. Entirely deterministic: no AI calls,
// no external network calls and no paid services. Authenticated routes only.
// "Anchored" means an excerpt occurs in locally SAVED text, NOT that a claim
// is independently true. Stored model interpretations are explicitly labelled.
const EL_VERSION='1.0.0';
const EL_SOURCE_ID=/^[a-f0-9-]{8,80}$/i;
const elShort=(value,max)=>String(value??'').trim().slice(0,max);
const elNormalize=value=>String(value??'').toLowerCase().replace(/\s+/g,' ').trim();
async function elHash(value){
 const bytes=new TextEncoder().encode(String(value??''));
 const digest=await crypto.subtle.digest('SHA-256',bytes);
 return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
async function elTable(env){
 await env.DB.prepare('CREATE TABLE IF NOT EXISTS evidence_audits (source_id TEXT PRIMARY KEY, source_hash TEXT NOT NULL, ideas_hash TEXT NOT NULL, content TEXT NOT NULL, verified_at TEXT NOT NULL)').run();
}
async function elCurrent(env,sourceId){
 const source=await env.DB.prepare('SELECT id,title,url,source_type,retrieval,status,error,body,created_at,updated_at,attempts FROM sources WHERE id=?').bind(sourceId).first();
 if(!source)return null;
 const ideas=await rows(env.DB.prepare('SELECT id,statement,mechanism,evidence,counterargument,excerpt,tags,created_at FROM ideas WHERE source_id=? ORDER BY created_at ASC LIMIT 30').bind(sourceId));
 const body=String(source.body||''),normalBody=elNormalize(body);
 const entries=ideas.map(x=>{
  const quote=elShort(x.excerpt,1200),matching=quote.length>=12&&normalBody.includes(elNormalize(quote));
  const anchor=quote?(matching?'anchored_in_saved_text':'excerpt_not_found'):'no_source_excerpt';
  return {idea_id:x.id,claim:elShort(x.statement,900),mechanism:elShort(x.mechanism,1000),
   ai_evidence_interpretation:elShort(x.evidence,1200),
   ai_counterargument:elShort(x.counterargument,1200),
   source_excerpt:quote,excerpt_status:anchor,
   interpretation_status:'AI-authored interpretation; not independently verified',
   claim_verified:false,source_title:elShort(source.title,240)};
 });
 const sourceHash=await elHash(body);
 const ideasHash=await elHash(JSON.stringify(ideas.map(x=>[x.id,x.statement,x.mechanism,x.evidence,x.counterargument,x.excerpt])));
 const counts={claims:entries.length,anchored:entries.filter(x=>x.excerpt_status==='anchored_in_saved_text').length,
  missing_or_unmatched:entries.filter(x=>x.excerpt_status!=='anchored_in_saved_text').length};
 const coverage=body.length===0?'no_saved_text':source.retrieval==='supplied'?'user_supplied_text':source.retrieval==='pending'?'pending_extraction':
  'saved_text_extraction_may_be_incomplete';
 const issues=[];
 if(!body)issues.push('No source text is saved; no excerpt can be checked.');
 if(source.status!=='ready')issues.push('Automatic analysis has not completed: '+elShort(source.status,30));
 if(!entries.length)issues.push('No extracted claims are stored for this source.');
 if(counts.missing_or_unmatched>0)issues.push(counts.missing_or_unmatched+' claim(s) lack a matching saved-text excerpt.');
 if(coverage==='saved_text_extraction_may_be_incomplete')issues.push('Text extraction does not establish that the full original was retrieved.');
 return {algorithm:EL_VERSION,source:{id:source.id,title:elShort(source.title,240),url:source.url||'',
   source_type:source.source_type||'',retrieval:source.retrieval||'',
   analysis_status:source.status,processing_attempts:source.attempts||0,
   processing_issue:elShort(source.error,200),saved_text_characters:body.length,source_hash:sourceHash,
   captured_at:source.created_at,source_updated_at:source.updated_at,coverage},
  ideas_hash:ideasHash,claims:entries,counts,issues,
  disclosure:'A matching excerpt proves only that the quoted words occur in SAVED source text. It does not verify the claim, the source, independent facts, AI explanation or completeness of extraction.'};
}
async function elPersist(env,sourceId){
 await elTable(env);
 const live=await elCurrent(env,sourceId);
 if(!live)return null;
 const old=await env.DB.prepare('SELECT source_hash,ideas_hash,verified_at FROM evidence_audits WHERE source_id=?').bind(sourceId).first();
 if(old&&old.source_hash===live.source.source_hash&&old.ideas_hash===live.ideas_hash)return {audit:live,verified_at:old.verified_at,cached:true};
 const stamped=now();
 await env.DB.prepare('INSERT INTO evidence_audits(source_id,source_hash,ideas_hash,content,verified_at) VALUES(?,?,?,?,?) ON CONFLICT(source_id) DO UPDATE SET source_hash=excluded.source_hash,ideas_hash=excluded.ideas_hash,content=excluded.content,verified_at=excluded.verified_at')
  .bind(sourceId,live.source.source_hash,live.ideas_hash,JSON.stringify(live),stamped).run();
 return {audit:live,verified_at:stamped,cached:false};
}
async function elAuditRoute(req,env,sourceId){
 if(!EL_SOURCE_ID.test(sourceId))return failure('Invalid source ID',404);
 if(req.method!=='GET'&&req.method!=='POST')return failure('Method not allowed',405);
 if(req.method==='POST'){
  const result=await elPersist(env,sourceId);
  if(!result)return failure('Source not found',404);
  return json({...result,recorded:true});
 }
 const live=await elCurrent(env,sourceId);
 if(!live)return failure('Source not found',404);
 const exists=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='evidence_audits'").first();
 const saved=exists?await env.DB.prepare('SELECT source_hash,ideas_hash,verified_at FROM evidence_audits WHERE source_id=?').bind(sourceId).first():null;
 const current=!!saved&&saved.source_hash===live.source.source_hash&&saved.ideas_hash===live.ideas_hash;
 return json({audit:live,recorded:!!saved,up_to_date:current,verified_at:saved?.verified_at||null,stale:!!saved&&!current});
}
async function elOverview(req,env){
 if(req.method!=='GET')return failure('Method not allowed',405);
 const sources=await rows(env.DB.prepare('SELECT id,title,url,status,retrieval,error,attempts,updated_at,length(body) AS body_length FROM sources ORDER BY created_at DESC LIMIT 60'));
 const exists=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='evidence_audits'").first();
 const audits=exists?await rows(env.DB.prepare('SELECT source_id,verified_at,content FROM evidence_audits ORDER BY verified_at DESC LIMIT 60')):[];
 const saved=new Map(audits.map(x=>[x.source_id,x]));
 const entries=sources.map(s=>{
  const audit=saved.get(s.id);let count=0,anchored=0,unanchored=0;
  if(audit)try{const d=JSON.parse(audit.content);count=d.counts.claims;anchored=d.counts.anchored;unanchored=d.counts.missing_or_unmatched}catch{}
  return {id:s.id,title:elShort(sourceLabel(s),180),status:s.status,
   retrieval:s.retrieval,processing_attempts:s.attempts||0,
   processing_issue:elShort(s.error,160),last_updated:s.updated_at,
   saved_text_characters:s.body_length||0,has_recorded_audit:!!audit,
   verified_at:audit?.verified_at||null,counts:{claims:count,anchored,unanchored},
   next_action:s.status==='ready'?'Review claim evidence':s.status==='awaiting_content'?'Provide source text':
    s.status==='processing'?'Processing in progress':s.status==='failed'&&s.attempts>=3?'Manual review required':
    'Queued or waiting for free AI availability'};
 });
 return json({sources:entries,summary:{sources:entries.length,ready:entries.filter(x=>x.status==='ready').length,
   needing_attention:entries.filter(x=>['failed','awaiting_content','awaiting_ai'].includes(x.status)).length,
   audited:entries.filter(x=>x.has_recorded_audit).length},
  disclosure:'Audits check quotations against stored text, not factual truth. Processing retries are bounded; unavailable free AI capacity can delay analysis.'});
}
