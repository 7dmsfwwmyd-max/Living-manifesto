// Source-grounded evergreen notes: user-authored thinking, source references and durable revisions.
const evergreen={loaded:false,items:[],active:null,sources:null,error:'',busy:false,refsOpen:false,linksOpen:false,history:null,historyOpen:false,search:''};
function evEscape(x){return esc(x==null?'':x)}
async function evRefresh(openId){
 try{
  const data=await api('evergreen');
  evergreen.items=data.notes||[];evergreen.loaded=true;evergreen.error='';
  if(openId){const r=await api('evergreen/'+openId);evergreen.active=r.note;}
 }catch(error){evergreen.error=String(error.message||'Evergreen notes unavailable');evergreen.loaded=true}
 render();
}
function evActiveBody(n){return {title:n.title,thesis:n.thesis,content:n.content,source_refs:n.source_refs||[],related:n.related||[],archived:!!n.archived}}
function evergreenMarkup(){
 if(state.signedIn&&!evergreen.loaded&&!evergreen.busy){evergreen.busy=true;Promise.resolve(evRefresh()).finally(()=>evergreen.busy=false)}
 let h='<article class="card" style="margin:20px 0"><div class="section-label">Living knowledge · evergreen concepts</div><h2>Develop an idea across sources</h2>'+
  '<p class="small muted">Evergreen notes are your evolving explanations, not another article summary. Keep claims, uncertainties and cited original evidence distinct. Every edit has a saved revision; there are no additional AI calls.</p>';
 if(evergreen.error)h+='<p role="alert">'+evEscape(evergreen.error)+'</p>';
 h+='<div class="actions"><button class="btn small" data-ev-new="1" '+(!evergreen.loaded?'disabled':'')+'>New concept</button>'+
  '<button class="btn small" data-ev-refresh="1">Refresh</button>'+
  '<button class="btn small" data-ev-export="markdown">Export Markdown</button>'+
  '<button class="btn small" data-ev-export="json">Export JSON</button>'+
  '<button class="btn small" data-ev-export="canvas">Export JSON Canvas</button></div>';
 if(!evergreen.loaded)return h+'<p class="small muted">Loading saved concepts…</p></article>';
 const visible=evergreen.items.filter(x=>!evergreen.search||x.title.toLowerCase().includes(evergreen.search.toLowerCase())).slice(0,80);
 h+='<form id="ev-find"><label for="ev-search">Find a concept</label><input class="input" id="ev-search" maxlength="100" name="search" value="'+evEscape(evergreen.search)+'" placeholder="e.g. Equity risk premium"><button class="btn small">Find</button></form>';
 if(visible.length)h+='<div class="actions">'+visible.map(n=>'<button class="btn small" data-ev-open="'+evEscape(n.id)+'">'+evEscape(n.title)+(n.archived?' (archived)':'')+'</button>').join('')+'</div>';
 else h+='<p class="small muted">No concepts yet. Create one and connect it to the articles in your library.</p>';
 if(!evergreen.active)return h+'</article>';
 const n=evergreen.active,creating=!n.id;
 h+='<hr><h3>'+(creating?'Create an evergreen concept':'Revise '+evEscape(n.title))+'</h3><p class="small muted">Your language, your judgment. Source quotations are checked against saved text when you add them.</p>'+
  '<form id="ev-editor"><label for="ev-title">Concept title</label><input class="input" id="ev-title" name="title" maxlength="140" required value="'+evEscape(n.title||'')+'">'+
  '<label for="ev-thesis">Core claim / current understanding</label><textarea class="input" id="ev-thesis" name="thesis" maxlength="1000" required rows="3">'+evEscape(n.thesis||'')+'</textarea>'+
  '<label for="ev-content">Explanation, caveats, disagreements and open questions</label><textarea class="input" id="ev-content" name="content" maxlength="18000" required rows="7">'+evEscape(n.content||'')+'</textarea>'+
  '<label for="ev-archived">Status</label><select class="input" id="ev-archived" name="archived"><option value="false"'+(!n.archived?' selected':'')+'>Working concept</option><option value="true"'+(n.archived?' selected':'')+'>Archived (preserved)</option></select>'+
  '<button class="btn primary" type="submit">'+(creating?'Create concept':'Save revised concept')+'</button></form>';
 if(creating)return h+'</article>';
 h+='<p class="small muted">Revision '+evEscape(n.revision)+' · Last edited '+evEscape(n.updated_at?.slice(0,10)||'')+'</p>'+
   '<div class="actions"><button class="btn small" data-ev-history="1">Revision history</button><button class="btn small" data-ev-refs="1">Add cited source</button><button class="btn small" data-ev-links="1">Connect another concept</button></div>';
 if(evergreen.historyOpen)h+='<h4>Prior saved revisions (read only)</h4>'+(evergreen.history?.length?
  evergreen.history.map(r=>'<p class="small muted">Revision '+evEscape(r.revision)+' · '+evEscape(r.created_at?.slice(0,10))+'</p>').join(''):'<p class="small muted">No earlier revisions.</p>');
 h+='<h4>Source provenance</h4>';
 if(!n.source_refs?.length)h+='<p class="small muted">No evidence attached yet; do not treat this concept as source-verified.</p>';
 for(const ref of n.source_refs||[])h+='<p><button class="btn small" data-source="'+evEscape(ref.source_id)+'">'+evEscape(ref.title)+'</button> <span class="small muted">'+evEscape(ref.relation)+'</span>'+(ref.quote?'<br><span class="small muted">Verified stored-text excerpt: '+evEscape(ref.quote)+'</span>':'')+(ref.comment?'<br><span class="small muted">Your interpretation: '+evEscape(ref.comment)+'</span>':'')+'</p>';
 if(evergreen.refsOpen){
  const options=(evergreen.sources||[]).filter(s=>s?.id).slice(0,150);
  h+='<form id="ev-ref"><label>Saved source</label><select class="input" name="source_id" required>'+options.map(s=>'<option value="'+evEscape(s.id)+'">'+evEscape(String(s.title||'Untitled').slice(0,140))+'</option>').join('')+'</select>'+
  '<label>Relationship</label><select class="input" name="relation"><option>supports</option><option>challenges</option><option>qualifies</option><option>context</option><option>illustrates</option></select>'+
  '<label>Quotation (optional, must appear verbatim in saved text)</label><textarea class="input" name="quote" maxlength="800" rows="2" placeholder="Paste a short exact excerpt"></textarea>'+
  '<label>Your rationale</label><textarea class="input" name="comment" maxlength="600" rows="2" placeholder="What does the source actually establish?"></textarea>'+
  '<button class="btn small" type="submit" '+(options.length?'':'disabled')+'>Attach source</button></form>';
 }
 h+='<h4>Related evergreen concepts</h4>';
 for(const link of n.related||[])h+='<p><button class="btn small" data-ev-open="'+evEscape(link.note_id)+'">'+evEscape(link.title)+'</button> '+evEscape(link.relation)+'<br><span class="small muted">'+evEscape(link.reason)+'</span></p>';
 if(evergreen.linksOpen){
  const options=evergreen.items.filter(x=>x.id!==n.id);
  h+='<form id="ev-link"><label>Other concept</label><select class="input" name="note_id" required>'+options.map(x=>'<option value="'+evEscape(x.id)+'">'+evEscape(x.title)+'</option>').join('')+'</select>'+
  '<label>Relationship</label><select class="input" name="relation"><option>supports</option><option>challenges</option><option>qualifies</option><option>depends-on</option><option>illustrates</option></select>'+
  '<label>Why are these ideas connected?</label><textarea class="input" name="reason" maxlength="500" rows="2" required></textarea>'+
  '<button class="btn small" type="submit" '+(options.length?'':'disabled')+'>Connect concepts</button></form>';
 }
 return h+'</article>';
}
function evSaveBody(note,form){
 return {title:String(form.get('title')||''),thesis:String(form.get('thesis')||''),content:String(form.get('content')||''),source_refs:note.source_refs||[],related:note.related||[],archived:form.get('archived')==='true'};
}
async function evUpdate(note){
 const res=await api('evergreen/'+evergreen.active.id,{method:'PUT',body:JSON.stringify({revision:evergreen.active.revision,note})});
 evergreen.active=res.note;
 await evRefresh(res.note.id);
}
document.addEventListener('submit',async e=>{
 const form=e.target?.id;
 if(!['ev-find','ev-editor','ev-ref','ev-link'].includes(form))return;
 e.preventDefault();
 if(form==='ev-find'){evergreen.search=String(new FormData(e.target).get('search')||'').slice(0,100);render();return}
 if(evergreen.busy)return;
 evergreen.busy=true;
 try{
  const data=new FormData(e.target);
  if(form==='ev-editor'){
   const note=evSaveBody(evergreen.active,data);
   if(evergreen.active.id)await evUpdate(note);
   else{
    const response=await api('evergreen',{method:'POST',body:JSON.stringify(note)});
    await evRefresh(response.note.id);
   }
   flash('Evergreen concept saved');
  }else if(form==='ev-ref'){
   const r={source_id:String(data.get('source_id')||''),relation:String(data.get('relation')||''),quote:String(data.get('quote')||''),comment:String(data.get('comment')||'')};
   await evUpdate({...evActiveBody(evergreen.active),source_refs:[...(evergreen.active.source_refs||[]),r]});
   evergreen.refsOpen=false;flash('Source provenance saved');
  }else if(form==='ev-link'){
   const r={note_id:String(data.get('note_id')||''),relation:String(data.get('relation')||''),reason:String(data.get('reason')||'')};
   await evUpdate({...evActiveBody(evergreen.active),related:[...(evergreen.active.related||[]),r]});
   evergreen.linksOpen=false;flash('Concept link saved');
  }
 }catch(err){flash(String(err.message||'Could not save concept'),true)}
 finally{evergreen.busy=false}
});
document.addEventListener('click',async e=>{
 const n=e.target?.closest?.('[data-ev-new],[data-ev-open],[data-ev-refresh],[data-ev-history],[data-ev-refs],[data-ev-links],[data-ev-export]');
 if(!n||evergreen.busy)return;
 if(n.dataset.evNew){evergreen.active={title:'',thesis:'',content:'',source_refs:[],related:[],archived:false};evergreen.refsOpen=false;evergreen.linksOpen=false;render();return}
 if(n.dataset.evOpen){
  try{const r=await api('evergreen/'+n.dataset.evOpen);evergreen.active=r.note;evergreen.historyOpen=false;evergreen.refsOpen=false;evergreen.linksOpen=false;render()}catch(err){flash(err.message,true)}
  return;
 }
 if(n.dataset.evRefresh){await evRefresh(evergreen.active?.id);return}
 if(n.dataset.evHistory){
  evergreen.historyOpen=!evergreen.historyOpen;
  if(evergreen.historyOpen)try{evergreen.history=(await api('evergreen/'+evergreen.active.id+'/history')).history}catch(err){flash(err.message,true)}
  render();return;
 }
 if(n.dataset.evRefs){
  evergreen.refsOpen=!evergreen.refsOpen;
  if(evergreen.refsOpen&&!evergreen.sources)try{evergreen.sources=(await api('sources')).sources}catch(err){flash(err.message,true)}
  render();return;
 }
 if(n.dataset.evLinks){evergreen.linksOpen=!evergreen.linksOpen;render();return}
 if(n.dataset.evExport){
  const kind=n.dataset.evExport;
  try{
   const response=await fetch('/api/evergreen/export?format='+encodeURIComponent(kind),{credentials:'same-origin',headers:{'cache-control':'no-store'}});
   if(!response.ok)throw Error('Export unavailable: '+response.status);
   const blob=await response.blob(),url=URL.createObjectURL(blob),a=document.createElement('a');
   a.href=url;a.download='living-manifesto-evergreen.'+(kind==='canvas'?'canvas':kind==='markdown'?'md':'json');
   document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
  }catch(error){flash(error.message||'Export unavailable',true)}
 }
});
