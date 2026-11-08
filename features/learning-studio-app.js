// Learning Studio v0.5.4 candidate. No new network services, AI calls or paid dependencies.
// Study progress, paths and user-authored source connections are device-local.
// A manually copied JSON backup is required to move this data to another device.
const studio={revealed:{},catalog:null,backupOpen:false,error:''};
const STUDIO_KEY='lm-learning-studio-v1';
function studioDefault(){return {version:1,reviews:{},paths:[],links:[]}}
function studioLoad(){
 try {
  const d=JSON.parse(localStorage.getItem(STUDIO_KEY)||'null');
  if(!d||d.version!==1||typeof d.reviews!=='object'||!Array.isArray(d.paths)||!Array.isArray(d.links))return studioDefault();
  return d;
 }catch{return studioDefault()}
}
function studioSave(d){
 const serialized=JSON.stringify(d);
 if(serialized.length>250000)throw Error('Learning notes exceed the device storage limit. Export a backup before adding more.');
 localStorage.setItem(STUDIO_KEY,serialized);
}
function studioText(v,n){return String(v==null?'':v).trim().slice(0,n)}
function studioId(id){return /^[0-9a-f-]{8,80}$/i.test(String(id||''))}
function studioQuestion(s){
 const d=integrated.bySource[s.id],raw=typeof d?.questions==='string'?d.questions:'';
 return studioText(raw.split(/\n/).map(x=>x.trim()).find(Boolean)||'What is the strongest claim in this source, what evidence supports it, and what could falsify it?',400);
}
function studioDue(entry){return Date.parse(entry?.next_review||'')<=Date.now()}
function studioMarkup(s){
 const db=studioLoad(),history=Array.isArray(db.reviews[s.id])?db.reviews[s.id]:[],last=history[0],d=integrated.bySource[s.id];
 let h='<article class="card" style="margin-top:18px"><div class="section-label">Learning Studio · active recall</div><h2>Can you explain it without looking?</h2><p class="small muted">Answer before revealing the reference material. This exercise uses an already-saved dossier; it does not request additional AI processing.</p><p><strong>'+esc(studioQuestion(s))+'</strong></p>';
 h+='<form id="lm-studio-review"><label for="lm-studio-answer">Your answer</label><textarea class="input" id="lm-studio-answer" name="answer" rows="4" maxlength="3000" required placeholder="Explain the idea in your own words, then identify the evidence and a possible objection."></textarea><label for="lm-studio-confidence">How confident are you?</label><select class="input" id="lm-studio-confidence" name="confidence"><option value="low">Low — review tomorrow</option><option value="medium" selected>Medium — review in 3 days</option><option value="high">High — review in 7 days</option></select><button class="btn primary" type="submit">Save answer and schedule review</button></form>';
 h+='<div class="actions"><button class="btn small" data-studio-reveal="'+esc(s.id)+'">'+(studio.revealed[s.id]?'Hide reference':'Reveal reference material')+'</button></div>';
 if(studio.revealed[s.id])h+='<section><h3>Verbatim saved-text excerpt</h3><p class="small muted">Excerpt is from the saved source, which may be incomplete. Check the original before citing it.</p><p style="white-space:pre-wrap">'+esc(studioText(s.body||'No full source text is saved.',1000))+'</p>'+(d&&typeof d.first_principles==='string'?'<h3>AI-generated explanation</h3><p style="white-space:pre-wrap">'+esc(studioText(d.first_principles,1800))+'</p><p class="small muted">Interpretation only; not a verified citation.</p>':'')+'</section>';
 if(last)h+='<section style="margin-top:16px"><h3>Last reflection</h3><p style="white-space:pre-wrap">'+esc(last.answer)+'</p><p class="small muted">Confidence: '+esc(last.confidence)+' · '+esc(history.length)+' saved attempt(s) · next review '+esc(last.next_review.slice(0,10))+(studioDue(last)?' · due now':'')+'</p></section>';
 h+='<section style="margin-top:16px"><h3>Build a learning path</h3><form id="lm-studio-path"><label for="lm-studio-path-name">Path name</label><input class="input" id="lm-studio-path-name" name="path" maxlength="60" value="Foundations"><button class="btn small" type="submit">Add this source</button></form></section>';
 h+='<section style="margin-top:16px"><h3>Connect this source to another</h3><p class="small muted">Connections are your own interpretations, not AI-inferred facts.</p><button class="btn small" data-studio-catalog="1">Select another saved source</button>';
 if(Array.isArray(studio.catalog)){
  const available=studio.catalog.filter(x=>x.id!==s.id&&studioId(x.id)).slice(0,100);
  h+='<form id="lm-studio-link"><label for="lm-studio-target">Related source</label><select class="input" id="lm-studio-target" name="target" required>'+available.map(x=>'<option value="'+esc(x.id)+'">'+esc(studioText(x.title||'Untitled',120))+'</option>').join('')+'</select><label for="lm-studio-kind">Relationship</label><select class="input" id="lm-studio-kind" name="kind"><option>supports</option><option>challenges</option><option>extends</option><option>questions</option></select><label for="lm-studio-reason">Your rationale</label><textarea class="input" id="lm-studio-reason" name="reason" maxlength="600" rows="2" required placeholder="What claim or evidence links these two sources?"></textarea><button class="btn small" type="submit" '+(!available.length?'disabled':'')+'>Save connection</button></form>';
 }
 h+='</section><p class="small muted">Progress and connections are stored only on this device, not in Cloudflare D1 or the standard library export. Use the learning backup in Explore to preserve them.</p></article>';
 return h;
}
function studioOverview(){
 const db=studioLoad(),all=Object.entries(db.reviews).filter(([,r])=>Array.isArray(r)&&r.length).map(([id,r])=>({id,...r[0]}));
 const due=all.filter(x=>studioDue(x)).length;
 let h='<section class="card" style="margin:20px 0"><div class="section-label">Learning Studio</div><h2>Your learning pathways</h2><p class="small muted">'+due+' review(s) due · '+all.length+' source(s) studied. Reviews, paths and links are saved only on this device.</p>';
 if(all.length)h+='<h3>Review queue</h3>'+all.sort((a,b)=>a.next_review.localeCompare(b.next_review)).slice(0,12).map(x=>'<p><button class="btn small" data-source="'+esc(x.id)+'">'+esc(studioText(x.title||'Open source',90))+'</button> <span class="small muted">'+esc(x.next_review.slice(0,10))+(studioDue(x)?' · Due':'')+'</span></p>').join('');
 if(db.paths.length)h+='<h3>Learning paths</h3>'+db.paths.slice(0,25).map(p=>'<section><strong>'+esc(p.name)+'</strong><p class="small muted">'+p.items.length+' source(s) · in chosen order</p>'+p.items.map(x=>'<button class="btn small" data-source="'+esc(x.id)+'">'+esc(studioText(x.title,80))+'</button>').join(' ')+'</section>').join('');
 if(db.links.length)h+='<h3>Knowledge connections</h3>'+db.links.slice(-40).reverse().map(x=>'<p><button class="btn small" data-source="'+esc(x.from)+'">'+esc(studioText(x.fromTitle,70))+'</button> '+esc(x.kind)+' <button class="btn small" data-source="'+esc(x.to)+'">'+esc(studioText(x.toTitle,70))+'</button><br><span class="small muted">'+esc(x.reason)+'</span></p>').join('');
 h+='<div class="actions"><button class="btn small" data-studio-backup="1">'+(studio.backupOpen?'Hide learning backup':'Back up / restore learning data')+'</button></div>';
 if(studio.backupOpen)h+='<p class="small muted">Copy the JSON backup and save it privately. It may contain your personal notes. Restoring replaces only this device’s Learning Studio data.</p><button class="btn small" data-studio-copy="1">Copy learning backup as JSON</button><form id="lm-studio-import"><label for="lm-studio-import-text">Restore from a previous Learning Studio backup</label><textarea class="input" id="lm-studio-import-text" name="backup" maxlength="250000" rows="3" placeholder="Paste your previously exported JSON" required></textarea><button class="btn small" type="submit">Restore learning data</button></form>';
 return h+'</section>';
}
function studioImport(value){
 if(value.length>250000)throw Error('Backup is too large.');
 const raw=JSON.parse(value);
 if(!raw||raw.version!==1||typeof raw.reviews!=='object'||!Array.isArray(raw.paths)||!Array.isArray(raw.links))throw Error('This is not a Learning Studio v1 backup.');
 const clean=studioDefault();
 for(const [id,history] of Object.entries(raw.reviews).slice(0,250)){
  if(!studioId(id)||!Array.isArray(history))continue;
  clean.reviews[id]=history.slice(0,20).map(x=>({title:studioText(x.title,200),question:studioText(x.question,400),answer:studioText(x.answer,3000),confidence:['low','medium','high'].includes(x.confidence)?x.confidence:'medium',created_at:studioText(x.created_at,40),next_review:studioText(x.next_review,40)})).filter(x=>x.answer);
 }
 for(const p of raw.paths.slice(0,25))if(p&&typeof p==='object'&&Array.isArray(p.items))clean.paths.push({name:studioText(p.name,60),items:p.items.slice(0,100).filter(x=>studioId(x?.id)).map(x=>({id:x.id,title:studioText(x.title,160)}))});
 for(const x of raw.links.slice(0,250))if(studioId(x?.from)&&studioId(x?.to)&&['supports','challenges','extends','questions'].includes(x.kind))clean.links.push({from:x.from,to:x.to,fromTitle:studioText(x.fromTitle,160),toTitle:studioText(x.toTitle,160),kind:x.kind,reason:studioText(x.reason,600)});
 studioSave(clean);
}
document.addEventListener('submit',e=>{
 const form=e.target?.id;
 if(!['lm-studio-review','lm-studio-path','lm-studio-link','lm-studio-import'].includes(form))return;
 e.preventDefault();
 try{
  if(form==='lm-studio-import'){studioImport(String(new FormData(e.target).get('backup')||''));flash('Learning backup restored');render();return}
  const s=state.detail?.source;if(!s||!studioId(s.id))throw Error('Open a saved source first.');
  const d=studioLoad(),f=new FormData(e.target);
  if(form==='lm-studio-review'){
   const answer=studioText(f.get('answer'),3000);if(answer.length<20)throw Error('Write at least 20 characters before saving.');
   const confidence=String(f.get('confidence'));if(!['low','medium','high'].includes(confidence))throw Error('Invalid confidence.');
   const offset={low:1,medium:3,high:7}[confidence];
   const entry={title:studioText(s.title,200),question:studioQuestion(s),answer,confidence,created_at:new Date().toISOString(),next_review:new Date(Date.now()+offset*86400000).toISOString()};
   d.reviews[s.id]=[entry,...(d.reviews[s.id]||[])].slice(0,20);
  }
  if(form==='lm-studio-path'){
   const name=studioText(f.get('path'),60);if(name.length<2)throw Error('Enter a path name.');
   let p=d.paths.find(x=>x.name.toLowerCase()===name.toLowerCase());
   if(!p){if(d.paths.length>=25)throw Error('Maximum 25 learning paths.');p={name,items:[]};d.paths.push(p)}
   if(!p.items.some(x=>x.id===s.id)){if(p.items.length>=100)throw Error('Path has 100 sources already.');p.items.push({id:s.id,title:studioText(s.title,160)})}
  }
  if(form==='lm-studio-link'){
   const target=String(f.get('target')),selected=studio.catalog?.find(x=>x.id===target);
   const kind=String(f.get('kind')),reason=studioText(f.get('reason'),600);
   if(!selected||target===s.id||!studioId(target)||!['supports','challenges','extends','questions'].includes(kind)||reason.length<10)throw Error('Choose another source and explain the relationship.');
   if(d.links.length>=250)throw Error('Maximum 250 manual connections. Export your learning data before expanding.');
   d.links.push({from:s.id,to:target,fromTitle:studioText(s.title,160),toTitle:studioText(selected.title,160),kind,reason});
  }
  studioSave(d);flash('Learning Studio saved on this device');render();
 }catch(error){flash(error.message||'Could not save learning data',true)}
});
document.addEventListener('click',async e=>{
 const n=e.target?.closest?.('[data-studio-reveal],[data-studio-catalog],[data-studio-backup],[data-studio-copy]');
 if(!n)return;
 if(n.dataset.studioReveal){const id=n.dataset.studioReveal;studio.revealed[id]=!studio.revealed[id];render();return}
 if(n.dataset.studioBackup){studio.backupOpen=!studio.backupOpen;render();return}
 if(n.dataset.studioCopy){try{await navigator.clipboard.writeText(JSON.stringify(studioLoad(),null,2));flash('Learning backup copied. Store it privately.')}catch{flash('Clipboard unavailable',true)}return}
 if(n.dataset.studioCatalog){try{const response=await api('sources');studio.catalog=(response.sources||[]).filter(x=>studioId(x.id));render()}catch(err){flash('Library unavailable: '+err.message,true)}}
});
