// Living Manifesto v0.5.8: first-party deterministic learning agenda.
// Private, transparent prioritisation. No model calls, discovery APIs or timers.
const briefing={data:null,loading:false,error:'',lastLoaded:0,showAll:false,filter:'all',changing:{}};
const BR_LOCAL_MAX_AGE=15*60*1000;
const brShort=(s,n=300)=>String(s??'').slice(0,n);
async function brRefresh(force=false){
 if(!state.signedIn||briefing.loading)return;
 if(!force&&briefing.data&&Date.now()-briefing.lastLoaded<BR_LOCAL_MAX_AGE)return;
 briefing.loading=true;briefing.error='';
 try{briefing.data=await api('briefing');briefing.lastLoaded=Date.now();}
 catch(error){briefing.error=error.message||'Briefing cannot be refreshed';}
 finally{briefing.loading=false;render()}
}
function brSectionLabel(kind){
 return ({review:'Active recall',reading:'Worth reading',evidence:'Evidence to inspect',
  processing:'Incomplete capture',concept:'Concept to develop',connection:'Your saved connection'})[kind]||kind;
}
function briefingMarkup(){
 if(state.signedIn&&!briefing.data&&!briefing.loading&&!briefing.error)void brRefresh();
 const data=briefing.data;
 let html='<section class="card" style="margin-bottom:20px" aria-label="Your intellectual briefing">'+
 '<div class="section-label">LIVING MANIFESTO · INTELLECTUAL BRIEFING</div>'+
 '<h2>What deserves your attention?</h2>'+
 '<p class="small muted">Prioritised from your own saved articles, study schedule and evidence records. Capture dates are not publication dates. No additional AI processing is performed.</p>'+
 '<div class="actions"><button class="btn small" data-brief-refresh="1" '+(briefing.loading?'disabled':'')+'>Refresh briefing</button></div>';
 if(briefing.error)html+='<p role="alert">Could not refresh: '+esc(briefing.error)+(data?' · Showing the previous in-session results.':'')+'</p>';
 if(!data)return html+'<p class="small muted">'+(briefing.loading?'Preparing your private learning agenda…':'No briefing available yet. Refresh after signing in.')+'</p></section>';
 const counts=data.counts||{};
 html+='<p class="small muted">'+Number(counts.due_reviews||0)+' due reviews · '+
  Number(counts.processing||0)+' incomplete sources · '+Number(counts.concepts_missing_sources||0)+
  ' uncited evergreen concepts · Generated '+esc(brShort(data.generated_at,16).replace('T',' '))+' UTC</p>';
 const all=data.items||[],view=all.filter(x=>briefing.filter==='all'||x.kind===briefing.filter);
 const list=briefing.showAll?view:view.slice(0,9);
 html+='<div class="actions" role="group" aria-label="Filter briefing">'+
  [{key:'all',name:'All'},{key:'review',name:'Reviews'},{key:'reading',name:'Reading'},
   {key:'evidence',name:'Evidence'},{key:'processing',name:'Processing'},
   {key:'concept',name:'Concepts'},{key:'connection',name:'Connections'}]
   .map(x=>'<button class="btn small" data-brief-filter="'+x.key+'" aria-pressed="'+(x.key===briefing.filter?'true':'false')+'">'+x.name+'</button>').join('')+'</div>';
 if(!list.length)html+='<p class="small muted">No items in this category. Keep learning and saving material to build your agenda.</p>';
 for(const item of list){
  const id=item.source_id||'',concept=item.concept_id||'',key=esc(item.key);
  html+='<article style="border-top:1px solid var(--border,#ddd);padding:12px 0">'+
   '<div class="section-label">'+esc(brSectionLabel(item.kind))+'</div><h3>'+esc(brShort(item.title,170))+'</h3>'+
   (item.explanation?'<p>'+esc(brShort(item.explanation,300))+'</p>':'')+
   '<p class="small muted">Why this is here: '+esc(brShort(item.why,340))+'</p>'+
   '<div class="actions">'+(id?'<button class="btn small" data-source="'+esc(id)+'">'+esc(item.action_label||'Open source')+'</button>':
   concept?'<button class="btn small" data-brief-concept="'+esc(concept)+'">Open concept</button>':'')+
   '<button class="btn small" data-brief-action="snooze_1d" data-brief-key="'+key+'" data-brief-revision="'+Number(item.preference_revision||0)+'" '+(briefing.changing[item.key]?'disabled':'')+'>Snooze 1 day</button>'+
   '<button class="btn small" data-brief-action="dismiss" data-brief-key="'+key+'" data-brief-revision="'+Number(item.preference_revision||0)+'" '+(briefing.changing[item.key]?'disabled':'')+'>Dismiss</button></div></article>';
 }
 if(view.length>9)html+='<button class="btn small" data-brief-showall="1">'+(briefing.showAll?'Show fewer':'Show '+Math.min(view.length,24)+' items')+'</button>';
 if(data.hidden?.length){
  html+='<details><summary class="small muted">Hidden or snoozed suggestions ('+data.hidden.length+')</summary>';
  for(const x of data.hidden.slice(0,15))html+='<p class="small">'+esc(x.key)+' · '+(x.hidden_until.startsWith('9999')?'Dismissed':'Snoozed until '+esc(x.hidden_until.slice(0,10)))+
   ' <button class="btn small" data-brief-action="restore" data-brief-key="'+esc(x.key)+'" data-brief-revision="'+Number(x.revision||0)+'">Restore</button></p>';
  html+='</details>';
 }
 html+='<p class="small muted">Method: explicit due dates, incomplete captures, evidence gaps, unreviewed recent captures, your learning paths and your manual connections. Suggestions are not external news or independently verified conclusions.</p></section>';
 return html;
}
const brPriorToday=today;
today=function(){return briefingMarkup()+brPriorToday()};
document.addEventListener('click',async event=>{
 const n=event.target?.closest?.('[data-brief-action],[data-brief-refresh],[data-brief-filter],[data-brief-showall],[data-brief-concept]');
 if(!n)return;
 if(n.dataset.briefRefresh){await brRefresh(true);return}
 if(n.dataset.briefFilter){briefing.filter=n.dataset.briefFilter;briefing.showAll=false;render();return}
 if(n.dataset.briefShowall){briefing.showAll=!briefing.showAll;render();return}
 if(n.dataset.briefConcept){
  try{
   const target=n.dataset.briefConcept;
   const response=await api('evergreen/'+target);
   const nav=document.querySelector('[data-nav=Explore]');nav?.click();
   evergreen.active=response.note;render();
  }catch(error){flash(error.message||'Could not open concept',true)}
  return;
 }
 const key=n.dataset.briefKey,action=n.dataset.briefAction;
 if(!key||!action||briefing.changing[key])return;
 briefing.changing[key]=true;
 try{
  await api('briefing/action',{method:'POST',body:JSON.stringify({item_key:key,action,expected_revision:Number(n.dataset.briefRevision||0)})});
  briefing.data=null;briefing.lastLoaded=0;briefing.error='';
  await brRefresh(true);
 }catch(error){briefing.error=error.message||'Could not save preference';await brRefresh(true);}
 finally{delete briefing.changing[key];render()}
});
document.addEventListener('visibilitychange',()=>{
 if(!document.hidden&&state.signedIn&&briefing.data&&Date.now()-briefing.lastLoaded>BR_LOCAL_MAX_AGE)void brRefresh(true);
});
