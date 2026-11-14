// One existing analysis call; no extra inference or automatic adoption.
const LE_KINDS=['knowledge','insight','skill','application','question'];
const LE_FIELDS=['kind','text','reasoning','excerpt','limits','practice'];
const LE_SCHEMA={type:'array',minItems:4,maxItems:5,items:{type:'object',additionalProperties:false,required:LE_FIELDS,properties:Object.fromEntries(LE_FIELDS.map(k=>[k,k==='kind'?{type:'string',enum:LE_KINDS}:{type:'string'}]))}};
const LE_PRINCIPLE_FIELDS=['text','rationale','excerpt','limits','application'];
function lePrinciples(input,body){
 return (Array.isArray(input)?input:[]).slice(0,2).filter(p=>p&&typeof p.text==='string'&&p.text.trim().split(/\s+/).length>=7&&p.text.trim().length>=35&&['rationale','limits','application'].every(k=>typeof p[k]==='string'&&p[k].trim().length>=20)&&exactExcerpt(body,p.excerpt)).map(p=>({text:clean(p.text,900),rationale:'AI-inferred candidate — not your adopted view.\nReasoning: '+clean(p.rationale,550)+'\nSource passage: '+exactExcerpt(body,p.excerpt)+'\nBoundaries: '+clean(p.limits,350)+'\nApplication: '+clean(p.application,350)}));
}
function leExtract(a,body){
 const outcomes=[];
 for(const x of (Array.isArray(a.learning_outputs)?a.learning_outputs:[]).slice(0,5)){
  if(!x||!LE_KINDS.includes(x.kind)||!['text','reasoning','limits','practice'].every(k=>typeof x[k]==='string'&&x[k].trim().length>=12))continue;
  const excerpt=exactExcerpt(body,x.excerpt);if(!excerpt)continue;
  outcomes.push({kind:x.kind,text:clean(x.text,800),reasoning:clean(x.reasoning,900),excerpt,limits:clean(x.limits,600),practice:clean(x.practice,700)});
 }
 return {version:4,scope:body.length>10000?'Beginning and ending of saved text; middle omitted.':'Saved text only; original completeness unverified.',outcomes,principles:lePrinciples(a.proposed_principles,body),rejected_principles:Math.max(0,(Array.isArray(a.proposed_principles)?a.proposed_principles.length:0)-lePrinciples(a.proposed_principles,body).length)};
}
async function leTable(env){await env.DB.prepare('CREATE TABLE IF NOT EXISTS source_learning (source_id TEXT PRIMARY KEY,content TEXT NOT NULL,created_at TEXT NOT NULL)').run()}
async function leRead(env,sourceId){
 const exists=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='source_learning'").first();
 if(!exists)return null;const row=await env.DB.prepare('SELECT content FROM source_learning WHERE source_id=?').bind(sourceId).first();return row?JSON.parse(row.content):null;
}
