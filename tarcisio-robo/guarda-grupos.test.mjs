import test from 'node:test'
import assert from 'node:assert/strict'
import { criarGuardaGrupos, ErroGrupoProtegido, ErroGruposLimitados, LIMITES } from './guarda-grupos.mjs'

// Banco falso: cada consulta encadeada termina chamando `responder(tabela, ops)`.
function bancoFalso(responder) {
  const chamadas = []
  const from = (tabela, ops = []) => new Proxy({}, {
    get(_, nome) {
      if (nome === 'then') { const r = responder(tabela, ops); chamadas.push({ tabela, ops }); return (ok, erro) => Promise.resolve(r).then(ok, erro) }
      return (...args) => from(tabela, [...ops, [nome, ...args]])
    },
  })
  return { from, chamadas }
}
const GRUPOS = [{ jid: 'servos@g.us', papel: 'acolitos' }, { jid: 'pais@g.us', papel: 'pais' }, { jid: 'ceri@g.us', papel: 'cerimoniarios' }]
const FICHAS = [{ telefone: '19 99637-3583' }, { telefone: '5519912345678' }, { telefone: null }]
function montar({ excecoes = [], erroExcecoes = false, fichas = FICHAS, pausaAte = null, operacoes = [], erroOperacoes = false, erroConfig = false, agora = () => Date.parse('2026-11-10T12:00:00Z') } = {}) {
  const adicionados = [], removidos = [], registradas = []
  const db = bancoFalso((t, ops) => {
    if (t === 'tarcisio_grupos') return { data: GRUPOS }
    if (t === 'acolitos_membros') return { data: fichas }
    if (t === 'tarcisio_config') return erroConfig ? { data: null, error: { message: 'timeout' } } : { data: { pausa_grupos_ate: pausaAte } }
    if (t === 'tarcisio_grupo_operacoes') {
      if (ops.some((o) => o[0] === 'insert')) { registradas.push(ops.find((o) => o[0] === 'insert')[1]); return { error: null } }
      return erroOperacoes ? { data: null, error: { message: 'timeout' } } : { data: operacoes }
    }
    return erroExcecoes ? { data: null, error: { message: 'relation does not exist' } } : { data: excecoes }
  })
  const evo = {
    participantes: async () => [],
    adicionarAoGrupo: async (jid, numeros) => { adicionados.push([jid, numeros]); return { ok: true } },
    removerDoGrupo: async (jid, numeros) => { removidos.push([jid, numeros]); return { ok: true } },
  }
  const guarda = criarGuardaGrupos({ db, evo, log: { warn() {}, info() {} }, agora })
  return { guarda, adicionados, removidos, registradas, db }
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

test('o resto do cliente do Evolution continua disponível e fichas/grupos são lidos do banco só uma vez no prazo', async () => {
  const { guarda, db } = montar()
  assert.equal(typeof guarda.participantes, 'function')
  const lidas = () => db.chamadas.filter((c) => ['tarcisio_grupos', 'acolitos_membros'].includes(c.tabela)).length
  await guarda.adicionarAoGrupo('servos@g.us', ['5519996373583'])
  const antes = lidas()
  await guarda.adicionarAoGrupo('servos@g.us', ['5519996373583'])
  assert.equal(lidas(), antes, 'segunda chamada usa o cache de fichas e grupos (o ritmo é verificado sempre, no banco)')
})

// ── Ritmo das operações de grupo (restrição do WhatsApp em 05/11/2026) ───────────────────────────
const MIN = 60_000
const OK = Date.parse('2026-11-10T12:00:00Z')
const ha = (min) => new Date(OK - min * MIN).toISOString()

test('pausa ligada: nenhuma entrada nem saída de grupo, nem para telefone próprio', async () => {
  const { guarda, adicionados, removidos } = montar({ pausaAte: '2026-11-12T00:00:00Z' })
  await assert.rejects(() => guarda.adicionarAoGrupo('servos@g.us', ['5519996373583']), (e) => e instanceof ErroGruposLimitados && e.motivo === 'pausa')
  await assert.rejects(() => guarda.removerDoGrupo('servos@g.us', ['5519996373583']), ErroGruposLimitados)
  assert.equal(adicionados.length + removidos.length, 0)
})

test('pausa que já passou não bloqueia', async () => {
  const { guarda, adicionados } = montar({ pausaAte: '2026-11-09T00:00:00Z' })
  await guarda.adicionarAoGrupo('servos@g.us', ['5519996373583'])
  assert.equal(adicionados.length, 1)
})

test('intervalo mínimo entre operações de grupo', async () => {
  const { guarda, adicionados } = montar({ operacoes: [{ quando: ha(LIMITES.intervaloMinimoMs / MIN - 5), qtd: 1 }] })
  await assert.rejects(() => guarda.adicionarAoGrupo('servos@g.us', ['5519996373583']), (e) => e.motivo === 'intervalo')
  assert.equal(adicionados.length, 0)
  const { guarda: g2, adicionados: a2 } = montar({ operacoes: [{ quando: ha(LIMITES.intervaloMinimoMs / MIN + 5), qtd: 1 }] })
  await g2.adicionarAoGrupo('servos@g.us', ['5519996373583'])
  assert.equal(a2.length, 1)
})

test('limite por 24 h conta números, não chamadas', async () => {
  const ops = Array.from({ length: LIMITES.maximoPor24h }, (_, i) => ({ quando: ha(60 * (i + 2)), qtd: 1 }))
  const { guarda, adicionados } = montar({ operacoes: ops })
  await assert.rejects(() => guarda.adicionarAoGrupo('servos@g.us', ['5519996373583']), (e) => e.motivo === 'limite_diario')
  const { guarda: g2 } = montar({ operacoes: [{ quando: ha(120), qtd: LIMITES.maximoPor24h - 1 }] })
  await assert.rejects(() => g2.adicionarAoGrupo('servos@g.us', ['5519996373583', '5519912345678']), (e) => e.motivo === 'limite_diario', 'dois números estouram quando só sobra um')
  assert.equal(adicionados.length, 0)
})

test('operação que deu certo é registrada (quantidade e grupo, sem número inteiro)', async () => {
  const { guarda, registradas } = montar()
  await guarda.adicionarAoGrupo('servos@g.us', ['5519996373583'])
  await guarda.removerDoGrupo('ceri@g.us', ['5519996373583'])
  assert.equal(registradas.length, 2)
  assert.deepEqual(registradas.map((r) => [r.acao, r.papel, r.qtd]), [['adicionar', 'acolitos', 1], ['remover', 'cerimoniarios', 1]])
  assert.ok(!JSON.stringify(registradas).includes('5519996373583'), 'só guarda o final do número')
})

test('operação que falha no WhatsApp NÃO conta no limite', async () => {
  const { db, registradas } = montar()
  const guarda = criarGuardaGrupos({
    db: { from: (t, ops) => db.from(t, ops) }, evo: { adicionarAoGrupo: async () => { throw new Error('rate-overlimit') } },
    log: { warn() {}, info() {} }, agora: () => OK,
  })
  await assert.rejects(() => guarda.adicionarAoGrupo('servos@g.us', ['5519996373583']), /rate-overlimit/)
  assert.equal(registradas.length, 0, 'falhou no WhatsApp: não gasta a cota')
})

test('não conseguir ler a pausa ou o histórico BLOQUEIA (falha fechada)', async () => {
  for (const o of [{ erroConfig: true }, { erroOperacoes: true }]) {
    const { guarda, adicionados } = montar(o)
    await assert.rejects(() => guarda.adicionarAoGrupo('servos@g.us', ['5519996373583']))
    assert.equal(adicionados.length, 0)
  }
})

test('remover grupo respeita o ritmo mas não a regra de "só telefone próprio"', async () => {
  const { guarda, removidos } = montar()
  await guarda.removerDoGrupo('servos@g.us', ['5519988884140'])   // família: sair é permitido
  assert.equal(removidos.length, 1)
})

test('gruposLiberados() diz se pode agora e por quê, sem lançar erro', async () => {
  assert.deepEqual((await montar().guarda.gruposLiberados()).ok, true)
  const p = await montar({ pausaAte: '2026-11-12T00:00:00Z' }).guarda.gruposLiberados()
  assert.deepEqual([p.ok, p.motivo], [false, 'pausa'])
  assert.equal(p.ate, '2026-11-12T00:00:00.000Z')
  const e = await montar({ erroConfig: true }).guarda.gruposLiberados()
  assert.deepEqual([e.ok, e.motivo], [false, 'erro_leitura'])
})
