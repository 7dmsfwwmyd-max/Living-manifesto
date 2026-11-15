import {readFile,writeFile} from 'node:fs/promises';
let w=await readFile('dist/_worker.js','utf8'),a=await readFile('dist/app.js','utf8');
function replace(s,n,v){if(!s.includes(n))throw Error('Mental models anchor missing: '+n.slice(0,100));return s.replace(n,()=>v)}
w=replace(w,'async function handle(req,env,ctx)',(await readFile('features/mental-models-seeds.js','utf8'))+'\n'+(await readFile('features/mental-models-worker.js','utf8'))+'\nasync function handle(req,env,ctx)');
w=replace(w," if(path==='/api/session'"," if(path==='/api/mental-models'||path.startsWith('/api/mental-models/'))return mmRoute(req,env,path);\n if(path==='/api/session'");
w=replace(w,'const out={source_learning:',"const hasModels=await mmExists(env);const out={mental_models:await mmList(env),mental_model_history:hasModels?await rows(env.DB.prepare('SELECT * FROM mental_model_history')):[],source_learning:");
w=replace(w,"version:'0.5.13'","version:'0.5.14'");
a=replace(a,"['Today','Library','Explore','Manifesto','Think']","['Today','Library','Models','Explore','Manifesto','Think']");
a=replace(a,"const ICON={Today:","const ICON={Models:'◈',Today:");
a=replace(a,'({Today:today,Library:library,Explore:explore','({Today:today,Library:library,Models:mentalModels,Explore:explore');
a=replace(a,'start();',(await readFile('features/mental-models-app.js','utf8'))+'\nstart();');a=a.replaceAll('v0.5.13','v0.5.14');
let css=await readFile('dist/styles.css','utf8');css=replace(css,'.mobile-nav{display:grid;grid-template-columns:repeat(5,1fr)', '.mobile-nav{display:grid;grid-template-columns:repeat(6,1fr)');
await writeFile('dist/styles.css',css);await writeFile('dist/_worker.js',w);await writeFile('dist/app.js',a);
