import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarEscalaAuto, montarMensagemConferencia } from './escala-auto.mjs'
import { criarEvolution } from './evolution.mjs'

// Banco em memória: from(t).select/insert/upsert/update + eq/gte/lte/lt/in, terminando em
// await, maybeSingle ou single. Só o necessário para a geração de terça e os lembretes.
function bancoMemoria(inicial = {}, falhar = () => false) {
  const t = structuredClone(inicial)
  let seq = 0
  const filtrar = (ops) => (r) => ops.every(([f, c, v]) =>
    f === 'eq' ? r[c] === v : f === 'gte' ? r[c] >= v : f === 'lte' ? r[c] <= v
      : f === 'lt' ? r[c] < v : f === 'in' ? v.includes(r[c]) : true)
  function exec(tabela, ops) {
    const linhas = (t[tabela] ||= [])
    const achar = (nome) => ops.find((o) => o[0] === nome)
    const casa = filtrar(ops.filter((o) => ['eq', 'gte', 'lte', 'lt', 'in'].includes(o[0])))
    const ins = achar('insert'), ups = achar('upsert'), upd = achar('update'), del = achar('delete')
    if (falhar(tabela, ops)) return { data: null, error: { message: `falha simulada em ${tabela}` } }
    if (del) { const fora = linhas.filter(casa); t[tabela] = linhas.filter((r) => !fora.includes(r)); return { data: fora, error: null } }
    if (ins) { const novos = [].concat(ins[1]).map((x) => ({ id: `e${++seq}`, ...x })); linhas.push(...novos); return { data: novos, error: null } }
    if (ups) {
      const chave = ups[2].onConflict
      const novos = [].concat(ups[1]).filter((n) => !linhas.some((r) => r[chave] === n[chave])).map((x) => ({ lembretes: 0, ...x }))
      linhas.push(...novos)
      return { data: novos, error: null }
    }
    if (upd) { const alvo = linhas.filter(casa); alvo.forEach((r) => Object.assign(r, upd[1])); return { data: alvo, error: null } }
    const achados = linhas.filter(casa)
    if (achar('maybeSingle')) return { data: achados[0] ?? null, error: null }
    if (achar('single')) return { data: achados[0], error: null }
    return { data: achados, error: null }
  }
  const from = (tabela) => {
    const ops = []
    const q = new Proxy({}, {
      get(_, nome) {
        if (nome === 'then') return (ok, erro) => Promise.resolve(exec(tabela, ops)).then(ok, erro)
        return (...args) => { ops.push([nome, ...args]); return q }
      },
    })
    return q
  }
  return { from, t }
}

const silencioso = { info() {}, warn() {}, error() {} }
const CFG = { id: 1, pausado: false, numero_conferencia: '5519999071702', janela_inicio: '08:00:00', janela_fim: '21:00:00' }
const SAB = '2026-10-24'
const CELS = [
  { id: 'c1', data: '2026-10-24', horario: '17h', minutos: 1020, comunidade: 'matriz', tipo: 'missa_comum' },
  { id: 'c2', data: '2026-10-25', horario: '9h', minutos: 540, comunidade: 'santo_antonio', tipo: 'missa_comum' },
]
const MEMBROS = [{ id: 'm1', nome: 'Ana Souza', apelido: 'Ana' }, { id: 'm2', nome: 'Bia Lima', apelido: 'Bia' }]
const RESULTADO = { novas: [{ celebracao_id: 'c1', membro_id: 'm1', funcao: 'cruz' }], vazias: [], alemDoMinimo: [], semanalPendentes: [] }

// Terça 20/10/2026, 18:01 em Brasília = 21:01 UTC.
const TERCA_1801 = '2026-10-20T21:01:00Z'

function cenario({ banco = {}, resultado = RESULTADO, lancar = null, celebracoes = CELS, falhar, evoFalha = null, montarMensagem } = {}) {
  const db = bancoMemoria(banco, falhar)
  const enviados = []
  const evo = {
    enviarBotoes: async (d, texto, botoes) => { if (evoFalha) throw evoFalha; enviados.push({ d, texto, botoes }); return { key: { id: 'msg1' } } },
    enviarTexto: async (d, texto) => { if (evoFalha) throw evoFalha; enviados.push({ d, texto }) },
  }
  const chamadas = { gerar: 0 }
  const deps = {
    db, evo, log: silencioso, rnd: () => 0.5, ...(montarMensagem ? { montarMensagem } : {}),
    carregarEntrada: async () => ({ celebracoes, membros: MEMBROS, escalasExistentes: {} }),
    gerarSemana: (entrada) => { chamadas.gerar++; assert.equal(typeof entrada.rnd, 'function'); if (lancar) throw lancar; return resultado },
  }
  const novo = () => criarEscalaAuto(deps)
  return { db, enviados, chamadas, novo, auto: novo() }
}
const linhaSemana = (db) => db.t.tarcisio_escala_auto?.find((r) => r.semana === SAB)

test('gera uma vez; segunda rodada e reinício não geram', async () => {
  const c = cenario()
  await c.auto.cuidar(new Date(TERCA_1801), CFG)
  await c.auto.cuidar(new Date('2026-10-20T21:30:00Z'), CFG)
  await c.novo().cuidar(new Date('2026-10-20T22:00:00Z'), CFG)   // robô reiniciou
  assert.equal(c.chamadas.gerar, 1)
  assert.deepEqual(c.db.t.acolitos_escalas.map(({ celebracao_id, membro_id, funcao }) => ({ celebracao_id, membro_id, funcao })),
    [{ celebracao_id: 'c1', membro_id: 'm1', funcao: 'cruz' }])
  assert.equal(c.enviados.length, 1)
  assert.equal(c.enviados[0].d, '5519999071702')
  assert.deepEqual(c.enviados[0].botoes.map((b) => b.id), [`escala:confirmar:${SAB}`, `escala:revisar:${SAB}`])
  assert.equal(linhaSemana(c.db).estado, 'aguardando')
  assert.equal(linhaSemana(c.db).mensagem_dono_id, 'msg1')

  // reinício no MEIO da geração (linha presa em 'gerando'): não gera de novo; passados 15 min, avisa o dono
  const m = cenario({ banco: { tarcisio_escala_auto: [{ semana: SAB, estado: 'gerando', gerada_em: '2026-10-20T21:01:00.000Z', lembretes: 0 }] } })
  await m.auto.cuidar(new Date('2026-10-20T21:05:00Z'), CFG)
  assert.equal(m.chamadas.gerar, 0)
  assert.equal(m.enviados.length, 0)
  await m.auto.cuidar(new Date('2026-10-20T21:20:00Z'), CFG)
  await m.novo().cuidar(new Date('2026-10-20T21:25:00Z'), CFG)
  assert.equal(m.chamadas.gerar, 0)
  assert.equal(linhaSemana(m.db).estado, 'falhou')
  assert.equal(m.enviados.length, 1)
  assert.match(m.enviados[0].texto, /parou no meio/)
})

test('semana já confirmada: não grava, avisa o dono', async () => {
  const c = cenario({ banco: { acolitos_config: [{ chave: 'escala_avisados', valor: { '2026-10-24': ['m1'] } }] } })
  await c.auto.cuidar(new Date(TERCA_1801), CFG)
  assert.equal(c.chamadas.gerar, 0)
  assert.equal((c.db.t.acolitos_escalas || []).length, 0)
  assert.equal(linhaSemana(c.db).estado, 'ja_confirmada')
  assert.equal(c.enviados.length, 1)
  assert.equal(c.enviados[0].d, '5519999071702')
  assert.match(c.enviados[0].texto, /já está confirmada/)
  // a arte já pedida (tarcisio_pedir_escala) também conta como confirmada
  const a = cenario({ banco: { tarcisio_envios: [{ chave_unica: 'escala:2026-10-25', estado: 'enviado' }] } })
  await a.auto.cuidar(new Date(TERCA_1801), CFG)
  assert.equal(a.chamadas.gerar, 0)
  assert.equal(linhaSemana(a.db).estado, 'ja_confirmada')
})

test('sem missas: não grava, avisa o dono', async () => {
  const c = cenario({ celebracoes: [] })
  await c.auto.cuidar(new Date(TERCA_1801), CFG)
  assert.equal(c.chamadas.gerar, 0)
  assert.equal((c.db.t.acolitos_escalas || []).length, 0)
  assert.equal(linhaSemana(c.db).estado, 'sem_missas')
  assert.equal(c.enviados.length, 1)
  assert.match(c.enviados[0].texto, /nenhuma missa/i)
})

test('gerador lança: nada gravado, estado falhou, dono avisado', async () => {
  const c = cenario({ lancar: new Error('kit sem dados') })
  await c.auto.cuidar(new Date(TERCA_1801), CFG)
  await c.auto.cuidar(new Date('2026-10-20T21:10:00Z'), CFG)
  assert.equal(c.chamadas.gerar, 1)
  assert.equal((c.db.t.acolitos_escalas || []).length, 0)
  assert.equal(linhaSemana(c.db).estado, 'falhou')
  assert.match(linhaSemana(c.db).erro, /kit sem dados/)
  assert.equal(c.enviados.length, 1)
  assert.equal(c.enviados[0].d, '5519999071702')
  assert.match(c.enviados[0].texto, /falhou/)
  assert.match(c.enviados[0].texto, /kit sem dados/)
})

test('mensagem lista vazias, além do mínimo e filho sem vaga', () => {
  const semana = { sabado: SAB, celebracoes: CELS, membros: [...MEMBROS, { id: 'm3', nome: 'Caio Dias' }],
    escalasExistentes: { c2: [{ celebracao_id: 'c2', membro_id: 'm2', funcao: 'altar' }] } }
  const texto = montarMensagemConferencia(semana, {
    novas: [{ celebracao_id: 'c1', membro_id: 'm1', funcao: 'cruz' }],
    vazias: [{ celebracao_id: 'c1', funcao: 'vela' }, { celebracao_id: 'c2', funcao: 'turibulo' }],
    alemDoMinimo: [{ membro_id: 'm2', vezes: 3 }],
    semanalPendentes: [],
    semVagaFilhoDeMinistro: [{ membro_id: 'm3', motivo: 'ausente' }],
    semMinistros: true,
  })
  assert.match(texto, /sábado, 24\/10/)
  assert.match(texto, /17h — Matriz/)
  assert.match(texto, /Cruz — Ana/)
  assert.match(texto, /Altar — Bia/)             // o que já estava montado também aparece
  assert.match(texto, /Vagas vazias/)
  assert.match(texto, /Velas/)
  assert.match(texto, /Turíbulo/)
  assert.match(texto, /Passou de 2×[\s\S]*Bia 3×/)
  assert.match(texto, /Filho de ministro sem vaga[\s\S]*Caio Dias \(ausente\)/)
  assert.match(texto, /Escala dos ministros não enviada/)
  assert.match(texto, /ninguém foi avisado/i)
  assert.match(texto, /"1"[^\n]*Confirmar/)
  assert.match(texto, /"2"[^\n]*Revisar/)

  // campos opcionais ausentes: sem blocos extras e sem quebrar
  const curto = montarMensagemConferencia({ sabado: SAB, celebracoes: CELS, membros: MEMBROS, escalasExistentes: {} },
    { novas: [{ celebracao_id: 'c1', membro_id: 'm1', funcao: 'cruz' }] })
  assert.match(curto, /Cruz — Ana/)
  for (const bloco of ['Vagas vazias', 'Passou de 2×', 'Filho de ministro sem vaga', 'Escala dos ministros não enviada']) {
    assert.ok(!curto.includes(bloco), `não devia ter "${bloco}"`)
  }
})

test('lembretes 20h terça e 9h quarta, depois param', async () => {
  const c = cenario({ banco: { tarcisio_escala_auto: [{ semana: SAB, estado: 'aguardando', lembretes: 0, gerada_em: '2026-10-20T21:01:00Z',
    resumo: { texto: 'Escala de teste' } }] } })
  const horas = [
    ['2026-10-20T22:59:00Z', 0], // terça 19:59
    ['2026-10-20T23:00:00Z', 1], // terça 20:00
    ['2026-10-20T23:10:00Z', 1],
    ['2026-10-21T11:59:00Z', 1], // quarta 08:59
    ['2026-10-21T12:00:00Z', 2], // quarta 09:00
    ['2026-10-21T12:05:00Z', 2],
    ['2026-10-21T23:00:00Z', 2], // quarta 20:00
    ['2026-10-22T12:00:00Z', 2], // quinta 09:00
  ]
  for (const [hora, esperado] of horas) {
    await c.novo().cuidar(new Date(hora), CFG)   // instância nova a cada vez: reinício não repete
    assert.equal(c.enviados.length, esperado, `às ${hora}`)
  }
  assert.ok(c.enviados.every((e) => e.d === '5519999071702' && e.botoes?.length === 2))
  assert.match(c.enviados[0].texto, /Lembrete[\s\S]*Escala de teste/)
  assert.equal(linhaSemana(c.db).lembretes, 2)

  // confirmada antes das 20h: nenhum lembrete
  const d = cenario({ banco: { tarcisio_escala_auto: [{ semana: SAB, estado: 'confirmada', lembretes: 0, resumo: { texto: 'x' } }] } })
  await d.auto.cuidar(new Date('2026-10-20T23:00:00Z'), CFG)
  assert.equal(d.enviados.length, 0)
})

test('horário em America/Sao_Paulo (18:01 UTC-3)', async () => {
  const c = cenario()
  await c.auto.cuidar(new Date('2026-10-20T18:01:00Z'), CFG)   // 18:01 UTC = 15:01 em Brasília
  await c.auto.cuidar(new Date('2026-10-20T21:00:00Z'), CFG)   // 18:00 em Brasília: ainda não
  await c.auto.cuidar(new Date('2026-10-19T21:01:00Z'), CFG)   // segunda 18:01: não
  assert.equal(c.chamadas.gerar, 0)
  assert.equal(c.db.t.tarcisio_escala_auto?.length ?? 0, 0)
  await c.auto.cuidar(new Date('2026-10-20T21:01:00Z'), CFG)   // 18:01 em Brasília
  assert.equal(c.chamadas.gerar, 1)
  assert.equal(linhaSemana(c.db).semana, SAB)

  // 00:30 UTC de quarta ainda é terça 21:30 em Brasília
  const n = cenario()
  await n.auto.cuidar(new Date('2026-10-21T00:30:00Z'), CFG)
  assert.equal(n.chamadas.gerar, 1)
  // quarta 18:01 em Brasília: não gera
  const q = cenario()
  await q.auto.cuidar(new Date('2026-10-21T21:01:00Z'), CFG)
  assert.equal(q.chamadas.gerar, 0)
})

const escalasGravadas = (db) => (db.t.acolitos_escalas || []).length

test('lembrete não sai se a semana já foi confirmada no app; estado vira confirmada', async () => {
  const c = cenario({ banco: {
    tarcisio_escala_auto: [{ semana: SAB, estado: 'aguardando', lembretes: 0, resumo: { texto: 'x' } }],
    acolitos_config: [{ chave: 'escala_avisados', valor: { '2026-10-24': ['m1'] } }],
  } })
  await c.auto.cuidar(new Date('2026-10-20T23:00:00Z'), CFG)   // terça 20:00
  await c.novo().cuidar(new Date('2026-10-21T12:00:00Z'), CFG) // quarta 09:00
  assert.equal(c.enviados.length, 0)
  assert.equal(linhaSemana(c.db).estado, 'confirmada')
})

test('falha depois de gravar (montar a mensagem): apaga o que esta rodada gravou, falhou, dono avisado', async () => {
  const c = cenario({
    banco: { acolitos_escalas: [{ id: 'antiga', celebracao_id: 'c2', membro_id: 'm2', funcao: 'altar' }] },
    montarMensagem: () => { throw new Error('quebrou o texto') },
  })
  await c.auto.cuidar(new Date(TERCA_1801), CFG)
  assert.deepEqual(c.db.t.acolitos_escalas.map((e) => e.id), ['antiga'])   // só a desta rodada saiu
  assert.equal(linhaSemana(c.db).estado, 'falhou')
  assert.equal(c.enviados.length, 1)
  assert.match(c.enviados[0].texto, /Nada foi gravado/)
  assert.doesNotMatch(c.enviados[0].texto, /gravada como rascunho/)
})

test('gravar aguardando falha depois da mensagem: apaga, falhou, dono manda desconsiderar', async () => {
  const c = cenario({ falhar: (tabela, ops) => tabela === 'tarcisio_escala_auto' && ops.some((o) => o[0] === 'update' && o[1].estado === 'aguardando') })
  await c.auto.cuidar(new Date(TERCA_1801), CFG)
  assert.equal(escalasGravadas(c.db), 0)
  assert.equal(linhaSemana(c.db).estado, 'falhou')
  assert.equal(c.enviados.length, 2)
  assert.ok(c.enviados[0].botoes)
  assert.match(c.enviados[1].texto, /Desconsidere a mensagem anterior/)
  assert.match(c.enviados[1].texto, /Nada foi gravado/)
  // e não vira "parou no meio" depois
  await c.novo().cuidar(new Date('2026-10-20T21:30:00Z'), CFG)
  assert.equal(c.enviados.length, 2)
})

test('botões e texto falham: não fica aguardando; apaga o gravado e marca falhou', async () => {
  const c = cenario({ evoFalha: new Error('Evolution fora') })
  await c.auto.cuidar(new Date(TERCA_1801), CFG)
  assert.equal(escalasGravadas(c.db), 0)
  assert.equal(linhaSemana(c.db).estado, 'falhou')
  assert.match(linhaSemana(c.db).erro, /Evolution fora/)
})

test('terça perdida: quarta 9h avisa o dono uma vez e não gera', async () => {
  const c = cenario()
  await c.auto.cuidar(new Date('2026-10-21T11:59:00Z'), CFG)   // quarta 08:59: ainda nada
  assert.equal(c.enviados.length, 0)
  await c.auto.cuidar(new Date('2026-10-21T12:00:00Z'), CFG)   // quarta 09:00
  await c.auto.cuidar(new Date('2026-10-21T13:00:00Z'), CFG)
  await c.novo().cuidar(new Date('2026-10-21T18:00:00Z'), CFG) // reinício
  assert.equal(c.chamadas.gerar, 0)
  assert.equal(escalasGravadas(c.db), 0)
  assert.equal(c.enviados.length, 1)
  assert.match(c.enviados[0].texto, /não rodou/)
  assert.match(c.enviados[0].texto, /app/)
  // semana que rodou na terça: quarta não manda nada disso
  const ok = cenario({ banco: { tarcisio_escala_auto: [{ semana: SAB, estado: 'confirmada', lembretes: 0 }] } })
  await ok.auto.cuidar(new Date('2026-10-21T12:00:00Z'), CFG)
  assert.equal(ok.enviados.length, 0)
})

// evolution.enviarBotoes: corpo do /message/sendButtons (fetch falso, nenhum envio de verdade)
test('evolution.enviarBotoes chama sendButtons com os botões de resposta', async () => {
  const pedidos = []
  const fetchFn = async (url, init) => { pedidos.push({ url, init }); return { ok: true, status: 201, text: async () => '{"key":{"id":"abc"}}' } }
  const evo = criarEvolution({ url: 'http://127.0.0.1:8080/', chave: 'k', instancia: 'SaoTarcisio', fetchFn })
  const r = await evo.enviarBotoes('5519999071702', 'Escala\nlinha 2', [{ id: 'escala:confirmar', texto: 'Confirmar' }, { id: 'escala:revisar', texto: 'Revisar' }])
  assert.equal(r.key.id, 'abc')
  assert.equal(pedidos[0].url, 'http://127.0.0.1:8080/message/sendButtons/SaoTarcisio')
  assert.equal(pedidos[0].init.method, 'POST')
  const corpo = JSON.parse(pedidos[0].init.body)
  assert.equal(corpo.number, '5519999071702')
  assert.ok(corpo.title)
  assert.equal(corpo.description, 'Escala\nlinha 2')
  assert.deepEqual(corpo.buttons, [
    { type: 'reply', displayText: 'Confirmar', id: 'escala:confirmar' },
    { type: 'reply', displayText: 'Revisar', id: 'escala:revisar' },
  ])
})
