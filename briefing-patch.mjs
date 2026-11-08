import {readFile,writeFile} from 'node:fs/promises';
let worker=await readFile('dist/_worker.js','utf8'),app=await readFile('dist/app.js','utf8');
function replace(s,anchor,value,label){
 if(!s.includes(anchor))throw Error('v0.5.8 briefing anchor missing: '+label+' ('+anchor.slice(0,100)+')');
 return s.replace(anchor,()=>value);
}
worker=replace(worker,'async function handle(req,env,ctx)',
 (await readFile('features/briefing-worker.js','utf8'))+'\nasync function handle(req,env,ctx)','worker insert');
worker=replace(worker," if(path==='/api/session'",
 " if(path==='/api/briefing')return req.method==='GET'?json(await brRead(env)):failure('Method not allowed',405);\n if(path==='/api/briefing/action')return brAction(req,env);\n if(path==='/api/session'",
 'authenticated briefing routes');
worker=replace(worker,'const hasEvidence=await env.DB.prepare',
 'const hasBriefing=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type=\'table\' AND name=\'briefing_preferences\'").first();const hasEvidence=await env.DB.prepare',
 'export table existence');
worker=replace(worker,'const out={evidence_audits:',
 "const out={briefing_preferences:hasBriefing?await rows(env.DB.prepare('SELECT * FROM briefing_preferences')):[],evidence_audits:",
 'private data export');
worker=replace(worker,"version:'0.5.7'","version:'0.5.8'",'worker health version');
app=replace(app,'start();',(await readFile('features/briefing-app.js','utf8'))+'\nstart();','app entrypoint');
app=app.replaceAll('v0.5.7','v0.5.8');
await writeFile('dist/_worker.js',worker);
await writeFile('dist/app.js',app);
console.log('v0.5.8 private Daily Intelligence Briefing: no model inference, external discovery or paid services.');
