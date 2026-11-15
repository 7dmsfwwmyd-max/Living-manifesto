// Additive tombstones preserve original records, references and revision histories.
const trashSchemas=new WeakMap();
async function trashSchema(env){
 if(trashSchemas.has(env.DB))return trashSchemas.get(env.DB);
 const promise=initTrashSchema(env).catch(e=>{trashSchemas.delete(env.DB);throw e});trashSchemas.set(env.DB,promise);return promise;
}
async function initTrashSchema(env){
 await env.DB.prepare('CREATE TABLE IF NOT EXISTS source_trash(source_id TEXT PRIMARY KEY REFERENCES sources(id),trashed_at TEXT NOT NULL)').run();
 await env.DB.prepare('CREATE VIEW IF NOT EXISTS active_sources AS SELECT * FROM sources WHERE id NOT IN (SELECT source_id FROM source_trash)').run();
 await env.DB.prepare('CREATE VIEW IF NOT EXISTS active_ideas AS SELECT * FROM ideas WHERE source_id IN (SELECT id FROM active_sources)').run();
}
async function trashRoute(req,env,path){
 if(path==='/api/trash')return req.method==='GET'?json({sources:await rows(env.DB.prepare('SELECT s.*,t.trashed_at,length(s.body) AS body_length FROM source_trash t JOIN sources s ON s.id=t.source_id ORDER BY t.trashed_at DESC LIMIT 400'))}):failure('Method not allowed',405);
 const m=path.match(/^\/api\/sources\/([a-f0-9-]+)\/(trash|restore)$/i);if(!m)return null;
 if(req.method!=='POST')return failure('Method not allowed',405);
 const s=await env.DB.prepare('SELECT id FROM sources WHERE id=?').bind(m[1]).first();if(!s)return failure('Source not found',404);
 if(m[2]==='trash')await env.DB.prepare('INSERT OR IGNORE INTO source_trash(source_id,trashed_at) VALUES(?,?)').bind(s.id,now()).run();
 else await env.DB.prepare('DELETE FROM source_trash WHERE source_id=?').bind(s.id).run();
 return json({ok:true,trashed:m[2]==='trash'});
}
