// Read-only audit. Never print credentials, source text, binding values or billing details.
const account=process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
const token=process.env.CLOUDFLARE_API_TOKEN?.trim();
if(!/^[a-f0-9]{32}$/.test(account||''))throw Error('CLOUDFLARE_ACCOUNT_ID is missing or invalid');
if(!token)throw Error('CLOUDFLARE_API_TOKEN is missing');
async function read(path){const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+path,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(30000)});let j;try{j=await r.json()}catch{j={}};if(!r.ok||!j.success){console.log(JSON.stringify({path,status:r.status,error_codes:j.errors?.map(x=>x.code)}));return null}return j.result}
const subscriptions=await read('/subscriptions');
console.log('SUBSCRIPTIONS',JSON.stringify(subscriptions?.map(s=>({rate_plan:s.rate_plan?.id,state:s.state})))||'unavailable');
const accountSettings=await read('/workers/account-settings');console.log('WORKERS_ACCOUNT',JSON.stringify(accountSettings));
const settings=await read('/workers/scripts/living-manifesto-app/settings');
if(settings)console.log('WORKER_SETTINGS',JSON.stringify({usage_model:settings.usage_model,compatibility_date:settings.compatibility_date,observability:settings.observability,bindings:settings.bindings?.map(b=>({name:b.name,type:b.type,...(b.type==='d1'?{id:b.id}:{} )}))}));
const deployments=await read('/workers/scripts/living-manifesto-app/deployments');
console.log('DEPLOYMENTS',JSON.stringify(deployments?.deployments?.map(d=>({id:d.id,created_on:d.created_on,strategy:d.strategy,versions:d.versions}))));
const versions=await read('/workers/scripts/living-manifesto-app/versions');
console.log('VERSIONS',JSON.stringify(versions?.items?.map(v=>({id:v.id,number:v.number,created_on:v.metadata?.created_on,source:v.metadata?.source}))));
console.log('SUBDOMAIN',JSON.stringify(await read('/workers/scripts/living-manifesto-app/subdomain')));
const databases=await read('/d1/database');console.log('DATABASES',JSON.stringify(databases?.map(d=>({uuid:d.uuid,name:d.name,version:d.version,num_tables:d.num_tables,file_size:d.file_size}))));
if(!settings)throw Error('Worker inspection failed; no changes made');
console.log('READ_ONLY_AUDIT_COMPLETE: no deployment, database writes, AI calls or subscription changes');

const scripts=await read('/workers/scripts');
const production=scripts?.find(s=>s.id==='living-manifesto-app');
if(production?.tag){
 const triggers=await read('/builds/workers/'+production.tag+'/triggers');
 console.log('BUILD_TRIGGERS',JSON.stringify(triggers?.map(t=>({trigger_uuid:t.trigger_uuid,build_command:t.build_command,deploy_command:t.deploy_command,branch_includes:t.branch_includes,branch_excludes:t.branch_excludes,root_directory:t.root_directory}))));
 const builds=await read('/builds/workers/'+production.tag+'/builds');
 console.log('BUILD_HISTORY',JSON.stringify(Array.isArray(builds)?builds.slice(0,10).map(b=>({id:b.build_uuid,status:b.status,outcome:b.build_outcome,created_on:b.created_on})):builds));
}

for(const id of ['918fd354-945b-4518-bfec-c649642a1f0c','6406d7a2-2119-40a4-bacc-7880dcb12ff7']){
 const logs=await read('/builds/builds/'+id+'/logs');
 const text=(logs?.lines||[]).map(x=>x.join(' ')).join('\n');
 console.log('BUILD_LOG_DIAGNOSIS',JSON.stringify({id,lines:logs?.lines?.length,truncated:logs?.truncated,syntax_error:/SyntaxError|syntax error/i.test(text),invalid_token:/Invalid or unexpected token/i.test(text),unexpected_token:/Unexpected token/i.test(text),build_failed:/failed/i.test(text),error_codes:[...text.matchAll(/code: (\d+)/g)].map(m=>m[1])}));
}
