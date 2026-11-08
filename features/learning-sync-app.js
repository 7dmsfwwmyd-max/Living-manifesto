// Living Manifesto v0.5.5: synced study history and provenance-first knowledge graph.
// Offline/local writes are immediate. D1 sync is authenticated, idempotent and revision checked.
const learningCloud={busy:false,queued:false,ready:false,lastAttempt:0,status:'Not yet synced',error:'',timer:null,graph:null,graphLoading:false,selected:'',query:''};
function studioMerge(a,b){
 const out=studioDefault();
 const left=a&&a.version===1?a:studioDefault(),right=b&&b.version===1?b:studioDefault();
 for(const [sid,history] of Object.entries({...left.reviews,...right.reviews})){
  if(!studioId(sid))continue;
  const items=[...(Array.isArray(left.reviews[sid])?left.reviews[sid]:[]),...(Array.isArray(right.reviews[sid])?right.reviews[sid]:[])];
  const seen=new Set();
  out.reviews[sid]=items.filter(x=>{
   if(!x||typeof x.answer!=='string'||x.answer.length<20)return false;
   const key=String(x.created_at||'')+'|'+x.answer;
   if(seen.has(key))return false;seen.add(key);return true;
  }).sort((x,y)=>String(y.created_at||'').localeCompare(String(x.created_at||''))).slice(0,20);
 }
 for(const p of [...(left.paths||[]),...(right.paths||[])]){
  if(!p||typeof p.name!=='string'||!Array.isArray(p.items))continue;
  let target=out.paths.find(x=>x.name.toLowerCase()===p.name.toLowerCase());
  if(!target){if(out.paths.length>=25)continue;target={name:p.name.slice(0,60),items:[]};out.paths.push(target)}
  for(const item of p.items)if(studioId(item?.id)&&!target.items.some(x=>x.id===item.id)&&target.items.length<100)target.items.push({id:item.id,title:studioText(item.title,160)});
 }
 const seen=new Set();
 for(const x of [...(left.links||[]),...(right.links||[])]){
  if(!studioId(x?.from)||!studioId(x?.to)||!['supports','challenges','extends','questions'].includes(x.kind))continue;
  const key=[x.from,x.to,x.kind,studioText(x.reason,600)].join('|');
  if(seen.has(key))continue;seen.add(key);
  if(out.links.length<250)out.links.push({from:x.from,to:x.to,fromTitle:studioText(x.fromTitle,160),toTitle:studioText(x.toTitle,160),kind:x.kind,reason:studioText(x.reason,600)});
 }
 return out;
}
function studioRefreshIfSafe(){
 if(!state.signedIn)return;
 const active=document.activeElement;
 if(active&&/^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName||''))return;
 if(state.modal)return;
 render();
}
function studioScheduleSync(){
 if(!state.signedIn)return;
 if(learningCloud.timer)clearTimeout(learningCloud.timer);
 learningCloud.timer=setTimeout(()=>{learningCloud.timer=null;studioSyncNow()},900);
 learningCloud.status='Saved locally; syncing when available';
}
async function studioSyncNow(){
 if(!state.signedIn)return;
 if(learningCloud.busy){learningCloud.queued=true;return}
 learningCloud.busy=true;learningCloud.lastAttempt=Date.now();
 try{
  let verified=false;
  for(let attempt=0;attempt<4;attempt++){
   const remote=await api('studio-state');
   // Read local on each retry, in case the user saved a new answer while syncing.
   const local=studioLoad();
   const merged=studioMerge(remote.state,local);
   const data=JSON.stringify(merged);
   if(data.length>250000)throw Error('Synced study data exceed the storage limit. Make a JSON backup.');
   const server=JSON.stringify(studioMerge(remote.state,studioDefault()));
   if(data!==server){
    try{await api('studio-state',{method:'POST',body:JSON.stringify({expected_revision:remote.revision,state:merged})})}
    catch(error){if(/another device|Concurrent learning update/.test(error.message)&&attempt<3)continue;throw error}
   }
   // A user interaction may have happened while the server request was pending.
   const newest=studioMerge(merged,studioLoad());
   localStorage.setItem(STUDIO_KEY,JSON.stringify(newest));
   learningCloud.ready=true;learningCloud.status='Synced to private Cloudflare database';learningCloud.error='';
   if(JSON.stringify(newest)!==data)learningCloud.queued=true;
   verified=true;break;
  }
  if(!verified)throw Error('The learning data changed on another device. Try Sync now.');
 }catch(error){
  learningCloud.error=String(error?.message||'Sync unavailable');
  learningCloud.status='Saved on this device; cloud sync pending';
 }finally{
  learningCloud.busy=false;
  studioRefreshIfSafe();
  if(learningCloud.queued){
   learningCloud.queued=false;
   if(learningCloud.timer)clearTimeout(learningCloud.timer);
   learningCloud.timer=setTimeout(()=>{learningCloud.timer=null;studioSyncNow()},500);
  }
 }
}
const studioSaveLocal=studioSave;
studioSave=function(data){studioSaveLocal(data);studioScheduleSync()};
const appReload=reload;
reload=async function(){
 const result=await appReload();
 if(state.signedIn&&(!learningCloud.ready&&Date.now()-learningCloud.lastAttempt>30000))void studioSyncNow();
 return result;
};
document.addEventListener('visibilitychange',()=>{
 if(!document.hidden&&state.signedIn&&Date.now()-learningCloud.lastAttempt>60000)void studioSyncNow();
});
async function graphLoad(){
 if(learningCloud.graphLoading||!state.signedIn)return;
 learningCloud.graphLoading=true;
 try{learningCloud.graph=await api('knowledge-graph');learningCloud.error=''}
 catch(error){learningCloud.error=error.message||'Graph currently unavailable'}
 finally{learningCloud.graphLoading=false;studioRefreshIfSafe()}
}
function graphMarkup(){
 if(!learningCloud.graph&&!learningCloud.graphLoading&&state.signedIn)void graphLoad();
 const g=learningCloud.graph,db=studioLoad();
 let html='<article class="card" style="margin:20px 0"><div class="section-label">Connected knowledge · source provenance</div><h2>Your knowledge graph</h2><p class="small muted">Concept nodes connect sources sharing extracted tags or disciplines. These are suggested themes, not evidence that their claims agree. Only links you wrote are labelled supports, challenges, extends or questions.</p>';
 html+='<p class="small muted">'+esc(learningCloud.status)+(learningCloud.error?' · '+esc(learningCloud.error):'')+'</p><div class="actions"><button class="btn small" data-studio-cloud-sync="1" '+(learningCloud.busy?'disabled':'')+'>Sync learning now</button><button class="btn small" data-graph-refresh="1" '+(learningCloud.graphLoading?'disabled':'')+'>Refresh graph</button></div>';
 if(!g) return html+'<p class="small muted">'+(learningCloud.graphLoading?'Building graph from your saved sources…':'Graph not yet loaded; source data remain unchanged.')+'</p></article>';
 html+='<p class="small muted">'+g.sources.length+' saved source nodes · '+g.concepts.length+' shared concept nodes · '+db.links.length+' user-written source links</p>';
 const all=g.concepts||[];
 html+='<form id="lm-graph-search"><label for="lm-graph-query">Explore shared concepts</label><input class="input" id="lm-graph-query" maxlength="80" name="q" value="'+esc(learningCloud.query)+'" placeholder="e.g. uncertainty, compounding, stoicism"><button class="btn small" type="submit">Find connections</button></form>';
 const matches=all.filter(x=>!learningCloud.query||x.label.toLowerCase().includes(learningCloud.query.toLowerCase())).slice(0,24);
 if(matches.length)html+='<div class="actions">'+matches.map(x=>'<button class="btn small" data-graph-concept="'+esc(x.id)+'">'+esc(x.label)+' ('+x.mentions.length+')</button>').join('')+'</div>';
 else html+='<p class="small muted">No shared concepts match. Read and analyse more sources to build useful edges.</p>';
 const selected=all.find(x=>x.id===learningCloud.selected)||matches[0];
 if(selected){
  html+='<section style="margin-top:18px"><h3>'+esc(selected.label)+'</h3><p class="small muted">Connected through saved analysis labels. Check each linked source before drawing a conclusion.</p>';
  for(const mention of selected.mentions.slice(0,25)){
   html+='<p><button class="btn small" data-source="'+esc(mention.source_id)+'">'+esc(mention.title)+'</button><span class="small muted"> · '+esc(mention.basis)+'</span>'+
   (mention.evidence?'<br><span class="small muted">Associated text: '+esc(mention.evidence)+'</span>':'')+'</p>';
  }
  html+='</section>';
 }
 if(db.links.length){
  html+='<h3>Your explicit source-to-source links</h3>';
  for(const x of db.links.slice(-20).reverse())html+='<p><button class="btn small" data-source="'+esc(x.from)+'">'+esc(x.fromTitle||'Source')+'</button> '+esc(x.kind)+' <button class="btn small" data-source="'+esc(x.to)+'">'+esc(x.toTitle||'Source')+'</button><br><span class="small muted">'+esc(x.reason)+' · Your interpretation</span></p>';
 }
 return html+'</article>';
}
const studioOverviewOriginal=studioOverview;
studioOverview=function(){return graphMarkup()+studioOverviewOriginal()};
document.addEventListener('click',e=>{
 const n=e.target?.closest?.('[data-studio-cloud-sync],[data-graph-refresh],[data-graph-concept]');
 if(!n)return;
 if(n.dataset.studioCloudSync)void studioSyncNow();
 if(n.dataset.graphRefresh)void graphLoad();
 if(n.dataset.graphConcept){learningCloud.selected=n.dataset.graphConcept;render()}
});
document.addEventListener('submit',e=>{
 if(e.target?.id!=='lm-graph-search')return;
 e.preventDefault();learningCloud.query=studioText(new FormData(e.target).get('q'),80);learningCloud.selected='';render();
});
