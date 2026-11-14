import {readFile,writeFile} from 'node:fs/promises';
let w=await readFile('dist/_worker.js','utf8'),a=await readFile('dist/app.js','utf8');
const replace=(s,n,v)=>{if(!s.includes(n))throw Error('Today repair anchor missing: '+n);return s.replace(n,()=>v)};
const labels=await readFile('features/source-label.js','utf8');w=labels+'\n'+w;
// Keep the supplied share title even if extraction fails. An extracted title
// still takes precedence when available; existing analysed records are untouched.
w=replace(w,".bind(uid,url,url?'':fileName,info.kind", ".bind(uid,url,url?clean(p.title,240):fileName,info.kind");
w=replace(w,"let body=supplied, title=url?'':fileName", "let body=supplied, title=url?clean(p.title,240):fileName");
a=replace(a,"const ready=pick(x=>x.status==='ready'), pending=pick(x=>x.status!=='ready')", "const ready=pick(x=>x.status==='ready'&&Number(x.body_length||0)>=40), pending=pick(x=>x.status!=='ready'||Number(x.body_length||0)<40)");
a=a.replace("newest.title||'Newly analysed source'",'sourceLabel(newest)');
a=replace(a,'start();',labels+`\nconst repairSourceRow=sourceRow;
sourceRow=function(s){return repairSourceRow({...s,title:sourceLabel(s)})};
const repairDetail=detail;
detail=function(){
 const s=state.detail?.source;if(!s)return repairDetail();
 const text=String(s.body||'');
 const reader='<article class="card" style="margin:16px 0" aria-label="Saved source text"><h2>Saved source text</h2>'+(text.trim()?'<details data-source-reader="1"><summary>Read saved text ('+text.length.toLocaleString()+' characters)</summary><p class="small muted">This is the stored extraction or supplied text, not an AI summary. It may be incomplete.</p><div style="white-space:pre-wrap;overflow-wrap:anywhere;max-height:65vh;overflow:auto;padding:12px 0">'+esc(text)+'</div></details>':'<p>No source text is stored for this capture. The link may be saved even when retrieval fails. Open the original source and use Add or replace text below to supply readable text.</p>')+'</article>';
 return reader+repairDetail();
};
start();`);
w=replace(w,"version:'0.5.11'","version:'0.5.12'");a=a.replaceAll('v0.5.11','v0.5.12');
await writeFile('dist/_worker.js',w);await writeFile('dist/app.js',a);
