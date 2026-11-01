import test from 'node:test'
import assert from 'node:assert/strict'
import { interpretar, limparDestino, numeroDoDestino, escolherGrupo, criarComandosDono, apagarLinha, cuidarApagarPedidos } from './conversa-comandos.mjs'

const GRUPOS = [
  { jid: 'cer@g.us', nome: 'Cerimoniários🔲 - JCBP' },
  { jid: 'pais@g.us', nome: 'Pais❗ - Acólitos e Coroinhas | JCBP' },
  { jid: 'aco@g.us', nome: 'Acólitos e Coroinhas ✝️ | JCBP' },
  { jid: 'esc@g.us', nome: 'Escala - Coroinhas | JCBP' },
]

test('interpreta enviar e apagar; o resto é conversa normal', () => {
  assert.deepEqual(interpretar('Enviar para cerimoniários: Boa noite, pessoal'), { tipo: 'enviar', destino: 'para cerimoniários', texto: 'Boa noite, pessoal' })
  assert.deepEqual(interpretar('mande pro grupo dos pais:\nOlá!\nSegunda tem missa'), { tipo: 'enviar', destino: 'pro grupo dos pais', texto: 'Olá!\nSegunda tem missa' })
  assert.equal(interpretar('Enviar para cerimoniários'), null)          // sem texto: não é comando
  assert.equal(interpretar('manda ver na escala amanhã'), null)           // sem separador
  assert.deepEqual(interpretar('apagar'), { tipo: 'apagar', destino: '' })
  assert.deepEqual(interpretar('Apague a última para os pais'), { tipo: 'apagar', destino: 'a última para os pais' })
  assert.equal(interpretar('apagar ' + 'x'.repeat(130)), null)
  assert.equal(interpretar('bom dia'), null)
})

test('limpa a frase do destino e reconhece número', () => {
  assert.equal(limparDestino('para o grupo de cerimoniários'), 'cerimoniarios')
  assert.equal(limparDestino('a última para os pais'), 'pais')
  assert.equal(numeroDoDestino('(19) 99123-4567'), '5519991234567')
  assert.equal(numeroDoDestino('5519991234567'), '5519991234567')
  assert.equal(numeroDoDestino('cerimoniarios'), null)
})

test('escolhe o grupo certo, sem confundir Pais com Acólitos', () => {
  assert.equal(escolherGrupo('para o grupo de cerimoniários', GRUPOS).grupo.jid, 'cer@g.us')
  assert.equal(escolherGrupo('pais', GRUPOS).grupo.jid, 'pais@g.us')
  assert.equal(escolherGrupo('acolitos', GRUPOS).grupo.jid, 'aco@g.us')       // Pais fica de fora se não pediu
  assert.equal(escolherGrupo('escala', GRUPOS).grupo.jid, 'esc@g.us')
  assert.equal(escolherGrupo('coroinhas', GRUPOS).erro, 'varios')             // Acólitos e Escala
  assert.equal(escolherGrupo('xyz', GRUPOS).erro, 'nenhum')
  assert.equal(escolherGrupo('', GRUPOS).erro, 'sem_destino')
})

// banco falso mínimo: guarda inserts/updates e devolve linhas prontas
function bancoFalso({ envios = [], mensagens = [] } = {}) {
  const log = { insert: [], update: [] }
  const tabelas = { tarcisio_envios: envios, tarcisio_mensagens: mensagens }
  const consulta = (nome) => {
    let linhas = [...tabelas[nome]], upd = null
    const q = {
      select: () => q, order: () => q, limit: () => q,
      eq: (c, v) => { linhas = linhas.filter((l) => l[c] === v); if (upd) { log.update.push({ nome, upd, onde: { [c]: v } }) } return q },
      not: (c) => { linhas = linhas.filter((l) => l[c] != null); return q },
      is: (c) => { linhas = linhas.filter((l) => l[c] == null); return q },
      insert: (l) => { log.insert.push({ nome, l }); return Promise.resolve({ data: null, error: null }) },
      update: (u) => { upd = u; return q },
      then: (ok) => ok({ data: upd ? null : linhas, error: null }),
    }
    return q
  }
  return { from: consulta, log }
}

test('dono pede envio para um grupo: entra na fila como manual', async () => {
  const db = bancoFalso()
  const evo = { grupos: async () => GRUPOS }
  const c = criarComandosDono({ db, evo, log: { error() {} }, agora: () => new Date('2026-11-01T12:00:00Z') })
  const r = await c.executar('Enviar para cerimoniários: Boa noite!')
  assert.match(r, /Enviando para Cerimoniários/)
  const ins = db.log.insert[0].l
  assert.equal(ins.tipo, 'manual'); assert.equal(ins.destino_jid, 'cer@g.us'); assert.equal(ins.texto, 'Boa noite!'); assert.equal(ins.estado, 'pendente')
  assert.match(ins.chave_unica, /^manual:/)
})

test('envio com grupo ambíguo não enfileira e lista as opções', async () => {
  const db = bancoFalso()
  const c = criarComandosDono({ db, evo: { grupos: async () => GRUPOS }, log: { error() {} } })
  const r = await c.executar('enviar para coroinhas: oi')
  assert.match(r, /mais de um grupo/)
  assert.equal(db.log.insert.length, 0)
})

test('dono pede apagar: apaga a última mensagem enviada e confirma', async () => {
  const chamadas = []
  const db = bancoFalso({
    envios: [{ id: 'e1', estado: 'enviado', external_id: 'WA1', enviado_em: '2026-11-01T10:00:00Z', destino_jid: 'cer@g.us', destino_nome: 'Cerimoniários', texto: 'Antiga', apagada_em: null }],
    mensagens: [],
  })
  const evo = { grupos: async () => GRUPOS, apagarParaTodos: async (...a) => { chamadas.push(a) } }
  const c = criarComandosDono({ db, evo, log: { error() {} } })
  const r = await c.executar('apagar')
  assert.deepEqual(chamadas, [['cer@g.us', 'WA1']])
  assert.match(r, /Apaguei para todos/)
  assert.equal(db.log.update.at(-1).upd.apagar_erro, null)
})

test('apagar sem nada para apagar avisa', async () => {
  const c = criarComandosDono({ db: bancoFalso(), evo: { grupos: async () => GRUPOS }, log: { error() {} } })
  assert.match(await c.executar('apagar'), /Não achei mensagem/)
})

test('apagar mensagem sem código do WhatsApp registra o erro e não chama a Evolution', async () => {
  const db = bancoFalso(); let chamou = false
  const r = await apagarLinha({ db, evo: { apagarParaTodos: async () => { chamou = true } }, tabela: 'envios', linha: { id: 'x', external_id: null } })
  assert.equal(r.ok, false); assert.equal(chamou, false)
  assert.match(db.log.update.at(-1).upd.apagar_erro, /não tem o código/)
})

test('pedido de apagar vindo do painel é executado pelo robô', async () => {
  const chamadas = []
  const db = bancoFalso({ mensagens: [{ id: 'm1', direcao: 'saida', numero: '5519991234567', external_id: 'WA9', apagar_pedido_em: '2026-11-01T10:00:00Z', apagada_em: null, apagar_erro: null }] })
  await cuidarApagarPedidos({ db, evo: { apagarParaTodos: async (...a) => { chamadas.push(a) } }, log: { info() {}, warn() {} } })
  assert.deepEqual(chamadas, [['5519991234567', 'WA9']])
})
