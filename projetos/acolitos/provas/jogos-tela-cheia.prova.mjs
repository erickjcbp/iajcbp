// Somente localhost: autenticação simulada, comandos reais e replay do mesmo motor.
import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import puppeteer from 'puppeteer-core';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),C=require('../davi-core-v3.js'),root=path.resolve(import.meta.dirname,'../../..'),out=path.join(root,'materiais-paroquia/provas/navegacao-conexao');fs.mkdirSync(out,{recursive:true});const id='11111111-1111-4111-8111-111111111111';let offline=false,failSave=false,submissions=0;
const stub=`\ninitModulo=async()=>{await new Promise(r=>{if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',r,{once:true});else r();});hideSplash();return {user:{id:'${id}',email:'davi@local.test'},membership:{role:'coroinha'},conta:{id:'${id}',serve:true,nome:'Guardião'},membro:{id:'${id}',serve:true,status:'ativo',nome:'Guardião',nivel:'coroinha'}};};freshToken=async()=> 'prova-local';localStorage.setItem('nav-mode','jornada');localStorage.setItem('pwa-dismiss','1');sb.rpc=async()=>({data:[],error:null});sb.from=()=>{const q=new Proxy({then(resolve){return Promise.resolve({data:[],error:null}).then(resolve);}},{get(t,k){return k in t?t[k]:()=>q;}});return q;};`;
const server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://local');if(offline&&u.pathname.endsWith('.html')){req.socket.destroy();return;}if(u.pathname==='/api/acolito-admin'){let b='';for await(const c of req)b+=c;const p=JSON.parse(b);res.setHeader('Content-Type','application/json');if(offline||failSave&&p.action==='game_davi_finalizar_v3'){res.statusCode=503;return res.end(JSON.stringify({error:'Conexão indisponível na prova.'}));}if(p.action==='game_davi_ranking_v3')return res.end(JSON.stringify({top:[{posicao:1,nome:'Teste',pontos:950,ondas:3,eu:true}],meu:{posicao:1,pontos:950,ondas:3}}));if(p.action==='game_davi_iniciar_v3')return res.end(JSON.stringify({id,seed:9,record:0,record_wave:0,day_xp:0,versao:8}));assert.equal(p.action,'game_davi_finalizar_v3');const r=C.replay(9,p.commands,p.ticks);assert.ok(r.done);submissions++;return res.end(JSON.stringify({xp:r.xp,day_xp:r.xp,novo:submissions===1}));}const f=path.resolve(root,'.'+decodeURIComponent(u.pathname));if(!f.startsWith(root+path.sep)||!fs.existsSync(f)){res.statusCode=404;return res.end();}res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.mp3':'audio/mpeg','.json':'application/json'})[path.extname(f)]||'application/octet-stream');res.end(f.endsWith('/shared.js')?fs.readFileSync(f,'utf8')+stub:fs.readFileSync(f));}catch(e){res.statusCode=500;res.end(String(e));}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required',...(process.argv.includes('--no-webgl')?['--disable-webgl']:[])]});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>{errors.push(e.stack||e.message);console.log('PAGE ERROR',page.url(),e.stack||e.message);});await page.setRequestInterception(true);page.on('request',r=>r.url().startsWith('http://127.0.0.1:')?r.continue():r.abort());

// Tela cheia dos jogos (Tíquico e Davi): abrir pelo botão Jogar do card (?expandido=1) vai direto à tela
// cheia; abrir pelo card (sem parâmetro) mostra a área do game; e o "voltar" do sistema SAI DA TELA CHEIA
// sem sair da página (era o "às vezes volta a página").
try{
 await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
 const base=`http://127.0.0.1:${server.address().port}/projetos/acolitos/`;
 const jogos=[['davi.html','dv-shell','dv-expand','dv-play'],['games.html','game-shell','expand','play']];
 const expandido=(id)=>page.$eval('#'+id,e=>e.classList.contains('expanded'));
 const pronto=(play)=>page.waitForFunction((id)=>{const b=document.getElementById(id);return b&&!b.disabled&&/Jogar/.test(b.textContent);},{timeout:20000},play);
 for(const[arq,shell,expand,play]of jogos){
  // 1) pelo CARD: área do game, sem tela cheia
  await page.goto(base+arq,{waitUntil:'networkidle0'});await pronto(play);
  assert.equal(await expandido(shell),false,arq+' pelo card não expande');
  // 2) pelo botão JOGAR do card: já em tela cheia
  await page.goto(base+arq+'?expandido=1',{waitUntil:'networkidle0'});await pronto(play);
  assert.equal(await expandido(shell),true,arq+' ?expandido=1 abre em tela cheia');
  const url=page.url(),entradas=await page.evaluate(()=>history.length);
  // 3) "voltar" do sistema: sai da tela cheia e fica na MESMA página
  await page.evaluate(()=>history.back());await page.waitForFunction((id)=>!document.getElementById(id).classList.contains('expanded'),{timeout:5000},shell);
  assert.equal(page.url(),url,arq+' voltar não sai da página');
  assert.equal(await page.evaluate(()=>document.body.style.overflow),'',arq+' devolve a rolagem da página');
  // 4) botão expandir/recolher abre e fecha, sem empilhar histórico
  await page.click('#'+expand);assert.equal(await expandido(shell),true);
  await page.click('#'+expand);await page.waitForFunction((id)=>!document.getElementById(id).classList.contains('expanded'),{timeout:5000},shell);
  assert.equal(page.url(),url);
  // 5) Davi: "Jogar agora" dentro da página já abre em tela cheia (comportamento que já existia), e voltar só recolhe.
  //    No Tíquico o botão de dentro NÃO expande: os botões de som ficam fora do quadro do jogo.
  if(arq==='davi.html'){
   await page.click('#'+play);await page.waitForFunction((id)=>document.getElementById(id).classList.contains('expanded'),{timeout:5000},shell);
   await page.evaluate(()=>history.back());await page.waitForFunction((id)=>!document.getElementById(id).classList.contains('expanded'),{timeout:5000},shell);
   assert.equal(page.url(),url,arq+' voltar durante a partida não sai da página');
  }else{
   await page.click('#'+expand);assert.equal(await expandido(shell),true);
   await page.evaluate(()=>history.back());await page.waitForFunction((id)=>!document.getElementById(id).classList.contains('expanded'),{timeout:5000},shell);
   assert.equal(page.url(),url,arq+' voltar com a tela cheia aberta pelo botão não sai da página');
  }
  console.log(arq+' OK (entradas no histórico: '+entradas+')');
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();await new Promise(r=>server.close(r));}
