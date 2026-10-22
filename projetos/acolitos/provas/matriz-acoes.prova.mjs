import assert from 'node:assert/strict';
import fs from 'node:fs';
import {iniciarProvas,PAPEIS} from './abrir-tela.mjs';
const destino='/Users/erickmartins/arquivos/projetos/paroquia/auditorias/2026-10-13-matriz';fs.mkdirSync(destino,{recursive:true});
const membro={id:'m1',nome:'Maria Clara',apelido:'Maria',nivel:'coroinha',status:'ativo',serve:true,created_at:'2025-01-10T12:00:00Z',telefone:'19999999999',data_nascimento:'2012-05-11'};
const hoje=new Date().toLocaleDateString('en-CA');
const tabelas={acolitos_membros:{data:[membro]},acolitos_escalas:{data:[{membro_id:'m1',status:'presente',acolitos_celebracoes:{data:hoje,horario:'10:00'}},{membro_id:'m2',substituto_id:'m1',status:'substituido',acolitos_celebracoes:{data:hoje,horario:'19:00'}}]}};
const provas=await iniciarProvas();
try{for(const width of [360,768,1366,2560])for(const tipo of ['matriz','calendario','editar']){
const r=await provas.abrir('jornada-admin.html',{papel:PAPEIS.admin,tabelas,largura:width,altura:900,avaliar:`abaJornada='evolucao';await renderAll();document.getElementById('splash')?.remove();document.getElementById('pwa-banner')?.remove();
 const editar=document.querySelector('button[aria-label="Editar ficha de Maria"]');const calendar=document.querySelector('button[aria-label="Ver últimas missas de Maria"]');
 if('${tipo}'==='calendario')await calendar.onclick();if('${tipo}'==='editar'){await editar.onclick();await new Promise(r=>setTimeout(r,100));}
 const modal=document.querySelector('.modal-overlay.open .modal');const dots=modal?[...modal.querySelectorAll('.historico-semanas button')]:[];
 return {editar:!!editar,calendario:!!calendar,overflow:document.documentElement.scrollWidth>innerWidth+1,modalWidth:modal?.getBoundingClientRect().width,texto:modal?.innerText,dots:dots.map(d=>d.getAttribute('aria-label')),small:[...document.querySelectorAll('button,input,select')].filter(e=>{const b=e.getBoundingClientRect();return b.width>0&&b.height>0&&e.type!=='checkbox'&&(b.height<43.5||b.width<43.5)&&innerWidth<640}).map(e=>e.textContent)};`,foto:{caminho:destino+'/'+tipo+'-'+width+'.png'}});
 assert.deepEqual(r.erros,[]);assert.equal(r.erroAvaliar,null);assert.equal(r.avaliado.overflow,false);assert.equal(r.avaliado.editar,true);assert.equal(r.avaliado.calendario,true);
 if(tipo==='calendario'){assert.match(r.avaliado.texto,/Tempo registrado na pastoral/);assert.equal(r.avaliado.dots.length,16);assert.ok(r.avaliado.dots.some(x=>x.includes('substituiu')));}
 if(tipo==='editar')assert.match(r.avaliado.texto,/Disponibilidade/i);
 if(tipo!=='matriz'&&width===360)assert.equal(r.avaliado.modalWidth,360);
 console.log(tipo,width,'OK',JSON.stringify(r.avaliado.small));
 }
 const save=await provas.abrir('jornada-admin.html',{papel:PAPEIS.admin,tabelas,avaliar:`abaJornada='evolucao';await renderAll();let redesenhos=0;renderAll=async()=>{redesenhos++};await document.querySelector('button[aria-label="Editar ficha de Maria"]').onclick();await new Promise(r=>setTimeout(r,100));const input=document.querySelector('.modal-overlay.open input');input.value='Maria editada';input.oninput();const btn=[...document.querySelectorAll('.modal-overlay.open button')].find(b=>b.textContent==='Salvar');await btn.onclick();return {redesenhos};`});
 assert.equal(save.erroAvaliar,null);assert.equal(save.avaliado.redesenhos,1);assert.ok(save.gravacoes.some(g=>g.tabela==='acolitos_membros'&&g.acao==='update'&&g.dados.apelido==='Maria editada'));console.log('Salvar ficha e atualizar matriz: OK');
 const falha=await provas.abrir('jornada-admin.html',{papel:PAPEIS.admin,tabelas:{acolitos_membros:{error:{code:'42703',message:'Coluna inexistente'}}},avaliar:`abaJornada='evolucao';await renderAll();return {texto:document.querySelector('.main').textContent,matriz:!!document.querySelector('table')};`});
 assert.equal(falha.erroAvaliar,null);assert.match(falha.avaliado.texto,/Não foi possível carregar os membros/);assert.match(falha.avaliado.texto,/Tentar novamente/);assert.equal(falha.avaliado.matriz,false);console.log('Falha de consulta aparece como erro, não lista vazia: OK');
 }finally{await provas.encerrar()}
