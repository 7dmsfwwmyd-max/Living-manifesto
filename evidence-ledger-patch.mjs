import {readFile,writeFile} from 'node:fs/promises';
let worker=await readFile('dist/_worker.js','utf8'),app=await readFile('dist/app.js','utf8');
function replace(s,old,next,label){if(!s.includes(old))throw Error('Evidence ledger anchor missing ('+label+'): '+old.slice(0,120));return s.replace(old,()=>next)}
worker=replace(worker,'async function handle(req,env,ctx)',(await readFile('features/evidence-ledger-worker.js','utf8'))+'\nasync function handle(req,env,ctx)','worker insert');
worker=replace(worker," if(path==='/api/session'",
 " if(path==='/api/evidence/overview')return elOverview(req,env);\n let evidenceMatch=path.match(/^\\/api\\/sources\\/([a-f0-9-]+)\\/evidence$/i);if(evidenceMatch)return elAuditRoute(req,env,evidenceMatch[1]);\n if(path==='/api/session'",'authenticated evidence routes');
worker=replace(worker,'const hasEvergreen=await env.DB.prepare',
 'const hasEvidence=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type=\'table\' AND name=\'evidence_audits\'").first();const hasEvergreen=await env.DB.prepare',
 'export table check');
worker=replace(worker,'const out={evergreen_notes:',
 "const out={evidence_audits:hasEvidence?await rows(env.DB.prepare('SELECT * FROM evidence_audits')):[],evergreen_notes:",
 'export payload');
worker=replace(worker,'await env.DB.batch(statements);\n }catch(e){',
 "await env.DB.batch(statements);\n  // Succeed even if the optional D1 audit snapshot cannot be written.\n  // This must not reverse a completed analysis or consume an AI retry.\n  try{await elPersist(env,uid)}catch(e){console.error('Evidence audit deferred',e?.message)}\n }catch(e){",
 'automatic evidence auditing after source analysis');
worker=replace(worker,"version:'0.5.6'","version:'0.5.7'",'worker version');
app=replace(app,
 'function explore(){return evergreenMarkup()+topicMarkup()+studioOverview()+exploreConnections()}',
 'function explore(){return evidenceOverviewMarkup()+evergreenMarkup()+topicMarkup()+studioOverview()+exploreConnections()}',
 'Explore dashboard');
app=replace(app,
 "dossierMarkup(s)+studioMarkup(s);",
 "dossierMarkup(s)+studioMarkup(s)+evidenceMarkup(s);",
 'source detail evidence panel');
app=replace(app,'start();',(await readFile('features/evidence-ledger-app.js','utf8'))+'\nstart();','client start');
app=app.replaceAll('v0.5.6','v0.5.7');
await writeFile('dist/_worker.js',worker);
await writeFile('dist/app.js',app);
console.log('Evidence ledger v0.5.7: deterministic saved-text checks, archived source audits, bounded workflow overview. No AI or paid dependency added.');
