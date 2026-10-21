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
  const robo = criarRobo({ db, evo, supabaseUrl: 'https://p.supabase.co', relogio: () => new Date(hora), rnd: () => 0, log: silencioso })
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
  const grupo = cenario({ item: { ...ITEM, destino_numero: null, destino_jid: '123@g.us', imagem_url: 'https://p.supabase.co/storage/v1/object/public/artes-escala/a.png' }, enviadosHoje: 2 })
  await grupo.robo.rodada()
  assert.deepEqual(grupo.enviados, [{ d: '123@g.us', u: 'https://p.supabase.co/storage/v1/object/public/artes-escala/a.png' }])
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

test('imagem de fora da pasta do projeto não é enviada (a Evolution não busca endereço interno)', async () => {
  const { robo, enviados, updates } = cenario({ item: { ...ITEM, imagem_url: 'http://127.0.0.1:8101/instance/fetchInstances' } })
  await robo.rodada()
  assert.equal(enviados.length, 0)
  assert.equal(updates.at(-1).estado, 'falhou')
})

// ── lembrete de ausência ──
// Banco com memória: a fila respeita chave_unica (ignora duplicata), como o upsert real.
function cenarioAusencia({ cfg = {}, grupos, hora = '2026-10-18T12:00:00Z', fila = new Map() }) {
  const db = {
    from(tabela) {
      let upserted = null
      const q = new Proxy({}, {
        get(_, nome) {
          if (nome === 'then') {
            let r = { data: [], error: null }
            if (tabela === 'tarcisio_config') r = { data: { ...CFG, ausencia_horas: ['09:00'], ausencia_ultimo: '15:00', ausencia_texto: null, ...cfg }, error: null }
            if (tabela === 'tarcisio_grupos') r = { data: grupos, error: null }
            if (tabela === 'tarcisio_envios' && upserted) {
              const novas = upserted.filter((l) => !fila.has(l.chave_unica))
              novas.forEach((l) => fila.set(l.chave_unica, l))
              r = { data: novas.map((l, i) => ({ id: i })), error: null }
            }
            return (ok, erro) => Promise.resolve(r).then(ok, erro)
          }
          return (...args) => { if (nome === 'upsert') upserted = args[0]; return q }
        },
      })
      return q
    },
  }
  const evo = { estado: async () => 'close', numeroConectado: async () => null }
  const robo = criarRobo({ db, evo, supabaseUrl: 'https://p.supabase.co', relogio: () => new Date(hora), rnd: () => 0, log: silencioso })
  return { robo, fila }
}
const GRUPOS = ['pais', 'acolitos', 'cerimoniarios', 'equipe'].map((p) => ({ jid: `${p}@g.us`, nome: `G ${p}`, papel: p }))

test('pausa geral suprime o lembrete de ausência', async () => {
  const { robo, fila } = cenarioAusencia({ cfg: { pausado: true }, grupos: GRUPOS })
  await robo.rodada()
  assert.equal(fila.size, 0)
})

test('a mesma hora não repete na mesma rodada nem após reinício', async () => {
  const fila = new Map()
  const a = cenarioAusencia({ grupos: GRUPOS, fila })
  await a.robo.rodada()
  assert.equal(fila.size, 4)
  assert.deepEqual([...fila.keys()].sort(), ['pais', 'acolitos', 'cerimoniarios', 'equipe'].map((p) => `ausencia:2026-10-18:09:00:grupo:${p}`).sort())
  assert.ok([...fila.values()].every((l) => l.tipo === 'aviso' && /ausencias/.test(l.texto)))
  await a.robo.rodada() // próxima rodada de 5 s
  const reiniciado = cenarioAusencia({ grupos: GRUPOS, fila }) // robô novo, mesma fila no banco
  await reiniciado.robo.rodada()
  assert.equal(fila.size, 4)
})

test('um grupo não ligado vira linha falhou e os outros recebem', async () => {
  const { robo, fila } = cenarioAusencia({ grupos: GRUPOS.filter((g) => g.papel !== 'pais') })
  await robo.rodada()
  assert.equal(fila.size, 4)
  const falhou = fila.get('ausencia:2026-10-18:09:00:grupo:pais')
  assert.equal(falhou.estado, 'falhou')
  assert.equal(falhou.erro, 'Grupo não ligado na aba Grupos')
  assert.equal(fila.get('ausencia:2026-10-18:09:00:grupo:equipe').destino_jid, 'equipe@g.us')
})
