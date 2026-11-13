function ktQuality(s){
 const n=Number(s.body_length||0),r=String(s.retrieval||'');
 const video=/https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\//i.test(s.url||'');
 let label,detail;
 if(!n){label=video?'Video link only':'No saved text';detail=video?'No transcript is stored. A title or link cannot support a full-video analysis.':'Capture source text before relying on an analysis.'}
 else if(n<100){label='Very limited text';detail='Fewer than 100 characters are saved; this cannot support a substantive source analysis.'}
 else if(r==='supplied'){label='Supplied text';detail='You supplied this text. Completeness of the original has not been independently verified.'}
 else if(r.startsWith('pdf_')){label='PDF extraction';detail='Pages, figures, tables or formatting may be missing.'}
 else if(r.startsWith('x_')){label='X text / excerpt';detail='Threads, quoted posts and linked articles may be missing.'}
 else{label='Extracted text';detail='Saved text is available; this does not establish that the full original was retrieved.'}
 return {label,detail,characters:n,analysis_status:s.status,analysis_context_limited:n>10000,complete_verified:false};
}
