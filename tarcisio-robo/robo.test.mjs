import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarRobo } from './robo.mjs'
import { ErroGateway } from './evolution.mjs'

// Banco falso: cada consulta encadeada (from().select().eq()…) termina chamando `responder`,
// que recebe a tabela e a lista de operações e devolve { data, error, count }.
function bancoFalso(responder) {
  const chamadas = []
  const from = (tabela) => {
    const ops = []
    const q = new Proxy({}, {
      get(_, nome) {
        if (nome === 'then') {
          const r = responder(tabela, ops)
          chamadas.push({ tabela, ops })
          return (ok, erro) => Promise.resolve(r ?? { data: null, error: null }).then(ok, erro)
        }
        return (...args) => { ops.push([nome, ...args]); return q }
      },
    })
    return q
  }
  return { from, chamadas }
}
const op = (ops, nome) => ops.find((o) => o[0] === nome)
const silencioso = { info() {}, warn() {}, error() {} }

const CFG = {
  id: 1, pausado: false, teto_diario: 2, janela_inicio: '08:00:00', janela_fim: '21:00:00',
  hora_lembrete: '19:00:00', hora_aniversario: '08:00:00', lembrete_ligado: false, aniversario_ligado: false,
  escala_ligada: true, rodape: '', numero_conectado: '5519900000000', qr_code: null, pedir_qr_em: null, pedir_grupos_em: null,
}

function cenario({ item, enviadosHoje = 0, cfg = {}, falha = null, hora = '2026-10-20T15:00:00Z' }) {
  const enviados = []
  const updates = []
  const db = bancoFalso((tabela, ops) => {
    if (tabela === 'tarcisio_config') return op(ops, 'single') ? { data: { ...CFG, ...cfg } } : { data: null }
    if (tabela !== 'tarcisio_envios') return { data: [] }
    if (op(ops, 'update')) { updates.push(op(ops, 'update')[1]); return { data: [{ id: 'x' }] } }
    if (op(ops, 'maybeSingle')) return { data: item }
    if (op(ops, 'select')?.[2]?.head) return { count: enviadosHoje }
    return { data: [] }
  })
  const evo = {
    estado: async () => 'open', numeroConectado: async () => '5519900000000',
    enviarTexto: async (d, t) => { if (falha) throw falha; enviados.push({ d, t }) },
    enviarImagem: async (d, u) => { if (falha) throw falha; enviados.push({ d, u }) },
  }
  const robo = criarRobo({ db, evo, relogio: () => new Date(hora), rnd: () => 0, log: silencioso })
  return { robo, enviados, updates }
}

const ITEM = { id: 'e1', tipo: 'lembrete', destino_numero: '5519998765432', texto: 'Olá', tentativas: 0 }

test('envia o item vencido e marca enviado', async () => {
  const { robo, enviados, updates } = cenario({ item: ITEM })
  await robo.rodada()
  assert.deepEqual(enviados, [{ d: '5519998765432', t: 'Olá' }])
  assert.equal(updates.at(-1).estado, 'enviado')
})

test('fora da janela (22h de Brasília) nada sai', async () => {
  const { robo, enviados } = cenario({ item: ITEM, hora: '2026-10-21T01:00:00Z' })
  await robo.rodada()
  assert.equal(enviados.length, 0)
})

test('pausado nada sai', async () => {
  const { robo, enviados } = cenario({ item: ITEM, cfg: { pausado: true } })
  await robo.rodada()
  assert.equal(enviados.length, 0)
})

test('teto do dia segura o privado, mas grupo não conta', async () => {
  const privado = cenario({ item: ITEM, enviadosHoje: 2 })
  await privado.robo.rodada()
  assert.equal(privado.enviados.length, 0)
  const grupo = cenario({ item: { ...ITEM, destino_numero: null, destino_jid: '123@g.us', imagem_url: 'https://x/arte.png' }, enviadosHoje: 2 })
  await grupo.robo.rodada()
  assert.deepEqual(grupo.enviados, [{ d: '123@g.us', u: 'https://x/arte.png' }])
})

test('erro passageiro volta para a fila em 5 min; na 3ª tentativa desiste', async () => {
  const um = cenario({ item: ITEM, falha: new ErroGateway(500, 'caiu') })
  await um.robo.rodada()
  assert.equal(um.updates.at(-1).estado, 'pendente')
  assert.equal(um.updates.at(-1).agendado_para, '2026-10-20T15:05:00.000Z')
  const tres = cenario({ item: { ...ITEM, tentativas: 2 }, falha: new ErroGateway(500, 'caiu') })
  await tres.robo.rodada()
  assert.equal(tres.updates.at(-1).estado, 'falhou')
})

test('número sem WhatsApp falha na hora, sem nova tentativa', async () => {
  const { robo, updates } = cenario({ item: ITEM, falha: new ErroGateway(400, 'Número sem WhatsApp', true) })
  await robo.rodada()
  assert.equal(updates.at(-1).estado, 'falhou')
  assert.equal(updates.at(-1).erro, 'Número sem WhatsApp')
})

test('depois de enviar, espera a pausa antes do próximo', async () => {
  const { robo, enviados } = cenario({ item: ITEM })
  await robo.rodada()
  await robo.rodada()
  assert.equal(enviados.length, 1)
})
