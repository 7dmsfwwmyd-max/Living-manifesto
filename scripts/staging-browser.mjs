// Real Chromium smoke test for the free-only Learning Studio on isolated staging.
// No packages, paid services, production writes or extra AI requests.
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
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
 assert.equal(await evaluate('(()=>{document.querySelector("[data-learn-tab=understand]").click();return true})()'),true);
 await until('!!document.getElementById("lm-studio-review")','Learning Studio in Understand');

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
 await command('Page.reload',{ignoreCache:true});
 await until('document.readyState==="complete"&&typeof studioLoad==="function"','reloaded application');
 assert.equal(await evaluate('studioLoad().reviews['+JSON.stringify(sourceId)+']?.some(x=>x.answer==='+JSON.stringify(answer)+')'),true,'Recall was lost across browser reload');
 console.log('PASS authenticated Chromium: login, recall and reviews, learning paths, manual links, D1 cloud sync, fresh-device restore, provenance graph, backup and reload persistence. No additional AI requests; evergreen notes, verified quotations and exports passed.');
}finally{
 try{ws?.close()}catch{}
 for(const p of pending.values())p.reject(new Error('Browser session closed'));
 if(child&&!child.killed)child.kill('SIGKILL');
 await rm(dir,{recursive:true,force:true,maxRetries:5,retryDelay:100});
}
