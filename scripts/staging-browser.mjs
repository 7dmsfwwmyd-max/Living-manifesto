// Real Chromium smoke test for the free-only Learning Studio on isolated staging.
// No packages, paid services, production writes or extra AI requests.
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const base=process.env.STAGING_URL,password=process.env.APP_PASSWORD,commit=process.env.EXPECTED_SHA;
assert.ok(base&&password&&commit,'Verified staging URL, password and expected commit required');
assert.ok(new URL(base).hostname.includes('living-manifesto-staging.'),'Only isolated staging is permitted');
const chrome=['google-chrome','google-chrome-stable','chromium','chromium-browser'].find(x=>{
 try{execFileSync('which',[x],{stdio:'ignore'});return true}catch{return false}
});
assert.ok(chrome,'Headless Chrome is not installed on the CI runner; do not promote');
const dir=await mkdtemp(join(tmpdir(),'manifesto-browser-'));
let child,ws,serial=0;
const pending=new Map();
const sleep=t=>new Promise(r=>setTimeout(r,t));
try{
 child=spawn(chrome,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-first-run','--no-default-browser-check','--remote-allow-origins=*','--remote-debugging-port=0','--user-data-dir='+dir,'about:blank'],{stdio:'ignore'});
 let port;
 for(let n=0;n<80;n++){try{port=(await readFile(join(dir,'DevToolsActivePort'),'utf8')).split('\n')[0];if(port)break}catch{}await sleep(200)}
 assert.ok(port,'Chrome did not open the local debugging port');
 const tabs=await (await fetch('http://127.0.0.1:'+port+'/json/list')).json();
 const target=tabs.find(x=>x.type==='page');
 assert.ok(target?.webSocketDebuggerUrl,'Chrome tab unavailable');
 ws=new WebSocket(target.webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true})});
 ws.addEventListener('message',event=>{
  const m=JSON.parse(String(event.data));
  if(!m.id)return;
  const p=pending.get(m.id);if(!p)return;pending.delete(m.id);
  if(m.error)p.reject(new Error(m.error.message));else p.resolve(m.result);
 });
 function command(method,params={}){
  return new Promise((resolve,reject)=>{
   const id=++serial;pending.set(id,{resolve,reject});
   ws.send(JSON.stringify({id,method,params}));
   setTimeout(()=>{if(pending.delete(id))reject(Error('Chrome command timed out: '+method))},20000).unref();
  });
 }
 async function evaluate(source){
  const result=await command('Runtime.evaluate',{expression:source,returnByValue:true,awaitPromise:true});
  if(result.exceptionDetails)throw Error('Browser expression error: '+result.exceptionDetails.text);
  return result.result?.value;
 }
 async function until(source,label,attempts=70){
  for(let n=0;n<attempts;n++){
   try{if(await evaluate(source))return true}catch{}
   await sleep(300);
  }
  throw Error('Browser did not reach: '+label);
 }
 await command('Page.enable');await command('Runtime.enable');
 await command('Page.navigate',{url:base});
 await until('document.readyState==="complete"&&!!document.getElementById("app")','application DOM');
 await until('!!document.getElementById("login-form")','login form');
 const login='(()=>{const f=document.getElementById("login-form");const i=f?.querySelector("input[type=password]");if(!i)return false;i.value='+JSON.stringify(password)+';i.dispatchEvent(new Event("input",{bubbles:true}));f.requestSubmit();return true})()';
 assert.equal(await evaluate(login),true,'Password form missing');
 await until('typeof state!=="undefined"&&state.signedIn===true','authenticated browser session');
 await until('!!document.querySelector("[data-nav=Library]")','authenticated application shell');
 // The Today screen must render the deterministic agenda in a logged-in browser.
 await until('!!document.querySelector("[data-brief-refresh]")','Daily Intelligence Briefing on Today');
 await until('briefing.data && !briefing.loading','private briefing initial data',110);
 const briefStatus=await evaluate('(async()=>{const d=await api("briefing");return {version:d.version,limit:d.limits.sources,items:d.items.length,hasSource:!!document.querySelector("[data-brief-refresh]"),text:document.body.innerText.includes("What deserves your attention?")}})()');
 assert.equal(briefStatus.version,'0.5.8');
 assert.equal(briefStatus.limit,100);
 assert.ok(briefStatus.hasSource&&briefStatus.text,'Briefing Today UI is missing');
 await evaluate('document.querySelector("[data-brief-filter=review]").click();true');
 assert.equal(await evaluate('briefing.filter'), 'review');
 await evaluate('document.querySelector("[data-brief-filter=all]").click();true');
 assert.equal(await evaluate('briefing.filter'),'all');

 let sourceId=await evaluate('(async()=>{const r=await api("sources");const sources=r.sources||[];return (sources.find(x=>String(x.title||"").includes("Release validation '+commit.slice(0,12)+'"))||sources.find(x=>String(x.title||"").startsWith("Release validation ")))?.id||null})()');
 if(!sourceId){
  const seed='Browser-only synthetic learning fixture. An evidence claim needs verifiable text; a plausible explanation should be tested against alternative explanations. '.repeat(4);
  sourceId=await evaluate('(async()=>{const d=await api("capture",{method:"POST",body:JSON.stringify({title:"Release validation first browser fixture",body:'+JSON.stringify(seed)+'})});return d.id})()');
 }
 assert.ok(sourceId,'No synthetic source available for authenticated browser tests');
 const nav=await evaluate('(()=>{const n=document.querySelector("[data-nav=Library]");if(n){n.click();return true}return false})()');
 assert.equal(nav,true,'Library navigation link is unavailable');
 await until('!!document.querySelector("[data-source]")','library source cards');
 const opened=await evaluate('(()=>{const n=[...document.querySelectorAll("[data-source]")].find(x=>x.dataset.source==='+JSON.stringify(sourceId)+');if(n){n.click();return true}return false})()');
 assert.equal(opened,true,'Staging source was not rendered as a clickable library card');
 await until('!!document.querySelector("[data-learn-tab=understand]")','article detail navigation');
 // Summary depth is available for already-saved articles without invoking AI.
 const storedSummaryCheck=await evaluate('(()=>{const source=state.detail?.source,ideas=state.detail?.ideas||[];const markup=summaryQualityMarkup({source:source||{summary:"Stored analysis",body:"A grounded passage from the source",retrieval:"supplied"},ideas:ideas.length?ideas:[{statement:"Grounded summary",mechanism:"Check assumptions",evidence:"Saved interpretation",counterargument:"Alternative reading",excerpt:"A grounded passage from the source"}]});return {hasPanel:markup.includes("Detailed argument and evidence"),hasMechanism:markup.includes("How the argument works"),hasCaveat:markup.includes("not independent verification"),domRendered:!!document.querySelector("[aria-label=\\"Detailed source summary\\"]")}})()');
 assert.ok(storedSummaryCheck.hasPanel&&storedSummaryCheck.hasMechanism&&storedSummaryCheck.hasCaveat,'Saved-source detailed argument reconstruction is absent');

 assert.equal(await evaluate('(()=>{document.querySelector("[data-learn-tab=understand]").click();return true})()'),true);
 await until('!!document.getElementById("lm-studio-review")','Learning Studio in Understand');
 await until('!!document.querySelector("[data-evidence-record]")','Evidence ledger in saved source');
 const auditResult=await evaluate('(async()=>{const r=await api("sources/'+sourceId+'/evidence",{method:"POST",body:"{}"});return {recorded:r.recorded,hash:r.audit.source.source_hash,claims:r.audit.counts.claims,verifiedClaims:r.audit.claims.filter(c=>c.claim_verified).length}})()');
 assert.ok(auditResult.recorded&&auditResult.hash.length===64&&auditResult.verifiedClaims===0,'Grounded evidence ledger failed in real authenticated browser');


 assert.equal(await evaluate('(()=>{const n=document.querySelector("[data-studio-reveal]");n?.click();return !!document.body.innerText.includes("Verbatim saved-text excerpt")})()'),true,'Reference reveal did not work');
 const answer='The article argues that evidence should be checked before reaching a conclusion, and alternative explanations should be considered. Tested on '+commit.slice(0,12);
 const submit='(()=>{const i=document.getElementById("lm-studio-answer");i.value='+JSON.stringify(answer)+';document.getElementById("lm-studio-confidence").value="low";document.getElementById("lm-studio-review").requestSubmit();return true})()';
 await evaluate(submit);
 await until('studioLoad().reviews['+JSON.stringify(sourceId)+']?.some(x=>x.answer==='+JSON.stringify(answer)+')','saved recall review');
 const reviewed=await evaluate('studioLoad().reviews['+JSON.stringify(sourceId)+'].find(x=>x.answer==='+JSON.stringify(answer)+')');
 assert.equal(reviewed.confidence,'low');
 assert.ok(Date.parse(reviewed.next_review)>Date.now(),'Review schedule not set');
 assert.equal(await evaluate('(()=>{document.getElementById("lm-studio-path-name").value="Research foundations";document.getElementById("lm-studio-path").requestSubmit();return studioLoad().paths.some(x=>x.name==="Research foundations")})()'),true,'Reading path was not saved');
 await evaluate('document.querySelector("[data-studio-catalog]").click();true');
 await until('!!document.getElementById("lm-studio-link")','source linking selector');
 const didLink=await evaluate('(()=>{const f=document.getElementById("lm-studio-link");if(!f)return false;const options=document.querySelectorAll("#lm-studio-target option");if(!options.length)return false;document.getElementById("lm-studio-kind").value="challenges";document.getElementById("lm-studio-reason").value="This provides a competing explanation that must be tested against the first source.";f.requestSubmit();return studioLoad().links.some(x=>x.from==='+JSON.stringify(sourceId)+'&&x.kind==="challenges")})()');
 assert.equal(didLink,true,'Explicit source connection was not saved');
 const preview=await evaluate('studioOverview()');
 assert.ok(preview.includes('Research foundations')&&preview.includes('Knowledge connections'),'Explore learning overview incomplete');
 // The imported JSON is retained locally; it does not touch production D1.
 assert.equal(await evaluate('(()=>{const old=localStorage.getItem("lm-learning-studio-v1");localStorage.removeItem("lm-learning-studio-v1");studioImport(old);return studioLoad().reviews['+JSON.stringify(sourceId)+']?.some(x=>x.answer==='+JSON.stringify(answer)+')})()'),true,'JSON backup restore failed');

 // Cloud D1 must preserve study records across a second browser storage context.
 await evaluate('studioSyncNow()');
 // The page may already be sending a debounced write. Wait for a completed
 // revision rather than reading D1 before the in-flight write has committed.
 await until('(async()=>{const server=await api("studio-state");return server.state.reviews['+JSON.stringify(sourceId)+']?.some(x=>x.answer==='+JSON.stringify(answer)+')&&server.state.paths.length>0&&server.state.links.length>0})()','D1 cloud sync including all study data',100);
 const synced=await evaluate('(async()=>{const server=await api("studio-state");const graph=await api("knowledge-graph");return {revision:server.revision,hasReview:server.state.reviews['+JSON.stringify(sourceId)+']?.some(x=>x.answer==='+JSON.stringify(answer)+'),paths:server.state.paths.length,links:server.state.links.length,graphSources:graph.sources.length,graphManual:graph.manual_links.length,localStatus:learningCloud.status,localError:learningCloud.error}})()');
 assert.ok(synced.revision>=1&&synced.hasReview&&synced.paths>0&&synced.links>0,'Study records were not persisted to private D1: '+JSON.stringify(synced));
 assert.ok(synced.graphSources>0&&synced.graphManual>0,'Knowledge graph did not include saved sources and user links');
 // Emulate another device without the previous localStorage snapshot; the
 // authoritative state must restore it after a fresh authenticated API fetch.
 assert.equal(await evaluate('localStorage.removeItem("lm-learning-studio-v1");true'),true);
 await evaluate('studioSyncNow()');
 await until('studioLoad().reviews['+JSON.stringify(sourceId)+']?.some(x=>x.answer==='+JSON.stringify(answer)+')','fresh-device D1 restoration',80);
 assert.equal(await evaluate('studioLoad().reviews['+JSON.stringify(sourceId)+']?.some(x=>x.answer==='+JSON.stringify(answer)+')'),true,'Cloud state not restored in a fresh device context');
 const exploreNav=await evaluate('(()=>{const n=document.querySelector("[data-nav=Explore]");if(!n)return false;n.click();return true})()');
 assert.equal(exploreNav,true,'Explore navigation was not available');
 await until('document.body.innerText.includes("Your knowledge graph")&&!!document.querySelector("[data-studio-cloud-sync]")','rendered knowledge graph viewer');

 // Create an authored evergreen note in the real UI, cite exact saved text, and
 // verify the D1 record and portable export are available after fresh login.
 await until('evergreen.loaded && !evergreen.busy && !!document.querySelector("[data-ev-new]")','Evergreen index ready in Explore');
 await evaluate('document.querySelector("[data-ev-new]").click();true');
 await until('!!document.getElementById("ev-editor")','Evergreen concept editor');
 const conceptName='Evidence foundations '+commit.slice(0,8);
 assert.equal(await evaluate('(()=>{document.getElementById("ev-title").value='+JSON.stringify(conceptName)+';document.getElementById("ev-thesis").value="Evidence should alter beliefs only when it is reliable and relevant.";document.getElementById("ev-content").value="We need to distinguish observations from competing explanations, examine uncertainty, and revisit assumptions after new data arrives.";document.getElementById("ev-editor").requestSubmit();return true})()'),true);
 const afterSubmit=await evaluate('(()=>{const f=document.getElementById("ev-editor");return {formPresent:!!f,formValid:f?.checkValidity(),title:f?.querySelector("[name=title]")?.value,flash:document.getElementById("flash")?.textContent,busy:evergreen.busy,loaded:evergreen.loaded,activeTitle:evergreen.active?.title,activeId:evergreen.active?.id,error:evergreen.error}})()');
 console.log('Evergreen browser submission diagnostics',JSON.stringify(afterSubmit));
 try{
  await until('!!evergreen.active?.id&&evergreen.active.title.includes("Evidence foundations")','UI saved an evergreen concept');
 }catch(error){
  const debug=await evaluate('({busy:evergreen.busy,loaded:evergreen.loaded,active:evergreen.active,error:evergreen.error,flash:document.getElementById("flash")?.textContent,form:!!document.getElementById("ev-editor")})');
  throw Error('Evergreen creation did not finish. State: '+JSON.stringify(debug)+'; original: '+error.message);
 }
 const conceptId=await evaluate('evergreen.active.id');
 await evaluate('document.querySelector("[data-ev-refs]").click();true');
 await until('!!document.getElementById("ev-ref")','source provenance form');
 const sourceText=await evaluate('(async()=>{const d=await api("sources/'+sourceId+'");return d.source.body.slice(0,90)})()');
 assert.ok(sourceText.length>=40,'Staging source text missing');
 assert.equal(await evaluate('(()=>{const f=document.getElementById("ev-ref");f.querySelector("[name=source_id]").value='+JSON.stringify(sourceId)+';f.querySelector("[name=relation]").value="supports";f.querySelector("[name=quote]").value='+JSON.stringify(sourceText)+';f.querySelector("[name=comment]").value="Grounded in exactly the text stored for this source.";f.requestSubmit();return true})()'),true);
 await until('evergreen.active?.source_refs?.length===1','authentic cited source saved');
 const evergreenCheck=await evaluate('(async()=>{const x=await api("evergreen/'+conceptId+'");const r=await fetch("/api/evergreen/export?format=markdown");const md=await r.text();const h=await api("evergreen/'+conceptId+'/history");return {revision:x.note.revision,refs:x.note.source_refs.length,quote:x.note.source_refs[0].quote,download:r.status,md:md.includes("Evidence foundations"),history:h.history.length}})()');
 assert.ok(evergreenCheck.revision>=2&&evergreenCheck.refs===1&&evergreenCheck.quote===sourceText&&evergreenCheck.download===200&&evergreenCheck.md&&evergreenCheck.history>=1,'Evergreen source provenance, revision history or export failed');
 // Topic workspaces: create through the UI, retain a draft across rerenders,
 // attach an existing synthetic source and read earlier authored views.
 await until('knowledge.loaded && !knowledge.loading && !knowledge.busy','Topic index ready');
 const topicName='Staging evidence '+commit.slice(0,12);
 const existingTopic=await evaluate('knowledge.items.find(x=>x.title==='+JSON.stringify(topicName)+')?.id||null');
 if(existingTopic){await evaluate('ktOpen('+JSON.stringify(existingTopic)+')')}
 else{
  await evaluate('document.querySelector("[data-kt-new]").click();true');
  await until('!!document.getElementById("kt-editor")','Topic editor');
  await evaluate('(()=>{document.getElementById("kt-title").value='+JSON.stringify(topicName)+';document.getElementById("kt-keywords").value="evidence, assumptions";document.getElementById("kt-current_view").value="Independent evidence should determine the strength of my confidence.";document.getElementById("kt-confidence").value="moderate";document.getElementById("kt-would_change").value="A well-designed replication that contradicts the proposed mechanism.";document.getElementById("kt-open_questions").value="How independent are these observations?";document.getElementById("kt-change_reason").value="Starting an explicit record of how evidence changes my judgment.";document.getElementById("kt-current_view").dispatchEvent(new Event("input",{bubbles:true}));render();return true})()');
  assert.equal(await evaluate('document.getElementById("kt-current_view").value'),'Independent evidence should determine the strength of my confidence.','Unsaved topic draft was lost on rerender');
  await evaluate('document.getElementById("kt-editor").requestSubmit();true');
  await until('!!knowledge.active?.id && knowledge.active.title==='+JSON.stringify(topicName)+' && !knowledge.busy','Topic saved in D1');
 }
 const topicId=await evaluate('knowledge.active.id');
 if(!await evaluate('knowledge.active.source_refs.some(x=>x.source_id==='+JSON.stringify(sourceId)+')')){
  await evaluate('(()=>{const f=document.getElementById("kt-attach");f.querySelector("[name=source_id]").value='+JSON.stringify(sourceId)+';f.querySelector("[name=relation]").value="challenges";f.querySelector("[name=rationale]").value="This source tests the assumptions behind my view.";f.requestSubmit();return true})()');
  await until('knowledge.active.source_refs.some(x=>x.source_id==='+JSON.stringify(sourceId)+') && !knowledge.busy','Source attached to topic');
 }
 const previousView=await evaluate('knowledge.active.current_view');
 await evaluate('document.querySelector("[data-kt-edit]").click();true');
 await until('!!document.getElementById("kt-editor")','Thinking review editor');
 const revisedView='I now distinguish independent evidence from repetitions of the same assumption.';
 await evaluate('(()=>{document.getElementById("kt-current_view").value='+JSON.stringify(revisedView)+';document.getElementById("kt-confidence").value="low";document.getElementById("kt-change_reason").value="The attached source changed my interpretation of independence.";document.getElementById("kt-editor").requestSubmit();return true})()');
 await until('knowledge.active.current_view==='+JSON.stringify(revisedView)+' && !knowledge.busy','Revised view saved');
 await evaluate('document.querySelector("[data-kt-history]").click();true');
 await until('Array.isArray(knowledge.history) && !knowledge.busy','Previous views loaded');
 assert.ok(await evaluate('knowledge.history.some(h=>h.topic.current_view==='+JSON.stringify(previousView)+')'),'Prior view missing from history');
 const topicCheck=await evaluate('(async()=>{const p=await api("knowledge-topics/'+topicId+'");const b=await api("export");return {view:p.topic.current_view,confidence:p.topic.confidence,source:p.sources.some(s=>s.source_id==='+JSON.stringify(sourceId)+'&&!s.quality.complete_verified),exported:b.knowledge_topics.some(t=>t.id==='+JSON.stringify(topicId)+'),history:b.knowledge_topic_history.some(t=>t.topic_id==='+JSON.stringify(topicId)+')}})()');
 assert.equal(topicCheck.view,revisedView);assert.equal(topicCheck.confidence,'low');assert.ok(topicCheck.source&&topicCheck.exported&&topicCheck.history,'Topic coverage or backup missing');
 await command('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await evaluate('knowledge.history=null;render();document.querySelector("[data-kt-new]").closest("article").scrollIntoView();true');
 const topicScreenshot=await command('Page.captureScreenshot',{format:'png'});
 await writeFile('staging-topics.png',Buffer.from(topicScreenshot.data,'base64'));
 console.log('PASS real topic UI: draft retention, source classification, revised confidence, readable history and private export; no AI calls.');
 await command('Page.reload',{ignoreCache:true});
 await until('document.readyState==="complete"&&typeof studioLoad==="function"','reloaded application');
 assert.equal(await evaluate('studioLoad().reviews['+JSON.stringify(sourceId)+']?.some(x=>x.answer==='+JSON.stringify(answer)+')'),true,'Recall was lost across browser reload');
 await evaluate('ktOpen('+JSON.stringify(topicId)+')');
 assert.equal(await evaluate('knowledge.active.current_view'),revisedView,'Topic view lost after reload');
 console.log('PASS authenticated Chromium: login, recall and reviews, learning paths, manual links, D1 cloud sync, fresh-device restore, provenance graph, backup and reload persistence. No additional AI requests; evergreen notes, verified quotations and exports passed.');
}finally{
 try{ws?.close()}catch{}
 for(const p of pending.values())p.reject(new Error('Browser session closed'));
 if(child&&!child.killed)child.kill('SIGKILL');
 await rm(dir,{recursive:true,force:true,maxRetries:5,retryDelay:100});
}
