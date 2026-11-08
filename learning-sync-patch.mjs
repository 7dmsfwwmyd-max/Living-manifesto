import {readFile,writeFile} from 'node:fs/promises';
let worker=await readFile('dist/_worker.js','utf8');
let app=await readFile('dist/app.js','utf8');
function replace(text,needle,value,label){
 if(!text.includes(needle))throw Error('Learning Sync patch missing '+label+' anchor: '+needle.slice(0,120));
 return text.replace(needle,()=>value);
}
worker=replace(worker,'async function handle(req,env,ctx)',(await readFile('features/learning-sync-worker.js','utf8'))+'\nasync function handle(req,env,ctx)','Worker insert');
worker=replace(worker," if(path==='/api/session'"," if(path==='/api/studio-state')return studioStateRoute(req,env);\n if(path==='/api/knowledge-graph')return knowledgeGraphRoute(req,env);\n if(path==='/api/session'",'authenticated route');
worker=replace(worker,'const hasTopics=await env.DB.prepare',"const hasStudio=await env.DB.prepare(\"SELECT name FROM sqlite_master WHERE type='table' AND name='studio_state'\").first();const hasTopics=await env.DB.prepare",'export table check');
worker=replace(worker,'const out={topic_searches:',"const out={studio_state:hasStudio?await rows(env.DB.prepare('SELECT key,content,revision,updated_at FROM studio_state')):[],topic_searches:",'export payload');
worker=replace(worker,"version:'0.5.4'","version:'0.5.5'",'worker version');
app=replace(app,'start();',(await readFile('features/learning-sync-app.js','utf8'))+'\nstart();','frontend sync');
app=replace(app,'Progress and connections are stored only on this device, not in Cloudflare D1 or the standard library export. Use the learning backup in Explore to preserve them.','Progress and connections sync to your private Cloudflare database when online. Local changes remain available offline; use the JSON backup as an additional safeguard.','source footer');
app=replace(app,'Reviews, paths and links are saved only on this device.','Reviews, paths and links sync to your private Cloudflare database when online.','overview footer');
app=replace(app,'Copy the JSON backup and save it privately. It may contain your personal notes. Restoring replaces only this device’s Learning Studio data.','Copy the JSON backup and save it privately. It may contain personal notes. Restoring imports local records and merges them into your private cloud learning state when online.','backup disclosure');
app=app.replaceAll('v0.5.4','v0.5.5');
await writeFile('dist/_worker.js',worker);
await writeFile('dist/app.js',app);
console.log('Learning Studio v0.5.5: D1 sync, conflict handling and source-grounded knowledge graph; no paid services or additional AI calls.');
