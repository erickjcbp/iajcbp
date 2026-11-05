// Fotografa o login.html real (página pública). Sem sessão; chamadas ao Supabase são bloqueadas.
import puppeteer from '/Users/erickmartins/projetos/iajcbp/arte-escala/node_modules/puppeteer/lib/esm/puppeteer/puppeteer.js';
const b=await puppeteer.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const p=await b.newPage();await p.setViewport({width:390,height:844,deviceScaleFactor:2});await p.setRequestInterception(true);
p.on('request',r=>/supabase\.co/.test(r.url())?r.abort():r.continue());
await p.goto('http://127.0.0.1:8177/projetos/acolitos/login.html',{waitUntil:'load'});await new Promise(r=>setTimeout(r,1500));
await p.evaluate(()=>{document.getElementById('splash')?.remove();document.getElementById('pwa-banner')?.remove();[...document.querySelectorAll('body *')].filter(e=>/Instale o app/.test(e.textContent)&&getComputedStyle(e).position==='fixed').forEach(e=>e.remove());});
await p.screenshot({path:'midia/video-onboarding-app/v1-membros/telas/login.png'});
console.log(await p.evaluate(()=>['li-email','li-senha','btn-entrar'].map(i=>{const r=document.getElementById(i)?.getBoundingClientRect();return r&&[i,Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)]})));await b.close();
