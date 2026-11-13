import {readFile,writeFile} from 'node:fs/promises';
let worker=await readFile('dist/_worker.js','utf8');
const fields=['overview','first_principles','argument','context','connections','critique','questions'];
// Workers AI schema format: https://developers.cloudflare.com/workers-ai/features/json-mode/
// Keep validation below: provider schema compliance is not guaranteed.
const schema={type:'object',properties:{...Object.fromEntries(fields.map(k=>[k,{type:'string'}])),reading:{type:'array',items:{type:'object',properties:Object.fromEntries(['title','author','reason','level'].map(k=>[k,{type:'string'}])),required:['title','author','reason','level']}}},required:[...fields,'reading']};
const anchor="max_tokens:3400,temperature:0.25,response_format:{type:'json_object'}";
if(!worker.includes(anchor))throw Error('Deep Dive request contract anchor missing');
worker=worker.replace(anchor,"max_tokens:3400,temperature:0.25,response_format:"+JSON.stringify({type:'json_schema',json_schema:schema}));
const parser="let parsed;try{let raw=response?.response??response?.result?.response??response;parsed=typeof raw==='string'?JSON.parse(raw.trim()):raw;if(!parsed||typeof parsed!=='object'||!['overview','first_principles','argument','context','connections','critique','questions'].every(k=>typeof parsed[k]==='string'&&parsed[k].trim())||!Array.isArray(parsed.reading))throw Error('Incomplete AI response')}catch(e){console.error('Deep dive parse failed',e?.message);return failure('AI returned an incomplete dossier. Please retry.',502)}";
if(!worker.includes(parser))throw Error('Deep Dive validation anchor missing');
worker=worker.replace(parser,`let parsed;try{
 const raw=response?.response??response?.result?.response??response;
 parsed=typeof raw==='string'?JSON.parse(raw.trim()):raw;
 const validSections=parsed&&typeof parsed==='object'&&${JSON.stringify(fields)}.every(k=>typeof parsed[k]==='string'&&parsed[k].trim());
 const validReading=Array.isArray(parsed?.reading)&&parsed.reading.every(r=>r&&typeof r==='object'&&['title','author','reason','level'].every(k=>typeof r[k]==='string'));
 if(!validSections||!validReading)throw Error('Incomplete AI response');
 }catch(e){const code=e instanceof SyntaxError?'invalid_json':'invalid_schema';console.error('Deep dive validation failed',code);return json({error:'AI returned an incomplete dossier. Your saved source is unchanged.',error_code:code},502)}`);
await writeFile('dist/_worker.js',worker);
