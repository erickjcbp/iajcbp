// Home: a barra de progresso até o próximo nível mostra o andamento (capítulo em curso), não fica sempre
// vazia. Caso real (05/11/2026): "a barrinha de XP sempre tá vazia".
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {iniciarProvas,PAPEIS} from './abrir-tela.mjs';
const out=new URL('../../../estudos/rank-barra-xp-2026-11-05/',import.meta.url).pathname;fs.mkdirSync(out,{recursive:true});
const m=(o)=>({obrigatoria:true,status:'pendente',atual:0,alvo:null,...o});
const board=(caps)=>({nivel:'coroinha',proximo_nivel:'acolito_aspirante',xp_total:140,capitulos:caps,bonus:[],pendencias:[],elegivel:false});
const emAndamento=board([{capitulo:1,completo:false,missoes:[m({status:'concluida'}),m({status:'concluida'}),m({}),m({})]},{capitulo:2,completo:false,missoes:[m({})]},{capitulo:3,completo:false,missoes:[m({})]}]);
const zerado=board([{capitulo:1,completo:false,missoes:[m({}),m({})]},{capitulo:2,completo:false,missoes:[m({})]}]);
const medir=`document.getElementById('splash')?.remove();await new Promise(r=>setTimeout(r,1800));document.querySelectorAll('#tutorial-guiado,.tg-balao,.tg-foco').forEach(n=>n.remove());
 const fill=document.querySelector('.rank-fill'),bar=document.querySelector('.rank-bar');if(!fill)return {semBarra:true};
 const caixa=bar.getBoundingClientRect().width;
 return {pct:fill.style.getPropertyValue('--pct'),largura:Math.round(fill.getBoundingClientRect().width),caixa:Math.round(caixa),
  aria:bar.getAttribute('aria-valuenow'),papel:bar.getAttribute('role'),texto:document.querySelector('.rank-card')?.innerText||''};`;
const env=await iniciarProvas();
try{
 for(const largura of [360,390,768,1366,2560]){
  const r=await env.abrir('index.html',{papel:PAPEIS.membro,largura,rpcs:{acolitos_missoes_board:{data:emAndamento}},foto:{caminho:out+'barra-'+largura+'.png',seletor:'.rank-card'},avaliar:medir});
  assert.equal(r.erroAvaliar,null,String(r.erroAvaliar));assert.deepEqual(r.erros,[]);const a=r.avaliado;
  assert.ok(!a.semBarra,'a barra existe ('+largura+')');
  // 2 de 4 missões no capítulo 1 de 3 capítulos: (0 + 0,5)/3 = 17%
  assert.equal(a.pct,'17%','largura da barra reflete o andamento');
  assert.ok(a.largura>0&&a.largura<a.caixa,'a barra está parcialmente cheia ('+a.largura+'/'+a.caixa+')');
  assert.equal(a.papel,'progressbar');assert.equal(a.aria,'17');
  assert.match(a.texto,/2\/4 missões do capítulo atual/i,'o texto diz onde a pessoa está');
  console.log('Barra de XP com andamento',largura,'OK');
 }
 const z=await env.abrir('index.html',{papel:PAPEIS.membro,largura:390,rpcs:{acolitos_missoes_board:{data:zerado}},avaliar:medir});
 assert.equal(z.erroAvaliar,null);assert.equal(z.avaliado.pct,'0%');assert.equal(z.avaliado.largura,0,'quem não começou vê a barra vazia (e só essa pessoa)');
 console.log('Quem ainda não começou: barra vazia OK');
}finally{await env.encerrar()}
