import assert from 'node:assert/strict';
import fs from 'node:fs';
import { iniciarProvas, PAPEIS } from './abrir-tela.mjs';
const destino='/Users/erickmartins/arquivos/projetos/paroquia/auditorias/2026-10-13-melhorias';
fs.mkdirSync(destino,{recursive:true});
const maria={id:'m1',nome:'Maria Clara',apelido:'Maria',nivel:'coroinha',data_nascimento:'2012-05-11',status:'ativo',serve:true,comunidade:'matriz',user_id:'u1'};
const tabelas={acolitos_membros:{data:[maria,{...maria,id:'m2',nome:'João',apelido:'João',nivel:'acolito_guardiao',data_nascimento:null}]},acolitos_listas:{data:[{tipo:'setor',valor:'secretaria',label:'Secretaria',meta:{cor:'#579bfc'}}]},acolitos_tarefas:{data:[{id:'t1',titulo:'Preparar acolhida',time_slug:'secretaria',responsavel_id:'m1',responsavel:{nome:'Maria Clara',apelido:'Maria'},prazo:'2026-10-18',recorrencia:'nenhuma'}]},acolitos_habilitacoes:{data:[]},acolitos_celebracoes:{data:[]},acolitos_modelos:{data:[]}};
const provas=await iniciarProvas();
try{
 for(const width of [360,768,1366,2560]){
  for(const [page,avaliar] of [
   ['escala',`await arteSemana();return {opcoes:[...document.querySelector('#arte-formato').options].map(o=>o.value),overflow:document.documentElement.scrollWidth>innerWidth+1};`],
   ['jornada-admin',`abaJornada='evolucao';await renderAll();const table=document.querySelector('table');return {texto:table?.innerText,overflow:document.documentElement.scrollWidth>innerWidth+1};`],
   ['tarefas',`modoVisao='tabela';render();const select=document.querySelector('.tf-board-status');const chamadas=[];aplicarTransicao=async(t,d,b)=>chamadas.push([t.id,d]);select.value='andamento';await select.onchange();return {cab:[...document.querySelectorAll('.tf-board-table th')].map(e=>e.textContent),chamadas,overflow:document.documentElement.scrollWidth>innerWidth+1};`]
  ]){
   const r=await provas.abrir(page+'.html',{papel:PAPEIS.admin,tabelas,largura:width,altura:900,avaliar:avaliar.replace('return {',"document.getElementById('splash')?.remove(); document.getElementById('pwa-banner')?.remove(); return {"),foto:{caminho:destino+'/'+page+'-melhoria-'+width+'.png'}});
   assert.deepEqual(r.erros,[]);assert.equal(r.erroAvaliar,null);assert.equal(r.avaliado.overflow,false);
   if(page==='escala')assert.deepEqual(r.avaliado.opcoes,['automatico','unica','por_dia']);
   if(page==='tarefas'){assert.deepEqual(r.avaliado.cab,['Tarefa','Responsável','Status','Prazo','Ações']);assert.deepEqual(r.avaliado.chamadas,[['t1','andamento']]);}
   if(page==='jornada-admin'){assert.match(r.avaliado.texto,/Idade/);assert.match(r.avaliado.texto,/14 anos/);assert.match(r.avaliado.texto,/Acólito Guardião/);assert.doesNotMatch(r.avaliado.texto,/Iniciantes/);}
   console.log(page,width,'OK');
  }
 }
}finally{await provas.encerrar()}
