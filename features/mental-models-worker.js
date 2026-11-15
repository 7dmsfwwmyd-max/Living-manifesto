const MM_FIELDS={name:120,category:60,definition:1800,mechanism:2400,when_to_use:1500,example:3000,limitations:2000,exercise:2000,notes:6000};
async function mmExists(env){return !!await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='mental_models'").first()}
async function mmTables(env){
 await env.DB.prepare('CREATE TABLE IF NOT EXISTS mental_models(id TEXT PRIMARY KEY,content TEXT NOT NULL,revision INTEGER NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)').run();
 await env.DB.prepare('CREATE TABLE IF NOT EXISTS mental_model_history(model_id TEXT NOT NULL,revision INTEGER NOT NULL,content TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(model_id,revision))').run();
}
function mmDecode(r){return {...JSON.parse(r.content),id:r.id,revision:r.revision,created_at:r.created_at,updated_at:r.updated_at}}
async function mmList(env){
 const map=new Map(MM_STARTERS.map(x=>[x.id,{...x}]));
 if(await mmExists(env))for(const r of await rows(env.DB.prepare('SELECT * FROM mental_models ORDER BY updated_at DESC LIMIT 200')))map.set(r.id,mmDecode(r));
 return [...map.values()];
}
async function mmValidate(env,p,origin){
 if(!p||typeof p!=='object')throw Error('Model details are required');
 const m={};for(const [key,max] of Object.entries(MM_FIELDS)){if(typeof p[key]!=='string'||p[key].length>max)throw Error('Check '+key+' (maximum '+max+' characters)');m[key]=p[key].trim()}
 if(m.name.length<3||m.definition.length<20)throw Error('Give the model a name and an explanation of at least 20 characters');
 if(!['exploring','practising','using'].includes(p.stage)||typeof p.favourite!=='boolean'||typeof p.archived!=='boolean')throw Error('Invalid model state');
 if(!Array.isArray(p.source_ids)||p.source_ids.length>30||p.source_ids.some(x=>typeof x!=='string'||!/^[a-f0-9-]{8,80}$/i.test(x)))throw Error('Choose up to 30 saved sources');
 m.source_ids=[...new Set(p.source_ids)];
 if(m.source_ids.length){const found=await rows(env.DB.prepare('SELECT id FROM sources WHERE id IN ('+m.source_ids.map(()=>'?').join(',')+')').bind(...m.source_ids));if(found.length!==m.source_ids.length)throw Error('A linked source no longer exists')}
 return {...m,stage:p.stage,favourite:p.favourite,archived:p.archived,origin};
}
async function mmRoute(req,env,path){
 if(!['GET','POST','PUT'].includes(req.method))return failure('Method not allowed',405);
 const list=await mmList(env);
 if(path==='/api/mental-models'&&req.method==='GET')return json({models:list,limit:200});
 const match=path.match(/^\/api\/mental-models\/([a-z0-9-]{3,80})(\/history)?$/);
 const current=match?list.find(x=>x.id===match[1]):null;
 if(path!=='/api/mental-models'&&!current)return failure('Model not found',404);
 if(match?.[2]){
  if(req.method!=='GET')return failure('Method not allowed',405);
  return json({history:await mmExists(env)?(await rows(env.DB.prepare('SELECT * FROM mental_model_history WHERE model_id=? ORDER BY revision DESC LIMIT 50').bind(current.id))).map(x=>({...x,model:JSON.parse(x.content)})):[]});
 }
 if(current&&req.method==='GET'){
  const sources=current.source_ids.length?await rows(env.DB.prepare('SELECT id,title,url,status,retrieval,length(body) AS body_length FROM sources WHERE id IN ('+current.source_ids.map(()=>'?').join(',')+')').bind(...current.source_ids)):[];
  return json({model:current,sources:sources.map(x=>({...x,title:sourceLabel(x)}))});
 }
 if((current&&req.method!=='PUT')||(!current&&req.method!=='POST'))return failure('Method not allowed',405);
 let input,value;try{input=await payload(req,40000);value=await mmValidate(env,input.model,current?.origin||'Your own model; sources linked by you.')}catch(e){return failure(e.message,422)}
 if(current&&(!Number.isSafeInteger(input.revision)||input.revision!==current.revision))return failure('This model changed on another device. Your draft is retained; reopen the saved version before saving.',409);
 await mmTables(env);const uid=current?.id||id(),t=now(),content=JSON.stringify(value);
 if(!current||current.revision===0){
  const result=await env.DB.prepare('INSERT OR IGNORE INTO mental_models(id,content,revision,created_at,updated_at) SELECT ?,?,1,?,? WHERE (SELECT count(*) FROM mental_models)<200').bind(uid,content,t,t).run();
  if(result.meta.changes!==1)return failure('Model changed on another device or the 200 saved-model limit was reached. Your draft is retained.',409);
 }else{
  const result=await env.DB.batch([
   env.DB.prepare('INSERT OR IGNORE INTO mental_model_history(model_id,revision,content,created_at) SELECT id,revision,content,updated_at FROM mental_models WHERE id=? AND revision=?').bind(uid,input.revision),
   env.DB.prepare('UPDATE mental_models SET content=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?').bind(content,t,uid,input.revision)
  ]);if(result[1].meta.changes!==1)return failure('Model changed on another device. Your draft is retained.',409);
 }
 return json({model:mmDecode(await env.DB.prepare('SELECT * FROM mental_models WHERE id=?').bind(uid).first())},current?200:201);
}
