const trashUI={open:false,sources:[],busy:false,error:''};
const trashPolicy='Moving a source to trash hides it from Library, Today and automatic analysis. Original text and analysis are retained. Principles, models, notes and their links are kept; they are not deleted or unendorsed. Restore at any time. Nothing is permanently erased.';
const beforeTrashLibrary=library;
library=function(){
 if(!trashUI.open)return '<div class="actions"><button class="btn" data-trash-open="1">Trash</button></div>'+beforeTrashLibrary();
 return hero('Recover removed sources','Trash','Sources stay here until you restore them. No automatic expiry or permanent deletion.')+'<button class="btn" data-trash-close="1">← Library</button><p class="small">'+esc(trashPolicy)+'</p>'+(trashUI.error?'<p role="alert">'+esc(trashUI.error)+'</p>':'')+(trashUI.busy?'<p>Loading…</p>':trashUI.sources.length?trashUI.sources.map(s=>'<article class="card" style="margin:16px 0"><h2>'+esc(sourceLabel(s))+'</h2><p>Moved to trash '+date(s.trashed_at)+'</p><button class="btn" data-source="'+esc(s.id)+'">Read saved source</button> <button class="btn primary" data-trash-restore="'+esc(s.id)+'">Restore to library</button></article>').join(''):'<p>Trash is empty.</p>');
};
const beforeTrashDetail=detail;
detail=function(){const s=state.detail?.source;if(!s)return beforeTrashDetail();
 if(s.trashed_at)return '<button class="btn" data-trash-open="1">← Trash</button>'+hero('In trash',sourceLabel(s),'This source is hidden from active reading and analysis. Its linked knowledge is preserved.')+'<button class="btn primary" data-trash-restore="'+esc(s.id)+'">Restore to library</button><article class="card" style="margin-top:16px"><h2>Saved source text</h2><div style="white-space:pre-wrap;overflow-wrap:anywhere">'+esc(s.body||'No source text saved.')+'</div></article>';
 return '<details class="card" style="margin-bottom:18px"><summary>Manage source</summary><p>'+esc(trashPolicy)+'</p><button class="btn" data-trash-remove="'+esc(s.id)+'" '+(trashUI.busy?'disabled':'')+'>Move to trash</button></details>'+beforeTrashDetail();
};
async function openTrash(){state.view='Library';state.activeSource=null;trashUI.open=true;trashUI.busy=true;trashUI.error='';render();try{trashUI.sources=(await api('trash')).sources}catch(e){trashUI.error=e.message}finally{trashUI.busy=false;render()}}
document.addEventListener('click',async e=>{
 const n=e.target.closest('[data-trash-open],[data-trash-close],[data-trash-remove],[data-trash-restore]');if(!n||trashUI.busy)return;
 if(n.dataset.trashOpen)return openTrash();
 if(n.dataset.trashClose){trashUI.open=false;render();return}
 const uid=n.dataset.trashRemove||n.dataset.trashRestore,removing=!!n.dataset.trashRemove;
 trashUI.busy=true;render();try{
  await api('sources/'+uid+(removing?'/trash':'/restore'),{method:'POST',body:'{}'});
  state.activeSource=null;state.detail=null;state.view='Library';state.thinking=null;trashUI.open=false;
  // Refresh briefing and graph on their next visit; no new inference.
  briefing.data=null;briefing.lastLoaded=0;learningCloud.graph=null;
  await reload();flash(removing?'Source moved to trash. Use Library → Trash to restore it.':'Source restored to Library.');
 }catch(e){flash(e.message,true)}finally{trashUI.busy=false;render()}
});
