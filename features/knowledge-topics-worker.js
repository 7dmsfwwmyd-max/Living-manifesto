// Private, deterministic topic workspaces. No inference or external requests.
const KT_REL=['context','supports','challenges','qualifies'];
const KT_CONF=['undecided','low','moderate','high'];
async function ktTables(env){
 await env.DB.prepare('CREATE TABLE IF NOT EXISTS knowledge_topics (id TEXT PRIMARY KEY,title TEXT NOT NULL,content TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)').run();
 await env.DB.prepare('CREATE TABLE IF NOT EXISTS knowledge_topic_history (topic_id TEXT NOT NULL,revision INTEGER NOT NULL,content TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(topic_id,revision))').run();
}
function ktDecode(row){return row?{...JSON.parse(row.content),id:row.id,revision:row.revision,created_at:row.created_at,updated_at:row.updated_at}:null}
async function ktValidate(env,value){
 if(!value||typeof value!=='object')throw Error('A topic is required');
 const title=clean(value.title,140),current_view=clean(value.current_view,6000),open_questions=clean(value.open_questions,4000),change_reason=clean(value.change_reason,1200),would_change=clean(value.would_change,3000);
 if(title.length<3)throw Error('Use a topic title of at least three characters');
 if(!KT_CONF.includes(value.confidence))throw Error('Choose a confidence level');
 if(change_reason.length<10)throw Error('Explain what changed or why you are starting this topic (at least ten characters)');
 if(!Array.isArray(value.keywords)||value.keywords.length>12||!Array.isArray(value.source_refs)||value.source_refs.length>50)throw Error('Use up to 12 keywords and 50 sources per topic');
 const keywords=[...new Set(value.keywords.map(x=>clean(x,70).toLowerCase()).filter(x=>x.length>=3))];
 const source_refs=[],seen=new Set();
 for(const ref of value.source_refs){
  if(!/^[a-f0-9-]{8,80}$/i.test(ref?.source_id||'')||!KT_REL.includes(ref?.relation)||seen.has(ref.source_id))throw Error('Invalid or duplicate source reference');
  seen.add(ref.source_id);source_refs.push({source_id:ref.source_id,relation:ref.relation,rationale:clean(ref.rationale,600)});
 }
 if(source_refs.length){
  const found=await rows(env.DB.prepare('SELECT id FROM sources WHERE id IN ('+source_refs.map(()=>'?').join(',')+')').bind(...source_refs.map(x=>x.source_id)));
  if(found.length!==source_refs.length)throw Error('A selected source is no longer in your library');
 }
 return {title,keywords,current_view,open_questions,change_reason,would_change,confidence:value.confidence,source_refs};
}
async function ktPage(env,topic){
 const ids=topic.source_refs.map(x=>x.source_id),sources=ids.length?await rows(env.DB.prepare('SELECT id,title,url,summary,question,status,retrieval,source_type,length(body) AS body_length FROM sources WHERE id IN ('+ids.map(()=>'?').join(',')+')').bind(...ids)):[];
 const ideas=ids.length?await rows(env.DB.prepare('SELECT id,source_id,statement,mechanism,evidence,counterargument FROM ideas WHERE source_id IN ('+ids.map(()=>'?').join(',')+') ORDER BY created_at DESC LIMIT 300').bind(...ids)):[];
 const selected=topic.source_refs.map(ref=>{const s=sources.find(s=>s.id===ref.source_id);return s?{...s,...ref,quality:ktQuality(s),ideas:ideas.filter(x=>x.source_id===s.id).slice(0,3)}:{...ref,title:'Source no longer available',missing:true}});
 const pool=await rows(env.DB.prepare('SELECT id,title,summary,disciplines FROM sources ORDER BY created_at DESC LIMIT 400'));
 const terms=topic.keywords.length?topic.keywords:[topic.title.toLowerCase()];
 const suggestions=pool.filter(s=>!ids.includes(s.id)).map(s=>({source_id:s.id,title:s.title,matches:terms.filter(k=>(s.title+' '+s.summary+' '+s.disciplines).toLowerCase().includes(k))})).filter(s=>s.matches.length).sort((a,b)=>b.matches.length-a.matches.length).slice(0,12);
 const hasConcepts=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='evergreen_notes'").first();
 const concepts=hasConcepts?(await rows(env.DB.prepare('SELECT id,title,thesis,source_refs FROM evergreen_notes WHERE archived=0 ORDER BY updated_at DESC LIMIT 200'))).filter(n=>JSON.parse(n.source_refs||'[]').some(r=>ids.includes(r.source_id))).map(n=>({id:n.id,title:n.title,thesis:n.thesis})).slice(0,20):[];
 const actions=[];
 if(!selected.length)actions.push('Attach a saved source to begin comparing arguments.');
 if(selected.some(s=>s.missing||s.quality.characters<100))actions.push('Open sources with missing or limited text and supply the original material.');
 if(!topic.current_view)actions.push('Write your current view in your own words.');
 if(selected.length&&!selected.some(s=>s.relation==='challenges'))actions.push('Look for a credible source that challenges your current view.');
 if(!topic.would_change)actions.push('State what evidence would change your mind.');
 if(topic.open_questions)actions.push('Choose one of your open questions for your next reading session.');
 return {topic,sources:selected,suggestions,concepts,next_actions:actions,limits:{suggestion_pool:400,displayed_ideas_per_source:3},disclosure:'Arguments reuse saved AI interpretations. Relationships and confidence are your judgments. Keyword matches and shared sources do not establish agreement or factual truth. No new AI analysis was requested.'};
}
async function ktRoute(req,env,path){
 if(!['GET','POST','PUT'].includes(req.method))return failure('Method not allowed',405);
 await ktTables(env);
 if(path==='/api/knowledge-topics'){
  if(req.method==='GET')return json({topics:(await rows(env.DB.prepare('SELECT * FROM knowledge_topics ORDER BY updated_at DESC LIMIT 100'))).map(ktDecode)});
  if(req.method!=='POST')return failure('Method not allowed',405);
  let value;try{value=await ktValidate(env,await payload(req,60000))}catch(e){return failure(e.message,422)}
  const uid=id(),t=now();
  const result=await env.DB.prepare('INSERT INTO knowledge_topics(id,title,content,revision,created_at,updated_at) SELECT ?,?,?,1,?,? WHERE (SELECT count(*) FROM knowledge_topics)<100').bind(uid,value.title,JSON.stringify(value),t,t).run();
  if(result.meta.changes!==1)return failure('The 100-topic limit has been reached.',429);
  return json({topic:ktDecode(await env.DB.prepare('SELECT * FROM knowledge_topics WHERE id=?').bind(uid).first())},201);
 }
 const match=path.match(/^\/api\/knowledge-topics\/([a-f0-9-]{8,80})(\/history)?$/i);
 if(!match)return failure('Not found',404);
 const row=await env.DB.prepare('SELECT * FROM knowledge_topics WHERE id=?').bind(match[1]).first();if(!row)return failure('Topic not found',404);
 if(match[2])return req.method==='GET'?json({history:(await rows(env.DB.prepare('SELECT revision,content,created_at FROM knowledge_topic_history WHERE topic_id=? ORDER BY revision DESC').bind(row.id))).map(r=>({...r,topic:JSON.parse(r.content)}))}):failure('Method not allowed',405);
 if(req.method==='GET')return json(await ktPage(env,ktDecode(row)));
 if(req.method!=='PUT')return failure('Method not allowed',405);
 const input=await payload(req,60000);
 if(!Number.isSafeInteger(input.revision)||input.revision<1)return failure('Expected revision is required',422);
 if(input.revision!==row.revision)return failure('This topic changed on another device. Your draft is kept; reopen the saved version before applying it.',409);
 let value;try{value=await ktValidate(env,input.topic)}catch(e){return failure(e.message,422)}
 const t=now();
 const result=await env.DB.batch([
  env.DB.prepare('INSERT OR IGNORE INTO knowledge_topic_history(topic_id,revision,content,created_at) SELECT id,revision,content,updated_at FROM knowledge_topics WHERE id=? AND revision=?').bind(row.id,input.revision),
  env.DB.prepare('UPDATE knowledge_topics SET title=?,content=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?').bind(value.title,JSON.stringify(value),t,row.id,input.revision)
 ]);
 if(result[1].meta.changes!==1)return failure('This topic changed on another device. Reopen before saving.',409);
 return json({topic:ktDecode(await env.DB.prepare('SELECT * FROM knowledge_topics WHERE id=?').bind(row.id).first())});
}
