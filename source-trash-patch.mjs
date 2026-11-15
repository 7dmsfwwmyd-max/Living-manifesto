import {readFile,writeFile} from 'node:fs/promises';
let w=await readFile('dist/_worker.js','utf8'),a=await readFile('dist/app.js','utf8');
function rep(s,n,v){if(!s.includes(n))throw Error('Trash anchor missing: '+n.slice(0,90));return s.replace(n,()=>v)}
// Active read models exclude trash; raw records remain available to export,
// duplicate detection, validation and the read-only source detail endpoint.
w=w.replace(/\b(FROM|JOIN) sources\b/g,'$1 active_sources').replace(/\b(FROM|JOIN) ideas\b/g,'$1 active_ideas');
// DELETE must target the real table; never modify a view.
w=w.replaceAll('DELETE FROM active_ideas','DELETE FROM ideas');
// A job already in flight may finish storing its output, but cannot resurface the source.
w=w.replaceAll('EXISTS(SELECT 1 FROM active_sources','EXISTS(SELECT 1 FROM sources');
w=w.replaceAll('FROM active_sources WHERE url=', 'FROM sources WHERE url=');
w=w.replaceAll('SELECT id FROM active_sources WHERE id IN (','SELECT id FROM sources WHERE id IN (');
w=rep(w,"sources:await rows(env.DB.prepare('SELECT * FROM active_sources'))","source_trash:await rows(env.DB.prepare('SELECT * FROM source_trash')),sources:await rows(env.DB.prepare('SELECT * FROM sources'))");
w=rep(w,"ideas:await rows(env.DB.prepare('SELECT * FROM active_ideas'))","ideas:await rows(env.DB.prepare('SELECT * FROM ideas'))");
w=rep(w,"const source=await env.DB.prepare('SELECT * FROM active_sources WHERE id=?').bind(match[1]).first()","const source=await env.DB.prepare('SELECT s.*,t.trashed_at FROM sources s LEFT JOIN source_trash t ON t.source_id=s.id WHERE s.id=?').bind(match[1]).first()");
w=rep(w,'async function handle(req,env,ctx)',await readFile('features/source-trash-worker.js','utf8')+'\nasync function handle(req,env,ctx)');
w=rep(w," if(path==='/api/topics')",` await trashSchema(env);
 const trashResponse=await trashRoute(req,env,path);if(trashResponse)return trashResponse;
 const trashTarget=path.match(/^\\/api\\/sources\\/([a-f0-9-]+)(?:\\/|$)/i);
 if(trashTarget&&req.method!=='GET'&&await env.DB.prepare('SELECT source_id FROM source_trash WHERE source_id=?').bind(trashTarget[1]).first())return failure('Source is in Trash. Restore it before changing or analysing it.',409);
 if(path==='/api/topics')`);
w=rep(w,'async function processQueue(env){','async function processQueue(env){await trashSchema(env);');
// Do not accidentally update or analyse a duplicate URL currently in Trash.
w=rep(w,'async function capture(req,env,ctx){',`async function capture(req,env,ctx){
 const check=await payload(req.clone(),55000);if(check.url){const t=await env.DB.prepare('SELECT t.source_id FROM source_trash t JOIN sources s ON s.id=t.source_id WHERE s.url=?').bind(safeUrl(check.url)).first();if(t)return failure('This source is already in Trash. Restore it from Library → Trash.',409);}
`);
a=rep(a,'start();',await readFile('features/source-trash-app.js','utf8')+'\nstart();');
w=w.replace("version:'0.5.14'","version:'0.5.15'");a=a.replaceAll('v0.5.14','v0.5.15');
await writeFile('dist/_worker.js',w);await writeFile('dist/app.js',a);
