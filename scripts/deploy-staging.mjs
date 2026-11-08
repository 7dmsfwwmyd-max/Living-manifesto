import {writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
assert.equal(process.env.ZERO_COST_CONFIRMED,'workers-free-no-payment-method');
assert.match(account||'',/^[a-f0-9]{32}$/);assert.ok(token);
const productionDB='39259550-5d35-4d51-aaee-f203d33af1c9';
async function api(path,method='GET',body){const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const j=await r.json();if(!r.ok||!j.success)throw Error(path+' HTTP '+r.status+' codes '+j.errors?.map(e=>e.code).join(','));return j.result}
// User supplied a screenshot of Workers Free, active, with no payment method.
// There are no subscription, billing, credit or paid-product API mutations here.
const databases=await api('/d1/database');
let db=databases.find(d=>d.name==='living-manifesto-staging');
if(!db){assert.ok(databases.length<10,'Free database limit reached');db=await api('/d1/database','POST',{name:'living-manifesto-staging',primary_location_hint:'weur'})}
assert.ok(db.uuid&&db.uuid!==productionDB,'Staging must never use production D1');
const config={name:'living-manifesto-staging',main:'dist/_worker.js',compatibility_date:'2026-11-01',workers_dev:true,preview_urls:false,assets:{directory:'dist',binding:'ASSETS',run_worker_first:true},d1_databases:[{binding:'DB',database_name:db.name,database_id:db.uuid}],ai:{binding:'CONVERTER'},keep_vars:false,triggers:{crons:['*/2 * * * *']}};
await writeFile('wrangler.staging.generated.json',JSON.stringify(config,null,2));
const secrets={APP_PASSWORD:randomBytes(32).toString('hex'),SESSION_SECRET:randomBytes(32).toString('hex'),SHORTCUT_TOKEN:randomBytes(32).toString('hex')};
for(const value of Object.values(secrets))console.log('::add-mask::'+value);
const temp=await mkdtemp(join(tmpdir(),'manifesto-stage-'));
try{
 const file=join(temp,'secrets.json');await writeFile(file,JSON.stringify(secrets),{mode:0o600});
 execFileSync('npx',['--yes','wrangler@4.158.0','deploy','--config','wrangler.staging.generated.json','--no-bundle','--secrets-file',file],{stdio:'inherit'});
 const subdomain=await api('/workers/subdomain');
 const base='https://living-manifesto-staging.'+subdomain.subdomain+'.workers.dev';
 const env={...process.env,APP_PASSWORD:secrets.APP_PASSWORD,APP_URL:base,STAGING_URL:base,EXPECTED_SHA:process.env.GITHUB_SHA,TEST_X_URL:'https://x.com/l1vsun/status/2116519560631205914',TEST_PDF_URL:'https://arxiv.org/pdf/1706.03762'};
 let ready=false,lastHealth='no response';for(let attempt=0;attempt<30;attempt++){
 try{
  const url=base+'/api/health?release='+encodeURIComponent(process.env.GITHUB_SHA)+'&attempt='+attempt;
  const r=await fetch(url,{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(10000)});
  if(r.ok){
   const info=await r.json();
   lastHealth='HTTP '+r.status+' version '+String(info.version||'missing')+' commit '+String(info.commit||'missing').slice(0,14);
   if(info.commit===process.env.GITHUB_SHA){ready=true;break}
  }else lastHealth='HTTP '+r.status;
 }catch(error){lastHealth=String(error?.message||'health request failed').slice(0,100)}
 if(attempt<29)await new Promise(r=>setTimeout(r,2000));
}
assert.ok(ready,'Staging did not serve expected release. Last public health: '+lastHealth+'; expected '+process.env.GITHUB_SHA.slice(0,14));
 execFileSync(process.execPath,['scripts/healthcheck.mjs'],{stdio:'inherit',env});
 // Check browser UI first. Reuse a synthetic staging source when present to
 // catch UI regressions before spending any additional free-tier AI allowance.
 execFileSync(process.execPath,['scripts/staging-browser.mjs'],{stdio:'inherit',env});
 execFileSync(process.execPath,['scripts/staging-e2e.mjs'],{stdio:'inherit',env});
 await writeFile('staging-validation.json',JSON.stringify({commit:process.env.GITHUB_SHA,url:base,database_id:db.uuid,passed:true,validated_at:new Date().toISOString()},null,2));
 console.log('STAGING_VALIDATED',base);
}finally{await rm(temp,{recursive:true,force:true})}
