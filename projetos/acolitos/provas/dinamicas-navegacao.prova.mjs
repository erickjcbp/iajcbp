import puppeteer from 'puppeteer-core';import assert from 'node:assert/strict';import fs from 'node:fs';import {rpc,sql} from './quiz-db.mjs';
const out='/Users/erickmartins/projetos/iajcbp/materiais-paroquia/provas/quiz-catolico-validacao/navegacao-v3';fs.mkdirSync(out,{recursive:true});
const estado=rpc('iniciar_temporada',{retiro_id:'dddddddd-dddd-4ddd-8ddd-dddddddddddd'});
const browser=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,userDataDir:out+'/chrome-'+Date.now()});
const page=await browser.newPage();page.setDefaultTimeout(10000);const erros=[];page.on('pageerror',e=>erros.push(e.message));
let leituras=0,navegacoes=0,liberar;const gate=new Promise(r=>liberar=r);
await page.setRequestInterception(true);page.on('request',async req=>{
 if(req.isNavigationRequest()&&req.frame()===page.mainFrame())navegacoes++;
 if(req.url().includes('/__quiz_test/'))leituras++;
 if(req.url().includes('/api/acolito-admin')&&JSON.parse(req.postData()||'{}').action==='quiz_config'){await gate;return req.respond({status:200,contentType:'application/json',body:JSON.stringify({operacional:true})});}
 return req.continue();
});
async function click(t){await page.evaluate(t=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent===t&&!b.disabled);if(!b)throw Error('Botão ausente: '+t);b.click();},t);await new Promise(r=>setTimeout(r,120));}
try{
 await page.goto('http://127.0.0.1:5189/projetos/acolitos/quizzes.html?gincana='+estado.gincana.id,{waitUntil:'domcontentloaded'});await page.waitForSelector('#quiz-score');
 assert.ok(await page.$('#quiz-score'));console.log('✔ entrada mostra conteúdo sem esperar a consulta de IA');liberar();
 const antes=leituras;const score=await page.$('#quiz-score');await new Promise(r=>setTimeout(r,2300));assert.equal(await score.evaluate(n=>n.isConnected),true,'poll sem mudanças preserva o DOM');
 const depoisDoPoll=leituras;
 await click('Quizzes');await page.waitForSelector('.din-library');assert.equal(leituras,depoisDoPoll,'trocar aba não refaz consultas');
 await click('Gestão');await click('Quizzes');assert.equal(leituras,depoisDoPoll);const navegaAntes=navegacoes;
 await page.evaluate(()=>document.querySelector('#app-nav [data-id=quizzes]').click());await new Promise(r=>setTimeout(r,150));assert.equal(navegacoes,navegaAntes,'clicar no módulo atual não recarrega');
 const href=await page.$eval('#app-nav [data-id=quizzes]',n=>n.href); // link é montado antes de lembrar a aba; em outra tela deve refletir a rota salva.
 const rota=await page.evaluate(()=>sessionStorage.getItem('dinamicas-rota-11111111-1111-4111-8111-111111111111'));assert.ok(rota.includes('aba=biblioteca'));
 await page.reload({waitUntil:'domcontentloaded'});await page.waitForSelector('.din-library');assert.ok(await page.$('.din-library'));
 await page.evaluate(()=>renderBottomNav({user:{id:'11111111-1111-4111-8111-111111111111',email:'prova@local.test'},membership:{role:'coord_admin'},membro:null,conta:null},'retiros'));
 assert.ok((await page.$eval('#app-nav [data-id=quizzes]',n=>n.href)).includes('aba=biblioteca'));
 await Promise.all([page.waitForNavigation({waitUntil:'domcontentloaded'}),page.evaluate(()=>document.querySelector('#app-nav [data-id=quizzes]').click())]);await page.waitForSelector('.din-library');
 console.log('✔ abas locais, módulo atual sem reload e rota preservada no menu de outra seção');
 await click('Conduzir quiz');const b=await page.$('button');await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Conduzir rodada').click());await page.waitForSelector('.din-stage');
 assert.equal(await page.$eval('#app-nav',n=>getComputedStyle(n).display==='none'),false,'menu principal visível na condução');
 for(const [nome,width,height] of [['celular',390,844],['tablet',768,1024],['notebook',1366,900],['tv',2560,1440]]){
  await page.setViewport({width,height});await page.screenshot({path:out+'/conducao-'+nome+'.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 }
 await click('Sair da condução');await click('Placar');await page.waitForSelector('#quiz-score');
 for(const [nome,width,height] of [['celular',390,844],['tablet',768,1024],['notebook',1366,900],['tv',2560,1440]]){
  await page.setViewport({width,height});await page.screenshot({path:out+'/placar-'+nome+'.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 }
 assert.deepEqual(erros,[]);console.log(JSON.stringify({ok:true,erros,navegacoes,larguras:[390,768,1366,2560]}));
}finally{liberar();await browser.close();}
