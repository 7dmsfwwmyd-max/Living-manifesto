const exploreUI={section:'topics',tool:'concepts'};
function exploreWorkspace(){
 const sections=[['topics','Your topics'],['discover','Find resources'],['tools','Knowledge tools']];
 const tools=[['concepts','Concept notes'],['learning','Learning paths & review'],['connections','Connections'],['evidence','Evidence checks']];
 let h='<section class="explore-workspace"><header class="explore-intro"><div class="section-label">Explore</div><h1>Turn reading into understanding.</h1><p>Follow a question. Connect what you know. Decide what to learn next.</p></header><nav class="explore-nav" aria-label="Explore views">'+sections.map(([id,label])=>'<button class="btn'+(exploreUI.section===id?' primary':'')+'" data-explore-view="'+id+'" aria-current="'+(exploreUI.section===id?'page':'false')+'">'+label+'</button>').join('')+'</nav>';
 if(exploreUI.section==='topics')h+=knowledgeMarkup();
 else if(exploreUI.section==='discover')h+=topicMarkup();
 else{
 h+='<div class="explore-tools"><label for="explore-tool">Work with your saved knowledge</label><select class="input" id="explore-tool">'+tools.map(([id,label])=>'<option value="'+id+'"'+(exploreUI.tool===id?' selected':'')+'>'+label+'</option>').join('')+'</select><p class="small muted">Keep reusable ideas, revisit learning and examine the connections behind your thinking.</p></div>';
 h+=exploreUI.tool==='concepts'?evergreenMarkup():exploreUI.tool==='learning'?studioOverview():exploreUI.tool==='connections'?exploreConnections():evidenceOverviewMarkup();
 }
 return h+'</section>';
}
document.addEventListener('click',e=>{
 const el=e.target.closest?.('[data-explore-view],[data-explore-topics],[data-explore-discover],[data-ev-open],[data-brief-concept]');if(!el)return;
 // Route before the existing asynchronous concept handlers render their result.
 if(el.dataset.evOpen||el.dataset.briefConcept){exploreUI.section='tools';exploreUI.tool='concepts';return}
 if(el.dataset.exploreTopics){if(knowledge.dirty)return;knowledge.active=null;knowledge.page=null;knowledge.history=null;knowledge.attach=null;exploreUI.section='topics'}
 else if(el.dataset.exploreDiscover){topics.query=knowledge.active?.title||topics.query;topics.active=null;exploreUI.section='discover'}
 else if(['topics','discover','tools'].includes(el.dataset.exploreView))exploreUI.section=el.dataset.exploreView;
 render();
},true);
document.addEventListener('change',e=>{
 if(e.target.id==='explore-tool'&&['concepts','learning','connections','evidence'].includes(e.target.value)){exploreUI.tool=e.target.value;render()}
});
document.addEventListener('input',e=>{if(e.target.id==='topic-query')topics.query=e.target.value});
