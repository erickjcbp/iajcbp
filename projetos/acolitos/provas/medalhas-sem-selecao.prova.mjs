// Evolução › Medalhas: o botão "Dar medalhas" funciona SEM membro marcado antes. A coordenação olha as
// medalhas primeiro e só depois escolhe quem recebe (uma, duas ou várias pessoas). Antes, a barra de
// ações em lote desabilitava o botão enquanto a seleção estivesse vazia.
import assert from 'node:assert/strict';import {iniciarProvas,PAPEIS} from './abrir-tela.mjs';
import fs from 'node:fs';const catalogo=JSON.parse(fs.readFileSync(new URL('./fixtures/medalhas-catalogo.json',import.meta.url)));
const membros=['m1','m2','m3'].map((id,i)=>({id,nome:'Membro '+(i+1),nivel:'coroinha',status:'ativo',serve:true}));
const p=await iniciarProvas();try{for(const largura of [360,390,768,1366,2560]){
 const r=await p.abrir('jornada-admin.html',{papel:PAPEIS.admin,largura,tabelas:{acolitos_membros:{data:membros}},rpcs:{acolitos_medalhas_catalogo:{data:catalogo}},avaliar:`
 abaJornada='evolucao';await renderAll();document.getElementById('splash')?.remove();document.getElementById('pwa-banner')?.remove();
 const dormir=(ms)=>new Promise(ok=>setTimeout(ok,ms));const calls=[];const original=sb.rpc;
 sb.rpc=async(n,a)=>{if(n==='acolitos_medalhas_multiplas'){calls.push(a);return {data:{ok:true,confirmado:a.p_confirmar,total_membros:a.p_membros.length,total_medalhas:a.p_medalhas.length,novas:a.p_membros.length,existentes:0}};}return original(n,a);};
 const barra=()=>[...document.querySelectorAll('.matriz-lote-bar button')];
 const botao=(t)=>barra().find(b=>b.textContent===t);
 const saida={};
 // 1) nenhum membro marcado: Dar medalhas habilitado; as edições em lote seguem travadas
 saida.selecionados=document.querySelectorAll('.matriz-member-check:checked').length;
 saida.medalhasHabilitado=botao('Dar medalhas').disabled===false;
 saida.nivelTravado=botao('Alterar nível').disabled===true;
 // 2) abre o assistente pelas medalhas, escolhe uma, e SÓ ENTÃO escolhe as pessoas
 botao('Dar medalhas').click();await dormir(150);
 const modal=document.querySelector('.medalhas-admin-modal');
 saida.abriu=!!modal;saida.tituloPasso1=modal.querySelector('h2,h3,.mg-title')?.textContent||modal.innerText.slice(0,80);
 modal.querySelector('.mg-badge').click();
 await modal.querySelector('.mg-footer button:last-child').onclick();await dormir(150);
 saida.passo2=/quem vai receber/i.test(modal.innerText);
 saida.pessoasListadas=modal.querySelectorAll('.mg-person input').length;
 for(const id of ['m1','m2']){const c=modal.querySelector('.mg-person input[value="'+id+'"]');c.checked=true;c.onchange();}
 await modal.querySelector('.mg-footer button:last-child').onclick();await dormir(150);
 saida.conferiu=calls.length===1?calls[0].p_membros:calls;
 saida.confirmado=calls[0]?.p_confirmar;
 saida.overflow=document.documentElement.scrollWidth>innerWidth+1;
 return saida;`});
 assert.equal(r.erroAvaliar,null,String(r.erroAvaliar));assert.deepEqual(r.erros,[]);const a=r.avaliado;
 assert.equal(a.selecionados,0,'ninguém marcado');
 assert.equal(a.medalhasHabilitado,true,'Dar medalhas habilitado sem seleção ('+largura+')');
 assert.equal(a.nivelTravado,true,'Alterar nível continua exigindo seleção');
 assert.equal(a.abriu,true,'o assistente abre');
 assert.equal(a.passo2,true,'depois das medalhas vem "Quem vai receber?"');
 assert.equal(a.pessoasListadas,3,'todos os membros aparecem para marcar');
 assert.deepEqual(a.conferiu,['m1','m2'],'concede às pessoas escolhidas depois');
 assert.equal(a.confirmado,false,'primeiro confere, ainda não concede');
 assert.equal(a.overflow,false);
 console.log('Dar medalhas sem seleção prévia',largura,'OK');
}}finally{await p.encerrar()}
