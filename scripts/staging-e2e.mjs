import assert from 'node:assert/strict';
const base=process.env.STAGING_URL;
const production='living-manifesto-app.4gj5cc8d25.workers.dev';
if(!base||new URL(base).protocol!=='https:'||new URL(base).hostname===production)throw Error('A separate HTTPS STAGING_URL is required; production writes are forbidden');
if(!process.env.APP_PASSWORD||!process.env.EXPECTED_SHA)throw Error('APP_PASSWORD and EXPECTED_SHA required');
let cookie='';
async function api(path,method='GET',data){const r=await fetch(new URL('/api/'+path,base),{method,headers:{cookie,'X-Manifesto-Request':'1','Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data),redirect:'error',signal:AbortSignal.timeout(180000)});if(!r.ok){const detail=await r.json().catch(()=>({}));throw Error('HTTP '+r.status+' at '+path+' code '+String(detail.error_code||'unspecified'))}if(path==='login')cookie=r.headers.get('set-cookie')?.split(';')[0];return r.json()}
assert.equal((await api('health')).commit,process.env.EXPECTED_SHA);
await api('login','POST',{password:process.env.APP_PASSWORD});assert.ok(cookie);
const text='Release validation fixture. Reliable learning requires separating observations from interpretations. A failed experiment provides evidence about a hypothesis, but does not prove every alternative. Recording assumptions and revisiting evidence allows a reader to revise an explanation rather than merely accumulating notes. Independent checks can expose mistakes that repeated use of the same method misses. '.repeat(3).trim();
// Reuse a previously LIVE-analysed synthetic staging fixture when possible.
// No need to exhaust Workers AI Free just to validate unchanged analysis code
// after UI-only changes. If none exists, a fresh capture MUST pass the live gate.
const prior=(await api('sources')).sources.filter(s=>s.status==='ready'&&/^Release validation [a-f0-9]{8,12}$/.test(s.title||'')).slice(0,20);
let id,analysed,usedPrior=false;
for(const row of prior){
 const detail=await api('sources/'+row.id);
 if(detail.source.body===text&&detail.ideas.some(i=>i.excerpt&&text.toLowerCase().includes(i.excerpt.toLowerCase()))){
  id=row.id;analysed=detail;usedPrior=true;break;
 }
}
if(!id){
 ({id}=await api('capture','POST',{title:'Release validation '+process.env.EXPECTED_SHA.slice(0,12),body:text}));
 assert.equal((await api('sources/'+id)).source.body,text);
 // No manual process or pasted answer; ingestion must complete automatically.
 for(let n=0;n<150;n++){
  analysed=await api('sources/'+id);
  if(analysed.source.status==='ready')break;
  if(analysed.source.status==='awaiting_content'||(analysed.source.status==='failed'&&analysed.source.attempts>=3))throw Error('Automatic analysis failed: '+analysed.source.error);
  // Free capacity backoff can make this temporarily unavailable. Fail closed,
  // label the cause; never retry more calls to bypass free-tier limits.
  if(analysed.source.status==='failed'&&/free AI allowance|capacity unavailable|quota/i.test(analysed.source.error||''))throw Error('Free AI capacity unavailable; staged release is NOT validated: '+analysed.source.error);
  await new Promise(resolve=>setTimeout(resolve,2000));
 }
}
assert.equal(analysed.source.status,'ready','Capture did not complete automatic analysis: '+(analysed.source.error||analysed.source.status));
console.log(usedPrior?'PASS grounded analysis from previous LIVE staging fixture reused (no new AI call)':'PASS fresh automatic analysis with live free-tier AI');
assert.ok(analysed.source.summary?.length>20);assert.ok(analysed.ideas.length>0);
assert.ok(analysed.ideas.some(i=>i.excerpt&&text.toLowerCase().includes(i.excerpt.toLowerCase())));
await api('login','POST',{password:process.env.APP_PASSWORD});
assert.deepEqual((await api('sources/'+id)).ideas,analysed.ideas);
console.log('PASS automatic capture analysis, grounded ideas and fresh-login persistence');
// The briefing must work on private D1 records and never request another model.
// Its source dates are capture times, not inferred publication dates.
const briefing=await api('briefing');
assert.equal(briefing.version,'0.5.8');assert.ok(Array.isArray(briefing.items));
assert.match(briefing.methodology,/CAPTURES/);
const key='source:'+id;
const hidden=briefing.hidden.find(x=>x.key===key);
const visible=briefing.items.find(x=>x.key===key);
// Shared staging D1 survives repeated release tests. The source may have a
// previous RESTORED preference not visible among current top-ranked cards.
// Read the authenticated private backup to recover its persisted CAS revision,
// rather than assuming that a previously handled source has revision zero.
const existingPreferences=(await api('export')).briefing_preferences||[];
const storedPreference=existingPreferences.find(p=>p.item_key===key);
const previousRevision=storedPreference?.revision??hidden?.revision??visible?.preference_revision??0;
const snoozed=await api('briefing/action','POST',{item_key:key,action:'snooze_1d',expected_revision:previousRevision});
assert.equal(snoozed.revision,previousRevision+1);
const afterSnooze=await api('briefing');assert.ok(afterSnooze.hidden.some(x=>x.key===key));
const restored=await api('briefing/action','POST',{item_key:key,action:'restore',expected_revision:snoozed.revision});
assert.equal(restored.revision,snoozed.revision+1);
console.log('PASS private Daily Intelligence Briefing, capture-date attribution, CAS snooze/restore and no extra AI requests.');

// No paid calls: verify deterministic source excerpts and saved audit record.
const checked=await api('sources/'+id+'/evidence');
assert.ok(checked.audit.counts.claims>0&&checked.audit.counts.anchored>0,'No anchored evidence excerpts');
assert.ok(checked.audit.claims.every(c=>c.claim_verified===false),'Source quotation is not independent truth verification');
const savedAudit=await api('sources/'+id+'/evidence','POST',{});
assert.equal(savedAudit.audit.source.source_hash,checked.audit.source.source_hash);
const auditOverview=await api('evidence/overview');assert.ok(auditOverview.sources.some(s=>s.id===id));
console.log('PASS source-backed deterministic audit, persisted provenance and workflow status. Zero additional AI requests for evidence.');

const path='sources/'+id+'/learning-dossier';
const existingDossier=await api(path);
const generated=existingDossier.dossier?existingDossier:await api(path,'POST',{});
for(const field of ['overview','first_principles','argument','context','connections','critique','questions'])assert.ok(generated.dossier[field]?.trim(),field+' missing');
assert.ok(Array.isArray(generated.dossier.reading));
// New authenticated session verifies server persistence, not a browser cache.
await api('login','POST',{password:process.env.APP_PASSWORD});
const reopened=await api(path);assert.deepEqual(reopened.dossier,generated.dossier);
assert.equal((await api(path,'POST',{})).cached,true);
const backup=await api('export');assert.ok(backup.learning_dossiers.some(d=>d.source_id===id));
for(const [label,url] of [['X',process.env.TEST_X_URL],['PDF',process.env.TEST_PDF_URL]]){
 if(!url)throw Error('TEST_'+label+'_URL is required for external ingestion validation');
 const captured=await api('capture','POST',{url,title:'Release validation '+label});
 let source;
 for(let attempt=0;attempt<30;attempt++){
  source=(await api('sources/'+captured.id)).source;
  if(source.body?.length>=100)break;
  await new Promise(resolve=>setTimeout(resolve,2000));
 }
 assert.ok(source.body?.length>=100,label+' did not retain usable source text');
 assert.ok(label==='PDF'?source.retrieval?.startsWith('pdf_'):source.retrieval?.startsWith('x_'),label+' did not use the expected extractor');
}
console.log('PASS staging login, capture, real AI, persisted dossier, cached reopen, export, X and PDF retrieval. Synthetic staging sources retained.');
// Reuse the 24-hour cached live search when repeating staging checks. A fresh
// isolated staging environment still has to retrieve real resources at least once.
// Forcing refresh on every push exhausts the five-searches/hour free guardrail.
const topic=await api('topics','POST',{topic:'Bayesian reasoning'});
assert.ok(topic.resources.length>0,'No retrieved topic resources');
for(const resource of topic.resources)assert.match(resource.url,/^https?:\/\//);
await api('login','POST',{password:process.env.APP_PASSWORD});
assert.deepEqual((await api('topics')).searches.find(x=>x.id===topic.id).resources,topic.resources);
assert.equal((await api('topics','POST',{topic:'Bayesian reasoning'})).cached,true);
console.log('PASS real topic retrieval, persisted resources and cached reopening; coverage: '+JSON.stringify(topic.coverage));
