import assert from 'node:assert/strict';import {iniciarProvas,PAPEIS} from './abrir-tela.mjs';
import fs from 'node:fs';const catalogo=JSON.parse(fs.readFileSync(new URL('./fixtures/medalhas-catalogo.json',import.meta.url)));
const dir=new URL('../../../estudos/medalhoes-integracao-2026-11-01/provas-selecao/',import.meta.url).pathname;fs.mkdirSync(dir,{recursive:true});
const membros=['m1','m2','m3'].map((id,i)=>({id,nome:'Membro '+(i+1),nivel:'coroinha',status:'ativo',serve:true}));
const p=await iniciarProvas();try{for(const largura of [360,390,768,1366,2560]){
 const r=await p.abrir('jornada-admin.html',{papel:PAPEIS.admin,largura,tabelas:{acolitos_membros:{data:membros}},rpcs:{acolitos_medalhas_catalogo:{data:catalogo}},foto:{caminho:dir+'conferencia-'+largura+'.png',seletor:'.medalhas-admin-modal'},avaliar:`
 abaJornada='evolucao';await renderAll();document.getElementById('splash')?.remove();document.getElementById('pwa-banner')?.remove();const calls=[];const original=sb.rpc;
 sb.rpc=async(n,a)=>{if(n==='acolitos_medalhas_multiplas'){calls.push(a);return {data:{ok:true,confirmado:a.p_confirmar,total_membros:a.p_membros.length,total_medalhas:a.p_medalhas.length,novas:2,existentes:0}};}return original(n,a);};
 for(const id of ['m1','m3']){const c=document.querySelector('.matriz-member-check[data-id="'+id+'"]');c.checked=true;c.onchange();}
 await [...document.querySelectorAll('.matriz-lote-bar button')].find(b=>b.textContent==='Dar medalhas').onclick();
 const modal=document.querySelector('.medalhas-admin-modal');modal.querySelector('.mg-badge').click();await modal.querySelector('.mg-footer button:last-child').onclick();
 return {calls,text:modal.innerText,overflow:document.documentElement.scrollWidth>innerWidth+1};`});
 assert.equal(r.erroAvaliar,null);assert.deepEqual(r.erros,[]);assert.equal(r.avaliado.calls.length,1,'Seleção da matriz deve ir direto à conferência');assert.deepEqual(r.avaliado.calls[0].p_membros,['m1','m3']);assert.equal(r.avaliado.calls[0].p_confirmar,false);assert.match(r.avaliado.text,/1 medalha para 2 pessoas/);assert.equal(r.avaliado.overflow,false);console.log('Dar medalhas conserva seleção e não pede nomes novamente',largura,'OK');
}}finally{await p.encerrar()}
