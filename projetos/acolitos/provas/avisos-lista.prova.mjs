import assert from 'node:assert/strict'
import fs from 'node:fs'
import { iniciarProvas,PAPEIS } from './abrir-tela.mjs'
const destino='/Users/erickmartins/projetos/iajcbp/materiais-paroquia/auditorias/2026-10/avisos-compactos';fs.mkdirSync(destino,{recursive:true})
const provas=await iniciarProvas()
try{
 for(const largura of [375,768,1366,2560]){
  const r=await provas.abrir('config.html',{papel:PAPEIS.admin,largura,altura:largura<640?812:1000,
   tabelas:{tarcisio_avisos:{data:[{id:'ret1',chave:'retiro-20261024-sexta',titulo:'Retiro +14 — sexta, 23/10 às 18h',texto:'Água, Bíblia, terço e toalha.',quando:'2026-10-23T21:00:00Z',ativo:true,grupos:['cerimoniarios'],privado:['pais'],repetir:'nao',configuracao:{tipo:'fila_existente',destinos_rotulo:'44 números únicos de participantes + grupo Cerimoniários'}}]},tarcisio_config:{data:[{id:1,pausado:false,ausencia_horas:['09:00'],ausencia_ultimo:'15:00',lembrete_ligado:true,aniversario_ligado:true,escala_ligada:true,hora_lembrete:'19:00',hora_aniversario:'08:00'}]}},
   passos:[{chamar:'abrirSecao',args:['tarcisio_avisos']}],
   avaliar:`
    const linhas=()=>[...document.querySelectorAll('.ta-item')];
    const totais={inicial:linhas().length};
    const abas=[...document.querySelectorAll('.ta-filtro')];
    abas.find(b=>b.textContent==='Regras automáticas').click();totais.regras=linhas().length;
    const busca=document.querySelector('.ta-busca');busca.value='anivers';busca.dispatchEvent(new Event('input'));totais.busca=linhas().length;
    busca.value='';busca.dispatchEvent(new Event('input'));abas.find(b=>b.textContent==='Agendados').click();totais.agendados=linhas().length;
    const ver=document.querySelector('.ta-ver'),det=document.querySelector('.ta-detalhe');const fechado=det.hidden;
    ver.click();const abriu=!det.hidden&&ver.getAttribute('aria-expanded')==='true';ver.click();
    abas.find(b=>b.textContent==='Todos').click();
    const fora=[...document.querySelectorAll('.ta-painel button,.ta-busca')].filter(e=>{const b=e.getBoundingClientRect();return b.height>0&&(b.height<43.5||b.left<0||b.right>innerWidth+1)}).length;
    return {totais,fechado,abriu,fora,overflow:document.documentElement.scrollWidth>innerWidth+1,alturaLinha:document.querySelector('.ta-row').getBoundingClientRect().height};`,
   foto:{caminho:destino+'/lista-'+largura+'.png',viewport:true}})
  assert.deepEqual(r.erros,[]);assert.deepEqual(r.passosFalhos,[]);assert.equal(r.erroAvaliar,null)
  assert.deepEqual(r.avaliado.totais,{inicial:6,regras:5,busca:1,agendados:1});assert.equal(r.avaliado.fechado,true);assert.equal(r.avaliado.abriu,true)
  assert.equal(r.avaliado.fora,0);assert.equal(r.avaliado.overflow,false)
  if(largura>=1366)assert.ok(r.avaliado.alturaLinha<=90,'linhas desktop precisam permanecer compactas')
  console.log('busca, filtros, prévia e toque @'+largura+': OK; linha '+Math.round(r.avaliado.alturaLinha)+'px')
 }
}finally{await provas.encerrar()}
