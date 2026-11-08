import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const worker=(await import('../dist/_worker.js')).default;
const body='Compound knowledge grows through careful reading, testing assumptions and revisiting evidence. '.repeat(8).trim();
const dossier=Object.fromEntries(['overview','first_principles','argument','context','connections','critique','questions'].map(k=>[k,'A substantive explanation of '+k]));dossier.reading=[{title:'Thinking, Fast and Slow',author:'Daniel Kahneman',reason:'Judgment',level:'Introductory'}];
function database(){const db=new DatabaseSync(':memory:');return {db,prepare(sql){let args=[];const s={bind(...a){args=a;return s},async first(){return db.prepare(sql).get(...args)||null},async all(){return {results:db.prepare(sql).all(...args)}},async run(){const result=db.prepare(sql).run(...args);return {success:true,meta:{changes:Number(result.changes)}}}};return s},async batch(stmts){db.exec('BEGIN');try{const r=await Promise.all(stmts.map(s=>s.run()));db.exec('COMMIT');return r}catch(e){db.exec('ROLLBACK');throw e}}}}
async function setup(){const DB=database();let calls=0;const env={DB,APP_PASSWORD:'test-only',SESSION_SECRET:'test-only-session-secret',CONVERTER:{run:async(model,input)=>{assert.equal(model,'@cf/meta/llama-3.3-70b-instruct-fp8-fast');assert.equal(input.response_format.type,'json_object');calls++;return {response:JSON.stringify(input.messages[0].content.includes('personal research analyst')?{summary:'Evidence improves learning.',question:'How do we check assumptions?',disciplines:['Learning'],ideas:[{statement:'Revisit evidence',mechanism:'Check assumptions',evidence:'Source assertion',counterargument:'Checks may be incomplete',excerpt:body.slice(0,90),tags:[]}],proposed_principles:[{text:'Check assumptions',rationale:'Reduce error'}],connections:[]}:dossier)}},toMarkdown:async()=>({data:body})},ASSETS:{fetch:async()=>new Response('asset')}};let cookie='';const pending=[];async function req(path,method='GET',data,extra={}){return worker.fetch(new Request('https://manifesto.example/api/'+path,{method,headers:{cookie,'X-Manifesto-Request':'1',...extra},body:data===undefined?undefined:JSON.stringify(data)}),env,{waitUntil:p=>pending.push(p)})}const login=await req('login','POST',{password:'test-only'});assert.equal(login.status,200);cookie=login.headers.get('set-cookie').split(';')[0];return {env,req,pending,calls:()=>calls}};
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
 assert.match(g.disclosure,/not evidence/i);
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
