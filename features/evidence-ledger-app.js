// Deterministic evidence ledger UI. No additional AI calls or paid services.
const evidenceUI={bySource:{},loading:{},saving:{},overview:null,overviewLoading:false,overviewError:''};
function evidenceLoad(sourceId){
 if(evidenceUI.loading[sourceId])return;
 evidenceUI.loading[sourceId]=true;
 api('sources/'+sourceId+'/evidence').then(result=>{evidenceUI.bySource[sourceId]=result;})
 .catch(error=>{evidenceUI.bySource[sourceId]={error:error.message||'Could not read evidence report'};})
 .finally(()=>{evidenceUI.loading[sourceId]=false;render();});
}
function evidenceMarkup(s){
 if(!evidenceUI.bySource[s.id]&&!evidenceUI.loading[s.id])evidenceLoad(s.id);
 const item=evidenceUI.bySource[s.id],report=item?.audit;
 let h='<article class="card" style="margin-top:18px"><div class="section-label">Evidence ledger · deterministic check</div>'+
 '<h2>Which claims are actually anchored in the source?</h2>'+
 '<p class="small muted">Checks exact excerpts against the text saved in your library. A matching quotation is NOT proof the claim is true, independently corroborated or even supported by the passage.</p>';
 if(!item)return h+'<p class="small muted">Reading the saved claim–evidence record…</p></article>';
 if(item.error)return h+'<p role="alert">'+esc(item.error)+'</p></article>';
 h+='<p class="small muted">Source: '+esc(report.source.retrieval||'unknown')+' · Saved text '+report.source.saved_text_characters.toLocaleString()+
  ' characters · Processing '+esc(report.source.analysis_status)+
  ' · SHA-256 '+esc(report.source.source_hash.slice(0,16))+'…</p>';
 h+='<p><strong>'+report.counts.anchored+'</strong> of '+report.counts.claims+' claims have excerpts found in saved source text.</p>'+
  '<p class="small muted">Last recorded check: '+(item.verified_at?esc(item.verified_at.slice(0,16).replace('T',' '))+' UTC':'not yet recorded')+
  (item.stale?' · stored snapshot is outdated':'')+'.</p>';
 if(report.issues.length)h+='<h3>Verification limitations</h3>'+report.issues.map(issue=>'<p class="small muted">'+esc(issue)+'</p>').join('');
 for(const c of report.claims.slice(0,15)){
  const status=c.excerpt_status==='anchored_in_saved_text'?'Excerpt located in saved text':c.excerpt_status==='excerpt_not_found'?'Excerpt does not match stored text':'No source excerpt stored';
  h+='<section style="border-top:1px solid var(--border,#ddd);padding-top:12px;margin-top:12px"><h3>'+esc(c.claim)+'</h3>'+
   '<p class="small muted">'+esc(status)+' · Claim truth is NOT independently verified</p>'+
   (c.source_excerpt?'<p><strong>Stored quotation:</strong> '+esc(c.source_excerpt)+'</p>':'')+
   (c.mechanism?'<p><strong>Proposed mechanism:</strong> '+esc(c.mechanism)+'</p>':'')+
   (c.ai_evidence_interpretation?'<p><strong>AI evidence interpretation (unverified):</strong> '+esc(c.ai_evidence_interpretation)+'</p>':'')+
   (c.ai_counterargument?'<p><strong>Possible objection (AI):</strong> '+esc(c.ai_counterargument)+'</p>':'')+
   '</section>';
 }
 h+='<div class="actions"><button class="btn small" data-evidence-record="'+esc(s.id)+'" '+(evidenceUI.saving[s.id]?'disabled':'')+
  '>'+(evidenceUI.saving[s.id]?'Verifying…':'Record / refresh evidence check')+'</button>'+
  '<button class="btn small" data-evidence-reload="'+esc(s.id)+'">Reload evidence report</button></div>'+
  '<p class="small muted">The report and any recorded snapshot stay in your authenticated Cloudflare database. Checking excerpts uses no AI requests.</p></article>';
 return h;
}
function evidenceOverviewLoad(){
 if(evidenceUI.overviewLoading)return;
 evidenceUI.overviewLoading=true;evidenceUI.overviewError='';
 api('evidence/overview').then(v=>{evidenceUI.overview=v}).catch(e=>{evidenceUI.overviewError=e.message||'Unable to load source audit status'})
 .finally(()=>{evidenceUI.overviewLoading=false;render()});
}
function evidenceOverviewMarkup(){
 if(!evidenceUI.overview&&!evidenceUI.overviewLoading&&!evidenceUI.overviewError&&state.signedIn)evidenceOverviewLoad();
 const data=evidenceUI.overview;
 let h='<article class="card" style="margin:20px 0"><div class="section-label">Research reliability · execution and evidence</div>'+
 '<h2>Claim verification and processing status</h2><p class="small muted">Private, read-only overview of the most recent 60 sources. It records real extraction status and retry attempts; no autonomous AI tasks are started here.</p>';
 h+='<div class="actions"><button class="btn small" data-evidence-overview-refresh="1" '+(evidenceUI.overviewLoading?'disabled':'')+'>Refresh status</button></div>';
 if(evidenceUI.overviewError)h+='<p role="alert">'+esc(evidenceUI.overviewError)+'</p>';
 if(!data)return h+'<p class="small muted">Loading source evidence and workflow state…</p></article>';
 h+='<p>'+data.summary.ready+' / '+data.summary.sources+' sources analysed · '+data.summary.needing_attention+
 ' require attention · '+data.summary.audited+' have recorded evidence checks.</p>';
 const attention=data.sources.filter(x=>x.next_action!=='Review claim evidence');
 if(attention.length)h+='<h3>Items needing attention</h3>'+attention.slice(0,12).map(x=>
  '<p><button class="btn small" data-source="'+esc(x.id)+'">'+esc(x.title||'Untitled source')+'</button> '+
  '<span class="small muted">'+esc(x.status)+' · '+x.processing_attempts+' attempt(s) · '+esc(x.next_action)+
  (x.processing_issue?' · '+esc(x.processing_issue):'')+'</span></p>').join('');
 const ready=data.sources.filter(x=>x.status==='ready');
 if(ready.length)h+='<h3>Recently processed sources</h3>'+ready.slice(0,12).map(x=>
  '<p><button class="btn small" data-source="'+esc(x.id)+'">'+esc(x.title||'Untitled source')+'</button> '+
  '<span class="small muted">'+(x.has_recorded_audit?
  x.counts.anchored+' / '+x.counts.claims+' saved-text excerpts located':'No recorded audit yet')+'</span></p>').join('');
 return h+'<p class="small muted">Audit status does not assess source credibility, factual correctness or whether extracted HTML contained the entire article.</p></article>';
}
document.addEventListener('click',async e=>{
 const n=e.target?.closest?.('[data-evidence-record],[data-evidence-reload],[data-evidence-overview-refresh]');
 if(!n)return;
 if(n.dataset.evidenceOverviewRefresh){evidenceUI.overview=null;evidenceOverviewLoad();return}
 const id=n.dataset.evidenceRecord||n.dataset.evidenceReload;
 if(!id)return;
 if(n.dataset.evidenceReload){delete evidenceUI.bySource[id];evidenceLoad(id);return}
 if(evidenceUI.saving[id])return;
 evidenceUI.saving[id]=true;
 try{
  const saved=await api('sources/'+id+'/evidence',{method:'POST',body:'{}'});
  evidenceUI.bySource[id]={...saved,up_to_date:true,stale:false};
  evidenceUI.overview=null;
  flash(saved.cached?'Stored evidence is already current':'Evidence snapshot recorded in your private database');
 }catch(err){flash(err.message||'Evidence could not be recorded',true)}
 finally{evidenceUI.saving[id]=false;render()}
});
