const knowledge={loaded:false,loading:false,busy:false,items:[],active:null,page:null,draft:null,dirty:false,history:null,error:'',attach:null};
const ktEsc=x=>esc(String(x??''));
const ktBlank=()=>({title:'',keywords:[],current_view:'',confidence:'undecided',would_change:'',open_questions:'',change_reason:'',source_refs:[]});
function ktDraft(){return knowledge.draft||knowledge.active||ktBlank()}
function ktEditor(){
 const n=ktDraft();
 const input=(key,label,max,rows=0)=>'<label for="kt-'+key+'">'+label+'</label>'+(rows?'<textarea class="input" id="kt-'+key+'" name="'+key+'" maxlength="'+max+'" rows="'+rows+'">'+ktEsc(n[key])+'</textarea>':'<input class="input" id="kt-'+key+'" name="'+key+'" maxlength="'+max+'" value="'+ktEsc(n[key])+'" required>');
 return '<form id="kt-editor">'+input('title','Topic',140)+'<label for="kt-keywords">Match terms (comma-separated, up to 12)</label><input class="input" id="kt-keywords" name="keywords" maxlength="860" value="'+ktEsc(n.keywords.join(', '))+'" placeholder="e.g. concentration, diversification, manager selection">'+input('current_view','My current view',6000,4)+'<label for="kt-confidence">My confidence</label><select class="input" id="kt-confidence" name="confidence">'+['undecided','low','moderate','high'].map(x=>'<option'+(n.confidence===x?' selected':'')+'>'+x+'</option>').join('')+'</select>'+input('would_change','What evidence would change my mind?',3000,3)+input('open_questions','Open questions',4000,3)+input('change_reason',knowledge.active?.id?'What changed my thinking, or why am I revising this?':'Why am I starting this topic?',1200,3)+'<p class="small muted">Your view is never automatically adopted into the Manifesto. Every saved revision keeps the preceding version.</p><div class="actions"><button class="btn primary" '+(knowledge.busy?'disabled':'')+'>Save topic and review</button><button type="button" class="btn" data-kt-cancel="1" '+(knowledge.busy?'disabled':'')+'>Cancel edit</button></div></form>';
}
function ktQualityMarkup(s){
 const q=s.quality||ktQuality({...s,body_length:s.body_length??s.body?.length??0});
 return '<div class="small muted" aria-label="Source coverage">'+tag(q.label)+' '+ktEsc(q.characters.toLocaleString())+' characters · '+ktEsc(q.analysis_status||'Unknown status')+'<p>'+ktEsc(q.detail)+(q.analysis_context_limited?' Saved text exceeds the current automatic-analysis context budget; analysis may cover only part of it.':'')+'</p></div>';
}
function knowledgeMarkup(){
 if(state.signedIn&&!knowledge.loaded&&!knowledge.loading){knowledge.loading=true;ktRefresh().finally(()=>knowledge.loading=false)}
 let h='<article class="card" style="margin:20px 0" aria-label="Topic workspaces"><div class="section-label">Living knowledge · topic pages</div><h2>Build a view across your reading</h2><p>Bring sources, arguments, questions and your changing perspective together.</p>';
 if(knowledge.error)h+='<p role="alert">'+ktEsc(knowledge.error)+'</p>';
 h+='<div class="actions"><button class="btn primary" data-kt-new="1" '+(knowledge.busy?'disabled':'')+'>New topic</button><button class="btn" data-kt-refresh="1" '+(knowledge.busy?'disabled':'')+'>Refresh saved topics</button></div>';
 if(!knowledge.loaded)return h+'<p>Loading topics…</p></article>';
 h+='<div class="actions">'+knowledge.items.map(n=>'<button class="btn small" data-kt-open="'+ktEsc(n.id)+'">'+ktEsc(n.title)+'</button>').join('')+'</div>';
 if(knowledge.draft)return h+'<hr>'+ktEditor()+'</article>';
 const n=knowledge.active,p=knowledge.page;if(!n||!p)return h+'<p class="small muted">Start with a question you care about. Attach saved sources and record your own view; no extra AI calls are made.</p></article>';
 h+='<hr><h3>'+ktEsc(n.title)+'</h3><p class="small muted">Revision '+n.revision+' · '+ktEsc(date(n.updated_at))+'</p><p class="small">'+ktEsc(p.disclosure)+'</p><h4>My current view</h4><p style="white-space:pre-wrap">'+ktEsc(n.current_view||'No view recorded yet.')+'</p>'+tag('My confidence: '+n.confidence)+'<h4>What would change my mind?</h4><p style="white-space:pre-wrap">'+ktEsc(n.would_change||'Not recorded yet.')+'</p><h4>Open questions</h4><p style="white-space:pre-wrap">'+ktEsc(n.open_questions||'No questions recorded yet.')+'</p><h4>Latest review: what changed?</h4><p>'+ktEsc(n.change_reason)+'</p><div class="actions"><button class="btn primary" data-kt-edit="1">Review my thinking</button><button class="btn" data-kt-history="1">Read previous views</button></div>';
 if(knowledge.history)h+='<details open><summary>Previous saved views ('+knowledge.history.length+')</summary>'+knowledge.history.map(r=>'<article class="card"><b>Revision '+r.revision+' · '+ktEsc(date(r.created_at))+'</b><p style="white-space:pre-wrap">'+ktEsc(r.topic.current_view||'No view recorded.')+'</p><p>Confidence: '+ktEsc(r.topic.confidence)+'</p><p>Reason for this version: '+ktEsc(r.topic.change_reason)+'</p><p>Would change my mind: '+ktEsc(r.topic.would_change||'Not recorded')+'</p><p>Open questions: '+ktEsc(r.topic.open_questions||'None recorded')+'</p></article>').join('')+(knowledge.history.length?'':'<p>No earlier versions yet.</p>')+'</details>';
 h+='<h4>Next useful steps</h4><ul>'+p.next_actions.map(x=>'<li>'+ktEsc(x)+'</li>').join('')+'</ul><h4>Sources and arguments</h4><p class="small muted">Supports, challenges and qualifies are your classifications. Up to three saved AI interpretations are shown per source; open the source for its full analysis and evidence checks.</p>';
 for(const s of p.sources){
  h+='<article class="card" style="margin:12px 0">'+tag('Your classification: '+s.relation)+'<h4><button class="btn" data-source="'+ktEsc(s.source_id)+'">'+ktEsc(s.title)+'</button></h4>';
  if(s.missing)h+='<p>Source no longer available.</p>';
  else h+=ktQualityMarkup(s)+'<details><summary>Saved summary and arguments</summary><p style="white-space:pre-wrap">'+ktEsc(s.summary||'No summary saved.')+'</p>'+s.ideas.map(i=>'<h5>'+ktEsc(i.statement)+'</h5><p>'+ktEsc(i.mechanism)+'</p><p><b>Saved AI evidence interpretation:</b> '+ktEsc(i.evidence||'Not recorded')+'</p><p><b>Saved AI objection:</b> '+ktEsc(i.counterargument||'Not recorded')+'</p>').join('')+(s.question?'<p><b>Source question:</b> '+ktEsc(s.question)+'</p>':'')+'</details>';
  h+='<p class="small">Your rationale: '+ktEsc(s.rationale||'Not recorded')+'</p><div class="actions"><button class="btn small" data-kt-classify="'+ktEsc(s.source_id)+'">Change classification</button><button class="btn small" data-kt-remove="'+ktEsc(s.source_id)+'">Detach from topic</button></div></article>';
 }
 const candidates=state.sources.filter(s=>!n.source_refs.some(r=>r.source_id===s.id));
 h+='<h4>Attach a saved source</h4><p class="small muted">Keyword matches scan titles, summaries and disciplines of the latest '+p.limits.suggestion_pool+' sources. They are suggestions, not confirmed relationships.</p>';
 h+=p.suggestions.map(s=>'<p><button class="btn small" data-kt-suggest="'+ktEsc(s.source_id)+'">'+ktEsc(s.title||'Untitled')+'</button> <span class="small muted">Matches: '+ktEsc(s.matches.join(', '))+'</span></p>').join('');
 const draft=knowledge.attach||{},existing=n.source_refs.find(r=>r.source_id===draft.source_id),options=existing?[state.sources.find(s=>s.id===existing.source_id)||{id:existing.source_id,title:'Selected source'}]:candidates;
 if(options.length)h+='<form id="kt-attach"><label for="kt-source">Saved source</label><select class="input" id="kt-source" name="source_id">'+options.map(s=>'<option value="'+ktEsc(s.id)+'"'+(draft.source_id===s.id?' selected':'')+'>'+ktEsc(s.title||'Untitled')+'</option>').join('')+'</select><label for="kt-relation">My classification</label><select class="input" id="kt-relation" name="relation">'+['context','supports','challenges','qualifies'].map(r=>'<option'+(draft.relation===r?' selected':'')+'>'+r+'</option>').join('')+'</select><label for="kt-rationale">Why does this source matter?</label><textarea class="input" id="kt-rationale" name="rationale" maxlength="600" rows="2">'+ktEsc(draft.rationale||'')+'</textarea><button class="btn" '+(knowledge.busy?'disabled':'')+'>'+(existing?'Save classification':'Attach to topic')+'</button></form>';
 h+='<h4>Related saved concepts</h4><p class="small muted">These concepts cite at least one of the same sources; this does not establish agreement.</p>'+p.concepts.map(c=>'<details><summary>'+ktEsc(c.title)+'</summary><p>'+ktEsc(c.thesis)+'</p><button class="btn small" data-ev-open="'+ktEsc(c.id)+'">Open in Evergreen concepts below</button></details>').join('');
 return h+'</article>';
}
async function ktRefresh(){try{knowledge.items=(await api('knowledge-topics')).topics;knowledge.error=''}catch(e){knowledge.error=e.message}finally{knowledge.loaded=true;render()}}
async function ktOpen(id){const page=await api('knowledge-topics/'+id);knowledge.active=page.topic;knowledge.page=page;knowledge.draft=null;knowledge.dirty=false;knowledge.history=null;knowledge.attach=null;knowledge.error='';render()}
async function ktSave(value){
 const current=knowledge.active;
 const r=await api('knowledge-topics'+(current?.id?'/'+current.id:''),{method:current?.id?'PUT':'POST',body:JSON.stringify(current?.id?{revision:current.revision,topic:value}:value)});
 // Only clear the draft after the server accepts the save. Conflicts retain it.
 knowledge.draft=null;knowledge.dirty=false;knowledge.active=r.topic;
 await ktOpen(r.topic.id);await ktRefresh();flash('Topic and thinking review saved');
}
function ktFormValue(form){const f=new FormData(form);return {...ktDraft(),...Object.fromEntries(['title','current_view','confidence','would_change','open_questions','change_reason'].map(k=>[k,String(f.get(k)||'')])),keywords:String(f.get('keywords')||'').split(',').map(x=>x.trim()).filter(Boolean)}}
document.addEventListener('input',e=>{
 if(e.target.closest?.('#kt-editor')){knowledge.draft=ktFormValue(e.target.closest('#kt-editor'));knowledge.dirty=true}
 if(e.target.closest?.('#kt-attach')){const f=new FormData(e.target.closest('#kt-attach'));knowledge.attach=Object.fromEntries(['source_id','relation','rationale'].map(k=>[k,String(f.get(k)||'')]))}
});
document.addEventListener('submit',async e=>{
 if(!['kt-editor','kt-attach'].includes(e.target.id))return;e.preventDefault();if(knowledge.busy)return;knowledge.busy=true;
 try{
  if(e.target.id==='kt-editor'){knowledge.draft=ktFormValue(e.target);knowledge.dirty=true;await ktSave(knowledge.draft)}
  else{const f=new FormData(e.target),ref={source_id:String(f.get('source_id')),relation:String(f.get('relation')),rationale:String(f.get('rationale')||'')};knowledge.attach=ref;await ktSave({...knowledge.active,source_refs:[...knowledge.active.source_refs.filter(r=>r.source_id!==ref.source_id),ref],change_reason:'Source classified as '+ref.relation+'. '+ref.rationale})}
 }catch(err){knowledge.error=err.message;flash(err.message,true)}finally{knowledge.busy=false;render()}
});
document.addEventListener('click',async e=>{
 const el=e.target.closest?.('[data-kt-new],[data-kt-open],[data-kt-edit],[data-kt-cancel],[data-kt-refresh],[data-kt-history],[data-kt-suggest],[data-kt-classify],[data-kt-remove]');if(!el||knowledge.busy)return;
 if(knowledge.dirty&&!el.dataset.ktCancel){flash('Save or cancel your topic draft first. It is still here.',true);return}
 knowledge.busy=true;
 try{
  if(el.dataset.ktNew){knowledge.active=null;knowledge.page=null;knowledge.draft=ktBlank();knowledge.error=''}
  if(el.dataset.ktOpen)await ktOpen(el.dataset.ktOpen);
  if(el.dataset.ktEdit){knowledge.draft={...knowledge.active,change_reason:''};knowledge.error=''}
  if(el.dataset.ktCancel){knowledge.draft=null;knowledge.dirty=false;knowledge.error=''}
  if(el.dataset.ktRefresh)await ktRefresh();
  if(el.dataset.ktHistory)knowledge.history=(await api('knowledge-topics/'+knowledge.active.id+'/history')).history;
  if(el.dataset.ktSuggest)knowledge.attach={source_id:el.dataset.ktSuggest,relation:'context',rationale:''};
  if(el.dataset.ktClassify)knowledge.attach={...knowledge.active.source_refs.find(r=>r.source_id===el.dataset.ktClassify)};
  if(el.dataset.ktRemove)await ktSave({...knowledge.active,source_refs:knowledge.active.source_refs.filter(r=>r.source_id!==el.dataset.ktRemove),change_reason:'Detached source from this topic; original source remains in the library.'});
 }catch(err){knowledge.error=err.message;flash(err.message,true)}finally{knowledge.busy=false;render()}
});
