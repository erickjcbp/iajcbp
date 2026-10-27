import assert from 'node:assert/strict'
import fs from 'node:fs'
import { iniciarProvas,PAPEIS } from './abrir-tela.mjs'
const destino='/Users/erickmartins/arquivos/auditorias/coroinhas/2026-10/sem-numero-edicao';fs.mkdirSync(destino,{recursive:true})
const provas=await iniciarProvas()
try{
 for(const [largura,relacao,erro]of [[375,'proprio',false],[768,'proprio',false],[1366,'proprio',false],[2560,'proprio',false],[375,'responsavel',false],[375,'proprio',true]]){
  const r=await provas.abrir('config.html',{papel:PAPEIS.admin,largura,altura:largura<640?812:1000,
   tabelas:{tarcisio_envios:{data:[{membro_id:'m1',destino_nome:'Servo de teste',tipo:'aviso',estado:'sem_numero',erro:'Sem telefone cadastrado',created_at:new Date().toISOString()}]},acolitos_membros:{data:[{id:'m1',nome:'Servo de teste',telefone:null,celular_recado:null}]}},
   rpcs:{tarcisio_salvar_contato:{data:erro?{erro:'sem_permissao'}:{ok:true,futuros_atualizados:2}}},
   passos:[{chamar:'abrirSecao',args:['tarcisio_sem']}],
   avaliar:`
    document.getElementById('splash')?.remove();await new Promise(r=>setTimeout(r,500));
    const form=document.querySelector('.tn-form');let telefone=form.querySelector('input[type=tel]');let seletor=form.querySelector('select');let salvar=form.querySelector('button[aria-label^="Salvar número"]');
    telefone.value='123';salvar.click();await new Promise(r=>setTimeout(r,30));const validou=form.querySelector('.tn-msg').textContent.includes('válido');
    seletor.value='${relacao}';telefone.value='(19) 99990-0001';salvar.click();await new Promise(r=>setTimeout(r,180));
    const campos=[...document.querySelectorAll('.tn-form input,.tn-form select,.tn-form button')].filter(c=>c.getBoundingClientRect().height>0);
    return {validou,erro:document.querySelector('.tn-msg')?.textContent||'',overflow:document.documentElement.scrollWidth>innerWidth+1,
      pequenos:campos.filter(c=>c.getBoundingClientRect().height<43.5).length,fontesPequenas:campos.filter(c=>c.tagName!=='BUTTON'&&parseFloat(getComputedStyle(c).fontSize)<16).length};`,
   foto:{caminho:destino+'/contato-'+largura+'-'+relacao+'-'+erro+'.png',viewport:true}})
  assert.deepEqual(r.erros,[]);assert.deepEqual(r.passosFalhos,[]);assert.equal(r.erroAvaliar,null)
  assert.equal(r.avaliado.validou,true);assert.equal(r.avaliado.overflow,false);assert.equal(r.avaliado.pequenos,0);assert.equal(r.avaliado.fontesPequenas,0)
  const chamadas=r.gravacoes.filter(g=>g.tabela==='rpc:tarcisio_salvar_contato');assert.equal(chamadas.length,1,'telefone inválido não chama o banco')
  assert.deepEqual(chamadas[0].dados,{p_membro:'m1',p_numero:'5519999900001',p_relacao:relacao})
  if(erro)assert.match(r.avaliado.erro,/acesso/);else assert.ok(r.ditos.some(d=>String(d).includes('Contato salvo')))
  console.log('contato inline @'+largura+' '+relacao+(erro?' (erro recuperável)':'')+': OK')
 }
}finally{await provas.encerrar()}
