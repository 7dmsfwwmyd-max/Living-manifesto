// Read-only aggregate diagnostic. Never log titles, URLs, text, tokens or raw errors.
import assert from 'node:assert/strict';
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
assert.match(account||'',/^[a-f0-9]{32}$/);assert.ok(token);
const sql=`SELECT
 CASE WHEN status IN ('ready','queued','processing','awaiting_content','awaiting_ai','failed') THEN status ELSE 'other' END AS state,
 count(*) AS records,
 sum(CASE WHEN length(trim(coalesce(title,'')))=0 THEN 1 ELSE 0 END) AS missing_title,
 sum(CASE WHEN length(trim(coalesce(body,'')))=0 THEN 1 ELSE 0 END) AS missing_text,
 sum(CASE WHEN length(trim(coalesce(body,'')))<100 THEN 1 ELSE 0 END) AS insufficient_text,
 sum(CASE WHEN length(trim(coalesce(body,'')))=0 AND length(trim(coalesce(url,'')))>0 THEN 1 ELSE 0 END) AS link_only,
 sum(CASE WHEN length(trim(coalesce(body,'')))=0 AND length(trim(coalesce(url,'')))=0 AND length(trim(coalesce(note,'')))=0 THEN 1 ELSE 0 END) AS empty_capture,
 sum(CASE WHEN length(trim(coalesce(summary,'')))>0 THEN 1 ELSE 0 END) AS has_summary,
 sum(CASE WHEN lower(coalesce(error,'')) LIKE '%403%' OR lower(coalesce(error,'')) LIKE '%blocked%' OR lower(coalesce(error,'')) LIKE '%unavailable%' THEN 1 ELSE 0 END) AS retrieval_access_issue
 FROM sources GROUP BY state`;
const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+'/d1/database/39259550-5d35-4d51-aaee-f203d33af1c9/query',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({sql}),signal:AbortSignal.timeout(30000)});
const j=await r.json();assert.ok(r.ok&&j.success,'Read-only diagnostic request failed');
console.log('SOURCE_HEALTH_COUNTS',JSON.stringify(j.result[0].results));
console.log('READ_ONLY_COMPLETE: SELECT aggregate counts only; no writes, source content, AI calls or billing changes.');
