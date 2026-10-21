import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarAssistente } from './assistente.mjs'
import { lerMensagemRecebida } from './evolution.mjs'

// Banco falso (mesmo jeito do robo.test.mjs): `responder(tabela, ops)` devolve { data, error }.
function bancoFalso(responder) {
  const gravado = []
  const from = (tabela) => {
    const ops = []
    const q = new Proxy({}, {
      get(_, nome) {
        if (nome === 'then') {
          const ins = ops.find((o) => o[0] === 'insert'); if (ins) gravado.push({ tabela, op: 'insert', dados: ins[1] })
          const del = ops.find((o) => o[0] === 'delete'); if (del) gravado.push({ tabela, op: 'delete', ops })
          const r = responder(tabela, ops)
          return (ok, erro) => Promise.resolve(r ?? { data: null, error: null }).then(ok, erro)
        }
        return (...args) => { ops.push([nome, ...args]); return q }
      },
    })
    return q
  }
  return { from, gravado }
}

const NUM_MAE = '5519998765432'
const joao = { id: 'm1', nome: 'João Pedro Albuquerque', celular_recado: '(19) 99876-5432', grupo_irmaos: 'g1', escalar_com_irmao: true, data_nascimento: '2014-05-01' }
const maria = { id: 'm2', nome: 'Maria Clara Albuquerque', celular_mae: '19998765432', grupo_irmaos: 'g1', escalar_com_irmao: true, data_nascimento: '2016-02-02' }
const outro = { id: 'm3', nome: 'Pedro Henrique Siqueira', celular_recado: '19911112222' }
const TODOS = [joao, maria, outro]
const silencioso = { info() {}, warn() {}, error() {} }

function montar({ avisados = { '2026-10-24': ['m1'] }, ia = null } = {}) {
  const db = bancoFalso((tabela) => {
    if (tabela === 'acolitos_config') return { data: { valor: avisados } }
    if (tabela === 'acolitos_membros') return { data: TODOS }
    return { data: [] }
  })
  const enviados = []
  const evo = { enviarTexto: async (n, t) => enviados.push({ n, t }) }
  const a = criarAssistente({ db, evo, ia, relogio: () => new Date('2026-10-21T15:00:00Z'), log: silencioso })
  return { a, db, enviados }
}

test('ausência: semana confirmada não muda, a outra é registrada, a passada é ignorada, o irmão vai junto', async () => {
  const { a, db } = montar()
  const exec = a.executorPara(NUM_MAE, [joao, maria], TODOS)
  const r = await exec('registrar_ausencia', { membro_id: 'm1', datas: ['2026-10-25', '2026-11-01', '2026-10-01'], motivo: 'viagem' })
  assert.deepEqual(r.registradas, ['2026-11-01'])
  assert.deepEqual(r.confirmadas_nao_mudam, ['2026-10-25'])
  assert.deepEqual(r.passadas_ignoradas, ['2026-10-01'])
  assert.deepEqual(r.tambem_para, ['Maria'])
  const ins = db.gravado.find((g) => g.tabela === 'acolitos_ausencias' && g.op === 'insert')
  assert.deepEqual(ins.dados.map((x) => [x.membro_id, x.data, x.motivo]), [['m1', '2026-11-01', 'viagem'], ['m2', '2026-11-01', 'viagem']])
})

test('ausência de servo que não é deste número é recusada e nada é gravado', async () => {
  const { a, db } = montar()
  const r = await a.executorPara(NUM_MAE, [joao, maria], TODOS)('registrar_ausencia', { membro_id: 'm3', datas: ['2026-11-01'] })
  assert.match(r.erro, /não está ligado/)
  assert.equal(db.gravado.length, 0)
})

test('semana toda confirmada: nada é gravado', async () => {
  const { a, db } = montar()
  const r = await a.executorPara(NUM_MAE, [joao, maria], TODOS)('registrar_ausencia', { membro_id: 'm1', datas: ['2026-10-24', '2026-10-25'] })
  assert.deepEqual(r.registradas, [])
  assert.equal(db.gravado.filter((g) => g.tabela === 'acolitos_ausencias').length, 0)
})

test('número desconhecido: identificar abre pendência com candidatos e NÃO devolve dado do cadastro', async () => {
  const { a, db } = montar()
  const r = await a.executorPara('5511900000000', [], TODOS)('identificar', { nome_completo: 'joao pedro albuquerque', data_nascimento: '2014-05-01', relacao: 'mae', nome_de_quem_fala: 'Ana' })
  assert.deepEqual(r, { ok: true, encaminhado_para_coordenacao: true })
  const p = db.gravado.find((g) => g.tabela === 'tarcisio_pendencias')
  assert.equal(p.dados.tipo, 'vincular_numero')
  assert.deepEqual(p.dados.dados.candidatos.map((c) => c.id), ['m1'])
})

test('número desconhecido não consegue ver escala', async () => {
  const { a } = montar()
  const r = await a.executorPara('5511900000000', [], TODOS)('escala_dos_meus', {})
  assert.ok(r.erro)
})

test('desconhecido: a IA recebe só identificar e chamar_coordenacao; conhecido recebe as ferramentas dele', async () => {
  const vistos = []
  const ia = { conversar: async ({ ferramentas, sistema }) => { vistos.push({ nomes: ferramentas.map((f) => f.name), sistema }); return { texto: 'oi', usadas: [] } } }
  for (const [numero, esperado] of [['5511900000000', ['identificar', 'chamar_coordenacao']], [NUM_MAE, ['escala_dos_meus', 'registrar_ausencia', 'chamar_coordenacao']]]) {
    const db = bancoFalso((tabela, ops) => {
      if (tabela === 'acolitos_membros') return { data: TODOS }
      if (tabela === 'tarcisio_mensagens' && ops.some((o) => o[0] === 'limit')) return { data: [{ direcao: 'entrada', texto: 'oi' }] }
      if (tabela === 'tarcisio_mensagens' && ops.some((o) => o[0] === 'order')) return { data: [{ id: 'x', texto: 'oi' }] }
      return { data: [] }
    })
    const a = criarAssistente({ db, evo: { enviarTexto: async () => {} }, ia, log: silencioso })
    await a.responder({ persona_nome: 'São Tarcísio', persona_tom: 't', persona_regras: 'r', ia_modelo: 'm' }, numero, true)
    assert.deepEqual(vistos.at(-1).nomes, esperado)
  }
  assert.match(vistos[0].sistema, /NÃO está ligado/)
  assert.match(vistos[1].sistema, /João Pedro Albuquerque/)
})

test('áudio sem texto: pede para escrever, sem chamar a IA', async () => {
  let chamou = false
  const db = bancoFalso((tabela) => (tabela === 'acolitos_membros' ? { data: TODOS } : tabela === 'tarcisio_mensagens' ? { data: [{ id: 'x', texto: null, midia: 'audio' }] } : { data: [] }))
  const enviados = []
  const a = criarAssistente({ db, evo: { enviarTexto: async (n, t) => enviados.push(t) }, ia: { conversar: async () => { chamou = true } }, log: silencioso })
  await a.responder({ ia_modelo: 'm' }, NUM_MAE, true)
  assert.equal(chamou, false)
  assert.match(enviados[0], /texto/)
})

test('lê mensagem recebida; ignora grupo, status e o que o próprio número mandou', () => {
  const ev = (key, message = { conversation: 'oi' }) => ({ event: 'messages.upsert', data: { key, message } })
  assert.deepEqual(lerMensagemRecebida(ev({ remoteJid: '5519998765432@s.whatsapp.net', id: 'A1', fromMe: false })),
    { numero: '5519998765432', external_id: 'A1', texto: 'oi', midia: null })
  assert.equal(lerMensagemRecebida(ev({ remoteJid: '123@g.us', id: 'A2' })), null)
  assert.equal(lerMensagemRecebida(ev({ remoteJid: '5519998765432@s.whatsapp.net', id: 'A3', fromMe: true })), null)
  assert.equal(lerMensagemRecebida(ev({ remoteJid: 'status@broadcast', id: 'A4' })), null)
  assert.equal(lerMensagemRecebida(ev({ remoteJid: '999@lid', remoteJidAlt: '5519998765432@s.whatsapp.net', id: 'A5' })).numero, '5519998765432')
  assert.equal(lerMensagemRecebida(ev({ remoteJid: '5519998765432@s.whatsapp.net', id: 'A6' }, { audioMessage: {} })).midia, 'audio')
  assert.equal(lerMensagemRecebida({ event: 'connection.update', data: {} }), null)
})
