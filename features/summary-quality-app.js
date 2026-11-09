// v0.5.9 · richer reading view assembled from already-saved analysis.
// All claims remain model interpretations; no new inference or remote requests.
function summarySourceNorm(value){return String(value??'').toLowerCase().replace(/\s+/g,' ').trim()}
function summarySafe(value,max=5000){return esc(String(value??'').slice(0,max))}
function summaryStatus(s){
 const body=String(s.body||''),len=body.length,retrieval=String(s.retrieval||'');
 if(!len)return 'No saved source text: no supporting passage can be verified.';
 if(retrieval==='supplied')return 'User-supplied text ('+len.toLocaleString()+' characters). Completeness of the original is not independently verified.';
 if(retrieval.startsWith('x_post_')||retrieval==='x_post_embed_only')return 'An X post or excerpt was captured; longer threads or linked material may be missing.';
 if(retrieval==='x_article_full_blocks')return 'X Article text was captured; completeness is not independently verified.';
 if(retrieval.startsWith('pdf_'))return 'PDF extraction ('+len.toLocaleString()+' characters). Figures, tables, formatting or pages may be missing.';
 return 'Saved extraction ('+len.toLocaleString()+' characters). The source may be partial or inaccessible beyond the saved text.';
}
function summaryQualityMarkup(d){
 const s=d?.source;if(!s)return '';
 const ideas=Array.isArray(d.ideas)?d.ideas.slice(0,5):[];
 const hasSummary=!!String(s.summary||'').trim();
 if(!hasSummary&&!ideas.length)return '';
 const newSummary=String(s.summary||'').trim().length>=450;
 const body=String(s.body||'');
 let html='<article class="card" aria-label="Detailed source summary" style="margin:18px 0">'+
  '<div class="section-label">Research summary · source-grounded reading</div>'+
  '<h2>Understand the argument, not just the headline</h2>'+
  '<p class="small muted">'+summarySafe(summaryStatus(s),360)+'</p>';
 if(hasSummary){
  html+='<h3>Executive overview</h3><p style="white-space:pre-wrap">'+summarySafe(s.summary,4000)+'</p>';
 }else html+='<p class="small muted">No executive summary was saved. The argument below comes from existing extracted ideas.</p>';
 if(!newSummary)html+='<p class="small muted">This is an earlier, shorter analysis. The breakdown below reuses saved claims, interpretations and source excerpts; it has not requested or invented a new AI summary.</p>';
 if(ideas.length){
  html+='<h3>Detailed argument and evidence</h3>'+
   '<p class="small muted">Reconstructed from '+ideas.length+' existing extracted idea(s). Mechanisms, evidence descriptions and objections are AI-authored interpretations, not independent verification.</p>';
  ideas.forEach((x,i)=>{
   const claim=String(x.statement||'').trim(),why=String(x.mechanism||'').trim(),evidence=String(x.evidence||'').trim(),challenge=String(x.counterargument||'').trim(),excerpt=String(x.excerpt||'').trim();
   const matched=excerpt.length>=12&&summarySourceNorm(body).includes(summarySourceNorm(excerpt));
   html+='<details '+(i===0?'open ':'')+'style="border-top:1px solid var(--border,#ddd);padding:12px 0">'+
    '<summary style="cursor:pointer"><strong>'+summarySafe(claim||'Claim '+(i+1),900)+'</strong></summary>'+
    (why?'<p><strong>How the argument works</strong><br>'+summarySafe(why,1000)+'</p>':'')+
    (evidence?'<p><strong>Evidence described in the analysis</strong><br>'+summarySafe(evidence,1200)+'</p>':'<p class="small muted">The analysis did not describe supporting evidence.</p>')+
    (excerpt?'<p><strong>Source passage</strong><br><span class="small muted">'+(matched?'Exact words found in saved text — this does not prove the claim.':'Excerpt could not be matched against saved text; do not cite it as verified.')+'</span><br><span style="white-space:pre-wrap">'+summarySafe(excerpt,1200)+'</span></p>':'<p class="small muted">No source quotation saved for this claim.</p>')+
    (challenge?'<p><strong>Strongest recorded limitation or objection</strong><br>'+summarySafe(challenge,1200)+'</p>':'<p class="small muted">No specific objection was saved for this claim.</p>')+
    '</details>';
  });
 }
 if(Array.isArray(d.links)&&d.links.length){
  html+='<h3>Related saved ideas</h3>';
  for(const link of d.links.slice(0,4)){
   html+='<p><strong>'+summarySafe(link.relation||'Related',60)+'</strong>: '+summarySafe(link.other_statement||'Previously saved idea',800)+
    (link.reason?' — '+summarySafe(link.reason,550):'')+
    '<br><span class="small muted">Suggested relationship; check both saved sources before drawing conclusions.</span></p>';
  }
 }
 html+='<p class="small muted">To explore definitions, wider context and foundational reading, open the <strong>Understand</strong> tab. Its stored Deep Dive is separate from this source-specific reconstruction.</p></article>';
 return html;
}
const summaryPreviousDetail=detail;
detail=function(){
 const html=summaryPreviousDetail();
 if(typeof html!=='string'||learn.tab==='understand')return html;
 const marker='<h2 class="section-title">Extracted ideas</h2>';
 return html.includes(marker)?html.replace(marker,summaryQualityMarkup(state.detail)+marker):html;
};
