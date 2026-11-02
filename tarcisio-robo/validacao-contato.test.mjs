import test from 'node:test'
import assert from 'node:assert/strict'
import { lerResposta, lerNumero, mesmoNumero, decidir, idadeEm, criarValidacaoContato, RESPOSTAS } from './validacao-contato.mjs'

const hoje = '2026-11-02'
const membros = [
  { id: 'a', nome: 'João Pedro da Silva', data_nascimento: '2012-03-10', telefone: null, celular_mae: '19 91111-2222', celular_recado: null },
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
  for (const t of ['Não sirvo no altar', 'Sou o coordenador']) assert.equal(lerResposta(t).naoServe, true)
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

function falso(linha, ficha = membros[0]) {
  const escritas = [], enviadas = [], grupos = []
  const fim = (data) => { const p = Promise.resolve({ data, error: null }); return Object.assign(p, { eq: () => fim(data), or: () => fim(data), select: () => fim(data), maybeSingle: () => fim(Array.isArray(data) ? ficha : data) }) }
  const db = { from: (t) => ({
    select: () => fim(t === 'tarcisio_validacao_contato' ? linha : t === 'tarcisio_grupos' ? { jid: 'g@g.us' } : membros),
    update: (v) => { escritas.push([t, v]); return fim([{ id: 'a' }]) },
    insert: (v) => { escritas.push([t, v]); return fim(null) },
  }) }
  const evo = { enviarTexto: async (_n, x) => { enviadas.push(x); return {} }, adicionarAoGrupo: async (j, n) => { if (ficha?.semGrupo) throw new Error('sem permissão'); grupos.push([j, n]) } }
  return { evo, v: criarValidacaoContato({ db, evo, relogio: () => new Date('2026-11-02T15:00:00Z'), log: { info() {}, warn() {} } }), escritas, enviadas, grupos }
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

const dados = (situacao, extra = {}) => ({ numero: '5519911112222', situacao, tentativas: 0, teste: false, membro_id: 'a', ...extra })
const FRASE_PAI = 'Eu não sirvo mais, meu filho serve, é o Pedro'
test('pai ou mãe que diz que o filho serve abre a conversa, em vez de encerrar', async () => {
  assert.equal(lerResposta(FRASE_PAI).filho, true)
  assert.equal(lerResposta('sou mãe do Pedro').filho, true)
  const { v, escritas, enviadas } = falso(dados('perguntado'))
  await v.receber({ numero: '5519911112222', texto: FRASE_PAI })
  assert.equal(enviadas[0], RESPOSTAS.filho_dados)
  assert.equal(escritas.find(([t]) => t === 'tarcisio_validacao_contato')[1].situacao, 'filho_dados')
})
test('com a ficha do filho achada, pede o número e diz que o grupo é só de comunicados', async () => {
  const { v, escritas, enviadas } = falso(dados('filho_dados'))
  await v.receber({ numero: '5519911112222', texto: 'João Pedro da Silva, 14 anos' })
  assert.match(enviadas[0], /somente para comunicados/)
  assert.equal(escritas.find(([t]) => t === 'tarcisio_validacao_contato')[1].situacao, 'filho_numero')
})
test('filho não localizado vai para revisão e nada entra no grupo', async () => {
  const { v, enviadas, grupos } = falso(dados('filho_dados'))
  await v.receber({ numero: '5519911112222', texto: 'Fulano de Tal, 12 anos' })
  assert.equal(enviadas[0], RESPOSTAS.revisar); assert.equal(grupos.length, 0)
})
test('número do filho entra na ficha vazia e no grupo, com o reforço de comunicados', async () => {
  const { v, escritas, enviadas, grupos } = falso(dados('filho_numero'))
  await v.receber({ numero: '5519911112222', texto: '19 98888-7777' })
  assert.deepEqual(escritas.find(([t]) => t === 'acolitos_membros')[1], { telefone: '19988887777' })
  assert.deepEqual(grupos, [['g@g.us', ['5519988887777']]])
  assert.match(enviadas[0], /somente para comunicados/)
})
test('modo teste simula a inclusão sem gravar nem mexer no grupo', async () => {
  const { v, escritas, grupos } = falso(dados('filho_numero', { teste: true }))
  await v.receber({ numero: '5519911112222', texto: '19 98888-7777' })
  assert.equal(escritas.some(([t]) => t === 'acolitos_membros'), false); assert.equal(grupos.length, 0)
})
test('ficha com outro número, ou filho no número da família, não entra no grupo', async () => {
  const a = falso(dados('filho_numero'), membros[1])
  await a.v.receber({ numero: '5519911112222', texto: '19 98888-7777' })
  assert.equal(a.grupos.length, 0); assert.equal(a.enviadas[0], RESPOSTAS.revisar)
  const b = falso(dados('filho_numero'))
  await b.v.receber({ numero: '5519911112222', texto: '19 91111-2222' })
  assert.equal(b.grupos.length, 0); assert.equal(b.enviadas[0], RESPOSTAS.revisar)
})
test('falha ao incluir no grupo vai para revisão, sem dizer que deu certo', async () => {
  const { v, enviadas } = falso(dados('filho_numero'), { ...membros[0], semGrupo: true })
  await v.receber({ numero: '5519911112222', texto: '19 98888-7777' })
  assert.equal(enviadas[0], RESPOSTAS.revisar)
})
test('mais de um filho vai para revisão', () => {
  assert.equal(lerResposta('meus filhos servem').variosFilhos, true)
})
test('lê número em formatos comuns', () => {
  assert.equal(lerNumero('(19) 98888-7777'), '5519988887777')
  assert.equal(lerNumero('+55 19 98888 7777'), '5519988887777')
  assert.equal(lerNumero('não tem'), null)
  assert.equal(lerNumero('usa o meu, 19 91111-2222'), null)
})
test('quem fala pelo filho precisa estar com o número da família na ficha', async () => {
  const { v, enviadas, escritas } = falso(dados('filho_dados', { numero: '5519977776666' }))
  await v.receber({ numero: '5519977776666', texto: 'João Pedro da Silva, 14 anos' })
  assert.equal(enviadas[0], RESPOSTAS.revisar)
  assert.equal(escritas.find(([t]) => t === 'tarcisio_validacao_contato')[1].motivo, 'número não é o da família na ficha')
})
test('número da família escrito em outro formato também não entra como número do filho', async () => {
  const { v, grupos, enviadas } = falso(dados('filho_numero', { numero: '5519933334444' }))
  await v.receber({ numero: '5519933334444', texto: '(19) 91111-2222' })
  assert.equal(grupos.length, 0); assert.equal(enviadas[0], RESPOSTAS.revisar)
})
test('número sem WhatsApp confirmado vai para revisão e não entra no grupo', async () => {
  const f = falso(dados('filho_numero'))
  f.evo.numerosComWhatsapp = async () => [{ existe: false }]
  await f.v.receber({ numero: '5519911112222', texto: '19 98888-7777' })
  assert.equal(f.grupos.length, 0); assert.equal(f.enviadas[0], RESPOSTAS.revisar)
})
test('compara número pelo DDD, tolerando 55 e nono dígito', () => {
  assert.equal(mesmoNumero('5519988887777', '19 8888-7777'), true)
  assert.equal(mesmoNumero('5519988887777', '11 98888-7777'), false)
  assert.equal(mesmoNumero('5519988887777', '98888-7777'), false)
  assert.equal(mesmoNumero('', ''), false)
})
