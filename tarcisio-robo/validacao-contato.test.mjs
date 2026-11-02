import test from 'node:test'
import assert from 'node:assert/strict'
import { lerResposta, decidir, idadeEm, criarValidacaoContato, RESPOSTAS } from './validacao-contato.mjs'

const hoje = '2026-11-02'
const membros = [
  { id: 'a', nome: 'João Pedro da Silva', data_nascimento: '2012-03-10', telefone: null },
  { id: 'b', nome: 'Ana Souza', data_nascimento: '2010-12-01', telefone: '19 99999-1111' },
  { id: 'c', nome: 'Luiz Costa', data_nascimento: '2011-01-01', telefone: null },
  { id: 'd', nome: 'Luiz Costa', data_nascimento: '2011-02-01', telefone: null },
]

test('lê nome e idade em jeitos comuns de responder', () => {
  assert.deepEqual(lerResposta('João Pedro da Silva, 14 anos'), { nome: 'joao pedro da silva', idade: 14 })
  assert.deepEqual(lerResposta('Meu nome é João Pedro da Silva e tenho 14 anos'), { nome: 'joao pedro da silva', idade: 14 })
  assert.deepEqual(lerResposta('João Pedro da Silva\n14'), { nome: 'joao pedro da silva', idade: 14 })
})
test('reconhece quem não serve', () => {
  for (const t of ['Não sirvo no altar', 'sou mãe do Pedro', 'Sou o coordenador']) assert.equal(lerResposta(t).naoServe, true)
})
test('idade respeita o aniversário', () => {
  assert.equal(idadeEm('2012-11-03', hoje), 13)
  assert.equal(idadeEm('2012-11-02', hoje), 14)
})
test('só grava com nome e idade batendo em uma ficha de telefone vazio', () => {
  const r = decidir({ nome: 'joao pedro da silva', idade: 14, numero: '5519988887777', membros, hoje })
  assert.equal(r.situacao, 'gravado'); assert.equal(r.gravar, true); assert.equal(r.ficha.id, 'a')
})
test('qualquer dúvida vai para revisão', () => {
  assert.equal(decidir({ nome: 'joao pedro da silva', idade: 15, numero: '5519', membros, hoje }).motivo, 'idade não confere com a ficha')
  assert.equal(decidir({ nome: 'ninguem aqui', idade: 14, numero: '5519', membros, hoje }).motivo, 'nome não encontrado no cadastro')
  assert.equal(decidir({ nome: 'ana souza', idade: 15, numero: '5519988887777', membros, hoje }).motivo, 'ficha já tem outro número')
  assert.equal(decidir({ nome: 'luiz costa', idade: 15, numero: '5519', membros, hoje }).motivo, 'mais de uma ficha possível')
})
test('mesmo número da ficha confirma sem regravar', () => {
  const r = decidir({ nome: 'ana souza', idade: 15, numero: '5519999991111', membros, hoje })
  assert.equal(r.situacao, 'gravado'); assert.equal(r.gravar, false)
})

function falso(linha) {
  const escritas = [], enviadas = []
  const fim = (data) => { const p = Promise.resolve({ data, error: null }); return Object.assign(p, { eq: () => fim(data), or: () => fim(data), select: () => fim(data), maybeSingle: () => fim(data) }) }
  const db = { from: (t) => ({
    select: () => fim(t === 'tarcisio_validacao_contato' ? linha : membros),
    update: (v) => { escritas.push([t, v]); return fim([{ id: 'a' }]) },
    insert: (v) => { escritas.push([t, v]); return fim(null) },
  }) }
  return { v: criarValidacaoContato({ db, evo: { enviarTexto: async (_n, x) => { enviadas.push(x); return {} } }, relogio: () => new Date('2026-11-02T15:00:00Z'), log: { info() {} } }), escritas, enviadas }
}
test('modo teste responde, mas nunca escreve na ficha', async () => {
  const { v, escritas, enviadas } = falso({ numero: '5519', situacao: 'perguntado', tentativas: 0, teste: true })
  assert.equal(await v.receber({ numero: '5519', texto: 'João Pedro da Silva, 14 anos' }), true)
  assert.equal(escritas.some(([t]) => t === 'acolitos_membros'), false)
  assert.equal(enviadas[0], RESPOSTAS.gravado('João'))
})
test('fora do modo teste, grava o telefone', async () => {
  const { v, escritas } = falso({ numero: '5519988887777', situacao: 'perguntado', tentativas: 0, teste: false })
  await v.receber({ numero: '5519988887777', texto: 'João Pedro da Silva, 14 anos' })
  assert.deepEqual(escritas.find(([t]) => t === 'acolitos_membros')[1], { telefone: '19988887777' })
})
test('quem não está na validação segue para a conversa normal', async () => {
  const { v, enviadas } = falso(null)
  assert.equal(await v.receber({ numero: '5519', texto: 'oi' }), false)
  assert.equal(enviadas.length, 0)
})
test('resposta incompleta pede de novo uma vez, depois vai para revisão', async () => {
  const a = falso({ numero: '5519', situacao: 'perguntado', tentativas: 0, teste: false })
  await a.v.receber({ numero: '5519', texto: 'oi' })
  assert.equal(a.enviadas[0], RESPOSTAS.repetir)
  const b = falso({ numero: '5519', situacao: 'perguntado', tentativas: 1, teste: false })
  await b.v.receber({ numero: '5519', texto: 'oi' })
  assert.equal(b.enviadas[0], RESPOSTAS.revisar)
})
