// Renderiza quadros do HTML (tempo controlado) com o Chrome do puppeteer da arte-escala.
import puppeteer from '/Users/erickmartins/projetos/iajcbp/arte-escala/node_modules/puppeteer/lib/esm/puppeteer/puppeteer.js';
import fs from 'node:fs';const FPS=30,args=process.argv.slice(2),modo=args[0]||'todos';
const T=JSON.parse(fs.readFileSync('tempos.json'));
const b=await puppeteer.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox','--font-render-hinting=none']});
const p=await b.newPage();await p.setViewport({width:1080,height:1920,deviceScaleFactor:1});
await p.goto('file://'+process.cwd()+'/index.html',{waitUntil:'networkidle0'});await p.evaluate(()=>window.ready);
fs.mkdirSync('quadros',{recursive:true});
const tempos=modo==='amostra'?T.cenas.flatMap(c=>[c.inicio+1.6,c.frases[0].inicio+1.0,c.fim-1.0]):[...Array(Math.ceil(T.total*FPS)).keys()].map(i=>i/FPS);
let i=0;for(const t of tempos){await p.evaluate(t=>window.seek(t),t);
 await p.screenshot({path:modo==='amostra'?`quadros/amostra-${String(i).padStart(2,'0')}.jpg`:`quadros/q${String(i).padStart(5,'0')}.jpg`,type:'jpeg',quality:92});i++;}
await b.close();console.log('quadros',i);
