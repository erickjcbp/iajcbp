import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
import { iniciarProvas } from './abrir-tela.mjs';
const destino=process.env.FOTOS_VISUAL || '/Users/erickmartins/arquivos/auditoria-visual-coroinhas-2026-10-10/depois';
const server=await iniciarProvas();
const browser=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-sandbox']});
const scenarios=[['login','entrar',''],['login','cadastro',"showScreen('cadastro')"],['login','cadastro-solo',"showScreen('cadastro-solo')"],['login','cadastro-familia',"showScreen('cadastro-familia')"],['login','esqueci',"showScreen('esqueci')"],['pastoral','pagina',''],['ausencias-publica','formulario',''],['ausencias-publica','tutorial','startTour()'],['novena-publica','formulario',''],['novena-publica','confirmacao',"escolher({id:'m1',nome:'Maria Clara de Oliveira Santos'});await new Promise(r=>setTimeout(r,350));document.querySelector('#cels .cel').click();document.getElementById('enviar').click();"]];
const out=[];
try{
 for(const [file,state,action] of scenarios.filter(s=>!process.env.CENARIOS_PUBLICO||process.env.CENARIOS_PUBLICO.split(',').includes(s[0]+'-'+s[1])))for(const [width,height] of [[390,844],[768,1024],[1366,900],[2560,1440]]){
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewport({width,height});await page.setRequestInterception(true);
  page.on('request',r=>{
   if(r.url().startsWith('http://127.0.0.1:')||/^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(r.url()))return r.continue();
   if(r.url().includes('.supabase.co/'))return r.respond({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS'},body:r.method()==='OPTIONS'?'':r.url().includes('acolitos_novena_publica_missas')?JSON.stringify([{id:'c1',data:'2026-10-11',horario:'10:00',tipo:'novena',comunidade:'matriz',local:'Matriz',funcoes:[{funcao:'apoio',restantes:3}]}]):r.url().includes('acolitos_ausencia_publica_celebracoes')?JSON.stringify([{id:'c1',data:'2026-10-11',horario:'10:00',tipo:'missa_comum',comunidade:'matriz'}]):'[]'});
   return r.abort();
  });
  await page.evaluateOnNewDocument(()=>{localStorage.setItem('aus_tutorial_visto','1');localStorage.setItem('pwa-dismiss','1');Object.defineProperty(navigator,'serviceWorker',{value:{controller:null,register:async()=>({update:async()=>{}}),addEventListener(){}}});});
  await page.goto('http://127.0.0.1:'+server.porta+'/projetos/acolitos/'+file+'.html',{waitUntil:'networkidle0'});
  if(file==='pastoral')await page.evaluate(async()=>{
   for(let y=0;y<document.documentElement.scrollHeight;y+=innerHeight*.8){window.scrollTo(0,y);await new Promise(r=>setTimeout(r,120));}
   window.scrollTo(0,0);await new Promise(r=>setTimeout(r,800));
  });
  const metrics=await page.evaluate(async(action)=>{
   await document.fonts.ready;
   if(action)await (new Function('return (async()=>{'+action+'})()'))();
   document.getElementById('splash')?.remove();document.getElementById('pwa-banner')?.remove();
   const visible=e=>{const r=e.getBoundingClientRect();const s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'};
   const els=[...document.querySelectorAll('button,a,input,select,textarea')].filter(visible);
   const name=e=>(e.textContent||e.placeholder||e.getAttribute('aria-label')||e.tagName).trim().slice(0,60);
   return {overflow:document.documentElement.scrollWidth>innerWidth+1,
    small:innerWidth<640?els.filter(e=>!['radio','checkbox','hidden'].includes(e.type)&&(e.getBoundingClientRect().height<43.5||e.getBoundingClientRect().width<43.5)).map(e=>name(e)):[],
    fonts:innerWidth<640?els.filter(e=>['INPUT','SELECT','TEXTAREA'].includes(e.tagName)&&!['checkbox','radio','hidden'].includes(e.type)&&parseFloat(getComputedStyle(e).fontSize)<16).map(e=>name(e)):[]};
  },action);
  await page.screenshot({path:destino+'/'+file+'-'+state+'-'+width+'.png',fullPage:true});
  out.push({id:file+'-'+state,width,...metrics,errors});console.log(file,state,width,JSON.stringify(metrics),errors);
  fs.writeFileSync(destino+'/metricas-publico'+(process.env.CENARIOS_PUBLICO?'-extras':'')+'.json',JSON.stringify(out,null,2));await page.close();
 }
}finally{await browser.close();await server.encerrar();}
if(process.env.EXIGIR_VISUAL==='1'&&out.some(r=>r.overflow||r.fonts.length||r.small.length||r.errors.length))process.exitCode=1;
