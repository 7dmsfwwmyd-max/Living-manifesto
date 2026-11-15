const mmUI={models:null,loading:false,error:'',selected:null,page:null,editing:false,drafts:{},query:'',filter:'all',history:null,busy:false};
const mmLabels={definition:'Core idea',mechanism:'How it works',when_to_use:'When to use it',example:'Worked example',limitations:'Where it can mislead',exercise:'Practise it',notes:'My applications and reflections'};
async function mmRefresh(){if(mmUI.loading)return;mmUI.loading=true;mmUI.error='';try{mmUI.models=(await api('mental-models')).models}catch(e){mmUI.error=e.message}finally{mmUI.loading=false;render()}}
async function mmOpen(id){mmUI.selected=id;mmUI.editing=false;mmUI.page=null;mmUI.history=null;mmUI.error='';render();try{const page=await api('mental-models/'+id);if(mmUI.selected===id)mmUI.page=page}catch(e){mmUI.error=e.message}render()}
function mmStartEdit(model){const key=model?.id||'new';if(!mmUI.drafts[key])mmUI.drafts[key]=model?JSON.parse(JSON.stringify(model)):{id:'new',revision:0,name:'',category:'My models',definition:'',mechanism:'',when_to_use:'',example:'',limitations:'',exercise:'',notes:'',source_ids:[],stage:'exploring',favourite:false,archived:false};mmUI.selected=key;mmUI.editing=true;render()}
function mmEditor(){
 const m=mmUI.drafts[mmUI.selected];if(!m)return '';
 let h='<form id="mm-editor"><h2>'+esc(m.id==='new'?'Add a mental model':'Edit '+m.name)+'</h2><p class="small muted">Your draft stays in this tab until saved. Saves sync across devices; stale edits are rejected.</p>';
 for(const [key,label] of Object.entries({name:'Model name',category:'Category',...mmLabels}))h+='<div class="field"><label for="mm-'+key+'">'+label+'</label>'+(key==='name'||key==='category'?'<input':'<textarea rows="4"')+' id="mm-'+key+'" name="'+key+'" maxlength="'+(MM_CLIENT_LIMITS[key])+'" '+(['name','definition'].includes(key)?'required ':'')+(key==='name'||key==='category'?'value="'+esc(m[key])+'">':'>'+esc(m[key])+'</textarea>')+'</div>';
 h+='<div class="field"><label for="mm-stage">My practice stage (self-assessed)</label><select id="mm-stage" name="stage">'+['exploring','practising','using'].map(x=>'<option '+(m.stage===x?'selected':'')+'>'+x+'</option>').join('')+'</select></div>';
 for(const [key,label] of [['favourite','Favourite'],['archived','Archive (keep all notes)']])h+='<p><label><input type="checkbox" name="'+key+'" '+(m[key]?'checked':'')+'> '+label+'</label></p>';
 h+='<details><summary>Link saved articles ('+m.source_ids.length+')</summary><p class="small muted">Links record your association, not proof or endorsement. Use your notes to explain support or disagreement. Most recent 400 sources are available here; older existing links are retained.</p>'+(state.sources||[]).map(s=>'<p><label><input type="checkbox" data-mm-source="'+esc(s.id)+'" '+(m.source_ids.includes(s.id)?'checked':'')+'> '+esc(sourceLabel(s))+'</label></p>').join('')+'</details>';
 return h+'<div class="actions" style="margin-top:20px"><button class="btn primary" type="submit" '+(mmUI.busy?'disabled':'')+'>Save model</button><button class="btn" type="button" data-mm-cancel="1">Back (keep draft)</button>'+(m.id!=='new'?'<button class="btn" type="button" data-mm-reload="1">Reload saved version (discard draft)</button>':'')+'</div></form>';
}
const MM_CLIENT_LIMITS={name:120,category:60,definition:1800,mechanism:2400,when_to_use:1500,example:3000,limitations:2000,exercise:2000,notes:6000};
function mentalModels(){
 if(!mmUI.models&&!mmUI.loading&&!mmUI.error)void mmRefresh();
 let h=hero('A toolkit for thinking','Mental models','Understand a model, test where it fails, and practise applying it. Models are lenses for reasoning, not automatically adopted principles.');
 if(mmUI.error)h+='<p role="alert" class="notice error">'+esc(mmUI.error)+'</p>';
 if(mmUI.editing)return h+mmEditor();
 if(mmUI.selected){
  h+='<button class="btn" data-mm-back="1">← All models</button>';
  if(!mmUI.page)return h+'<p>Loading model…</p><button class="btn" data-mm-open="'+esc(mmUI.selected)+'">Retry</button>';
  const m=mmUI.page.model;
  h+='<article class="card" style="margin-top:18px" data-mm-detail="'+esc(m.id)+'"><div class="section-label">'+esc(m.category)+' · '+esc(m.stage)+' (self-assessed)'+(m.favourite?' · Favourite':'')+'</div><h2>'+esc(m.name)+'</h2><p class="small muted">'+esc(m.origin)+(m.revision?' Personal version '+m.revision+'.':' Starter edition.')+'</p><div class="actions"><button class="btn primary" data-mm-edit="1">Edit / record application</button><button class="btn" data-mm-history="1">Revision history</button></div>';
  for(const [key,label] of Object.entries(mmLabels))h+='<h3>'+label+'</h3><p style="white-space:pre-wrap">'+esc(m[key]||'Nothing recorded yet.')+'</p>';
  h+='<h3>Linked articles</h3><p class="small muted">Your associations; a link does not establish that an article supports the model.</p>';
  for(const s of mmUI.page.sources)h+='<button class="item" data-source="'+esc(s.id)+'">'+esc(s.title)+'<br><span class="small muted">'+Number(s.body_length||0)+' characters saved · '+esc(s.status)+'</span></button>';
  if(!m.source_ids.length)h+='<p>No articles linked yet. Use Edit to attach one.</p>';
  if(m.source_ids.length>mmUI.page.sources.length)h+='<p>Some linked articles are no longer available.</p>';
  if(mmUI.history){h+='<h3>Earlier personal versions</h3>';if(!mmUI.history.length)h+='<p>No earlier saved personal versions yet.</p>';for(const r of mmUI.history)h+='<details><summary>Version '+Number(r.revision)+' · '+esc(r.created_at)+'</summary><h4>'+esc(r.model.name)+'</h4>'+Object.keys(mmLabels).map(k=>'<p><strong>'+mmLabels[k]+'</strong><br>'+esc(r.model[k]||'')+'</p>').join('')+'</details>'}
  return h+'</article>';
 }
 h+='<div class="actions"><button class="btn primary" data-mm-new="1">+ Add a model</button><button class="btn" data-mm-refresh="1">Refresh</button></div><p class="small muted">Ten starter guides are written for this app. They are not extracted from your articles or represented as authoritative quotations. Personal notes and edits are private and included in your JSON backup.</p><form id="mm-search" class="toolbar" style="margin-top:18px"><label class="field" style="flex:1">Search models<input name="query" value="'+esc(mmUI.query)+'" placeholder="Name, idea, use or category"></label><label class="field">Show<select name="filter">'+[['all','Active models'],['favourite','Favourites'],['practising','Practising'],['archived','Archived']].map(([v,l])=>'<option value="'+v+'" '+(mmUI.filter===v?'selected':'')+'>'+l+'</option>').join('')+'</select></label><button class="btn" type="submit">Search</button></form>';
 if(!mmUI.models)return h+'<p>'+(mmUI.loading?'Loading your models…':'Unable to load models. Use Refresh to retry.')+'</p>';
 const q=mmUI.query.trim().toLowerCase();const list=mmUI.models.filter(m=>(mmUI.filter==='archived'?m.archived:!m.archived)&&(mmUI.filter!=='favourite'||m.favourite)&&(mmUI.filter!=='practising'||m.stage==='practising')&&(!q||[m.name,m.category,m.definition,m.when_to_use,m.notes].join(' ').toLowerCase().includes(q)));
 h+='<p class="small muted">'+list.length+' models</p><div class="two">';
 for(const m of list)h+='<button class="item" data-mm-open="'+esc(m.id)+'"><div class="section-label">'+esc(m.category)+(m.favourite?' · ★':'')+'</div><h3>'+esc(m.name)+'</h3><p>'+esc(m.definition)+'</p><p class="small" style="margin-top:12px">'+esc(m.stage)+' · '+m.source_ids.length+' linked articles'+(mmUI.drafts[m.id]?' · Unsaved draft':'')+'</p></button>';
 return h+'</div>'+(list.length?'':'<p>No matches. Try a broader search or add your own model.</p>');
}
function mmCaptureInput(e){const form=e.target.closest?.('#mm-editor');if(!form)return;const m=mmUI.drafts[mmUI.selected];if(!m)return;const el=e.target;if(el.dataset.mmSource){m.source_ids=el.checked?[...new Set([...m.source_ids,el.dataset.mmSource])]:m.source_ids.filter(x=>x!==el.dataset.mmSource)}else if(Object.hasOwn(m,el.name))m[el.name]=el.type==='checkbox'?el.checked:el.value}
document.addEventListener('input',mmCaptureInput);document.addEventListener('change',mmCaptureInput);
document.addEventListener('click',async e=>{
 const n=e.target.closest?.('[data-mm-open],[data-mm-new],[data-mm-back],[data-mm-edit],[data-mm-cancel],[data-mm-refresh],[data-mm-history],[data-mm-reload]');if(!n)return;
 if(n.dataset.mmReload){if(!confirm('Discard this unsaved draft and load the latest saved model?'))return;const key=mmUI.selected;await mmOpen(key);if(mmUI.page){delete mmUI.drafts[key];mmStartEdit(mmUI.page.model)}return}
 if(n.dataset.mmOpen){await mmOpen(n.dataset.mmOpen);return}
 if(n.dataset.mmNew){mmStartEdit(null);return}
 if(n.dataset.mmEdit){mmStartEdit(mmUI.page.model);return}
 if(n.dataset.mmBack||n.dataset.mmCancel){mmUI.selected=null;mmUI.editing=false;mmUI.error='';render();return}
 if(n.dataset.mmRefresh){await mmRefresh();return}
 if(n.dataset.mmHistory)try{mmUI.history=(await api('mental-models/'+mmUI.selected+'/history')).history;render()}catch(e){mmUI.error=e.message;render()}
});
document.addEventListener('submit',async e=>{
 if(e.target.id==='mm-search'){e.preventDefault();const f=new FormData(e.target);mmUI.query=String(f.get('query')||'');mmUI.filter=String(f.get('filter')||'all');render();return}
 if(e.target.id!=='mm-editor')return;e.preventDefault();if(mmUI.busy)return;
 const key=mmUI.selected,m=mmUI.drafts[key];mmUI.busy=true;mmUI.error='';render();
 try{const result=await api('mental-models'+(key==='new'?'':'/'+key),{method:key==='new'?'POST':'PUT',body:JSON.stringify({model:m,revision:m.revision})});delete mmUI.drafts[key];mmUI.editing=false;await mmRefresh();await mmOpen(result.model.id)}catch(e){mmUI.error=e.message}finally{mmUI.busy=false;render()}
});
