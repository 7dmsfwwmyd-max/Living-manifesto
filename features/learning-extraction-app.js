function learningOutputsMarkup(d){
 const s=d?.source;if(!s)return '';
 const data=d.learning;
 let h='<article class="card" style="margin:18px 0" aria-label="Knowledge and practice"><div class="section-label">Knowledge · judgement · practice</div><h2>What can I learn and use?</h2>';
 if(!data)return h+'<p>This earlier analysis has not been re-extracted into learning outcomes. Its saved ideas, text and principles are unchanged. New captures use the more demanding extraction standard.</p></article>';
 h+='<p class="small muted">'+esc(data.scope)+' These are AI interpretations, not independently established facts or your adopted beliefs. A matching quotation supports provenance, not the truth of an inference.</p>';
 const labels={knowledge:'Knowledge — what the source explains',insight:'Insight — an inferred implication',question:'Open question — what remains unresolved',skill:'Skill — a capability to practise',application:'Application — a concrete experiment'};
 for(const kind of ['knowledge','insight','question','skill','application']){
  const items=(data.outcomes||[]).filter(x=>x.kind===kind);
  h+='<h3>'+labels[kind]+'</h3>';
  if(!items.length){h+='<p class="small muted">No grounded output of this type was saved.</p>';continue}
  for(const x of items)h+='<details style="margin:12px 0"><summary>'+esc(x.text)+'</summary><p><strong>Reasoning</strong><br>'+esc(x.reasoning)+'</p><blockquote>'+esc(x.excerpt)+'</blockquote><p><strong>Limits or competing explanation</strong><br>'+esc(x.limits)+'</p><p><strong>Try it and test yourself</strong><br>'+esc(x.practice)+'</p></details>';
 }
 h+='<h3>Principles — transferable guidance to consider</h3>';
 if(!data.principles?.length)h+='<p>No candidate met the evidence and reasoning requirements. An article need not yield a principle.</p>';
 for(const p of data.principles||[])h+='<details><summary>'+esc(p.text)+'</summary><p style="white-space:pre-wrap">'+esc(p.rationale)+'</p></details>';
 h+='<p class="small muted">These are extraction-time candidates. Review, revise or reject them in Manifesto; your current accepted view is recorded there. Topic labels are organisational tags, not principles.</p><p>Learning loop: explain the idea without looking, apply it to a different case, try the suggested exercise, then compare the outcome with your prediction. Use the existing recall and review tools to revisit it.</p></article>';
 return h;
}
const lePreviousDetail=detail;
detail=function(){return lePreviousDetail()+learningOutputsMarkup(state.detail)};
