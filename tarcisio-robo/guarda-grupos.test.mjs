import test from 'node:test'
import assert from 'node:assert/strict'
import { criarGuardaGrupos, ErroGrupoProtegido } from './guarda-grupos.mjs'

// Banco falso: cada consulta encadeada termina chamando `responder(tabela)`.
function bancoFalso(responder) {
  const chamadas = []
  const from = (tabela) => new Proxy({}, {
    get(_, nome) {
      if (nome === 'then') { const r = responder(tabela); chamadas.push(tabela); return (ok, erro) => Promise.resolve(r).then(ok, erro) }
      return () => from(tabela)
    },
  })
  return { from, chamadas }
}
const GRUPOS = [{ jid: 'servos@g.us', papel: 'acolitos' }, { jid: 'pais@g.us', papel: 'pais' }, { jid: 'ceri@g.us', papel: 'cerimoniarios' }]
const FICHAS = [{ telefone: '19 99637-3583' }, { telefone: '5519912345678' }, { telefone: null }]
function montar({ excecoes = [], erroExcecoes = false, fichas = FICHAS } = {}) {
  const adicionados = []
  const db = bancoFalso((t) => t === 'tarcisio_grupos' ? { data: GRUPOS }
    : t === 'acolitos_membros' ? { data: fichas }
    : erroExcecoes ? { data: null, error: { message: 'relation does not exist' } } : { data: excecoes })
  const evo = { participantes: async () => [], adicionarAoGrupo: async (jid, numeros) => { adicionados.push([jid, numeros]); return { ok: true } } }
  const guarda = criarGuardaGrupos({ db, evo, log: { warn() {}, info() {} } })
  return { guarda, adicionados, db }
}

test('telefone PRÓPRIO de uma ficha entra no grupo dos servos (qualquer formatação)', async () => {
  const { guarda, adicionados } = montar()
  await guarda.adicionarAoGrupo('servos@g.us', ['5519996373583'])
  await guarda.adicionarAoGrupo('servos@g.us', ['5519912345678'])
  assert.equal(adicionados.length, 2)
})

test('número de FAMÍLIA (não é telefone próprio de ficha nenhuma) é barrado no grupo dos servos', async () => {
  const { guarda, adicionados } = montar()
  await assert.rejects(() => guarda.adicionarAoGrupo('servos@g.us', ['5519988884140']), ErroGrupoProtegido)
  assert.equal(adicionados.length, 0, 'não chega ao WhatsApp')
})

test('o grupo dos cerimoniários tem a mesma proteção', async () => {
  const { guarda, adicionados } = montar()
  await assert.rejects(() => guarda.adicionarAoGrupo('ceri@g.us', ['5519988884140']), ErroGrupoProtegido)
  assert.equal(adicionados.length, 0)
})

test('lista mista: se um número é barrado, NINGUÉM da lista é adicionado', async () => {
  const { guarda, adicionados } = montar()
  await assert.rejects(() => guarda.adicionarAoGrupo('servos@g.us', ['5519996373583', '5519988884140']), ErroGrupoProtegido)
  assert.equal(adicionados.length, 0)
})

test('exceção registrada pela coordenação libera aquele número naquele grupo', async () => {
  const { guarda, adicionados } = montar({ excecoes: [{ numero_fim: '88889828', papel: 'acolitos' }] })
  await guarda.adicionarAoGrupo('servos@g.us', ['5519988889828'])
  assert.equal(adicionados.length, 1)
  await assert.rejects(() => guarda.adicionarAoGrupo('ceri@g.us', ['5519988889828']), ErroGrupoProtegido, 'a exceção é do grupo dos servos, não dos cerimoniários')
})

test('o grupo de PAIS não tem trava: família entra livremente', async () => {
  const { guarda, adicionados } = montar()
  await guarda.adicionarAoGrupo('pais@g.us', ['5519988884140'])
  assert.equal(adicionados.length, 1)
})

test('grupo desconhecido passa direto (a trava só protege os grupos de servos)', async () => {
  const { guarda, adicionados } = montar()
  await guarda.adicionarAoGrupo('outro@g.us', ['5519988884140'])
  assert.equal(adicionados.length, 1)
})

test('tabela de exceções ainda não existe: segue sem exceções e a trava vale', async () => {
  const { guarda, adicionados } = montar({ erroExcecoes: true })
  await assert.rejects(() => guarda.adicionarAoGrupo('servos@g.us', ['5519988884140']), ErroGrupoProtegido)
  await guarda.adicionarAoGrupo('servos@g.us', ['5519996373583'])
  assert.equal(adicionados.length, 1)
})

test('falha ao ler as fichas NUNCA libera a entrada (falha fechada)', async () => {
  const db = bancoFalso((t) => t === 'tarcisio_grupos' ? { data: GRUPOS } : { data: null, error: { message: 'timeout' } })
  const adicionados = []
  const guarda = criarGuardaGrupos({ db, evo: { adicionarAoGrupo: async (...a) => adicionados.push(a) }, log: { warn() {}, info() {} } })
  await assert.rejects(() => guarda.adicionarAoGrupo('servos@g.us', ['5519996373583']))
  assert.equal(adicionados.length, 0)
})

test('o resto do cliente do Evolution continua disponível e a lista é lida do banco só uma vez no prazo', async () => {
  const { guarda, db } = montar()
  assert.equal(typeof guarda.participantes, 'function')
  await guarda.adicionarAoGrupo('servos@g.us', ['5519996373583'])
  const antes = db.chamadas.length
  await guarda.adicionarAoGrupo('servos@g.us', ['5519996373583'])
  assert.equal(db.chamadas.length, antes, 'segunda chamada usa o cache')
})
