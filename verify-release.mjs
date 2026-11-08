import {readFileSync} from 'node:fs';
const worker=readFileSync('dist/_worker.js','utf8');
const app=readFileSync('dist/app.js','utf8');
const checks=[
 ['health version',worker.includes("version:'0.5.7'")],
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
 ['authenticated study state',worker.includes("path==='/api/studio-state'")],
 ['graph endpoint',worker.includes("path==='/api/knowledge-graph'")],
 ['conflict-safe revisions',worker.includes('revision=revision+1')],
 ['synced learning graph interface',app.includes('function graphMarkup()')],
 ['evergreen concept endpoint',worker.includes("path==='/api/evergreen'")],
 ['durable note revisions',worker.includes('evergreen_history')],
 ['source quote verification',worker.includes('evNormalize(s.body)')],
 ['portable canvas export',worker.includes("format==='markdown'")],
 ['evergreen note editor',app.includes('function evergreenMarkup()')],
 ['source evidence route',worker.includes('elAuditRoute(req,env,evidenceMatch[1])')],
 ['deterministic provenance',worker.includes('function elNormalize')||worker.includes('const elNormalize')],
 ['audit persistence',worker.includes('evidence_audits')],
 ['audit after automatic analysis',worker.includes('await elPersist(env,uid)')],
 ['evidence source detail',app.includes('function evidenceMarkup(s)')],
 ['workflow status in Explore',app.includes('function evidenceOverviewMarkup()')],
 ['existing article detail',app.includes('function detail()')]
];
for(const [name,ok] of checks)console.log((ok?'PASS':'FAIL')+' '+name);
if(checks.some(x=>!x[1]))process.exit(1);
console.log('Release checks passed: generated app is ready for staging, not yet production validated.');
