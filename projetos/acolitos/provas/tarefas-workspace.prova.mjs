import assert from 'node:assert/strict';import fs from 'node:fs';import {iniciarProvas,PAPEIS} from './abrir-tela.mjs';
const dir='/Users/erickmartins/arquivos/auditorias/coroinhas/2026-10-13-tarefas-revisao';fs.mkdirSync(dir,{recursive:true});
const task=(id,titulo,time_slug,extra={})=>({id,titulo,time_slug,prazo:'2026-10-18',responsavel_id:'m1',responsavel:{nome:'Maria Clara',apelido:'Maria'},...extra});
const tabelas={acolitos_tarefas:{data:[task('t1','Conferir estoque de velas','liturgia',{prazo:'2026-10-10',observacao:'Verificar as velas e separar as peças para as missas.'}),task('t2','Preparar acolhida das famílias','secretaria',{andamento_em:'2026-10-11T12:00:00Z'}),task('t3','Organizar lista de membros','secretaria',{concluida_em:'2026-10-12T12:00:00Z'}),task('t4','Revisar os paramentos','liturgia')]},acolitos_listas:{data:[{tipo:'setor',valor:'liturgia',label:'Liturgia',meta:{cor:'#9c8cf5'}},{tipo:'setor',valor:'secretaria',label:'Secretaria',meta:{cor:'#579bfc'}}]},acolitos_config:{data:[{chave:'responsabilidades',valor:{liturgia:'Preparar o altar e cuidar dos materiais litúrgicos.',secretaria:'Organizar cadastros e acompanhar a comunicação.'}}]}};
const provas=await iniciarProvas();
try{for(const width of [360,768,1366,2560])for(const view of ['tabela','quadro','lista','time']){
 const r=await provas.abrir('tarefas.html',{papel:PAPEIS.admin,tabelas,largura:width,altura:900,avaliar:`modoVisao='${view}';render();document.getElementById('splash')?.remove();document.getElementById('pwa-banner')?.remove();
  const sel=document.querySelector('.tf-board-status');const calls=[];aplicarTransicao=async(t,d)=>calls.push([t.id,d]);sel.value='andamento';await sel.onchange();
  const main=document.getElementById('main-content');const visible=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0};
  const small=innerWidth<640?[...main.querySelectorAll('button,input,select')].filter(visible).filter(e=>{const r=e.getBoundingClientRect();return e.type!=='checkbox'&&(r.height<43.5||r.width<43.5)}).map(e=>e.textContent):[];
  const cols=[...document.querySelectorAll('.tf-col')].map(e=>Math.round(e.getBoundingClientRect().width));
  return {calls,overflow:document.documentElement.scrollWidth>innerWidth+1,small,filters:main.querySelectorAll('input[placeholder="Buscar tarefa..."]').length,titles:main.querySelectorAll('.tf-board-title').length,cols,mainWidth:main.getBoundingClientRect().width,rotinas:main.querySelectorAll('.tf-area-rotinas').length};`,foto:{caminho:dir+'/workspace-'+view+'-'+width+'.png'}});
 assert.deepEqual(r.erros,[]);assert.equal(r.erroAvaliar,null);assert.equal(r.avaliado.overflow,false);assert.deepEqual(r.avaliado.small,[]);assert.equal(r.avaliado.filters,1);assert.equal(r.avaliado.titles,4);assert.equal(r.avaliado.calls.length,1);
 if(width>=1366){assert.equal(r.avaliado.mainWidth,width);if(view==='quadro')assert.ok(r.avaliado.cols.every(w=>w>350));}
 if(view==='time')assert.equal(r.avaliado.rotinas,2);
 console.log(view,width,'OK');
}
 for(const view of ['tabela','quadro','lista','time']){
 const r=await provas.abrir('tarefas.html',{papel:PAPEIS.admin,tabelas,avaliar:`modoVisao='${view}';render();const search=document.querySelector('input[placeholder="Buscar tarefa..."]');search.value='velas';search.dispatchEvent(new Event('input'));await new Promise(r=>setTimeout(r,500));const atual=[...document.querySelectorAll('.tf-board-title')].map(e=>e.textContent);modoVisao='${view==='quadro'?'lista':'quadro'}';render();return {atual,depois:[...document.querySelectorAll('.tf-board-title')].map(e=>e.textContent)};`});assert.equal(r.erroAvaliar,null);assert.deepEqual(r.avaliado.atual,['Conferir estoque de velas']);assert.deepEqual(r.avaliado.depois,r.avaliado.atual);console.log('Busca e troca de visão',view,'OK');
 }
for(const width of [360,1366]){
 const r=await provas.abrir('tarefas.html',{papel:PAPEIS.admin,tabelas,largura:width,altura:900,avaliar:`document.documentElement.dataset.theme='light';modoVisao='quadro';render();document.getElementById('splash')?.remove();document.getElementById('pwa-banner')?.remove();document.querySelector('.tf-menu .tf-mais').click();const menu=document.querySelector('.tf-menu .tf-acoes-extra');const rect=menu.getBoundingClientRect();return {hidden:menu.hidden,texto:menu.textContent,inside:rect.left>=0&&rect.right<=innerWidth&&rect.bottom<=innerHeight,overflow:document.documentElement.scrollWidth>innerWidth+1};`,foto:{caminho:dir+'/workspace-menu-claro-'+width+'.png'}});
 assert.equal(r.erroAvaliar,null);assert.equal(r.avaliado.hidden,false);assert.equal(r.avaliado.inside,true);assert.equal(r.avaliado.overflow,false);assert.match(r.avaliado.texto,/Editar/i);console.log('Menu e tema claro',width,'OK');
}
}finally{await provas.encerrar()}
