import assert from 'node:assert/strict';
const base=process.env.APP_URL;
if(!base||!base.startsWith('https://'))throw Error('Set APP_URL to the verified HTTPS route');
const expected=process.env.EXPECTED_SHA;
if(!expected)throw Error('EXPECTED_SHA is required');
async function get(path,cookie=''){const r=await fetch(new URL(path,base),{headers:{cookie,'Cache-Control':'no-cache'},redirect:'error',signal:AbortSignal.timeout(30000)});assert.equal(r.status,200,'HTTP failure at '+path);return r}
const health=await (await get('/api/health')).json();assert.equal(health.version,'0.5.4');assert.equal(health.commit,expected);
const release=await (await get('/release.json')).json();assert.equal(release.commit,expected);assert.equal(release.version,health.version);
for(const path of ['/','/app.js','/styles.css','/service-worker.js'])await get(path);
assert.equal((await fetch(new URL('/api/sources',base),{redirect:'error'})).status,401);
if(!process.env.APP_PASSWORD)throw Error('APP_PASSWORD required for authenticated health checks');
let login;for(let attempt=0;attempt<4;attempt++){login=await fetch(new URL('/api/login',base),{method:'POST',headers:{'X-Manifesto-Request':'1','Content-Type':'application/json'},body:JSON.stringify({password:process.env.APP_PASSWORD}),redirect:'error'});if(login.status===200||login.status!==401)break;await new Promise(r=>setTimeout(r,5000));}assert.equal(login.status,200,'Login failed');
const cookie=login.headers.get('set-cookie')?.split(';')[0];assert.ok(cookie);
const {sources}=await (await get('/api/sources',cookie)).json();assert.ok(Array.isArray(sources));
for(const source of sources.slice(0,3)){const detail=await (await get('/api/sources/'+source.id,cookie)).json();assert.equal(detail.source.id,source.id);await get('/api/sources/'+source.id+'/learning-dossier',cookie)}
console.log('PASS version, commit, assets, authentication, library and saved dossier reads. External ingestion and real AI generation require staging E2E validation.');
