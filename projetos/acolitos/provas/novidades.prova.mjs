import assert from 'node:assert/strict';import fs from 'node:fs';import {iniciarProvas,PAPEIS} from './abrir-tela.mjs';
const dir=new URL('../../../materiais-paroquia/provas/novidades/',import.meta.url).pathname;fs.mkdirSync(dir,{recursive:true});const p=await iniciarProvas();
try{for(const largura of [360,390,768,1366,2560]){
 const r=await p.abrir('index.html',{papel:PAPEIS.membro,largura,altura:largura>1000?1000:844,foto:{caminho:dir+largura+'.png',viewport:true},avaliar:`
 document.getElementById('splash')?.remove();document.getElementById('pwa-banner')?.remove();
 const m={id:'novidades-prova',serve:true,nivel:'coroinha',nivel_visto:'coroinha',avisos:[]},key='acolitos-novidades-'+m.id+'-2026-11-03';localStorage.removeItem(key);sessionStorage.setItem('cadastro-prompt-'+m.id,'1');
 let seguinte=0;enqueueNotif(-10,done=>{seguinte++;done();});queueNotificacoes(m);await new Promise(r=>setTimeout(r,80));
 const auto=!!document.querySelector('.novidades-dialog'),antes=document.body.style.overflow;
 const md=document.querySelector('.novidades-dialog'),bounds=md.getBoundingClientRect(),touch=[...md.querySelectorAll('a,button')].every(e=>e.getBoundingClientRect().height>=44);
 const hrefs=[...md.querySelectorAll('a')].map(e=>e.getAttribute('href')),texto=md.innerText;
 md.querySelector('.novidades-close').click();await new Promise(r=>setTimeout(r,150));
 const visto=localStorage.getItem(key)==='1',fechou=!document.querySelector('.novidades-dialog')&&document.body.style.overflow!=='hidden';
 enfileirarNovidades(m);_notifStart();const repetiu=!!document.querySelector('.novidades-dialog');
 enfileirarNovidades({id:'pendente',serve:true,_crmEtapa:'aprovacao_cadastro'});enfileirarNovidades({id:'sem-servico',serve:false});_notifStart();const bloqueados=!document.querySelector('.novidades-dialog');
 document.querySelector('.novidades-atalho').click();await new Promise(r=>setTimeout(r,100));const manual=!!document.querySelector('.novidades-dialog');document.querySelector('.novidades-overlay')._acResolveClose();await new Promise(r=>setTimeout(r,150));const voltou=!document.querySelector('.novidades-dialog');
 document.querySelector('.novidades-atalho').click();await new Promise(r=>setTimeout(r,100));const focusables=[...document.querySelectorAll('.novidades-dialog a,.novidades-dialog button')];focusables.at(-1).focus();focusables.at(-1).dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}));const foco=document.activeElement===focusables[0];
 return {auto,touch,width:bounds.width,height:bounds.height,viewport:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth||[...md.querySelectorAll('a,button')].some(e=>e.getBoundingClientRect().right>innerWidth),visto,fechou,seguinte,repetiu,bloqueados,manual,voltou,foco,hrefs,texto};`});
 assert.deepEqual(r.erros,[]);assert.equal(r.erroAvaliar,null);const a=r.avaliado;for(const k of ['auto','touch','visto','fechou','bloqueados','manual','voltou','foco'])assert.equal(a[k],true,k+' '+largura);assert.equal(a.seguinte,1);assert.equal(a.repetiu,false);assert.equal(a.overflow,false);assert.ok(a.width>=largura-100,'largura fluida');if(largura<700)assert.equal(a.width,largura);assert.ok(a.hrefs.includes('games.html'));assert.match(a.texto,/1.500 m/);assert.doesNotMatch(a.texto,/Vai ficar sem XP/);console.log(JSON.stringify({largura,...a,texto:undefined}));
}
 const persistiu=await p.abrir('index.html',{papel:PAPEIS.membro,avaliar:`
 enfileirarNovidades({id:'novidades-prova',serve:true});_notifStart();const antiga=!document.querySelector('.novidades-dialog');
 enfileirarNovidades({id:'outro-perfil',serve:true});_notifStart();const outro=!!document.querySelector('.novidades-dialog');document.querySelector('.novidades-overlay')._acResolveClose();
 return {antiga,outro};`});assert.equal(persistiu.erroAvaliar,null);assert.deepEqual(persistiu.avaliado,{antiga:true,outro:true});assert.deepEqual(persistiu.erros,[]);console.log('Persistencia entre acessos e separacao de perfis OK');
}finally{await p.encerrar();}
