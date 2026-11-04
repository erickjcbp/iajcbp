// Prova local da janela "Instalar o app": iPhone, Android (janela nativa), Instagram e computador. Sem dados reais.
import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import puppeteer from 'puppeteer-core';
const root=path.resolve(import.meta.dirname,'../../..'),out=path.join(root,'materiais-paroquia/provas/instalar-app'),id='11111111-1111-4111-8111-111111111111';fs.mkdirSync(out,{recursive:true});
const stub=`\ninitModulo=async()=>{hideSplash();return {user:{id:'${id}'},membership:{role:'coroinha'},conta:{id:'${id}',serve:true,nome:'João'},membro:{id:'${id}',serve:true,status:'ativo',nome:'João',nivel:'coroinha'}};};freshToken=async()=> 'prova';sb.rpc=async()=>({data:[],error:null});sb.from=()=>{const q=new Proxy({then(r){return Promise.resolve({data:[],error:null}).then(r);}},{get(t,k){return k in t?t[k]:()=>q;}});return q;};`;
const tipos={'.html':'text/html','.js':'application/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.json':'application/json'};
const server=http.createServer((req,res)=>{const u=new URL(req.url,'http://l');if(u.pathname.startsWith('/api/')){res.setHeader('Content-Type','application/json');return res.end('{}');}const f=path.resolve(root,'.'+decodeURIComponent(u.pathname));if(!f.startsWith(root+path.sep)||!fs.existsSync(f)){res.statusCode=404;return res.end();}res.setHeader('Content-Type',tipos[path.extname(f)]||'application/octet-stream');if(f.endsWith('/sw.js'))return res.end('');res.end(f.endsWith('/shared.js')?fs.readFileSync(f,'utf8')+stub:fs.readFileSync(f));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}/projetos/acolitos/index.html`;
const b=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const IPHONE='Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',ANDROID='Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
async function caso(nome,ua,w,h,antes){const p=await b.newPage();await p.setUserAgent(ua);await p.setViewport({width:w,height:h,isMobile:w<700,hasTouch:w<700,deviceScaleFactor:2});
 await p.goto(url,{waitUntil:'networkidle0'});await new Promise(r=>setTimeout(r,500));if(antes)await antes(p);
 const r=await p.evaluate(async()=>{document.getElementById('splash')?.remove();window.abrirInstalacao();await new Promise(r=>setTimeout(r,400));const ov=document.getElementById('pwa-instalar');return {aberta:!!ov,titulo:ov?.querySelector('h2')?.textContent,alvos:ov?[...ov.querySelectorAll('button')].map(x=>Math.round(x.getBoundingClientRect().height)):[],prompt:!!window.__prompted,largura:document.documentElement.scrollWidth};});
 await p.screenshot({path:path.join(out,nome+'.png')});await p.close();console.log(nome,JSON.stringify(r));return r;}
try{
 const ios=await caso('iphone-safari',IPHONE,390,844);assert.equal(ios.titulo,'Instale em 3 toques');assert.ok(ios.alvos.every(a=>a>=44));
 const insta=await caso('iphone-instagram',IPHONE+' Instagram 350.0.0',390,844);assert.equal(insta.titulo,'Abra no Safari para instalar');
 const and=await caso('android-sem-evento',ANDROID,360,780,p=>p.evaluate(()=>{window.__bip=null;}));assert.equal(and.titulo,'Instale em 2 toques');
 const nat=await caso('android-nativo',ANDROID,360,780,p=>p.evaluate(()=>{const e=new Event('beforeinstallprompt');e.prompt=()=>{window.__prompted=true;};e.userChoice=new Promise(()=>{});window.dispatchEvent(e);}));
 assert.equal(nat.prompt,true,'Android com o evento abre a janela nativa direto');assert.equal(nat.aberta,false);
 const pc=await caso('computador','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36',1366,800,p=>p.evaluate(()=>{window.__bip=null;}));assert.equal(pc.titulo,'Instalar no computador');
 [ios,insta,and,pc].forEach(r=>assert.ok(r.largura<=1366));console.log('ok');
}finally{await b.close();server.close();}
