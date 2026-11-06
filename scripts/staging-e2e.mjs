import assert from 'node:assert/strict';
const base=process.env.STAGING_URL;
const production='living-manifesto-app.4gj5cc8d25.workers.dev';
if(!base||new URL(base).protocol!=='https:'||new URL(base).hostname===production)throw Error('A separate HTTPS STAGING_URL is required; production writes are forbidden');
if(!process.env.APP_PASSWORD||!process.env.EXPECTED_SHA)throw Error('APP_PASSWORD and EXPECTED_SHA required');
let cookie='';
async function api(path,method='GET',data){const r=await fetch(new URL('/api/'+path,base),{method,headers:{cookie,'X-Manifesto-Request':'1','Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data),redirect:'error',signal:AbortSignal.timeout(180000)});assert.ok(r.ok,'HTTP '+r.status+' at '+path);if(path==='login')cookie=r.headers.get('set-cookie')?.split(';')[0];return r.json()}
assert.equal((await api('health')).commit,process.env.EXPECTED_SHA);
await api('login','POST',{password:process.env.APP_PASSWORD});assert.ok(cookie);
const text='Release validation fixture. Reliable learning requires separating observations from interpretations. A failed experiment provides evidence about a hypothesis, but does not prove every alternative. Recording assumptions and revisiting evidence allows a reader to revise an explanation rather than merely accumulating notes. Independent checks can expose mistakes that repeated use of the same method misses. '.repeat(3).trim();
const {id}=await api('capture','POST',{title:'Release validation '+process.env.EXPECTED_SHA.slice(0,12),body:text});
assert.equal((await api('sources/'+id)).source.body,text);
// No process request or pasted analysis: capture alone must complete automatically.
let analysed;
for(let n=0;n<240;n++){
 analysed=await api('sources/'+id);
 if(analysed.source.status==='ready')break;
 if(analysed.source.status==='awaiting_content'||(analysed.source.status==='failed'&&analysed.source.attempts>=3))throw Error('Automatic analysis failed: '+analysed.source.error);
 await new Promise(resolve=>setTimeout(resolve,2000));
}
assert.equal(analysed.source.status,'ready','Capture did not complete automatic analysis');
assert.ok(analysed.source.summary?.length>20);assert.ok(analysed.ideas.length>0);
assert.ok(analysed.ideas.some(i=>i.excerpt&&text.toLowerCase().includes(i.excerpt.toLowerCase())));
await api('login','POST',{password:process.env.APP_PASSWORD});
assert.deepEqual((await api('sources/'+id)).ideas,analysed.ideas);
console.log('PASS automatic capture analysis, grounded ideas and fresh-login persistence');
const path='sources/'+id+'/learning-dossier';
const generated=await api(path,'POST',{});
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
