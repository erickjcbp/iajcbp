import assert from 'node:assert/strict'
import fs from 'node:fs'
import { iniciarProvas, PAPEIS } from './abrir-tela.mjs'
const destino='/Users/erickmartins/arquivos/auditorias/coroinhas/2026-10/avisos-edicao'
fs.mkdirSync(destino,{recursive:true})
const aviso={id:'a1',titulo:'Retiro +14 — sexta',texto:'Mensagem original',imagem_url:null,grupos:['cerimoniarios'],privado:['pais'],quando:'2026-10-23T21:00:00Z',repetir:'nao',ativo:true,configuracao:{tipo:'fila_existente',destinos_rotulo:'Participantes elegíveis + grupo de cerimoniários',horario_rotulo:'Disparo único'}}
const provas=await iniciarProvas()
try {
 for(const largura of [375,768,1366,2560]){
  const r=await provas.abrir('config.html',{papel:PAPEIS.admin,largura,altura:largura<640?812:1000,bancoVivo:true,
   tabelas:{tarcisio_avisos:{data:[aviso]},tarcisio_config:{data:[{id:1,pausado:false}]},tarcisio_envios:{data:[{id:'e1',aviso_id:'a1',estado:'pendente',agendado_para:aviso.quando,texto:aviso.texto}]}},
   passos:[{chamar:'abrirSecao',args:['tarcisio_avisos']},{clicar:'Editar'}],
   avaliar:`
    const modal=document.getElementById('modal-aviso');
    const bloqueados=[...modal.querySelectorAll('input,select,textarea')].filter(x=>x.disabled).length;
    const textarea=modal.querySelector('textarea');textarea.value='Mensagem editada com sapato fechado';
    modal.querySelector('input[type=datetime-local]').value='2026-10-23T17:30';
    const salvar=[...modal.querySelectorAll('button')].find(b=>b.textContent==='Salvar aviso');salvar.click();
    await new Promise(r=>setTimeout(r,30));
    const dialogos=[...document.querySelectorAll('.modal-overlay.open')];
    const confirmar=dialogos.filter(x=>x.id!=='modal-aviso').flatMap(x=>[...x.querySelectorAll('button')]).find(b=>b.textContent==='Confirmar');
    if(confirmar)confirmar.click();
    for(let i=0;i<30&&document.getElementById('modal-aviso');i++)await new Promise(r=>setTimeout(r,30));
    return {bloqueados,fechou:!document.getElementById('modal-aviso'),overflow:document.documentElement.scrollWidth>innerWidth+1};`,
   foto:{caminho:destino+'/salvo-'+largura+'.png',viewport:true}})
  assert.deepEqual(r.erros,[]);assert.deepEqual(r.passosFalhos,[]);assert.equal(r.erroAvaliar,null)
  assert.equal(r.avaliado.bloqueados,0,'editor não deve bloquear o agendamento')
  assert.equal(r.avaliado.fechou,true)
  assert.equal(r.estadoFinal.tarcisio_avisos[0].texto,'Mensagem editada com sapato fechado')
  assert.equal(r.estadoFinal.tarcisio_envios[0].texto,'Mensagem editada com sapato fechado')
  assert.equal(r.estadoFinal.tarcisio_envios[0].agendado_para,'2026-10-23T20:30:00.000Z')
  assert.equal(r.avaliado.overflow,false)
  console.log('editar → salvar → reler @'+largura+': OK')
  const n=await provas.abrir('config.html',{papel:PAPEIS.admin,largura,altura:largura<640?812:1000,bancoVivo:true,
    tabelas:{tarcisio_avisos:{data:[]},tarcisio_config:{data:[{id:1,pausado:false,ausencia_horas:['09:00'],ausencia_ultimo:'15:00',ausencia_texto:null}]},tarcisio_envios:{data:[]}},
    passos:[{chamar:'abrirSecao',args:['tarcisio_avisos']},{clicar:'Configurar regra'}],
    avaliar:`
      const m=document.getElementById('modal-aviso');m.querySelector('textarea').value='Use o link para registrar sua ausência.';
      [...m.querySelectorAll('button')].find(b=>b.textContent==='Salvar regra').click();
      for(let i=0;i<30&&document.getElementById('modal-aviso');i++)await new Promise(r=>setTimeout(r,30));
      return {fechou:!document.getElementById('modal-aviso'),overflow:document.documentElement.scrollWidth>innerWidth+1};`,
    foto:{caminho:destino+'/regra-salva-'+largura+'.png',viewport:true}})
  assert.deepEqual(n.erros,[]);assert.deepEqual(n.passosFalhos,[]);assert.equal(n.avaliado.fechou,true);assert.equal(n.avaliado.overflow,false)
  assert.ok(n.estadoFinal.tarcisio_config[0].ausencia_texto.includes('https://coroinhas.jcbplimeira.com.br/ausencias'))
  assert.equal(n.estadoFinal.tarcisio_avisos.length,0,'editar regra não cria aviso duplicado')
  console.log('editar regra → salvar na configuração sem duplicar @'+largura+': OK')

 }
}finally{await provas.encerrar()}
