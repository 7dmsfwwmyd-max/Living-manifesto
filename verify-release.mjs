import {readFileSync} from 'node:fs';
const worker=readFileSync('dist/_worker.js','utf8');
const app=readFileSync('dist/app.js','utf8');
const checks=[
 ['health version',worker.includes("version:'0.5.4'")],
 ['authenticated route',worker.includes("researchDossier(req,env,researchMatch[1])")],
 ['research endpoint',worker.includes('async function researchDossier(')],
 ['AI binding',worker.includes('env.CONVERTER.run(')],
 ['D1 dossier persistence',worker.includes('learning_dossiers')],
 ['existing capture route',worker.includes("path==='/api/capture'")],
 ['existing shortcut intake',worker.includes("path==='/api/shortcut-intake'")],
 ['existing PDF analysis',worker.includes("path==='/api/analyse-file'")],
 ['existing X extraction',worker.includes('extractSourceInBackground')],
 ['existing login',worker.includes("path==='/api/login'")],
 ['deep dive button',app.includes('Generate deep dive in app')],
 ['deep dive render',app.includes('function dossierMarkup(s)')],
 ['deep dive click handler',app.includes('dataset.researchGenerate')],
 ['existing library',app.includes('function library()')],
 ['learning studio rendered',app.includes('function studioMarkup(s)')],
 ['learning dashboard rendered',app.includes('function studioOverview()')],
 ['study source connections',app.includes('lm-studio-link')],
 ['existing article detail',app.includes('function detail()')]
];
for(const [name,ok] of checks)console.log((ok?'PASS':'FAIL')+' '+name);
if(checks.some(x=>!x[1]))process.exit(1);
console.log('Release checks passed: generated app is ready for staging, not yet production validated.');
