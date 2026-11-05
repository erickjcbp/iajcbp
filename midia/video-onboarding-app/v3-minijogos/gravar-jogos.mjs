// Grava uma partida real de cada minijogo (Tíquico e Davi) no celular, com login simulado em servidor local.
// Nada vai à produção: a API responde daqui mesmo. Saída: telas/jogo-<nome>/0001.jpg… a 30 quadros por segundo.
// O relógio do jogo é controlado: cada quadro avança exatamente 1/30 s e é fotografado, então o vídeo sai liso.
// Roda da raiz do repositório: node midia/video-onboarding-app/v3-minijogos/gravar-jogos.mjs
import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import puppeteer from 'puppeteer-core';
const root=path.resolve('.'),out=path.resolve('midia/video-onboarding-app/v3-minijogos/telas'),id='11111111-1111-4111-8111-111111111111';
const stub=`\ninitModulo=async()=>{await new Promise(r=>{if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',r,{once:true});else r();});hideSplash();return {user:{id:'${id}',email:'video@local.test'},membership:{role:'coroinha'},conta:{id:'${id}',serve:true,nome:'João'},membro:{id:'${id}',serve:true,status:'ativo',nome:'João',nivel:'coroinha'}};};freshToken=async()=> 'video-local';localStorage.setItem('nav-mode','jornada');localStorage.setItem('pwa-dismiss','1');sb.rpc=async()=>({data:[],error:null});sb.from=()=>{const q=new Proxy({then(resolve){return Promise.resolve({data:[],error:null}).then(resolve);}},{get(t,k){return k in t?t[k]:()=>q;}});return q;};`;
const api={game_iniciar_v5:{id,seed:9,record:0,day_xp:0},game_ranking_v5:{top:[],meu:null,participantes:0},game_finalizar_v5:{xp:20,day_xp:20,novo:true},
 game_davi_iniciar_v3:{id,seed:9,record:0,record_wave:0,day_xp:0,versao:8},game_davi_ranking_v3:{top:[],meu:null},game_davi_finalizar_v3:{xp:20,day_xp:20,novo:true}};
const tipos={'.html':'text/html','.js':'application/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.mp3':'audio/mpeg','.json':'application/json','.woff2':'font/woff2'};
const server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://local');
 if(u.pathname==='/api/acolito-admin'){let b='';for await(const c of req)b+=c;const p=JSON.parse(b);res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(api[p.action]||{}));}
 const f=path.resolve(root,'.'+decodeURIComponent(u.pathname));if(!f.startsWith(root+path.sep)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
 res.setHeader('Content-Type',tipos[path.extname(f)]||'application/octet-stream');if(f.endsWith('/sw.js'))return res.end('//desligado na gravação');
 res.end(f.endsWith('/shared.js')?fs.readFileSync(f,'utf8')+stub:fs.readFileSync(f));}catch(e){res.statusCode=500;res.end(String(e));}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}/projetos/acolitos/`;
const browser=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required','--mute-audio']});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

// Relógio controlado: até __manual() o jogo roda normal; depois só anda quando __tick(ms) é chamado.
const relogio=()=>{let live=true,vt=0;const q=[],raw=performance.now.bind(performance),rawRaf=requestAnimationFrame.bind(window);
 performance.now=()=>live?raw():vt;
 window.requestAnimationFrame=cb=>{if(live)return rawRaf(t=>live?cb(t):q.push(cb));q.push(cb);return q.length;};
 window.__manual=()=>{vt=raw();live=false;};
 window.__tick=ms=>{vt+=ms;if(window.__antes)window.__antes();q.splice(0).forEach(cb=>cb(vt));};};

async function abrir(pagina,extra){const p=await browser.newPage();await p.setViewport({width:390,height:717,isMobile:true,hasTouch:true,deviceScaleFactor:2});
 p.on('pageerror',e=>console.log('ERRO',pagina,e.message));
 await p.evaluateOnNewDocument(()=>{try{localStorage.setItem('pwa-dismiss','1');localStorage.setItem('davi-voice','0');}catch(_){}});
 await p.evaluateOnNewDocument(relogio);if(extra)await p.evaluateOnNewDocument(extra);
 await p.goto(base+pagina,{waitUntil:'networkidle0',timeout:90000});return p;}

async function gravar(p,nome,segundos,acao){const dir=path.join(out,'jogo-'+nome);fs.rmSync(dir,{recursive:true,force:true});fs.mkdirSync(dir,{recursive:true});
 await p.evaluate(()=>window.__manual());const total=Math.round(segundos*30);
 for(let i=0;i<total;i++){if(acao)await acao(i);await p.evaluate(()=>window.__tick(1000/30));
  await p.screenshot({path:path.join(dir,String(i+1).padStart(4,'0')+'.jpg'),type:'jpeg',quality:88});}
 console.log(nome,'quadros',total);}

const so=process.argv[2];
try{
 if(!so||so==='tiquico'){
 // Tíquico: corrida pelas ruas; pula a introdução e desvia com as setas
 const p1=await abrir('games.html');await p1.waitForFunction(()=>!document.getElementById('play').disabled,{timeout:90000});
 // a introdução narrada pode falhar sem som: clica até a corrida começar
 for(let k=0;k<8&&!(await p1.$eval('#game-overlay',o=>o.hidden));k++){await p1.click('#play').catch(()=>{});await sleep(1200);console.log('tentativa',k,JSON.stringify(await p1.evaluate(()=>({b:document.getElementById('play').textContent,d:document.getElementById('play').disabled,t:document.getElementById('overlay-title').textContent,h:document.getElementById('game-overlay').hidden,skip:!document.getElementById('skip-intro').hidden}))));}
 await p1.waitForFunction(()=>document.getElementById('game-overlay').hidden,{timeout:20000});await sleep(1500);
 const teclas=['ArrowUp','ArrowLeft','ArrowUp','ArrowRight','ArrowDown','ArrowUp','ArrowRight','ArrowLeft'];
 await gravar(p1,'tiquico',9,async i=>{if(i%21===10)await p1.keyboard.press(teclas[(i/21|0)%teclas.length]);});
 await p1.close();
 }
 if(!so||so==='davi'){

 // Davi: o piloto automático do teste do jogo mira e protege o rebanho a cada quadro
 const piloto=()=>{window.__antes=()=>{const s=window.__run,c=document.getElementById('dv-canvas');if(!s||!c||!window.__pilot)return;const e=s.enemies.slice().sort((a,b)=>(b.carry>=0)-(a.carry>=0)||b.y-a.y)[0],r=c.getBoundingClientRect();if(!e)return;const travel=Math.max(12,Math.ceil(Math.hypot(e.x-500,e.y-855)/18)),x=Math.max(0,Math.min(1000,e.x+e.vx*travel)),y=Math.max(0,Math.min(1000,e.y+e.vy*travel)),o={bubbles:true,cancelable:true,isPrimary:true,pointerId:77,pointerType:'touch',clientX:r.left+(500+(500-x)/4.5)/1000*r.width,clientY:r.top+(820+(855-y)*.68/4.5)/1000*r.height};if(s.charge<0&&s.cooldown===0)c.dispatchEvent(new PointerEvent('pointerdown',{...o,clientX:r.left+r.width*.5,clientY:r.top+r.height*.82}));else if(s.charge>=0){c.dispatchEvent(new PointerEvent('pointermove',o));if(s.charge>=(e.carry>=0?1:e.hp>1?32:3))c.dispatchEvent(new PointerEvent('pointerup',o));}};};
 const p2=await abrir('davi.html',piloto);await p2.waitForFunction(()=>document.getElementById('dv-play').textContent==='Jogar agora',{timeout:90000});
 await p2.evaluate(()=>{const step=DaviCore.step;DaviCore.step=(s,a)=>{const r=step(s,a);window.__run=s;return r;};document.getElementById('dv-canvas').setPointerCapture=()=>{};});
 for(let k=0;k<8&&!(await p2.$eval('#dv-overlay',o=>o.hidden));k++){await p2.click('#dv-play').catch(()=>{});await sleep(1200);console.log('davi',k,await p2.$eval('#dv-play',b=>b.textContent));}
 await p2.waitForFunction(()=>document.getElementById('dv-overlay').hidden,{timeout:20000});
 await p2.evaluate(()=>window.__pilot=true);await sleep(2500);
 await gravar(p2,'davi',9);
 await p2.close();
 }
}finally{await browser.close();server.close();}
