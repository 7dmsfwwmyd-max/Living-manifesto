// Display fallback only: never overwrite the author's stored title or fetch a URL.
function sourceLabel(s){
 const title=String(s?.title||'').trim();if(title&&!/^(untitled(?: source)?|undefined|null)$/i.test(title))return title.slice(0,240);
 if(s?.url)try{
  const u=new URL(s.url);if(['http:','https:'].includes(u.protocol)){
   const host=u.hostname.replace(/^www\./,'');
   if(['x.com','twitter.com','mobile.twitter.com'].includes(host)){const parts=u.pathname.split('/').filter(Boolean);const pos=parts.indexOf('status');if(pos>0)return 'X post · @'+parts[pos-1]+' · '+(parts[pos+1]||'');return 'X link · '+u.pathname.slice(1)}
   if(['youtube.com','youtu.be','m.youtube.com'].includes(host))return 'YouTube video · '+(u.searchParams.get('v')||u.pathname.split('/').filter(Boolean).pop()||'saved link');
   let path=u.pathname;try{path=decodeURIComponent(path)}catch{}
   return (host+(path==='/'?'':path)).slice(0,220);
  }
 }catch{}
 const text=String(s?.note||s?.body||s?.summary||'').trim().replace(/\s+/g,' ');
 return text?'Saved text · '+text.slice(0,100):'Incomplete capture · '+String(s?.id||'').slice(-8);
}
