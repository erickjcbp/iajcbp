import assert from 'node:assert/strict';
import fs from 'node:fs';
import {iniciarProvas,PAPEIS} from './abrir-tela.mjs';
const catalogo=JSON.parse(fs.readFileSync(new URL('./fixtures/medalhas-catalogo.json',import.meta.url)));
const membros=[
 {id:'m1',nome:'Ana Maria',apelido:'Ana',nivel:'coroinha',status:'ativo',serve:true,comunidade:'matriz',created_at:'2026-06-01',servindo_desde:'2022-09-17',servindo_desde_ou_antes:true,data_nascimento:'2012-01-01'},
 {id:'m2',nome:'Bruno',nivel:'acolito_guardiao',status:'ativo',serve:true,comunidade:'santo_antonio',created_at:'2026-06-01',servindo_desde:'2024-01-01',data_nascimento:'2015-01-01'},
 {id:'m3',nome:'Clara',nivel:'cerimoniario_magistral',status:'ativo',serve:true,comunidade:'matriz',created_at:'2026-06-01',servindo_desde:null,data_nascimento:null}
];
const celebracao={id:'c1',data:'2026-11-01',horario:'9h',minutos:540,comunidade:'matriz',tipo:'missa_comum'};
const tabelas={acolitos_membros:{data:membros},acolitos_celebracoes:{data:[celebracao]},acolitos_escalas:{data:[{id:'e1',celebracao_id:'c1',membro_id:'m1',funcao:'vela',status:'escalado',acolitos_celebracoes:celebracao}]}};
const out=new URL('../../../estudos/gestao-tempo-2026-11-01/',import.meta.url).pathname;fs.mkdirSync(out,{recursive:true});
const env=await iniciarProvas();
const rpcs={acolitos_medalhas_catalogo:{data:catalogo},acolitos_missoes_fila:{data:[{membro_id:'m1',membro:'Ana',missao_id:'q1',titulo:'Missão teste',xp:20}]},acolitos_hab_fila:{data:[{id:'h1',membro_id:'m1',membro:'Ana',label:'Cruz'}]},acolitos_promocoes_pendentes:{data:[{membro_id:'m1',membro:'Ana',proximo:'acolito_aspirante'}]},acolitos_quase_la:{data:[{membro_id:'m1',membro:'Ana',proximo:'acolito_aspirante',avaliadas:[]}]},acolitos_formacao_acompanhamento:{data:[{membro_id:'m1',nome:'Ana',nivel:'coroinha',faixa:'nunca_entrou'}]}};
const limpar=`document.getElementById('splash')?.remove();document.getElementById('pwa-banner')?.remove();`;
const final=`if(document.documentElement.scrollWidth>innerWidth+1)throw Error('Página com rolagem horizontal');return {largura:innerWidth};`;
const escala=`
 celebracoes=[${JSON.stringify(celebracao)}];escalasMap={c1:[{membro_id:'m1',funcao:'vela',status:'escalado'}]};await setAba('planilha');
 const root=document.querySelector('#view-planilha');const ids=()=>[...root.querySelectorAll('tbody tr[data-membro]')].map(n=>n.dataset.membro);
 const clicar=t=>[...root.querySelectorAll('button')].find(n=>n.textContent.startsWith(t)).click();
 clicar('Idade');if(ids().join()!=='m2,m1,m3')throw Error('Idade não ordena numericamente');
 clicar('Tempo de pastoral');clicar('Tempo de pastoral');if(ids().join()!=='m1,m2,m3')throw Error('Tempo ausente deve ficar por último');
 const filtrar=(aria,v)=>{const n=root.querySelector('[aria-label="'+aria+'"]');n.focus();n.value=v;n.oninput();if(document.activeElement.getAttribute('aria-label')!==aria)throw Error('Filtro perde foco ao digitar');};
 filtrar('Filtrar Idade mínimo','12');if(ids().join()!=='m1')throw Error('Intervalo de idade incorreto');
 filtrar('Filtrar Membro','BRUNO');if(ids().length)throw Error('Filtros de colunas não combinam');
 clicar('Limpar filtros');if(ids().length!==3)throw Error('Não limpa filtros');
 const data=[...root.querySelectorAll('thead tr:first-child button')].find(n=>n.textContent.includes('01/11'));if(!data)throw Error('Falta coluna de celebração');
 const dateInput=[...root.querySelectorAll('thead input')].find(n=>n.getAttribute('aria-label').includes('01/11'));dateInput.value='VÉLA';dateInput.oninput();if(ids().join()!=='m1')throw Error('Filtro de celebração não encontra função');
 dateInput.value='';dateInput.oninput();
 for(const b of root.querySelectorAll('.coluna-ordenar'))if(b.getBoundingClientRect().height<44)throw Error('Cabeçalho sem alvo de toque');
 ${final}`;
const medalhas=`
 await MedalhasAdmin.abrir({sb,membros:${JSON.stringify(membros)}});const modal=document.querySelector('.medalhas-admin-modal');modal.querySelector('.mg-badge').click();await modal.querySelector('.mg-footer button:last-child').onclick();
 const ids=()=>[...modal.querySelectorAll('.mg-person input')].map(n=>n.value);
 const select=(aria,v)=>{const n=modal.querySelector('select[aria-label="'+aria+'"]');if(!n)throw Error('Falta '+aria);n.value=v;n.dispatchEvent(new Event('change'));};
 select('Ordenar membros','tempo_desc');if(ids().join()!=='m1,m2,m3')throw Error('Ordem de tempo incorreta');
 select('Tempo de pastoral','3');if(ids().join()!=='m1')throw Error('Faixa de tempo incorreta');
 [...modal.querySelectorAll('button')].find(n=>n.textContent==='Marcar todos do filtro').click();
 select('Tempo de pastoral','sem_data');if(ids().join()!=='m3'||!modal.textContent.includes('1 fora do filtro'))throw Error('Perdeu seleção no filtro');
 modal.querySelector('.mg-advanced-filters').open=true;select('Tempo de pastoral','todos');select('Comunidade dos membros','santo_antonio');if(ids().join()!=='m2')throw Error('Comunidade incorreta');
 select('Comunidade dos membros','todas');select('Seleção dos membros','selecionados');if(ids().join()!=='m1')throw Error('Filtro de seleção incorreto');
 select('Seleção dos membros','todos');select('Comunidade dos membros','todas');const faixa=modal.querySelector('input[aria-label="Tempo máximo em meses"]');faixa.value='35';faixa.dispatchEvent(new Event('input'));if(ids().join()!=='m2')throw Error('Intervalo mensal não filtra corretamente');faixa.value='';faixa.dispatchEvent(new Event('input'));select('Ordenar membros','nivel_desc');if(ids().join()!=='m3,m2,m1')throw Error('Ordem de níveis incorreta');select('Ordenar membros','tempo_desc');if(modal.querySelectorAll('.mg-person .tempo-pastoral').length!==3)throw Error('Card sem tempo');
 modal.querySelector('.mg-advanced-filters').open=false;if(modal.scrollWidth>modal.clientWidth+1)throw Error('Modal excede largura');${final}`;
try{for(const largura of [360,390,768,1366,2560]){
 for(const [nome,tela,avaliar] of [['escala','escala.html',escala],['medalhas','jornada-admin.html',medalhas],['inicio','index.html',`await renderDashboardMembro({membro:${JSON.stringify(membros[0])},membership:{role:'coroinha'},user:{email:'teste@teste'}});const tempo=document.querySelector('.greet-info .tempo-pastoral');if(!tempo?.textContent.includes('4 anos'))throw Error('Início sem tempo real');abrirNivelMembros(nivelInfo('coroinha'),${JSON.stringify(membros)});if(document.querySelectorAll('.modal-overlay.open .tempo-pastoral').length!==3)throw Error('Lista de nível sem tempo');document.querySelector('.modal-overlay.open').remove();${final}`],['jornada','jornada-admin.html',`const filas=[...document.querySelectorAll('.ja-approvals .mx-fila-item')];if(filas.length!==4||filas.some(n=>!n.querySelector('.tempo-pastoral')?.textContent.includes('4 anos')))throw Error('Fila sem tempo real');abaJornada='evolucao';await renderAll();const cards=[...document.querySelectorAll('.ja-member-card')];if(cards.length!==3||cards.some(c=>!c.querySelector('.tempo-pastoral')))throw Error('Card da Jornada sem tempo');const cel=document.querySelector('.matriz-tempo');if(!cel.textContent.includes('4 anos')||!cel.textContent.includes('ou mais'))throw Error('Matriz conta data de importação');${final}`]]){
  const r=await env.abrir(tela,{papel:PAPEIS.admin,tabelas,rpcs,largura,altura:950,avaliar:limpar+avaliar,foto:{caminho:out+nome+'-'+largura+'.png'}});
  assert.equal(r.erroAvaliar,null,JSON.stringify(r));assert.deepEqual(r.erros,[]);console.log(nome,largura,'OK');
 }
}}finally{await env.encerrar();}
