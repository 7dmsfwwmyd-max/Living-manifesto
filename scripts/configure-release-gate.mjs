import assert from 'node:assert/strict';
const account=process.env.CLOUDFLARE_ACCOUNT_ID, token=process.env.CLOUDFLARE_API_TOKEN;
async function api(path,method='GET',body){const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const j=await r.json();assert.ok(r.ok&&j.success,'Cloudflare '+r.status+' codes '+j.errors?.map(e=>e.code));return j.result}
const worker=(await api('/workers/scripts')).find(s=>s.id==='living-manifesto-app');assert.ok(worker?.tag);
const path='/builds/workers/'+worker.tag+'/triggers';
const triggers=await api(path);assert.equal(triggers.length,1);
const trigger=triggers[0];assert.equal(trigger.trigger_uuid,'11a058c4-fb21-4c08-a488-e6539d117066');
await api('/builds/triggers/'+trigger.trigger_uuid,'PATCH',{branch_excludes:['*'],build_command:'node scripts/build.mjs',deploy_command:'node scripts/require-promotion.mjs'});
const current=(await api(path))[0];assert.deepEqual(current.branch_excludes,['*']);assert.equal(current.build_command,'node scripts/build.mjs');assert.equal(current.deploy_command,'node scripts/require-promotion.mjs');
console.log('PASS legacy automatic deployment disabled; staged artifact promotion is the production release path.');
