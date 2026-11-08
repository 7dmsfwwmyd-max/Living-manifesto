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
 const sourceId=await evaluate('(async()=>{const r=await api("sources");return r.sources.find(x=>String(x.title||"").includes("Release validation '+commit.slice(0,12)+'"))?.id||null})()');
 assert.ok(sourceId,'Staging release fixture is missing');
 const openSource='(async()=>{state.detail=await api("sources/'+sourceId+'");learn.tab="understand";render();return !!document.getElementById("lm-studio-review")})()';
 assert.equal(await evaluate(openSource),true,'Learning Studio did not render for saved article');
 assert.equal(await evaluate('(()=>{const n=document.querySelector("[data-studio-reveal]");n?.click();return !!document.body.innerText.includes("Verbatim saved-text excerpt")})()'),true,'Reference reveal did not work');
 const answer='The article argues that evidence should be checked before reaching a conclusion, and alternative explanations should be considered.';
 const submit='(()=>{const i=document.getElementById("lm-studio-answer");i.value='+JSON.stringify(answer)+';document.getElementById("lm-studio-confidence").value="low";document.getElementById("lm-studio-review").requestSubmit();return true})()';
 await evaluate(submit);
 await until('studioLoad().reviews['+JSON.stringify(sourceId)+']?.length===1','saved recall review');
 const reviewed=await evaluate('studioLoad().reviews['+JSON.stringify(sourceId)+'][0]');
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
 assert.equal(await evaluate('(()=>{const old=localStorage.getItem("lm-learning-studio-v1");localStorage.removeItem("lm-learning-studio-v1");studioImport(old);return studioLoad().reviews['+JSON.stringify(sourceId)+']?.length===1})()'),true,'JSON backup restore failed');
 await command('Page.reload',{ignoreCache:true});
 await until('document.readyState==="complete"&&typeof studioLoad==="function"','reloaded application');
 assert.equal(await evaluate('studioLoad().reviews['+JSON.stringify(sourceId)+']?.length===1'),true,'Recall was lost across browser reload');
 console.log('PASS authenticated real-browser login, source details, recall and scheduled review, reference reveal, learning path, source connection, JSON restore, and reload persistence. No additional AI requests.');
}finally{
 try{ws?.close()}catch{}
 for(const p of pending.values())p.reject(new Error('Browser session closed'));
 if(child&&!child.killed)child.kill('SIGKILL');
 await rm(dir,{recursive:true,force:true,maxRetries:5,retryDelay:100});
}
