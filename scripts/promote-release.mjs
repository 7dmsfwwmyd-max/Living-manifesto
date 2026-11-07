import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
assert.equal(process.env.ZERO_COST_CONFIRMED,'workers-free-no-payment-method');
const db='39259550-5d35-4d51-aaee-f203d33af1c9',name='living-manifesto-app',base='https://living-manifesto-app.4gj5cc8d25.workers.dev';
const report=JSON.parse(await readFile('release/staging-validation.json'));
const manifest=JSON.parse(await readFile('release/dist/release.json'));
assert.equal(report.passed,true);assert.equal(report.commit,process.env.RELEASE_SHA);assert.equal(manifest.commit,report.commit);assert.notEqual(report.database_id,db);
for(const [file,hash] of Object.entries(manifest.files)){assert.match(file,/^[a-zA-Z0-9_.-]+$/);assert.equal(createHash('sha256').update(await readFile('release/dist/'+file)).digest('hex'),hash,'Artifact hash mismatch: '+file)}
async function api(path,method='GET',body){const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});const j=await r.json();if(!r.ok||!j.success)throw Error(path+' HTTP '+r.status+' codes '+j.errors?.map(e=>e.code));return j.result}
const path='/workers/scripts/'+name;
const original=await api(path+'/settings');assert.equal(original.bindings.find(b=>b.name==='DB')?.id,db);for(const secret of ['APP_PASSWORD','SESSION_SECRET','SHORTCUT_TOKEN'])assert.ok(original.bindings.some(b=>b.name===secret&&b.type==='secret_text'));
const previous=(await api(path+'/deployments')).deployments[0];assert.ok(previous.versions?.length);
const bookmark=await api('/d1/database/'+db+'/time_travel/bookmark');assert.ok(bookmark.bookmark,'Time Travel restore point required');
async function fingerprint(){const q=await api('/d1/database/'+db+'/query','POST',{sql:"SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name != 'auth_attempts'"});const out={};for(const {name:table} of q[0].results){assert.match(table,/^[a-zA-Z_]+$/);const result=await api('/d1/database/'+db+'/query','POST',{sql:'SELECT * FROM "'+table+'"'});const rows=result[0].results.map(x=>JSON.stringify(x)).sort();out[table]={count:rows.length,hash:createHash('sha256').update(JSON.stringify(rows)).digest('hex')}}return out}
const previousSchedules=await api(path+'/schedules');
try{
await api(path+'/schedules','PUT',[]);
const before=await fingerprint();
await writeFile('production-rollback.json',JSON.stringify({previous_deployment:{id:previous.id,versions:previous.versions},previous_schedules:previousSchedules,bookmark:bookmark.bookmark,release:manifest.commit},null,2));
const config={name,main:'release/dist/_worker.js',compatibility_date:original.compatibility_date,workers_dev:true,preview_urls:true,keep_vars:true,assets:{directory:'release/dist',binding:'ASSETS',run_worker_first:true},d1_databases:[{binding:'DB',database_name:'living-manifesto',database_id:db}],ai:{binding:'CONVERTER'}};
await writeFile('wrangler.production.generated.json',JSON.stringify(config,null,2));
 execFileSync('npx',['--yes','wrangler@4.158.0','deploy','--config','wrangler.production.generated.json','--no-bundle'],{stdio:'inherit'});
 let ready=false;for(let n=0;n<30;n++){try{const r=await fetch(base+'/api/health',{signal:AbortSignal.timeout(10000)});if(r.ok&&(await r.json()).commit===manifest.commit){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,2000))}assert.ok(ready,'Production revision did not become ready');
 for(const asset of ['/','/app.js','/styles.css','/service-worker.js','/release.json']){const r=await fetch(base+asset);assert.equal(r.status,200,asset);if(asset!=='/release.json'){const file=asset==='/'?'index.html':asset.slice(1);assert.equal(createHash('sha256').update(Buffer.from(await r.arrayBuffer())).digest('hex'),manifest.files[file],asset+' live bytes differ')}}
 assert.equal((await fetch(base+'/api/sources')).status,401);
 const current=await api(path+'/settings');assert.equal(current.bindings.find(b=>b.name==='DB')?.id,db);for(const secret of ['APP_PASSWORD','SESSION_SECRET','SHORTCUT_TOKEN'])assert.ok(current.bindings.some(b=>b.name===secret&&b.type==='secret_text'));
 assert.deepEqual(await fingerprint(),before,'Stored data changed during deployment');
 await writeFile('production-validation.json',JSON.stringify({commit:manifest.commit,version:manifest.version,validated_at:new Date().toISOString(),public_health:true,asset_hashes:true,anonymous_access_denied:true,data_unchanged:true,authenticated_browser_checks:'pending'},null,2));
 await api(path+'/schedules','PUT',[{cron:'*/2 * * * *'}]);
 console.log('PASS production revision, exact asset hashes, access control, original bindings and unchanged data. Authenticated browser verification remains required.');
}catch(e){console.error('Production gate failed; restoring previous Worker deployment without changing D1');await api(path+'/deployments','POST',{strategy:'percentage',versions:previous.versions});await api(path+'/schedules','PUT',(previousSchedules.schedules||previousSchedules||[]).map(s=>({cron:s.cron})));throw e}
