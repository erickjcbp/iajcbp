import assert from 'node:assert/strict';
import fs from 'node:fs';
import {iniciarProvas,PAPEIS} from './abrir-tela.mjs';
const dir='/Users/erickmartins/arquivos/auditorias/coroinhas/2026-10-13-rodizio-edicao';
fs.mkdirSync(dir,{recursive:true});
const pessoas=[{id:'m1',nome:'Maria Clara',nivel:'coroinha',status:'ativo',serve:true,comunidade:'matriz'},
 {id:'m2',nome:'João Pedro',nivel:'acolito_guardiao',status:'ativo',serve:true,comunidade:'matriz',suspenso_em:'2026-01-01',suspenso_ate:'2099-01-01'}];
const desenho=`membros=${JSON.stringify(pessoas)};rodizioLinhas=membros.map((m,i)=>({membro:m,vezesNoMes:0,faltas:i?2:4,semEscalar:2,semServir:2,motivo:'no_piso',ultimaServida:null}));abaAtual='rodizio';pintarAba(abaAtual);desenharRodizio();document.getElementById('splash')?.remove();document.getElementById('pwa-banner')?.remove();await new Promise(r=>setTimeout(r,450));`;
const p=await iniciarProvas();
try{for(const width of [360,768,1366,2560]){
 const cards=await p.abrir('escala.html',{papel:PAPEIS.admin,largura:width,altura:900,avaliar:desenho+`return {titulos:[...document.querySelectorAll('.rod-painel h3')].map(x=>x.textContent),botoes:[...document.querySelectorAll('.rod-editar')].map(b=>({label:b.getAttribute('aria-label'),w:b.getBoundingClientRect().width,h:b.getBoundingClientRect().height})),overflow:document.documentElement.scrollWidth>innerWidth+1,visivel:document.querySelector('.rod-painel').getBoundingClientRect().height>50};`,foto:dir+'/cards-'+width+'.png'});
 assert.deepEqual(cards.erros,[]);assert.equal(cards.erroAvaliar,null);assert.equal(cards.avaliado.botoes.length,2);assert.match(cards.avaliado.titulos.join(' '),/Quem mais faltou.*Suspensos agora/);assert.match(cards.avaliado.botoes[0].label,/Maria/);assert.match(cards.avaliado.botoes[1].label,/João/);assert.equal(cards.avaliado.overflow,false);assert.equal(cards.avaliado.visivel,true);if(width===360)for(const b of cards.avaliado.botoes){assert.ok(b.w>=44&&b.h>=44);}
 const modal=await p.abrir('escala.html',{papel:PAPEIS.admin,largura:width,altura:900,avaliar:desenho+`const botoes=[...document.querySelectorAll('.rod-editar')];botoes[0].click();await new Promise(r=>setTimeout(r,40));const primeiro=document.querySelector('.modal-overlay.open');const maria=primeiro.textContent;primeiro.querySelector('.modal-close').click();botoes[1].click();await new Promise(r=>setTimeout(r,40));const md=document.querySelector('.modal-overlay.open .modal');return {maria,joao:md.textContent,overflow:document.documentElement.scrollWidth>innerWidth+1,w:md.getBoundingClientRect().width};`,foto:{caminho:dir+'/ficha-'+width+'.png',viewport:true}});
 assert.deepEqual(modal.erros,[]);assert.equal(modal.erroAvaliar,null);assert.match(modal.avaliado.maria,/Maria Clara/);assert.match(modal.avaliado.joao,/João Pedro/);assert.match(modal.avaliado.joao,/Salvar/);assert.equal(modal.avaliado.overflow,false);if(width===360)assert.equal(Math.round(modal.avaliado.w),360);
 console.log('Cards e fichas rápidas',width,'OK');
}}finally{await p.encerrar();}
