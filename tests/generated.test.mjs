import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const worker=(await import('../dist/_worker.js')).default;
const body='Compound knowledge grows through careful reading, testing assumptions and revisiting evidence. '.repeat(8).trim();
const dossier=Object.fromEntries(['overview','first_principles','argument','context','connections','critique','questions'].map(k=>[k,'A substantive explanation of '+k]));dossier.reading=[{title:'Thinking, Fast and Slow',author:'Daniel Kahneman',reason:'Judgment',level:'Introductory'}];
function database(){const db=new DatabaseSync(':memory:');return {db,prepare(sql){let args=[];const s={bind(...a){args=a;return s},async first(){return db.prepare(sql).get(...args)||null},async all(){return {results:db.prepare(sql).all(...args)}},async run(){const result=db.prepare(sql).run(...args);return {success:true,meta:{changes:Number(result.changes)}}}};return s},async batch(stmts){db.exec('BEGIN');try{const r=await Promise.all(stmts.map(s=>s.run()));db.exec('COMMIT');return r}catch(e){db.exec('ROLLBACK');throw e}}}}
async function setup(){const DB=database();let calls=0;const env={DB,APP_PASSWORD:'test-only',SESSION_SECRET:'test-only-session-secret',CONVERTER:{run:async(model,input)=>{assert.equal(model,'@cf/meta/llama-3.3-70b-instruct-fp8-fast');assert.equal(input.response_format.type,input.max_tokens===3400?'json_schema':'json_object');calls++;return {response:JSON.stringify(input.messages[0].content.includes('personal research analyst')?{summary:'Evidence improves learning.',question:'How do we check assumptions?',disciplines:['Learning'],ideas:[{statement:'Revisit evidence',mechanism:'Check assumptions',evidence:'Source assertion',counterargument:'Checks may be incomplete',excerpt:body.slice(0,90),tags:[]}],proposed_principles:[{text:'Check assumptions',rationale:'Reduce error'}],connections:[]}:dossier)}},toMarkdown:async()=>({data:body})},ASSETS:{fetch:async()=>new Response('asset')}};let cookie='';const pending=[];async function req(path,method='GET',data,extra={}){return worker.fetch(new Request('https://manifesto.example/api/'+path,{method,headers:{cookie,'X-Manifesto-Request':'1',...extra},body:data===undefined?undefined:JSON.stringify(data)}),env,{waitUntil:p=>pending.push(p)})}const login=await req('login','POST',{password:'test-only'});assert.equal(login.status,200);cookie=login.headers.get('set-cookie').split(';')[0];return {env,req,pending,calls:()=>calls}};
test('generated Worker: auth, capture, persistence, cached dossier without AI, export',async()=>{const s=await setup();assert.equal((await s.req('sources','GET',undefined,{cookie:''})).status,401);assert.equal((await s.req('capture','POST',{body},{Origin:'https://evil.example'})).status,403);const c=await s.req('capture','POST',{body,title:'Fixture'});assert.equal(c.status,201);const {id}=await c.json();assert.equal((await (await s.req('sources/'+id)).json()).source.body,body);await Promise.all(s.pending);const path='sources/'+id+'/learning-dossier';assert.equal((await (await s.req(path)).json()).dossier,null);const gen=await s.req(path,'POST',{});assert.equal(gen.status,200);assert.equal((await gen.json()).dossier.overview,dossier.overview);await s.req(path,'POST',{});assert.equal(s.calls(),2);delete s.env.CONVERTER;assert.equal((await s.req(path)).status,200);assert.equal((await s.req(path,'POST',{})).status,200);const backup=await (await s.req('export')).json();assert.equal(backup.learning_dossiers.length,1);assert.equal(backup.sources[0].body,body);s.env.DB.db.close()});
test('generated Worker: reject incomplete AI without persisting it',async()=>{const s=await setup();s.env.CONVERTER.run=async()=>({response:'{"overview":"Only one section"}'});const {id}=await (await s.req('capture','POST',{body})).json();assert.equal((await s.req('sources/'+id+'/learning-dossier','POST',{})).status,502);assert.equal((await (await s.req('sources/'+id+'/learning-dossier')).json()).dossier,null)});
test('generated Worker: X and PDF link extraction with controlled upstream fixtures',async()=>{const s=await setup();const old=globalThis.fetch;try{globalThis.fetch=async url=>String(url).includes('fxtwitter')?Response.json({tweet:{text:body,author:{name:'Fixture'}}}):new Response('%PDF-1.4 fixture',{headers:{'content-type':'text/plain'}});for(const url of ['https://x.com/fixture/status/12345678','https://example.com/fixture.pdf']){const {id}=await (await s.req('capture','POST',{url})).json();await Promise.all(s.pending);const saved=await (await s.req('sources/'+id)).json();assert.ok(saved.source.body.includes('Compound knowledge'));assert.notEqual(saved.source.retrieval,'pending')}}finally{globalThis.fetch=old}});
test('generated Worker: supplied PDF analysis and duplicate preservation',async()=>{const s=await setup();const data={title:'PDF fixture',body,analysis:{summary:'Fixture summary',ideas:[{statement:'Revisit evidence',excerpt:body.slice(0,90)}],disciplines:[],proposed_principles:[],connections:[]}};const r=await s.req('analyse-file','POST',data);assert.equal(r.status,201);const {id}=await r.json();const again=await (await s.req('analyse-file','POST',data)).json();assert.equal(again.id,id);assert.equal(again.duplicate,true)});
test('complete generated frontend boots and renders escaped dossiers',async()=>{const app={innerHTML:''};const document={getElementById:()=>app,addEventListener(){},querySelector:()=>null};const context=vm.createContext({document,navigator:{},location:{protocol:'http:'},fetch:async()=>new Response('',{status:401}),setTimeout:(fn,ms)=>setTimeout(fn,ms).unref(),clearTimeout,console,URL,localStorage:{getItem:()=>null}});vm.runInContext(readFileSync('dist/app.js','utf8'),context);await new Promise(r=>setTimeout(r,10));assert.match(app.innerHTML,/login-form/);const html=vm.runInContext(`integrated.bySource.test={overview:'<script>alert(1)</script>',reading:[]};dossierMarkup({id:'test'})`,context);assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));const topicHtml=vm.runInContext(`topics.active={topic:'<script>bad</script>',created_at:'2026-11-07',ranked:true,coverage:[],resources:[{id:'1',title:'<img src=x>',url:'https://example.org/',kind:'Web / blog',level:'Foundation',reason:'Metadata only'}]};explore()`,context);assert.ok(topicHtml.includes('topic-form'));assert.ok(!topicHtml.includes('<script>'));assert.ok(topicHtml.includes('&lt;img src=x&gt;'))});

test('generated Worker: AI failure preserves source and allows a later retry',async()=>{const s=await setup();const {id}=await (await s.req('capture','POST',{body})).json();const path='sources/'+id+'/learning-dossier';s.env.CONVERTER.run=async()=>{throw Error('Upstream unavailable')};assert.equal((await s.req(path,'POST',{})).status,503);assert.equal((await (await s.req(path)).json()).dossier,null);assert.equal((await (await s.req('sources/'+id)).json()).source.body,body);s.env.CONVERTER.run=async()=>({response:JSON.stringify(dossier)});assert.equal((await s.req(path,'POST',{})).status,200);assert.equal((await (await s.req(path)).json()).dossier.overview,dossier.overview)});

test('automatic analysis: capture completes without a prompt, repeat processing preserves results',async()=>{
 const s=await setup();const {id}=await (await s.req('capture','POST',{body,title:'Automatic fixture'})).json();await Promise.all(s.pending);
 const saved=await (await s.req('sources/'+id)).json();assert.equal(saved.source.status,'ready',saved.source.error);assert.ok(saved.source.summary);assert.equal(saved.ideas.length,1);assert.equal(saved.ideas[0].excerpt,body.slice(0,90));
 await s.req('sources/'+id+'/process','POST',{});await Promise.all(s.pending);assert.equal(s.calls(),1);assert.deepEqual((await (await s.req('sources/'+id)).json()).ideas,saved.ideas);
 assert.equal((await s.req('sources/'+id+'/text','POST',{body:'Replacement '.repeat(20)})).status,409);
 const beliefs=(await (await s.req('beliefs')).json()).beliefs;assert.equal(beliefs.length,1);assert.equal(beliefs[0].status,'proposed');
});
test('automatic analysis: invalid output preserves source, scheduled retry recovers',async()=>{
 const s=await setup(),run=s.env.CONVERTER.run;s.env.CONVERTER.run=async()=>({response:'{"summary":"Incomplete","ideas":[]}'});
 const {id}=await (await s.req('capture','POST',{body})).json();await Promise.all(s.pending);assert.equal((await (await s.req('sources/'+id)).json()).source.status,'failed');assert.equal(s.env.DB.db.prepare('SELECT count(*) n FROM ideas').get().n,0);
 s.env.CONVERTER.run=run;const pending=[];await worker.scheduled({},s.env,{waitUntil:p=>pending.push(p)});await Promise.all(pending);assert.equal((await (await s.req('sources/'+id)).json()).source.status,'ready');
});
test('automatic analysis: abandoned processing recovered and quota retries delayed',async()=>{
 const s=await setup();s.env.CONVERTER.run=async()=>{throw Error('429 quota exceeded')};const {id}=await (await s.req('capture','POST',{body})).json();await Promise.all(s.pending);
 const row=(await (await s.req('sources/'+id)).json()).source;assert.equal(row.status,'failed');assert.ok(Date.parse(row.updated_at)>Date.now()+23*3600000);assert.equal(row.body,body);
 const pending=[];await worker.scheduled({},s.env,{waitUntil:p=>pending.push(p)});await Promise.all(pending);assert.equal((await (await s.req('sources/'+id)).json()).source.attempts,1);
 s.env.DB.db.prepare("UPDATE sources SET status='processing',updated_at=? WHERE id=?").run(new Date(Date.now()-6*60000).toISOString(),id);
 await worker.scheduled({},s.env,{waitUntil:p=>pending.push(p)});await Promise.all(pending);assert.equal((await (await s.req('sources/'+id)).json()).source.attempts,2);
});
test('automatic analysis: share sheet intake starts analysis',async()=>{
 const s=await setup();const r=await s.req('shortcut-intake','POST',{text:body,title:'Shared fixture'});const data=await r.json();assert.equal(r.status,200);assert.equal(data.processing_automatically,true);assert.equal(data.ready_for_analysis,false);await Promise.all(s.pending);assert.equal((await (await s.req('sources/'+data.source_id)).json()).source.status,'ready');
});
test('topics: authenticated retrieved resources, grounded ranking, caching and export',async()=>{
 const s=await setup(),old=globalThis.fetch;let searches=0;
 const fixture='<h2 class="result__title"><a class="result__a" href="https://example.org/learning">Learning &amp; evidence</a></h2><a class="result__snippet">A foundation in evidence.</a><h2 class="result__title"><a class="result__a" href="javascript:alert(1)">Unsafe</a></h2>';
 try{globalThis.fetch=async(url,opts)=>{assert.equal(opts.redirect,'manual','Workers supports manual redirects');searches++;return new Response(fixture)};s.env.CONVERTER.run=async()=>({response:JSON.stringify({resources:[{id:'999',reason:'Invented'},{id:'1',reason:'Foundation based on snippet',level:'Foundation'},{id:'1',reason:'Duplicate'}]})});
 assert.equal((await s.req('topics','GET',undefined,{cookie:''})).status,401);
 assert.equal((await s.req('topics','POST',{topic:'Learning'},{Origin:'https://evil.example'})).status,403);
 const r=await s.req('topics','POST',{topic:'Learning'});assert.equal(r.status,200);const data=await r.json();assert.equal(data.resources.length,1);assert.equal(data.resources[0].url,'https://example.org/learning');assert.equal(data.ranked,true);assert.equal(searches,6);
 assert.equal((await (await s.req('topics','POST',{topic:'learning'})).json()).cached,true);assert.equal(searches,6);
 assert.equal((await (await s.req('topics')).json()).searches[0].id,data.id);assert.equal((await (await s.req('export')).json()).topic_searches.length,1);
 }finally{globalThis.fetch=old}
});
test('topics: provider challenge stops searches; no invented resources persisted',async()=>{
 const s=await setup(),old=globalThis.fetch;let calls=0;
 try{globalThis.fetch=async()=>{calls++;return new Response('<form class="challenge-form">',{status:202})};assert.equal((await s.req('topics','POST',{topic:'Evidence'})).status,503);assert.equal(calls,3);assert.equal((await (await s.req('topics')).json()).searches.length,0)}finally{globalThis.fetch=old}
});
test('topics: independent scholarly retrieval works when general search is blocked',async()=>{
 const s=await setup(),old=globalThis.fetch;delete s.env.CONVERTER;
 try{globalThis.fetch=async url=>String(url).includes('api.crossref.org')?Response.json({message:{items:[{title:['Evidence and inference'],URL:'https://doi.org/10.1234/example',author:[{given:'A',family:'Scholar'}]}]}}):new Response('unavailable',{status:503});const r=await s.req('topics','POST',{topic:'Evidence'});assert.equal(r.status,200);const d=await r.json();assert.equal(d.resources[0].kind,'Paper / book');assert.equal(d.ranked,false);assert.ok(d.coverage.some(x=>x.kind==='Web / blog'&&x.status.includes('limited')))}finally{globalThis.fetch=old}
});


test('Learning Studio: client-only recall, paths, links, backup validation and escaped markup',async()=>{
 const app={innerHTML:''},items=new Map();
 const storage={getItem:k=>items.get(k)||null,setItem:(k,v)=>items.set(k,v)};
 const document={getElementById:()=>app,addEventListener(){},querySelector:()=>null};
 const context=vm.createContext({document,navigator:{},location:{protocol:'http:'},fetch:async()=>new Response('',{status:401}),setTimeout:(fn,ms)=>setTimeout(fn,ms).unref(),clearTimeout,console,URL,localStorage:storage});
 vm.runInContext(readFileSync('dist/app.js','utf8'),context);
 await new Promise(r=>setTimeout(r,10));
 assert.match(app.innerHTML,/login-form/);
 const source={id:'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',title:'<script>alert(1)</script>',body:'<b>Untrusted source evidence</b>'};
 const html=vm.runInContext('studioMarkup('+JSON.stringify(source)+')',context);
 assert.ok(html.includes('Learning Studio'));
 assert.ok(!html.includes('<script>'));
 assert.ok(html.includes('Can you explain it without looking?'));
 assert.ok(html.includes('Save answer and schedule review'));
 assert.ok(html.includes('Connect this source to another'));
 const backup={version:1,reviews:{[source.id]:[{title:source.title,answer:'This is a review answer with adequate detail.',confidence:'high',next_review:new Date().toISOString()}]},paths:[{name:'Investing',items:[{id:source.id,title:source.title}]}],links:[]};
 vm.runInContext('studioImport('+JSON.stringify(JSON.stringify(backup))+')',context);
 assert.ok(items.get('lm-learning-studio-v1').includes('Investing'));
 const summary=vm.runInContext('studioOverview()',context);
 assert.ok(summary.includes('&lt;script&gt;')&& !summary.includes('<script>'));
 assert.ok(summary.includes('review(s) due'));
 assert.throws(()=>vm.runInContext('studioImport('+JSON.stringify('{"version":2}')+')',context));
 assert.equal(items.get('lm-learning-studio-v1').includes('Investing'),true);
});


test('Learning Studio cloud: authenticated revision-checked D1 sync and export preservation',async()=>{
 const s=await setup();
 assert.equal((await s.req('studio-state','GET',undefined,{cookie:''})).status,401);
 assert.equal((await s.req('studio-state','POST',{expected_revision:0,state:{version:1,reviews:{},paths:[],links:[]}},{Origin:'https://untrusted.example'})).status,403);
 const initial=await (await s.req('studio-state')).json();assert.equal(initial.revision,0);assert.deepEqual(initial.state,{version:1,reviews:{},paths:[],links:[]});
 const first=await (await s.req('capture','POST',{body,title:'Source for study'})).json();await Promise.all(s.pending);
 const v1={version:1,reviews:{[first.id]:[{title:'Source for study',question:'What is the evidence?',answer:'A careful reader compares claims with quotations from the article.',confidence:'medium',created_at:'2026-11-07T11:00:00Z',next_review:'2026-11-10T11:00:00Z'}]},paths:[{name:'Critical reading',items:[{id:first.id,title:'Source for study'}]}],links:[]};
 const saved=await s.req('studio-state','POST',{expected_revision:0,state:v1});assert.equal(saved.status,200);assert.equal((await saved.json()).revision,1);
 assert.equal((await s.req('studio-state','POST',{expected_revision:0,state:v1})).status,409,'A stale device must never overwrite the newer state');
 const restored=await (await s.req('studio-state')).json();assert.equal(restored.revision,1);assert.equal(restored.state.reviews[first.id][0].confidence,'medium');
 assert.equal((await s.req('studio-state','POST',{expected_revision:1,state:{version:2,reviews:{},paths:[],links:[]}})).status,422);
 const exportData=await (await s.req('export')).json();assert.ok(exportData.studio_state?.some(x=>JSON.parse(x.content).paths[0].name==='Critical reading'));
 assert.equal((await (await s.req('sources/'+first.id)).json()).source.body,body,'Existing saved text must not be changed by studying');
});
test('Knowledge graph: authentic shared tags, grounded excerpts and manual claim distinctions',async()=>{
 const s=await setup();
 const first=(await (await s.req('capture','POST',{body,title:'Bayesian source one'})).json()).id;
 const second=(await (await s.req('capture','POST',{body,title:'Bayesian source two'})).json()).id;
 await Promise.all(s.pending);
 for(const id of [first,second]){
  s.env.DB.db.prepare('UPDATE sources SET disciplines=? WHERE id=?').run(JSON.stringify(['Reasoning and evidence']),id);
  s.env.DB.db.prepare('UPDATE ideas SET tags=?,excerpt=? WHERE source_id=?').run(JSON.stringify(['Bayesian reasoning']),body.slice(0,90),id);
 }
 const note='Both sources examine inference from evidence but disagree about the weight of the prior.';
 const saved={version:1,reviews:{},paths:[],links:[{from:first,to:second,fromTitle:'Bayesian one',toTitle:'Bayesian two',kind:'challenges',reason:note}]};
 assert.equal((await s.req('studio-state','POST',{expected_revision:0,state:saved})).status,200);
 assert.equal((await s.req('knowledge-graph','GET',undefined,{cookie:''})).status,401);
 const g=await (await s.req('knowledge-graph')).json();
 assert.ok(g.concepts.some(x=>x.label==='Bayesian reasoning'&&x.mentions.length===2));
 const shared=g.concepts.find(x=>x.label==='Bayesian reasoning');
 assert.ok(shared.mentions.every(x=>x.basis==='idea tag'&&body.includes(x.evidence)));
 assert.equal(g.manual_links[0].kind,'challenges');
 assert.equal(g.manual_links[0].reason,note);
 assert.match(g.disclosure,/not proof/i);
 assert.equal(g.sources.some(x=>x.id===first),true);
 assert.equal(g.sources.some(x=>x.id===second),true);
 assert.ok(g.concepts.every(x=>x.mentions.length>=2));
});
test('Synced Learning Studio frontend: conflict-merge preserves offline entries; graph escapes untrusted labels',async()=>{
 const app={innerHTML:''},storage=new Map(),localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
 const document={getElementById:()=>app,addEventListener(){},querySelector:()=>null,activeElement:null};
 const context=vm.createContext({document,navigator:{},location:{protocol:'http:'},fetch:async()=>new Response('',{status:401}),setTimeout:(fn,ms)=>setTimeout(fn,ms).unref(),clearTimeout,console,URL,localStorage});
 vm.runInContext(readFileSync('dist/app.js','utf8'),context);
 await new Promise(r=>setTimeout(r,10));
 const idA='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',idB='bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
 const left={version:1,reviews:{[idA]:[{answer:'An initial long answer with evidence.',created_at:'2026-11-01T00:00:00Z'}]},paths:[{name:'Evidence',items:[{id:idA,title:'A'}]}],links:[]};
 const right={version:1,reviews:{[idA]:[{answer:'A different long answer with evidence.',created_at:'2026-11-02T00:00:00Z'}]},paths:[{name:'Evidence',items:[{id:idB,title:'B'}]}],links:[{from:idA,to:idB,fromTitle:'A',toTitle:'B',kind:'supports',reason:'A source links another source'}]};
 const merged=vm.runInContext('studioMerge('+JSON.stringify(left)+','+JSON.stringify(right)+')',context);
 assert.equal(merged.reviews[idA].length,2);assert.equal(merged.paths[0].items.length,2);assert.equal(merged.links.length,1);
 const malicious='<img src=x onerror=alert(1)>';
 const graph={sources:[{id:idA,title:'A'},{id:idB,title:'B'}],concepts:[{id:'concept:example',label:malicious,mentions:[{source_id:idA,title:malicious,basis:'idea tag',evidence:malicious},{source_id:idB,title:'B',basis:'analysis discipline',evidence:'Evidence'}]}],manual_links:[],disclosure:''};
 const html=vm.runInContext('learningCloud.graph='+JSON.stringify(graph)+';graphMarkup()',context);
 assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
 assert.ok(!html.includes('<img src=x'));
});


test('Evergreen concepts: authenticated user writing, grounded quotations, version conflict and history',async()=>{
 const s=await setup();
 const r1=await (await s.req('capture','POST',{title:'Research Alpha',body})).json();
 const r2=await (await s.req('capture','POST',{title:'Research Beta',body})).json();
 await Promise.all(s.pending);
 assert.equal((await s.req('evergreen','GET',undefined,{cookie:''})).status,401);
 assert.equal((await s.req('evergreen','POST',{title:'Concept'},{Origin:'https://evil.example'})).status,403);
 const firstNote={title:'Evidence and inference',thesis:'We should update beliefs when credible evidence is received.',content:'The foundation is to compare what the source actually says to alternative hypotheses, not merely quote conclusions.',source_refs:[],related:[],archived:false};
 const a=await s.req('evergreen','POST',firstNote);assert.equal(a.status,201);const created=(await a.json()).note;
 assert.equal(created.revision,1);assert.equal(created.title,firstNote.title);
 const quote=body.slice(0,90);
 const withQuote={...firstNote,source_refs:[{source_id:r1.id,relation:'supports',quote,comment:'A verbatim stored excerpt supports this claim.'}]};
 const saved=await s.req('evergreen/'+created.id,'PUT',{revision:1,note:withQuote});assert.equal(saved.status,200);
 const note=(await saved.json()).note;assert.equal(note.revision,2);
 assert.equal(note.source_refs[0].quote,quote);
 const bad=await s.req('evergreen/'+created.id,'PUT',{revision:2,note:{...withQuote,source_refs:[{source_id:r1.id,relation:'supports',quote:'This is an invented quotation absent from the source.',comment:'Invalid'}]}});assert.equal(bad.status,422);
 assert.equal((await s.req('evergreen/'+created.id,'PUT',{revision:1,note:withQuote})).status,409);
 const history=(await (await s.req('evergreen/'+created.id+'/history')).json()).history;assert.equal(history[0].revision,1);
 assert.equal(JSON.parse(history[0].snapshot).title,firstNote.title);
 assert.equal((await (await s.req('evergreen/'+created.id)).json()).note.revision,2);
 const b=(await (await s.req('evergreen','POST',{...firstNote,title:'Prior probabilities'})).json()).note;
 const withRelated={...withQuote,related:[{note_id:b.id,relation:'qualifies',reason:'This concept explains the role of prior uncertainty.'}]};
 assert.equal((await s.req('evergreen/'+created.id,'PUT',{revision:2,note:withRelated})).status,200);
 const copy=(await (await s.req('export')).json());assert.ok(copy.evergreen_notes.some(n=>n.id===created.id));assert.ok(copy.evergreen_history.some(h=>h.note_id===created.id));
 assert.equal((await (await s.req('sources/'+r1.id)).json()).source.body,body);
});
test('Evergreen concepts: portable Markdown, JSON and Canvas reflect only stored sources',async()=>{
 const s=await setup();const source=(await (await s.req('capture','POST',{title:'Original Source',body})).json()).id;
 await Promise.all(s.pending);
 const first={title:'Causal inference',thesis:'Causality needs an argument beyond observational correlation.',content:'Separate observed outcomes from proposed mechanisms and consider plausible confounding variables.',source_refs:[{source_id:source,relation:'supports',quote:body.slice(0,90),comment:'A source excerpt with exact provenance.'}],related:[],archived:false};
 const note=(await (await s.req('evergreen','POST',first)).json()).note;
 const md=await s.req('evergreen/export?format=markdown');assert.equal(md.status,200);
 const text=await md.text();assert.ok(text.includes('Causal inference'));assert.ok(text.includes(body.slice(0,90)));assert.ok(text.includes(source));
 const canvas=await (await s.req('evergreen/export?format=canvas')).json();
 assert.ok(canvas.nodes.some(x=>x.id==='note-'+note.id));assert.ok(canvas.nodes.some(x=>x.id==='source-'+source));
 assert.ok(canvas.edges.some(x=>x.toNode==='source-'+source));
 const jsonBackup=await (await s.req('evergreen/export?format=json')).json();assert.equal(jsonBackup.format,'evergreen-v1');assert.equal(jsonBackup.notes[0].id,note.id);
 assert.equal((await s.req('evergreen/export?format=invalid')).status,422);
 assert.equal((await s.req('evergreen/export?format=json','GET',undefined,{cookie:''})).status,401);
});
test('Evergreen interface: author content, URLs and concept labels are HTML-escaped',async()=>{
 const app={innerHTML:''},document={getElementById:()=>app,addEventListener(){},querySelector:()=>null};
 const context=vm.createContext({document,navigator:{},location:{protocol:'http:'},fetch:async()=>new Response('',{status:401}),setTimeout:(fn,ms)=>setTimeout(fn,ms).unref(),clearTimeout,console,URL,localStorage:{getItem:()=>null}});
 vm.runInContext(readFileSync('dist/app.js','utf8'),context);
 await new Promise(r=>setTimeout(r,10));
 const malicious='<img src=x onerror=alert(1)>';
 const note={id:'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',title:malicious,thesis:malicious+' is untrusted content',content:malicious+' with a substantive explanation and counterarguments',source_refs:[{source_id:'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',title:malicious,relation:'supports',quote:malicious,comment:malicious}],related:[],revision:1,archived:false,updated_at:'2026-11-08'};
 const html=vm.runInContext('evergreen.loaded=true;evergreen.items=['+JSON.stringify(note)+'];evergreen.active='+JSON.stringify(note)+';evergreenMarkup()',context);
 assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));assert.ok(!html.includes('<img src=x'));
 assert.ok(html.includes('Export Markdown')&&html.includes('Export JSON Canvas'));
 assert.ok(html.includes('Source provenance'));
});


test('Claim–evidence ledger: post-analysis audit is stored, grounded and makes no extra AI calls',async()=>{
 const s=await setup();
 const id=(await (await s.req('capture','POST',{title:'Evidence fixture',body})).json()).id;
 await Promise.all(s.pending);
 const countBefore=s.calls();
 const get=await s.req('sources/'+id+'/evidence');
 assert.equal(get.status,200);
 const data=await get.json();
 assert.equal(data.audit.counts.claims,1);
 assert.equal(data.audit.counts.anchored,1);
 assert.equal(data.audit.counts.missing_or_unmatched,0);
 assert.equal(data.audit.claims[0].claim_verified,false,'Do not conflate an anchored quotation with true claim');
 assert.equal(data.audit.claims[0].excerpt_status,'anchored_in_saved_text');
 assert.equal(data.audit.source.source_hash.length,64);
 assert.ok(data.audit.claims[0].source_excerpt.length>20);
 assert.match(data.audit.claims[0].interpretation_status,/not independently verified/);
 assert.equal(data.recorded,true,'Audit should be saved after automatic processing');
 assert.equal(data.up_to_date,true);
 const row=s.env.DB.db.prepare('SELECT source_hash,content FROM evidence_audits WHERE source_id=?').get(id);
 assert.equal(row.source_hash,data.audit.source.source_hash);
 assert.equal(JSON.parse(row.content).counts.anchored,1);
 const rec=await s.req('sources/'+id+'/evidence','POST',{});
 assert.equal(rec.status,200);
 assert.equal((await rec.json()).cached,true,'Identical rechecks must not write another D1 snapshot');
 assert.equal(s.calls(),countBefore,'Evidence work must not invoke any AI model');
 const backup=await (await s.req('export')).json();
 assert.ok(backup.evidence_audits.some(x=>x.source_id===id),'Private backups must contain audit snapshots');
});
test('Claim–evidence ledger: stale quote, missing source and authorisation are detected without trusting AI',async()=>{
 const s=await setup(),id=(await (await s.req('capture','POST',{title:'Assertion fixture',body})).json()).id;
 await Promise.all(s.pending);
 assert.equal((await s.req('sources/'+id+'/evidence','GET',undefined,{cookie:''})).status,401);
 assert.equal((await s.req('evidence/overview','GET',undefined,{cookie:''})).status,401);
 assert.equal((await s.req('sources/'+id+'/evidence','POST',{}, {Origin:'https://evil.example'})).status,403);
 const known=s.env.DB.db.prepare('SELECT id FROM ideas WHERE source_id=?').get(id).id;
 s.env.DB.db.prepare('UPDATE ideas SET excerpt=? WHERE id=?').run('Invented quotation nowhere in the original saved source',known);
 const before=await (await s.req('sources/'+id+'/evidence')).json();
 assert.equal(before.stale,true);assert.equal(before.audit.counts.anchored,0);
 assert.equal(before.audit.claims[0].excerpt_status,'excerpt_not_found');
 const updated=await (await s.req('sources/'+id+'/evidence','POST',{})).json();
 assert.equal(updated.cached,false);
 assert.equal(updated.audit.counts.missing_or_unmatched,1);
 assert.match(updated.audit.issues.join(' '),/matching saved-text excerpt/);
 const overview=await (await s.req('evidence/overview')).json();
 assert.ok(overview.sources.some(x=>x.id===id&&x.has_recorded_audit));
 const future=await s.req('sources/aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa/evidence');
 assert.equal(future.status,404);
 const source=(await (await s.req('sources/'+id)).json()).source;
 assert.equal(source.body,body);
 assert.equal((await s.req('evidence/overview','POST',{})).status,405);
});
test('Claim–evidence ledger frontend: source claims and processing errors are escaped',async()=>{
 const app={innerHTML:''},document={getElementById:()=>app,addEventListener(){},querySelector:()=>null};
 const context=vm.createContext({document,navigator:{},location:{protocol:'http:'},fetch:async()=>new Response('',{status:401}),setTimeout:(fn,ms)=>setTimeout(fn,ms).unref(),clearTimeout,console,URL,localStorage:{getItem:()=>null}});
 vm.runInContext(readFileSync('dist/app.js','utf8'),context);
 await new Promise(r=>setTimeout(r,10));
 const id='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',malicious='<img src=x onerror=alert(1)>';
 const row={audit:{source:{id,retrieval:'supplied',saved_text_characters:300,analysis_status:'ready',source_hash:'a'.repeat(64)},counts:{claims:1,anchored:0,missing_or_unmatched:1},issues:[malicious],claims:[{claim:malicious,excerpt_status:'no_source_excerpt',source_excerpt:malicious,mechanism:malicious,ai_evidence_interpretation:malicious,ai_counterargument:malicious}]},verified_at:null,stale:false};
 const html=vm.runInContext('evidenceUI.bySource['+JSON.stringify(id)+']='+JSON.stringify(row)+';evidenceMarkup({id:'+JSON.stringify(id)+'})',context);
 assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
 assert.ok(!html.includes('<img src=x'));
 assert.ok(html.includes('NOT independently verified'));
 assert.ok(html.includes('Record / refresh evidence check'));
 const summary={summary:{ready:1,sources:1,needing_attention:1,audited:0},sources:[{id,title:malicious,status:'failed',processing_attempts:3,processing_issue:malicious,next_action:'Manual review required'}]};
 const overview=vm.runInContext('evidenceUI.overview='+JSON.stringify(summary)+';evidenceOverviewMarkup()',context);
 assert.ok(!overview.includes('<img src=x'));
 assert.ok(overview.includes('Manual review required'));
});


test('Daily briefing: prioritises captured-not-published sources, due recall and uncited concepts without new model calls',async()=>{
 const s=await setup();
 const source=(await (await s.req('capture','POST',{title:'Evidence and learning',body})).json()).id;
 await Promise.all(s.pending);
 const before=s.calls();
 const first=await s.req('briefing');
 assert.equal(first.status,200);
 const data=await first.json();
 assert.equal(data.version,'0.5.8');assert.equal(data.limits.sources,100);
 assert.match(data.methodology,/CAPTURES/);
 assert.ok(data.items.some(x=>x.key==='source:'+source&&x.kind==='reading'));
 assert.ok(data.items.find(x=>x.key==='source:'+source).why.includes('not its publication date'));
 assert.ok(!data.items.some(x=>x.key==='evidence:'+source),'Recorded source audit must not be described as missing');
 assert.equal(s.calls(),before,'The briefing must not make model inference requests');
 const due=new Date(Date.now()-86400000).toISOString(),stamp=new Date().toISOString();
 const studio={version:1,reviews:{[source]:[{title:'Evidence and learning',question:'What changed?',answer:'The evidence requires revisiting the explanation and its assumptions.',confidence:'low',created_at:stamp,next_review:due}]},paths:[{name:'Research',items:[{id:source,title:'Evidence and learning'}]}],links:[]};
 s.env.DB.db.prepare('CREATE TABLE IF NOT EXISTS studio_state (key TEXT PRIMARY KEY,content TEXT NOT NULL,revision INTEGER NOT NULL,updated_at TEXT NOT NULL)').run();
 s.env.DB.db.prepare("INSERT INTO studio_state(key,content,revision,updated_at) VALUES('owner',?,1,?)").run(JSON.stringify(studio),stamp);
 const next=await (await s.req('briefing')).json();
 assert.ok(next.items.some(x=>x.key==='review:'+source&&x.kind==='review'));
 assert.ok(!next.items.some(x=>x.key==='source:'+source),'Already studied sources must not masquerade as unread');
 const evergreen={title:'Theory of evidence',thesis:'A thesis should change when better evidence becomes available.',content:'Evidence quality must be evaluated separately from the plausibility of a claim.',source_refs:[],related:[],archived:false};
 const note=(await (await s.req('evergreen','POST',evergreen)).json()).note;
 const last=await (await s.req('briefing')).json();
 assert.ok(last.items.some(x=>x.key==='concept:'+note.id&&x.kind==='concept'));
 assert.equal(s.calls(),before);
});
test('Daily briefing: preference revisions, snoozes, restoring and authenticated privacy',async()=>{
 const s=await setup(),source=(await (await s.req('capture','POST',{title:'Preference fixture',body})).json()).id;await Promise.all(s.pending);
 assert.equal((await s.req('briefing','GET',undefined,{cookie:''})).status,401);
 assert.equal((await s.req('briefing/action','POST',{item_key:'source:'+source,action:'dismiss',expected_revision:0},{cookie:''})).status,401);
 assert.equal((await s.req('briefing/action','POST',{item_key:'source:'+source,action:'dismiss',expected_revision:0},{Origin:'https://other.example'})).status,403);
 assert.equal(s.env.DB.db.prepare("SELECT name FROM sqlite_master WHERE name='briefing_preferences'").get(),undefined,'GET must not create tables');
 const item='source:'+source;
 let update=await s.req('briefing/action','POST',{item_key:item,action:'snooze_1d',expected_revision:0});
 assert.equal(update.status,200);assert.equal((await update.json()).revision,1);
 let data=await (await s.req('briefing')).json();assert.ok(!data.items.some(x=>x.key===item));assert.ok(data.hidden.some(x=>x.key===item&&x.revision===1));
 assert.equal((await s.req('briefing/action','POST',{item_key:item,action:'dismiss',expected_revision:0})).status,409,'Stale device must not overwrite hidden state');
 assert.equal((await s.req('briefing/action','POST',{item_key:'invalid key',action:'restore',expected_revision:0})).status,422);
 assert.equal((await s.req('briefing/action','POST',{item_key:item,action:'nonsense',expected_revision:1})).status,422);
 update=await s.req('briefing/action','POST',{item_key:item,action:'restore',expected_revision:1});assert.equal(update.status,200);
 data=await (await s.req('briefing')).json();
 assert.ok(data.items.some(x=>x.key===item&&x.preference_revision===2));
 assert.ok(!data.hidden.some(x=>x.key===item));
 const backup=await (await s.req('export')).json();assert.ok(backup.briefing_preferences.some(x=>x.item_key===item));
});
test('Daily briefing: incomplete sources and explicit user-authored connections are not presented as verified',async()=>{
 const s=await setup(),a=(await (await s.req('capture','POST',{title:'First source',body})).json()).id;
 const b=(await (await s.req('capture','POST',{title:'Other source',body})).json()).id;await Promise.all(s.pending);
 const problem='<img src=x onerror=alert(1)>';
 s.env.DB.db.prepare("UPDATE sources SET status='failed',attempts=3,error=? WHERE id=?").run(problem,a);
 s.env.DB.db.prepare('CREATE TABLE IF NOT EXISTS studio_state (key TEXT PRIMARY KEY,content TEXT NOT NULL,revision INTEGER NOT NULL,updated_at TEXT NOT NULL)').run();
 const state={version:1,reviews:{},paths:[],links:[{from:a,to:b,fromTitle:'First source',toTitle:'Other source',kind:'challenges',reason:'The second article challenges the mechanisms claimed in the first.'}]};
 s.env.DB.db.prepare("INSERT INTO studio_state(key,content,revision,updated_at) VALUES('owner',?,1,?)").run(JSON.stringify(state),new Date().toISOString());
 const result=await (await s.req('briefing')).json();
 assert.ok(result.attention.some(x=>x.key==='processing:'+a&&x.explanation.includes(problem)));
 assert.ok(result.items.some(x=>x.kind==='connection'&&x.why.includes('you wrote')&&x.why.includes('not AI-confirmed')));
 assert.ok(result.items.every(x=>!x.why.includes('published today')));
 assert.equal((await s.req('briefing','POST',{})).status,405);
});
test('Daily briefing UI: escapes untrusted titles and renders independent source actions',async()=>{
 const app={innerHTML:''},document={getElementById:()=>app,addEventListener(){},querySelector:()=>null};
 const context=vm.createContext({document,navigator:{},location:{protocol:'http:'},fetch:async()=>new Response('',{status:401}),setTimeout:(fn,ms)=>setTimeout(fn,ms).unref(),clearTimeout,console,URL,localStorage:{getItem:()=>null}});
 vm.runInContext(readFileSync('dist/app.js','utf8'),context);
 await new Promise(r=>setTimeout(r,10));
 const evil='<img src=x onerror=alert(1)>',id='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
 const report={version:'0.5.8',generated_at:new Date().toISOString(),counts:{due_reviews:1,processing:1,concepts_missing_sources:0},items:[{key:'processing:'+id,kind:'processing',title:evil,explanation:evil,why:evil,source_id:id,preference_revision:0,action_label:'Inspect processing'}],hidden:[]};
 const html=vm.runInContext('briefing.data='+JSON.stringify(report)+';briefing.filter="processing";briefingMarkup()',context);
 assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));assert.ok(!html.includes('<img src=x'));
 assert.ok(html.includes('Snooze 1 day')&&html.includes('Dismiss'));
 assert.ok(html.includes('Capture dates are not publication dates'));
 assert.ok(html.includes('data-source="'+id+'"'));
});

test('Health readiness: exact built Git SHA is embedded in PUBLIC health, not private briefing payload',async()=>{
 const s=await setup();
 const health=await (await s.req('health')).json();
 assert.equal(health.version,'0.5.12');
 assert.match(health.commit,/^[0-9a-f]{40}$/);
 const result=await (await s.req('briefing')).json();
 assert.equal(result.version,'0.5.8');
 assert.equal(Object.hasOwn(result,'commit'),false,'Source app commit must not be accidentally injected into briefing data');
});

test('Deeper summaries: same model invocation, bounded head-and-tail source context and honest omissions',async()=>{
 const s=await setup();
 let runs=0,request;
 const original=body;
 const long='LEAD UNIQUE research hypothesis: evidence quality matters. '.repeat(150)+
   'MIDDLE OMITTED: extensive arguments and counterexamples. '.repeat(180)+
   'ENDING UNIQUE conclusion: specific missing observations would change the answer. '.repeat(50);
 s.env.CONVERTER.run=async (model,input)=>{
  runs++;request=input;
  const raw=JSON.parse(input.messages[1].content);
  assert.ok(raw.body.includes('LEAD UNIQUE'));
  assert.ok(raw.body.includes('ENDING UNIQUE'));
  assert.ok(!raw.body.includes('MIDDLE OMITTED'),'A large middle section should not be disguised as model-read text');
  assert.equal(raw.source_text_sampling,'beginning_and_ending_only');
  assert.equal(raw.source_text_characters,long.trim().length,'Capture normalises surrounding whitespace before storing source text');
  assert.ok(raw.body.length<=10000,'No increase in source character budget');
  assert.ok(input.messages[0].content.includes('central')||input.messages[0].content.includes('CENTRAL THESIS'));
  assert.equal(input.max_tokens,2400,'The same automatic output-token cap must be retained');
  return {response:JSON.stringify({summary:'The central thesis is that evidence should be revisited. This source is partially sampled.',question:'Which evidence would change your mind?',disciplines:['Research'],ideas:[{statement:'Evidence strength matters for conclusions',mechanism:'Weigh the claim against independent observations',evidence:'The source asserts quality matters, but does not independently prove it',counterargument:'Alternative evidence may overturn the account',excerpt:long.slice(0,90),tags:['Evidence']}],proposed_principles:[],connections:[]})};
 };
 const id=(await (await s.req('capture','POST',{title:'Large source analysis',body:long})).json()).id;
 await Promise.all(s.pending);
 assert.equal(runs,1,'Automatic capture must use one model call only');
 const saved=(await (await s.req('sources/'+id)).json());
 assert.equal(saved.source.status,'ready',saved.source.error||'Automatic analysis failed without an error string');
 assert.ok(saved.source.body.includes('MIDDLE OMITTED'),'Full saved original must remain intact');
 assert.equal(saved.ideas.length,1);
 assert.ok(saved.ideas[0].excerpt.length>=12);
});
test('Deeper summaries: existing source detail is reconstructed from saved ideas without AI',async()=>{
 const vmContext=vm.createContext({document:{getElementById:()=>({innerHTML:''}),addEventListener(){},querySelector:()=>null},navigator:{},location:{protocol:'http:'},fetch:async()=>new Response('',{status:401}),setTimeout:(fn,ms)=>setTimeout(fn,ms).unref(),clearTimeout,console,URL,localStorage:{getItem:()=>null}});
 vm.runInContext(readFileSync('dist/app.js','utf8'),vmContext);
 await new Promise(r=>setTimeout(r,10));
 const html=vm.runInContext('summaryQualityMarkup({source:{summary:"Brief existing summary",body:"Grounded passage from the saved article",retrieval:"supplied"},ideas:[{statement:"A source-based claim",mechanism:"A mechanism explained in the underlying analysis",evidence:"The author asserts evidence without independent confirmation",counterargument:"A competing explanation remains plausible",excerpt:"Grounded passage from the saved article"}]})',vmContext);
 assert.ok(html.includes('Detailed argument and evidence'));
 assert.ok(html.includes('How the argument works'));
 assert.ok(html.includes('Strongest recorded limitation'));
 assert.ok(html.includes('Exact words found in saved text'));
 assert.ok(html.includes('not independent verification'));
 assert.ok(html.includes('earlier, shorter analysis'),'Do not claim the old summary has been regenerated');
});
test('Deeper summaries: source excerpts and AI prose are XSS-escaped, non-matching quotations flagged',async()=>{
 const ctx=vm.createContext({document:{getElementById:()=>({innerHTML:''}),addEventListener(){},querySelector:()=>null},navigator:{},location:{protocol:'http:'},fetch:async()=>new Response('',{status:401}),setTimeout:(fn,ms)=>setTimeout(fn,ms).unref(),clearTimeout,console,URL,localStorage:{getItem:()=>null}});
 vm.runInContext(readFileSync('dist/app.js','utf8'),ctx);
 const evil='<img src=x onerror=alert(1)>';
 const data={source:{summary:evil,body:'This is original source text',retrieval:'x_post_embed_only'},ideas:[{statement:evil,mechanism:evil,evidence:evil,counterargument:evil,excerpt:evil}],links:[]};
 const html=vm.runInContext('summaryQualityMarkup('+JSON.stringify(data)+')',ctx);
 assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
 assert.ok(!html.includes('<img src=x'));
 assert.ok(html.includes('could not be matched'));
 assert.ok(html.includes('longer threads or linked material may be missing'));
});
test('Deep Dive: richer prompt uses existing optional user-initiated inference and same token ceiling',async()=>{
 const s=await setup(),id=(await (await s.req('capture','POST',{body,title:'Dossier depth fixture'})).json()).id;await Promise.all(s.pending);
 let calls=0;
 s.env.CONVERTER.run=async(model,input)=>{
  calls++;assert.equal(input.max_tokens,3400);assert.ok(input.messages[0].content.includes('150-210 words'));assert.ok(input.messages[0].content.includes('falsifying observations'));assert.equal(input.response_format.type,input.max_tokens===3400?'json_schema':'json_object');
  return {response:JSON.stringify(dossier)};
 };
 assert.equal((await s.req('sources/'+id+'/learning-dossier')).status,200);
 assert.equal(calls,0,'Reading cached state cannot invoke the model');
 const generated=await s.req('sources/'+id+'/learning-dossier','POST',{});
 assert.equal(generated.status,200);assert.equal(calls,1);
 const again=await s.req('sources/'+id+'/learning-dossier','POST',{});
 assert.equal(again.status,200);assert.equal(calls,1,'Cached dossier must not regenerate');
});

test('topics: failures consume allowance, return coverage and block upstream on sixth attempt',async()=>{
 const s=await setup(),old=globalThis.fetch;let calls=0;
 try{
  globalThis.fetch=async()=>{calls++;return new Response('unavailable',{status:503})};
  for(let n=0;n<5;n++){
   const r=await s.req('topics','POST',{topic:'Unavailable '+n});assert.equal(r.status,503);
   const d=await r.json();assert.equal(d.resources.length,0);assert.equal(d.coverage.length,6);
  }
  const before=calls,r=await s.req('topics','POST',{topic:'Another attempt'});
  assert.equal(r.status,429);assert.equal(calls,before);assert.ok(Number(r.headers.get('Retry-After'))>0);
  assert.equal((await r.json()).retry_after<=3600,true);
  assert.equal((await (await s.req('topics')).json()).searches.length,0);
  s.env.DB.db.prepare('UPDATE topic_search_attempts SET created_at=?').run(new Date(Date.now()-3600001).toISOString());
  assert.equal((await s.req('topics','POST',{topic:'After expiry'})).status,503);
  assert.equal(s.env.DB.db.prepare('SELECT count(*) n FROM topic_search_attempts').get().n,1);
 }finally{globalThis.fetch=old;s.env.DB.db.close()}
});

test('topics: concurrent reservations cap outbound searches and cached reads remain available',async()=>{
 const s=await setup(),old=globalThis.fetch;let calls=0;delete s.env.CONVERTER;
 try{
  globalThis.fetch=async url=>{calls++;return String(url).includes('api.crossref.org')?Response.json({message:{items:[{title:['Evidence'],URL:'https://doi.org/10.1234/evidence'}]}}):new Response('limited',{status:503})};
  const first=await (await s.req('topics','POST',{topic:'Saved topic'})).json();
  assert.equal(first.resources[0].discovery_provider,'Crossref');assert.match(first.resources[0].access_status,/unverified/);
  const responses=await Promise.all(Array.from({length:8},(_,n)=>s.req('topics','POST',{topic:'Concurrent '+n})));
  assert.equal(responses.filter(r=>r.status===200).length,4);assert.equal(responses.filter(r=>r.status===429).length,4);
  const before=calls,cached=await (await s.req('topics','POST',{topic:'Saved topic'})).json();assert.equal(cached.cached,true);assert.equal(cached.id,first.id);assert.equal(calls,before);
  assert.equal((await s.req('topics','POST',{topic:'Saved topic',refresh:true})).status,429);
  assert.equal((await (await s.req('topics')).json()).searches.length,5);
 }finally{globalThis.fetch=old;s.env.DB.db.close()}
});

test('topics UI: failed new searches clear stale results, show coverage and preserve history',async()=>{
 const app={innerHTML:''},listeners={};let rejectRequest;
 const document={getElementById:()=>app,addEventListener(type,fn){(listeners[type]??=[]).push(fn)},querySelector:()=>null};
 const context=vm.createContext({document,navigator:{},location:{protocol:'http:'},fetch:async()=>new Response('',{status:401}),setTimeout:(fn,ms)=>setTimeout(fn,ms).unref(),clearTimeout,console,URL,localStorage:{getItem:()=>null},FormData:class{get(){return 'New topic'}}});
 vm.runInContext(readFileSync('dist/app.js','utf8'),context);await new Promise(r=>setTimeout(r,10));
 context.pendingSearch=new Promise((resolve,reject)=>{rejectRequest=reject});
 vm.runInContext(`topics.active={id:'old',topic:'Old topic',resources:[],coverage:[]};topics.items=[topics.active];render=()=>{};api=()=>pendingSearch`,context);
 const submit=listeners.submit.find(fn=>fn.toString().includes('topic-form'));
 const pending=submit({target:{id:'topic-form'},preventDefault(){}});
 assert.equal(vm.runInContext('topics.active',context),null);
 assert.equal(vm.runInContext('topics.loading',context),true);
 const error=new Error('Search failed');error.details={coverage:[{kind:'X',status:'Search unavailable <script>'}],retry_after:90};rejectRequest(error);await pending;
 const html=vm.runInContext('topicMarkup()',context);assert.match(html,/Search failed/);assert.match(html,/Search unavailable &lt;script&gt;/);assert.match(html,/about 2 minutes/);assert.doesNotMatch(html,/<h2>Old topic/);
 assert.equal(vm.runInContext('topics.items.length',context),1);assert.equal(vm.runInContext('topics.loading',context),false);
});

test('Deep Dive: explicit provider schema, unchanged single-call budget, strict malformed-output rejection',async()=>{
 const s=await setup();const {id}=await (await s.req('capture','POST',{body})).json();await Promise.all(s.pending);
 let calls=0;const path='sources/'+id+'/learning-dossier';
 s.env.CONVERTER.run=async(model,input)=>{
  calls++;assert.equal(input.max_tokens,3400);assert.equal(input.response_format.type,'json_schema');
  const schema=input.response_format.json_schema;assert.equal(schema.required.length,8);assert.equal(schema.properties.questions.type,'string');assert.equal(schema.properties.reading.items.type,'object');
  return {response:JSON.stringify({...dossier,reading:[null]})};
 };
 let r=await s.req(path,'POST',{});assert.equal(r.status,502);assert.equal((await r.json()).error_code,'invalid_schema');assert.equal(calls,1);assert.equal((await (await s.req(path)).json()).dossier,null);
 s.env.CONVERTER.run=async()=>({response:'{"overview":"truncated'});
 r=await s.req(path,'POST',{});assert.equal(r.status,502);assert.equal((await r.json()).error_code,'invalid_json');assert.equal((await (await s.req(path)).json()).dossier,null);
 s.env.CONVERTER.run=async()=>({response:dossier});assert.equal((await s.req(path,'POST',{})).status,200);
 delete s.env.CONVERTER;assert.equal((await (await s.req(path,'POST',{})).json()).cached,true);
 assert.equal((await (await s.req('sources/'+id)).json()).source.body,body);
});

const ktFixture=()=>({title:'Evidence and conviction',keywords:['evidence','assumptions'],current_view:'I should revise confidence when independent evidence changes.',confidence:'moderate',would_change:'A robust replication that contradicts the mechanism.',open_questions:'How independent are the observations?',change_reason:'Starting a record of how evidence changes my view.',source_refs:[]});
test('topic workspaces: private authored views, source quality, suggestions, concepts and zero inference',async()=>{
 const s=await setup();
 const {id}=await (await s.req('capture','POST',{body,title:'Evidence from repeated experiments'})).json();await Promise.all(s.pending);
 const {id:other}=await (await s.req('capture','POST',{body:body+' Additional detail.',title:'Alternative evidence'})).json();await Promise.all(s.pending);
 const before=s.calls(),value={...ktFixture(),source_refs:[{source_id:id,relation:'challenges',rationale:'Tests my assumption.'}]};
 assert.equal((await s.req('knowledge-topics','GET',undefined,{cookie:''})).status,401);
 assert.equal((await s.req('knowledge-topics','POST',value,{Origin:'https://evil.example'})).status,403);
 await s.req('evergreen','POST',{title:'Evidence concept',thesis:'Evidence has to be relevant and independent.',content:'A shared source is a reference, not proof of agreement.',source_refs:[{source_id:id,relation:'context',quote:'',comment:''}],related:[]});
 const created=await s.req('knowledge-topics','POST',value);assert.equal(created.status,201);const {topic}=await created.json();
 const page=await (await s.req('knowledge-topics/'+topic.id)).json();
 assert.equal(page.sources[0].relation,'challenges');assert.equal(page.sources[0].quality.label,'Supplied text');assert.equal(page.sources[0].quality.complete_verified,false);assert.ok(page.sources[0].ideas.length);assert.equal(page.concepts.length,1);assert.ok(page.suggestions.some(x=>x.source_id===other));assert.ok(!page.suggestions.some(x=>x.source_id===id));
 assert.equal(s.calls(),before,'Topic reads and edits must not call AI');
 assert.equal((await (await s.req('knowledge-topics')).json()).topics[0].id,topic.id);
 const backup=await (await s.req('export')).json();assert.equal(backup.knowledge_topics.length,1);assert.equal(backup.knowledge_topic_history.length,0);
 assert.equal((await (await s.req('sources/'+id)).json()).source.body,body);
});
test('topic workspaces: compare-and-swap edits preserve earlier beliefs and reject stale changes',async()=>{
 const s=await setup();const {topic}=await (await s.req('knowledge-topics','POST',ktFixture())).json();const path='knowledge-topics/'+topic.id;
 const next={...ktFixture(),current_view:'Replication is necessary but measurement quality also matters.',confidence:'low',change_reason:'A contrary measurement changed my confidence.'};
 assert.equal((await s.req(path,'PUT',{revision:1,topic:next})).status,200);
 assert.equal((await s.req(path,'PUT',{revision:1,topic:{...next,current_view:'Stale overwrite'}})).status,409);
 const page=await (await s.req(path)).json();assert.equal(page.topic.revision,2);assert.equal(page.topic.current_view,next.current_view);
 const history=(await (await s.req(path+'/history')).json()).history;assert.equal(history.length,1);assert.equal(history[0].topic.current_view,ktFixture().current_view);assert.equal(history[0].topic.change_reason,ktFixture().change_reason);
 const backup=await (await s.req('export')).json();assert.equal(backup.knowledge_topic_history.length,1);
 assert.equal((await s.req(path,'PUT',{revision:2,topic:{...next,change_reason:''}})).status,422);
 assert.equal((await s.req(path,'DELETE')).status,405);
});
test('topic workspaces: validate saved references and bounded inputs; detach preserves originals',async()=>{
 const s=await setup(),base=ktFixture();
 for(const invalid of [{...base,source_refs:[{source_id:'deadbeef-dead-beef',relation:'supports'}]},{...base,confidence:'certain'},{...base,keywords:Array(13).fill('evidence')},{...base,change_reason:'short'}])assert.equal((await s.req('knowledge-topics','POST',invalid)).status,422);
 const {id}=await (await s.req('capture','POST',{body})).json();await Promise.all(s.pending);
 const ref={source_id:id,relation:'supports',rationale:'My interpretation.'};
 assert.equal((await s.req('knowledge-topics','POST',{...base,source_refs:[ref,ref]})).status,422);
 const {topic}=await (await s.req('knowledge-topics','POST',{...base,source_refs:[ref]})).json();
 assert.equal((await s.req('knowledge-topics/'+topic.id,'PUT',{revision:1,topic:{...base,source_refs:[],change_reason:'Removed from this topic only.'}})).status,200);
 assert.equal((await (await s.req('sources/'+id)).json()).source.body,body);
 const h=await (await s.req('knowledge-topics/'+topic.id+'/history')).json();assert.equal(h.history[0].topic.source_refs[0].source_id,id);
});
test('topic source coverage: metadata, excerpts and long text never imply completeness',async()=>{
 const code=readFileSync('features/source-quality.js','utf8'),c=vm.createContext({});vm.runInContext(code,c);
 for(const [source,label] of [[{url:'https://youtube.com/watch?v=test',body_length:0},'Video link only'],[{body_length:20},'Very limited text'],[{body_length:1000,retrieval:'pdf_extracted'},'PDF extraction'],[{body_length:1000,retrieval:'x_post_embed_only'},'X text / excerpt'],[{body_length:48000,retrieval:'html'},'Extracted text']]){
  c.source=source;const quality=vm.runInContext('ktQuality(source)',c);assert.equal(quality.label,label);assert.equal(quality.complete_verified,false);assert.equal(quality.analysis_context_limited,(source.body_length||0)>10000);
 }
});
test('topic UI: escapes authored content, labels inference, and retains drafts through rerenders',async()=>{
 const app={innerHTML:''};const document={getElementById:()=>app,addEventListener(){},querySelector:()=>null};
 const c=vm.createContext({document,navigator:{},location:{protocol:'http:'},fetch:async()=>new Response('',{status:401}),setTimeout:(fn,ms)=>setTimeout(fn,ms).unref(),clearTimeout,console,URL,localStorage:{getItem:()=>null}});
 vm.runInContext(readFileSync('dist/app.js','utf8'),c);await new Promise(r=>setTimeout(r,10));
 c.topic={...ktFixture(),id:'abc',revision:1,title:'<img src=x onerror=alert(1)>',updated_at:'2026-11-13'};
 const html=vm.runInContext(`knowledge.loaded=true;knowledge.active=topic;knowledge.page={disclosure:'Saved AI interpretations',sources:[],suggestions:[],concepts:[],next_actions:[],limits:{suggestion_pool:400}};knowledgeMarkup()`,c);
 assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<img'));assert.match(html,/Saved AI interpretations/);
 vm.runInContext(`knowledge.draft={...topic,current_view:'Unsaved <script>draft</script>',change_reason:'A new line of thought'};knowledge.dirty=true`,c);
 assert.match(vm.runInContext('knowledgeMarkup()',c),/Unsaved &lt;script&gt;draft/);
 assert.match(vm.runInContext('knowledgeMarkup()',c),/A new line of thought/);
 const q=vm.runInContext(`ktQualityMarkup({body:'',url:'https://youtube.com/watch?v=abc'})`,c);assert.match(q,/Video link only/);assert.match(q,/No transcript/);
});

 test('Today repair: link-only captures cannot displace reading and keep recoverable labels',async()=>{
 const s=await setup();const {id}=await (await s.req('capture','POST',{title:'Readable fixture',body})).json();await Promise.all(s.pending);
 const before=s.calls();
 for(let i=0;i<12;i++)s.env.DB.db.prepare("INSERT INTO sources(id,title,url,body,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?)").run(crypto.randomUUID(),'','https://x.com/fixture/status/'+(12345000+i),'','awaiting_content',new Date().toISOString(),new Date().toISOString());
 const data=await (await s.req('briefing')).json();
 const overview=await (await s.req('evidence/overview')).json();assert.ok(overview.sources.filter(x=>x.status==='awaiting_content').every(x=>x.title.startsWith('X post · @fixture')));
 assert.equal(data.attention.length,12);assert.ok(data.attention.every(x=>x.title.startsWith('X post · @fixture')&&!x.has_saved_text));
 assert.ok(data.items.some(x=>x.source_id===id&&x.kind==='reading'));assert.ok(data.items.every(x=>x.kind!=='processing'));
 assert.equal(s.calls(),before);assert.equal((await (await s.req('sources/'+id)).json()).source.body,body);
 const key=data.attention[0].key;await s.req('briefing/action','POST',{item_key:key,action:'dismiss',expected_revision:0});
 assert.equal((await (await s.req('briefing')).json()).attention.length,11);
 await s.req('briefing/action','POST',{item_key:key,action:'restore',expected_revision:1});
 assert.equal((await (await s.req('briefing')).json()).attention.length,12);
 });
 test('Today repair: supplied share title survives a media capture without text',async()=>{
 const s=await setup();const r=await s.req('shortcut-intake','POST',{url:'https://www.youtube.com/watch?v=fixture1234',title:'Shared video title'});assert.equal(r.status,200);
 const d=await r.json();await Promise.all(s.pending);const saved=(await (await s.req('sources/'+d.source_id)).json()).source;
 assert.equal(saved.title,'Shared video title');assert.equal(saved.status,'awaiting_content');assert.equal(s.calls(),0);
 });
 test('Today repair UI: original text is escaped and missing text is explicit',async()=>{
 const app={innerHTML:''},document={getElementById:()=>app,addEventListener(){},querySelector:()=>null};
 const context=vm.createContext({document,navigator:{},location:{protocol:'http:'},fetch:async()=>new Response('',{status:401}),setTimeout:(fn,ms)=>setTimeout(fn,ms).unref(),clearTimeout,console,URL,localStorage:{getItem:()=>null}});
 vm.runInContext(readFileSync('dist/app.js','utf8'),context);await new Promise(r=>setTimeout(r,10));
 const html=vm.runInContext(`state.detail={source:{id:'test',body:'<script>unsafe</script> Saved original text',disciplines:'[]',status:'ready'},ideas:[],links:[]};integrated.bySource.test={__empty:true};detail()`,context);
 assert.ok(html.includes('data-source-reader'));assert.ok(html.includes('&lt;script&gt;unsafe&lt;/script&gt;'));assert.ok(!html.includes('<script>unsafe'));
 assert.ok(vm.runInContext(`state.detail.source.body='';detail()`,context).includes('No source text is stored'));
 const report={items:[],attention:[{key:'processing:test',source_id:'test',title:'YouTube video · fixture',explanation:'No readable source text saved'}],counts:{processing:1},hidden:[]};
 const today=vm.runInContext('briefing.data='+JSON.stringify(report)+';briefingMarkup()',context);assert.ok(today.includes('data-brief-attention'));assert.ok(!today.includes('data-brief-attention="1" open'));assert.ok(today.includes('YouTube video · fixture'));
 });
