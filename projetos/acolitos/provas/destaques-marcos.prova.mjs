// Destaques › cartão de outro membro: o NÍVEL e o MARCO DE TEMPO DE PASTORAL têm o mesmo peso visual —
// dois painéis do mesmo tamanho, selo grande, rótulo e título em destaque. Antes o nível era uma linha de
// texto pequena e o medalhão de tempo, um selinho no canto do avatar.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {iniciarProvas,PAPEIS} from './abrir-tela.mjs';
const out=new URL('../../../estudos/destaques-marcos-2026-11-05/',import.meta.url).pathname;fs.mkdirSync(out,{recursive:true});
const membro={nome:'Maria Clara',nome_completo:'Maria Clara de Oliveira Santos e Almeida',nivel:'acolito_sentinela',total_servido:24,funcoes:5,comunidade:'matriz',ultimas:[{data:'2026-10-25',horario:'19:00',funcao:'cruz'}]};
const marco={label:'3 anos',icone:'tempo_raiz',tier:'ouro',marco:'3'};
const base={acolitos_medalhas_cartao:{data:[]},acolitos_destaques:{data:{servos:[{id:'m1',nome:membro.nome,nivel:membro.nivel,total:24}]}},acolitos_membro_card:{data:membro}};
const medir=`
 document.getElementById('splash')?.remove();document.getElementById('pwa-banner')?.remove();
 await abrirCard('m1');await new Promise(r=>setTimeout(r,500));
 const modal=document.querySelector('.dest-member-modal'),box=modal.querySelector('.dest-marcos');
 const painel=(t)=>{const p=box?.querySelector('.dest-marco-'+t);if(!p)return null;const r=p.getBoundingClientRect(),arte=p.querySelector('.dest-marco-arte').getBoundingClientRect(),tit=p.querySelector('.dest-marco-titulo');
  return {w:Math.round(r.width),h:Math.round(r.height),arte:Math.round(arte.width),fonte:parseFloat(getComputedStyle(tit).fontSize),titulo:tit.textContent,sub:p.querySelector('.dest-marco-sub').textContent,rotulo:p.querySelector('.dest-marco-rotulo').textContent,
   temSvg:!!p.querySelector('.dest-marco-arte svg, .dest-marco-arte img'),vazio:p.querySelector('.dest-marco-arte').classList.contains('vazio'),medalhao:!!p.querySelector('.medalhao-tempo'),
   dentro:r.left>=modal.getBoundingClientRect().left-1&&r.right<=modal.getBoundingClientRect().right+1};};
 return {existe:!!box,nivel:painel('nivel'),tempo:painel('tempo'),overflow:document.documentElement.scrollWidth>innerWidth+1||modal.scrollWidth>modal.clientWidth+1};`;
const env=await iniciarProvas();
try{
 for(const largura of [360,390,768,1366,2560]){
  const r=await env.abrir('destaques.html',{papel:PAPEIS.membro,largura,rpcs:{...base,acolitos_tempo_marcos_lote:{data:{m1:marco}}},foto:{caminho:out+'marcos-'+largura+'.png',seletor:'.dest-member-modal'},avaliar:medir});
  assert.equal(r.erroAvaliar,null,String(r.erroAvaliar));assert.deepEqual(r.erros,[]);const a=r.avaliado;
  assert.equal(a.existe,true,'bloco de nível e tempo existe ('+largura+')');
  assert.match(a.nivel.titulo,/sentinela/i,'nível escrito em destaque');assert.equal(a.nivel.rotulo.toUpperCase(),'NÍVEL');
  assert.equal(a.tempo.titulo,'3 anos','marco de tempo escrito em destaque');assert.match(a.tempo.rotulo,/tempo de pastoral/i);
  assert.equal(a.tempo.medalhao,true,'o medalhão do marco aparece');assert.equal(a.nivel.temSvg,true,'a insígnia do nível aparece');
  assert.ok(a.nivel.arte>=72&&a.tempo.arte>=72,'selos grandes (>=72px): '+a.nivel.arte+'/'+a.tempo.arte);
  assert.ok(a.nivel.fonte>=18&&a.tempo.fonte>=18,'títulos >=18px: '+a.nivel.fonte+'/'+a.tempo.fonte);
  assert.equal(a.nivel.fonte,a.tempo.fonte,'nível e tempo com o MESMO tamanho de título');
  assert.ok(Math.abs(a.nivel.w-a.tempo.w)<=2,'painéis da mesma largura: '+a.nivel.w+'/'+a.tempo.w);
  assert.equal(a.nivel.dentro&&a.tempo.dentro,true,'painéis dentro do cartão');assert.equal(a.overflow,false,'sem rolagem horizontal');
  console.log('Cartão com nível e tempo em destaque',largura,'OK');
 }
 const sem=await env.abrir('destaques.html',{papel:PAPEIS.membro,largura:390,rpcs:{...base,acolitos_tempo_marcos_lote:{data:{}}},avaliar:medir});
 assert.equal(sem.erroAvaliar,null);assert.equal(sem.avaliado.tempo.titulo,'Ainda sem marco');assert.equal(sem.avaliado.tempo.vazio,true);assert.match(sem.avaliado.tempo.sub,/1 ano/);assert.match(sem.avaliado.nivel.titulo,/sentinela/i);
 const erro=await env.abrir('destaques.html',{papel:PAPEIS.membro,largura:390,rpcs:{...base,acolitos_tempo_marcos_lote:{error:{message:'Falha simulada'}}},avaliar:medir});
 assert.equal(erro.erroAvaliar,null);assert.equal(erro.avaliado.tempo.titulo,'Marco indisponível');assert.match(erro.avaliado.nivel.titulo,/sentinela/i,'nível continua aparecendo se o marco falhar');
 console.log('Sem marco e erro do marco OK');
}finally{await env.encerrar()}
