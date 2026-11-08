// Source-grounded, user-authored evergreen concept notes. No external APIs or AI requests.
const EV_ID=/^[0-9a-f-]{8,80}$/i;
const EV_REL=['supports','challenges','qualifies','context','depends-on','illustrates'];
const evText=(x,n)=>String(x==null?'':x).trim().slice(0,n);
const evNormalize=x=>String(x||'').replace(/\s+/g,' ').trim().toLowerCase();
async function evTables(env){
 await env.DB.prepare('CREATE TABLE IF NOT EXISTS evergreen_notes (id TEXT PRIMARY KEY,title TEXT NOT NULL,thesis TEXT NOT NULL,content TEXT NOT NULL,source_refs TEXT NOT NULL,related TEXT NOT NULL,archived INTEGER NOT NULL DEFAULT 0,revision INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)').run();
 await env.DB.prepare('CREATE TABLE IF NOT EXISTS evergreen_history (note_id TEXT NOT NULL,revision INTEGER NOT NULL,snapshot TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(note_id,revision))').run();
}
function evDecode(row){
 if(!row)return null;
 return {...row,source_refs:JSON.parse(row.source_refs||'[]'),related:JSON.parse(row.related||'[]'),archived:!!row.archived};
}
async function evValidate(env,raw,selfId){
 if(!raw||typeof raw!=='object')throw Error('Expected an evergreen note');
 const title=evText(raw.title,140),thesis=evText(raw.thesis,1000),content=evText(raw.content,18000);
 if(title.length<3||thesis.length<20||content.length<30)throw Error('Provide a title, substantive thesis (20+ characters) and explanation (30+ characters)');
 if(!Array.isArray(raw.source_refs)||raw.source_refs.length>30||!Array.isArray(raw.related)||raw.related.length>40)throw Error('Too many source or concept links');
 const source_refs=[],seenSources=new Set();
 for(const x of raw.source_refs){
  const id=String(x?.source_id||''),relation=evText(x?.relation,20),quote=evText(x?.quote,800),comment=evText(x?.comment,600);
  if(!EV_ID.test(id)||!EV_REL.includes(relation)||seenSources.has(id+'|'+relation))throw Error('Invalid or duplicate cited source');
  const s=await env.DB.prepare('SELECT id,title,body,url FROM sources WHERE id=?').bind(id).first();
  if(!s)throw Error('Cited source is not in your saved library');
  if(quote&&!evNormalize(s.body).includes(evNormalize(quote)))throw Error('Cited quotation is not present in the stored original text');
  seenSources.add(id+'|'+relation);
  source_refs.push({source_id:id,title:evText(s.title,180),url:evText(s.url,1000),relation,quote,comment});
 }
 const related=[],seen=new Set();
 for(const x of raw.related){
  const id=String(x?.note_id||''),relation=evText(x?.relation,20),reason=evText(x?.reason,500);
  if(!EV_ID.test(id)||id===selfId||!EV_REL.includes(relation)||reason.length<8||seen.has(id+'|'+relation))throw Error('Invalid or duplicate concept relation');
  const target=await env.DB.prepare('SELECT id,title FROM evergreen_notes WHERE id=?').bind(id).first();
  if(!target)throw Error('Related evergreen concept was not found');
  seen.add(id+'|'+relation);
  related.push({note_id:id,title:evText(target.title,140),relation,reason});
 }
 return {title,thesis,content,source_refs,related,archived:raw.archived===true};
}
async function evRoute(req,env,path){
 if(!['GET','POST','PUT'].includes(req.method))return failure('Method not allowed',405);
 await evTables(env);
 if(path==='/api/evergreen/export')return evExport(req,env);
 if(path==='/api/evergreen'){
  if(req.method==='GET')return json({notes:await rows(env.DB.prepare('SELECT id,title,thesis,archived,revision,created_at,updated_at FROM evergreen_notes ORDER BY updated_at DESC LIMIT 200'))});
  if(req.method!=='POST')return failure('Method not allowed',405);
  const n=await env.DB.prepare('SELECT count(*) AS n FROM evergreen_notes').first();
  if(n.n>=200)return failure('The 200-concept safety limit has been reached. Export a backup before adding more.',429);
  let value;try{value=await evValidate(env,await payload(req,60000),'')}catch(e){return failure(e.message,422)}
  const uid=id(),stamp=now();
  await env.DB.prepare('INSERT INTO evergreen_notes(id,title,thesis,content,source_refs,related,archived,revision,created_at,updated_at) VALUES(?,?,?,?,?,?,?,1,?,?)')
   .bind(uid,value.title,value.thesis,value.content,JSON.stringify(value.source_refs),JSON.stringify(value.related),Number(value.archived),stamp,stamp).run();
  return json({note:evDecode(await env.DB.prepare('SELECT * FROM evergreen_notes WHERE id=?').bind(uid).first())},201);
 }
 const match=path.match(/^\/api\/evergreen\/([a-f0-9-]{8,80})(\/history)?$/i);
 if(!match)return failure('Not found',404);
 const uid=match[1],old=await env.DB.prepare('SELECT * FROM evergreen_notes WHERE id=?').bind(uid).first();
 if(!old)return failure('Concept not found',404);
 if(match[2]){
  if(req.method!=='GET')return failure('Method not allowed',405);
  return json({history:await rows(env.DB.prepare('SELECT revision,snapshot,created_at FROM evergreen_history WHERE note_id=? ORDER BY revision DESC LIMIT 30').bind(uid))});
 }
 if(req.method==='GET')return json({note:evDecode(old)});
 if(req.method!=='PUT')return failure('Method not allowed',405);
 const incoming=await payload(req,60000);
 if(!Number.isSafeInteger(incoming.revision)||incoming.revision<1)return failure('Expected concept revision required',422);
 if(incoming.revision!==old.revision)return failure('This concept was edited elsewhere. Reopen before saving.',409);
 let value;try{value=await evValidate(env,incoming.note,uid)}catch(e){return failure(e.message,422)}
 const stamp=now(),snapshot=JSON.stringify(evDecode(old));
 const batch=await env.DB.batch([
  env.DB.prepare('UPDATE evergreen_notes SET title=?,thesis=?,content=?,source_refs=?,related=?,archived=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?')
   .bind(value.title,value.thesis,value.content,JSON.stringify(value.source_refs),JSON.stringify(value.related),Number(value.archived),stamp,uid,incoming.revision),
  env.DB.prepare('INSERT OR IGNORE INTO evergreen_history(note_id,revision,snapshot,created_at) VALUES(?,?,?,?)').bind(uid,incoming.revision,snapshot,stamp)
 ]);
 if(Number(batch[0].meta?.changes)!==1)return failure('This concept changed on another device. Reopen before saving.',409);
 return json({note:evDecode(await env.DB.prepare('SELECT * FROM evergreen_notes WHERE id=?').bind(uid).first())});
}
async function evExport(req,env){
 if(req.method!=='GET')return failure('Method not allowed',405);
 const format=new URL(req.url).searchParams.get('format')||'json';
 if(!['json','markdown','canvas'].includes(format))return failure('Unsupported export format',422);
 const count=await env.DB.prepare('SELECT count(*) AS n FROM evergreen_notes').first();
 if(count.n>200)return failure('Too many notes to export in a single free request',413);
 const notes=(await rows(env.DB.prepare('SELECT * FROM evergreen_notes ORDER BY title ASC LIMIT 201'))).map(evDecode);
 if(format==='json')return json({format:'evergreen-v1',notes,exported_at:now()});
 if(format==='markdown'){
  const markdown=notes.map(n=>{
   const refs=n.source_refs.map(s=>'* '+s.relation+': '+s.title+(s.url?' ('+s.url+')':'')+(s.quote?'\n  > '+s.quote:'')+(s.comment?'\n  - '+s.comment:'')).join('\n');
   const linked=n.related.map(x=>'* '+x.relation+' [['+x.title+']] — '+x.reason).join('\n');
   return '# '+n.title+'\n\nID: '+n.id+' | Revision: '+n.revision+' | '+(n.archived?'Archived':'Active')+'\n\n## Core claim\n\n'+n.thesis+'\n\n## Working explanation\n\n'+n.content+'\n\n## Cited source material\n\n'+(refs||'No citations yet')+'\n\n## Related concepts\n\n'+(linked||'No relationships yet');
  }).join('\n\n---\n\n');
  return new Response(markdown,{headers:{'content-type':'text/markdown; charset=utf-8','cache-control':'no-store','content-disposition':'attachment; filename="living-manifesto-evergreen.md"'}});
 }
 const nodes=[],edges=[],lookup=new Map(notes.map((n,i)=>[n.id,i]));
 notes.forEach((n,i)=>nodes.push({id:'note-'+n.id,type:'text',text:n.title+'\n\n'+n.thesis,x:(i%4)*460,y:Math.floor(i/4)*300,width:400,height:220}));
 const existing=new Set(),sourceList=new Map();
 notes.forEach(n=>{
  for(const rel of n.related)if(lookup.has(rel.note_id)){
   const key=n.id+'|'+rel.note_id+'|'+rel.relation;if(existing.has(key))continue;existing.add(key);
   edges.push({id:'relation-'+edges.length,fromNode:'note-'+n.id,toNode:'note-'+rel.note_id,fromSide:'right',toSide:'left',label:rel.relation});
  }
  for(const ref of n.source_refs){
   if(!sourceList.has(ref.source_id)){
    const index=sourceList.size;
    sourceList.set(ref.source_id,{id:'source-'+ref.source_id,type:'text',text:'Source: '+ref.title+(ref.quote?'\n\n'+ref.quote:''),x:(index%4)*460,y:Math.ceil(notes.length/4)*300+Math.floor(index/4)*260,width:400,height:180});
   }
   edges.push({id:'citation-'+edges.length,fromNode:'note-'+n.id,toNode:'source-'+ref.source_id,fromSide:'bottom',toSide:'top',label:ref.relation});
  }
 });
 return json({nodes:[...nodes,...sourceList.values()],edges});
}
