import {readFile,writeFile} from 'node:fs/promises';
let w=await readFile('dist/_worker.js','utf8');
function replace(a,b){if(!w.includes(a))throw Error('Automatic analysis anchor missing: '+a.slice(0,80));w=w.replace(a,()=>b)}
w=w.replaceAll('env.AI','env.CONVERTER');
replace("const FREE_MODEL='@cf/meta/llama-3.1-8b-instruct'","const FREE_MODEL='@cf/meta/llama-3.3-70b-instruct-fp8-fast'");
replace("content:system}","content:system+' Required JSON schema: '+JSON.stringify(schema)}");
replace("response_format:{type:'json_schema',json_schema:schema}","response_format:{type:'json_object'}");
replace('input.slice(0,12000)','input'); // input is already bounded before JSON encoding
replace('max_tokens:1600','max_tokens:2400');
replace("if(url&&!body&&ctx?.waitUntil)ctx.waitUntil(extractSourceInBackground(env,uid));","if(ctx?.waitUntil)ctx.waitUntil(processOne(env,uid));");
replace("async function updateText(req,env,sourceId)","async function updateText(req,env,sourceId,ctx)");
replace(".bind(body,now(),sourceId).run();return json({ok:true,queued:true})", ".bind(body,now(),sourceId).run();ctx?.waitUntil(processOne(env,sourceId));return json({ok:true,queued:true})");
replace('return updateText(req,env,match[1]);','return updateText(req,env,match[1],ctx);');
replace('return json({ok:true,saved:true,duplicate:wasExisting,ready_for_analysis:true',"ctx?.waitUntil(processOne(env,source.id));\n  return json({ok:true,saved:true,processing_automatically:true,duplicate:wasExisting,ready_for_analysis:true");
replace("const changed=await env.DB.prepare(\"UPDATE sources SET status='processing',attempts=attempts+1,updated_at=? WHERE id=? AND status IN ('queued','awaiting_ai','failed')\").bind(now(),uid).run();", "const lease=now();const changed=await env.DB.prepare(\"UPDATE sources SET status='processing',attempts=attempts+1,error='',updated_at=? WHERE id=? AND status IN ('queued','awaiting_ai','failed') AND attempts<3\").bind(lease,uid).run();");
replace('const x=await retrieveText(s.url,env);body=x.text;',"const x=/^(www\\.|mobile\\.)?(x\\.com|twitter\\.com)$/.test(new URL(s.url).hostname)?await extractXPost(s.url):await retrieveText(s.url,env);body=x.text;");
replace("await env.DB.prepare('UPDATE sources SET title=?,body=?,retrieval=?,updated_at=? WHERE id=?').bind(title,body,retrieval,now(),uid).run()","await env.DB.prepare(\"UPDATE sources SET title=?,body=?,retrieval=? WHERE id=? AND status='processing' AND updated_at=?\").bind(title,body,retrieval,uid,lease).run()");
replace("const olds=await rows", "if(body.trim().length<40)throw Error('Not enough readable source text');\n  const olds=await rows");
replace("const timestamp=now(),ideaIds=valid.map(()=>id());", "if(!clean(a.summary)||!clean(a.question)||!Array.isArray(a.disciplines)||!Array.isArray(a.proposed_principles)||!Array.isArray(a.connections)||!valid.some(x=>exactExcerpt(body,x.excerpt)))throw Error('Incomplete or ungrounded analysis; retry available');\n  const timestamp=now(),ideaIds=valid.map(()=>id());");
replace("prepare('UPDATE sources SET summary=?,question=?,disciplines=?,status=?,error=?,updated_at=? WHERE id=?')",'prepare('+JSON.stringify("UPDATE sources SET summary=?,question=?,disciplines=?,status=?,error=?,updated_at=? WHERE id=? AND status='processing' AND updated_at=?")+')');
replace("'ready','',timestamp,uid),env.DB.prepare('DELETE FROM ideas WHERE source_id=?').bind(uid)","'ready','',timestamp,uid,lease)");
// In the same atomic batch, insert only if this lease successfully made the source ready.
const start=w.indexOf('async function processOne('),end=w.indexOf('async function processQueue(',start);
let f=w.slice(start,end);
f=f.replaceAll('VALUES(?,?,?,?,?,?,?,?,?)',"SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM sources WHERE id=? AND status='ready' AND updated_at=?)").replaceAll('VALUES(?,?,?,?,?,?,?)',"SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM sources WHERE id=? AND status='ready' AND updated_at=?)").replaceAll('VALUES(?,?,?,?,?,?)',"SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM sources WHERE id=? AND status='ready' AND updated_at=?)");
f=f.replace('JSON.stringify((x.tags||[]).slice(0,10)),timestamp))','JSON.stringify((Array.isArray(x.tags)?x.tags:[]).slice(0,10)),timestamp,uid,timestamp))').replace('timestamp,timestamp))','timestamp,timestamp,uid,timestamp))').replace('clean(c.reason,1200),timestamp))','clean(c.reason,1200),timestamp,uid,timestamp))');
f=f.replace("WHERE id=?\").bind(now(),uid).run();return}","WHERE id=? AND status='processing' AND updated_at=?\").bind(now(),uid,lease).run();return}");
f=f.replace("WHERE id=?\").bind(clean(e.message,400),now(),uid).run();return}","WHERE id=? AND status='processing' AND updated_at=?\").bind(clean(e.message,400),now(),uid,lease).run();return}");
// SQL strings with new status literals use double-quoted JS strings.
f=f.replace(/prepare\('([^\n]*SELECT 1 FROM sources[^\n]*?)'\)/g,(_,sql)=>'prepare('+JSON.stringify(sql)+')');
const catchStart=f.indexOf(' }catch(e){\n  const quotaOrCapacity');
f=f.slice(0,catchStart)+` }catch(e){
  const quota=/(429|quota|limit|capacity|3040|exceed|allocation|rate)/i.test(String(e?.message));
  const message=quota?'Free AI allowance or capacity unavailable. Saved safely; retry later.':clean(e?.message||'Analysis failed',400);
  await env.DB.prepare("UPDATE sources SET status='failed',error=?,updated_at=? WHERE id=? AND status='processing' AND updated_at=?").bind(message,quota?new Date(Date.now()+24*3600000).toISOString():now(),uid,lease).run();
 }
}
`;
w=w.slice(0,start)+f+w.slice(end);
const qStart=w.indexOf('async function processQueue('),qEnd=w.indexOf('\n',qStart);
w=w.slice(0,qStart)+`async function processQueue(env){
 if(!env.CONVERTER?.run)return;
 // waitUntil may be interrupted after the response; recover abandoned leases.
 await env.DB.prepare("UPDATE sources SET status='failed',error='Processing interrupted; retrying automatically',updated_at=? WHERE status='processing' AND updated_at<?").bind(now(),new Date(Date.now()-5*60000).toISOString()).run();
 const tasks=await rows(env.DB.prepare("SELECT id FROM sources WHERE status IN ('queued','awaiting_ai','failed') AND attempts<3 AND updated_at<=? ORDER BY created_at ASC LIMIT 1").bind(now()));
 for(const t of tasks)await processOne(env,t.id);
}`+w.slice(qEnd);
// Preserve analysed records on text replacement; use a new capture for revised editions.
replace("SELECT id FROM sources WHERE id=?').bind(sourceId).first();if(!src)return failure('Source not found',404);","SELECT id,status FROM sources WHERE id=?').bind(sourceId).first();if(!src)return failure('Source not found',404);if(src.status==='ready')return failure('Analysed source preserved. Capture revised text as a new source.',409);");
w=w.replace("version:'0.5.1'","version:'0.5.2'");
await writeFile('dist/_worker.js',w);
let a=await readFile('dist/app.js','utf8');
a=a.replace("queued:'Awaiting analysis'","queued:'Queued for automatic analysis'").replace("awaiting_ai:'Awaiting analysis'","awaiting_ai:'Queued for automatic analysis'");
a=a.replace("${state.ai?button('Try processing','process'):''}","${state.ai&&s.status!=='ready'&&s.status!=='processing'?button('Retry analysis','process'):''}");
a=a.replace('A URL is not an analysed source. When text has been retrieved, use the ChatGPT buttons here or the enhanced Share Sheet Shortcut.','New captures are analysed automatically. Processing continues when you close the app. If text cannot be retrieved, add it here. The ChatGPT buttons are an optional fallback.');
a=a.replace('If article text was retrieved, use Copy ChatGPT prompt, then Paste ChatGPT analysis. Nothing is treated as read until its text is available.','Automatic analysis will appear here when complete. Text-needed or retry messages explain any interruption.');
a=a.replace('Once processing is configured, the system will','The system will automatically');
a += `\nasync function refreshProcessing(){
 try{if(state.signedIn && !document.getElementById('overlay')?.innerHTML && state.sources.some(s=>['queued','processing','awaiting_ai'].includes(s.status))){await reload();if(state.activeSource){state.detail=await api('sources/'+state.activeSource);render();}}}catch{}
 setTimeout(refreshProcessing,10000);
}
setTimeout(refreshProcessing,10000);\n`;
await writeFile('dist/app.js',a);
console.log('Automatic capture analysis and durable scheduled recovery enabled');
