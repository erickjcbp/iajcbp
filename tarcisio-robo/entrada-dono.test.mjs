import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { bancoMemoria } from './banco-memoria.mjs'
import { criarEntradaDono, RESPOSTAS } from './entrada-dono.mjs'
import { criarMinistrosPdf, montarTextoDosItens, extrairTextoPdf, mesDosLidos } from './ministros-pdf.mjs'
import { lerMensagemRecebida, criarEvolution } from './evolution.mjs'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const PASTA_NUCLEOS = process.env.ACOLITOS_CORE_DIR || path.resolve(AQUI, '../projetos/acolitos')
const NUCLEO = createRequire(import.meta.url)(path.join(PASTA_NUCLEOS, 'escala-ministros-core.js'))
// Texto do PDF de outubro (o mesmo fixture do núcleo): entra pelo `extrairTexto` injetado.
const TEXTO_OUTUBRO = fs.readFileSync(path.join(PASTA_NUCLEOS, 'fixtures', 'escala-ministros-outubro.txt'), 'utf8')
const WEBHOOK = JSON.parse(fs.readFileSync(path.join(AQUI, 'fixtures', 'webhook-sintetico.json'), 'utf8'))

const silencioso = { info() {}, warn() {}, error() {} }
// Números de teste (inventados). O do dono vem SÓ da config, como em produção.
const DONO = '5519987650001'
const DONO_ANTIGO = '551987650001'   // o mesmo número no JID antigo do WhatsApp, sem o 9
const COORD = '5519987650002'
const OUTRO = '5519911112222'
const CFG = { id: 1, numero_conferencia: DONO, remetentes_pdf: [COORD] }
const HOJE = '2026-10-20T21:30:00Z'   // terça, 18:30 em Brasília
const SAB = '2026-10-24'
// Membros inventados: Rita Eder é mãe da Maria; dois "Luís" pais de acólitos diferentes.
const MEMBROS = [
  { id: 'm1', nome: 'Maria Teste', status: 'ativo', serve: true, tem_mae_ministro: true, nome_mae_ministro: 'Rita Eder', tem_pai_ministro: false },
  { id: 'm2', nome: 'João Teste', status: 'ativo', serve: true, tem_pai_ministro: true, nome_pai_ministro: 'Luís Carlos', tem_mae_ministro: false },
  { id: 'm3', nome: 'Pedro Teste', status: 'ativo', serve: true, tem_pai_ministro: true, nome_pai_ministro: 'Luís Alberto', tem_mae_ministro: false },
  { id: 'm4', nome: 'Ana Teste', status: 'ativo', serve: true, tem_pai_ministro: false, tem_mae_ministro: false },
]

function cenario({ estado = 'aguardando', confirmar = async () => ({ ok: true }), texto = TEXTO_OUTUBRO, botoesFalham = false, banco = {} } = {}) {
  const relogio = { agora: new Date(HOJE) }
  const passar = (min) => { relogio.agora = new Date(+relogio.agora + min * 60_000) }
  const db = bancoMemoria({
    tarcisio_config: [CFG],
    tarcisio_escala_auto: estado ? [{ semana: SAB, estado, lembretes: 0 }] : [],
    acolitos_membros: MEMBROS,
    ...banco,
  }, undefined, () => relogio.agora)
  const enviados = []
  const baixados = []
  const evo = {
    enviarTexto: async (n, t) => { enviados.push({ n, t }); return { key: { id: 'x' } } },
    enviarBotoes: async (n, t, botoes) => { if (botoesFalham) throw new Error('recusado'); enviados.push({ n, t, botoes }); return { key: { id: 'y' } } },
    baixarMidia: async (id) => { baixados.push(id); return { base64: Buffer.from('%PDF-1.4 falso').toString('base64'), mimetype: 'application/pdf' } },
  }
  const chamadas = { confirmar: 0 }
  const ministros = criarMinistrosPdf({ db, evo, nucleo: () => NUCLEO, log: silencioso, relogio: () => relogio.agora,
    extrairTexto: async () => (typeof texto === 'function' ? texto() : texto) })
  const entrada = criarEntradaDono({ db, evo, ministros, log: silencioso, relogio: () => relogio.agora,
    confirmarSemana: async (s) => { chamadas.confirmar++; assert.equal(s, SAB); return confirmar(s) } })
  return { db, evo, enviados, baixados, chamadas, entrada, ministros, passar }
}
const estadoSemana = (db) => db.t.tarcisio_escala_auto.find((r) => r.semana === SAB)?.estado
// Evento do webhook, no formato da Evolution
const evento = (numero, message, id) => ({ event: 'messages.upsert', data: { key: { remoteJid: `${numero}@s.whatsapp.net`, fromMe: false, id }, message } })
const toque = (numero, idBotao, id = 'T' + Math.random()) => evento(numero, { buttonsResponseMessage: { selectedButtonId: idBotao, selectedDisplayText: 'x' } }, id)
const CONFIRMAR = `escala:confirmar:${SAB}`
const REVISAR = `escala:revisar:${SAB}`
const pdf = (numero, id = 'P' + Math.random(), nome = 'ESCALA OUTUBRO REV01.pdf') => evento(numero, { documentMessage: { mimetype: 'application/pdf', fileName: nome } }, id)
const receber = (c, corpo) => c.entrada.receber(lerMensagemRecebida(corpo))

// ── botões Confirmar / Revisar ───────────────────────────────────────────────────────────

test('botão do dono confirma uma vez', async () => {
  const c = cenario()
  await receber(c, toque(DONO, CONFIRMAR))
  assert.equal(c.chamadas.confirmar, 1)
  assert.equal(estadoSemana(c.db), 'confirmada')
  assert.deepEqual(c.enviados, [{ n: DONO, t: 'Confirmada. Arte indo para os grupos.' }])
  // a IA não vê o toque
  assert.equal(c.db.t.tarcisio_mensagens[0].respondida, true)
})

test('duas vezes: segunda não envia nada', async () => {
  const c = cenario()
  await receber(c, toque(DONO, CONFIRMAR))
  await receber(c, toque(DONO, CONFIRMAR))
  assert.equal(c.chamadas.confirmar, 1)
  assert.equal(c.enviados.filter((e) => e.t === RESPOSTAS.confirmada).length, 1)
  // o segundo toque só recebe o aviso
  assert.equal(c.enviados[1].t, 'Essa escala já foi tratada.')
  assert.equal(c.enviados.length, 2)
  // o mesmo evento repetido pela Evolution (mesmo id) nem é tratado
  const d = cenario()
  const ev = toque(DONO, CONFIRMAR, 'MESMO')
  await receber(d, ev)
  await receber(d, ev)
  assert.equal(d.chamadas.confirmar, 1)
  assert.equal(d.enviados.length, 1)
})

test('dois toques ao mesmo tempo: só um confirma', async () => {
  const c = cenario({ confirmar: () => new Promise((r) => setTimeout(() => r({ ok: true }), 5)) })
  await Promise.all([receber(c, toque(DONO, CONFIRMAR)), receber(c, toque(DONO, CONFIRMAR))])
  assert.equal(c.chamadas.confirmar, 1)
  assert.equal(c.enviados.filter((e) => e.t === RESPOSTAS.confirmada).length, 1)
})

test('botão de outro número é ignorado sem resposta', async () => {
  const c = cenario()
  assert.equal(await c.entrada.tratarRespostaDono({ numero: OUTRO, botao: 'escala:confirmar', cfg: CFG }), false)
  await receber(c, toque(OUTRO, CONFIRMAR))
  await receber(c, toque(COORD, REVISAR))   // remetente de PDF também não confirma escala
  assert.equal(c.chamadas.confirmar, 0)
  assert.equal(estadoSemana(c.db), 'aguardando')
  assert.deepEqual(c.enviados, [])
  // e a IA também não responde o toque
  assert.ok(c.db.t.tarcisio_mensagens.every((m) => m.respondida === true))
})

test('texto 2 vira revisar', async () => {
  const c = cenario()
  await receber(c, evento(DONO, { conversation: '2' }, 'R1'))
  assert.equal(estadoSemana(c.db), 'em_revisao')
  assert.deepEqual(c.enviados, [{ n: DONO, t: 'Combinado, revise no app.' }])
  assert.equal(c.chamadas.confirmar, 0)
  // "1" de outro número é conversa normal: vai para a IA
  await receber(c, evento(OUTRO, { conversation: '1' }, 'R2'))
  assert.equal(c.db.t.tarcisio_mensagens.find((m) => m.external_id === 'R2').respondida, false)
})

test('só age com a semana aguardando: em revisão, falhou ou sem linha não confirma', async () => {
  const r = cenario({ estado: 'em_revisao' })
  await receber(r, toque(DONO, CONFIRMAR))
  assert.equal(r.chamadas.confirmar, 0)
  assert.equal(estadoSemana(r.db), 'em_revisao')
  assert.equal(r.enviados[0].t, 'Essa escala já foi tratada.')
  await receber(r, evento(DONO, { conversation: '1' }, 'E1'))   // por texto: aviso do estado
  assert.match(r.enviados[1].t, /revisão: confirme pelo app/)
  for (const estado of ['falhou', 'gerando', 'sem_missas', null]) {
    const c = cenario({ estado })
    await receber(c, toque(DONO, CONFIRMAR))
    await receber(c, toque(DONO, REVISAR))
    assert.equal(c.chamadas.confirmar, 0, String(estado))
    assert.equal(estadoSemana(c.db), estado ?? undefined)
    assert.ok(c.enviados.every((e) => e.t === 'Essa escala já foi tratada.'), String(estado))
    // "1" / "2" escrito sem semana esperando: segue para a conversa normal (IA)
    await receber(c, evento(DONO, { conversation: '1' }, 'X1'))
    await receber(c, evento(DONO, { conversation: '2' }, 'X2'))
    assert.equal(c.chamadas.confirmar, 0)
    assert.ok(['X1', 'X2'].every((id) => c.db.t.tarcisio_mensagens.find((m) => m.external_id === id).respondida === false), String(estado))
  }
})

test('botão de outra semana não mexe na que espera', async () => {
  const c = cenario()
  await receber(c, toque(DONO, 'escala:confirmar:2026-10-17'))
  assert.equal(c.chamadas.confirmar, 0)
  assert.equal(estadoSemana(c.db), 'aguardando')
  assert.deepEqual(c.enviados, [{ n: DONO, t: 'Essa escala já foi tratada.' }])
  // id sem semana (atalho) continua valendo
  await receber(c, toque(DONO, 'escala:revisar'))
  assert.equal(estadoSemana(c.db), 'em_revisao')
})

test('número do dono: com e sem o 9 e com sufixo de aparelho vale; forma nacional e outro não', async () => {
  for (const jid of [DONO, DONO_ANTIGO, `${DONO}:12`, `${DONO_ANTIGO}:3`]) {
    const c = cenario()
    await receber(c, toque(jid, REVISAR))
    assert.equal(estadoSemana(c.db), 'em_revisao', jid)
    assert.deepEqual(c.enviados, [{ n: DONO, t: 'Combinado, revise no app.' }], jid)   // resposta no número canônico
  }
  for (const jid of ['19987650001', '1987650001', '5519987650009', '5519987650001999']) {
    const c = cenario()
    await receber(c, toque(jid, REVISAR))
    await receber(c, pdf(jid))
    assert.equal(estadoSemana(c.db), 'aguardando', jid)
    assert.deepEqual(c.enviados, [], jid)
    assert.deepEqual(c.baixados, [], jid)
  }
})

test('confirmar que falha devolve a semana para aguardando e avisa o dono', async () => {
  const c = cenario({ confirmar: async () => ({ ok: false, erro: 'confirmação automática ainda não ligada' }) })
  await receber(c, toque(DONO, CONFIRMAR))
  assert.equal(estadoSemana(c.db), 'aguardando')
  assert.match(c.enviados[0].t, /Não consegui confirmar: confirmação automática ainda não ligada/)
  assert.ok(!c.enviados.some((e) => e.t === RESPOSTAS.confirmada))
})

// ── PDF dos ministros ────────────────────────────────────────────────────────────────────

test('PDF de número não autorizado é ignorado', async () => {
  const c = cenario()
  await receber(c, pdf(OUTRO))
  assert.deepEqual(c.enviados, [])
  assert.deepEqual(c.baixados, [])
  assert.equal(c.db.t.acolitos_escala_ministros, undefined)
  assert.equal(c.db.t.tarcisio_mensagens[0].respondida, true)   // a IA também não responde
})

test('PDF do dono grava casados e pergunta só as dúvidas', async () => {
  const c = cenario()
  await receber(c, pdf(DONO, 'PDF1'))
  assert.deepEqual(c.baixados, ['PDF1'])
  const linhas = c.db.t.acolitos_escala_ministros
  // Rita E. (mãe da Maria) casou; os dois Luís ficam de fora até a resposta
  assert.ok(linhas.some((l) => l.membro_id === 'm1' && l.data === '2026-10-24' && l.horario === '17h' && l.comunidade === 'matriz' && l.pai_ou_mae === 'mae'))
  assert.ok(linhas.every((l) => l.membro_id === 'm1' && l.mes === '2026-10-01' && l.arquivo === 'ESCALA OUTUBRO REV01.pdf'))
  assert.equal(c.enviados[0].t, `Li a escala dos ministros de outubro: ${linhas.length} casos, 1 com dúvida. Vou perguntar as dúvidas, uma por vez.`)
  // uma pergunta só (a do Luís), com os botões apelido:sim/nao
  const perguntas = c.enviados.filter((e) => e.botoes)
  assert.equal(perguntas.length, 1)
  assert.match(perguntas[0].t, /^'Luís' é Luís (Carlos|Alberto), pai de (João|Pedro) Teste\?$/)
  const lote = c.db.t.tarcisio_mensagens.find((m) => m.direcao === 'saida').id
  assert.deepEqual(perguntas[0].botoes.map((b) => b.id), [`apelido:sim:${lote}.0`, `apelido:nao:${lote}.0`])
  // de novo o mesmo mês: substitui, não duplica
  await receber(c, pdf(DONO, 'PDF2'))
  assert.equal(c.db.t.acolitos_escala_ministros.length, linhas.length)
  // coordenador listado em remetentes_pdf também pode mandar
  const d = cenario()
  await receber(d, pdf(COORD))
  assert.match(d.enviados[0].t, /^Li a escala dos ministros de outubro/)
  assert.equal(d.enviados[0].n, COORD)
})

test('sim grava apelido e o próximo mês não pergunta', async () => {
  const c = cenario()
  await receber(c, pdf(DONO, 'PDF1'))
  const pergunta = c.enviados.find((e) => e.botoes)
  const opcao = /Carlos/.test(pergunta.t) ? 'm2' : 'm3'
  await receber(c, toque(DONO, pergunta.botoes[0].id))
  assert.deepEqual(c.db.t.acolitos_ministro_apelidos.map(({ nome_pdf, membro_id, pai_ou_mae, resposta, respondido_por }) => ({ nome_pdf, membro_id, pai_ou_mae, resposta, respondido_por })),
    [{ nome_pdf: 'luis', membro_id: opcao, pai_ou_mae: 'pai', resposta: 'sim', respondido_por: DONO }])
  // refez o casamento só do Luís: o filho dele entra nas missas onde "Luís" serve
  const doLuis = c.db.t.acolitos_escala_ministros.filter((l) => l.membro_id === opcao)
  assert.ok(doLuis.some((l) => l.data === '2026-10-03' && l.horario === '17h'))
  assert.match(c.enviados.at(-1).t, /^Anotado: 'Luís' é pai de .* Pronto: \d+ casos de outubro valem para o gerador\.$/)
  // toque repetido: só avisa
  const antes = c.db.t.acolitos_escala_ministros.length
  await receber(c, toque(DONO, pergunta.botoes[0].id))
  assert.match(c.enviados.at(-1).t, /^Já estava anotado/)
  assert.equal(c.db.t.acolitos_escala_ministros.length, antes)
  // próximo PDF: o "sim" lembrado casa sozinho, nada é perguntado
  const n = c.enviados.length
  await receber(c, pdf(DONO, 'PDF2', 'ESCALA NOVEMBRO.pdf'))
  assert.equal(c.enviados.slice(n).filter((e) => e.botoes).length, 0)
  assert.match(c.enviados[n].t, /0 com dúvida\. Já vale para o gerador\./)
})

test('não grava e não pergunta de novo', async () => {
  const c = cenario({ botoesFalham: true })   // aparelho sem botões: pergunta e resposta por texto
  await receber(c, pdf(DONO, 'PDF1'))
  assert.match(c.enviados.at(-1).t, /Responda SIM ou NÃO\.$/)
  const primeiro = /Carlos/.test(c.enviados.at(-1).t) ? 'm2' : 'm3'
  await receber(c, evento(DONO, { conversation: 'Não' }, 'N1'))
  assert.deepEqual(c.db.t.acolitos_ministro_apelidos.map((a) => [a.nome_pdf, a.membro_id, a.resposta]), [['luis', primeiro, 'nao']])
  assert.ok(!c.db.t.acolitos_escala_ministros.some((l) => l.membro_id === primeiro))
  // pergunta a segunda opção do mesmo nome, explicitamente
  assert.match(c.enviados.at(-1).t, /'Luís' é Luís .*\?\n\nResponda SIM ou NÃO\./)
  assert.ok(!c.enviados.at(-1).t.includes(MEMBROS.find((m) => m.id === primeiro).nome))
  // próximo PDF: o "não" lembrado não volta como pergunta
  const n = c.enviados.length
  await receber(c, pdf(DONO, 'PDF2'))
  assert.ok(!c.enviados.slice(n).some((e) => e.t.includes(MEMBROS.find((m) => m.id === primeiro).nome)))
  assert.ok(!c.db.t.acolitos_escala_ministros.some((l) => l.membro_id === primeiro))
})

test('resposta de apelido de outro número não grava nem responde', async () => {
  const c = cenario()
  await receber(c, pdf(DONO, 'PDF1'))
  const pergunta = c.enviados.find((e) => e.botoes)
  const n = c.enviados.length
  await receber(c, toque(OUTRO, pergunta.botoes[0].id))
  await receber(c, evento(OUTRO, { conversation: 'sim' }, 'S2'))
  assert.deepEqual(c.db.t.acolitos_ministro_apelidos || [], [])
  assert.equal(c.enviados.length, n)
})

test('sim/não escrito só vale logo depois da pergunta (30 min) e com ela por último', async () => {
  const c = cenario({ botoesFalham: true })
  await receber(c, pdf(DONO, 'PDF1'))
  c.passar(31)
  await receber(c, evento(DONO, { conversation: 'sim' }, 'S1'))
  assert.equal(c.db.t.tarcisio_mensagens.find((m) => m.external_id === 'S1').respondida, false)
  assert.deepEqual(c.db.t.acolitos_ministro_apelidos || [], [])
  // outra mensagem do robô depois da pergunta (a IA respondeu): "sim" também não é da pergunta
  const d = cenario({ botoesFalham: true })
  await receber(d, pdf(DONO, 'PDF1'))
  d.db.t.tarcisio_mensagens.push({ id: 'ia1', numero: DONO, direcao: 'saida', texto: 'resposta da IA', created_at: new Date(Date.parse(HOJE) + 60_000).toISOString() })
  d.passar(2)
  await receber(d, evento(DONO, { conversation: 'sim' }, 'S2'))
  assert.equal(d.db.t.tarcisio_mensagens.find((m) => m.external_id === 'S2').respondida, false)
  assert.deepEqual(d.db.t.acolitos_ministro_apelidos || [], [])
})

test('dúvida vence em 24 h: toque avisa, escrito vai para a IA', async () => {
  const c = cenario()
  await receber(c, pdf(DONO, 'PDF1'))
  const pergunta = c.enviados.find((e) => e.botoes)
  c.passar(25 * 60)
  const n = c.enviados.length
  await receber(c, toque(DONO, pergunta.botoes[0].id))
  assert.deepEqual(c.db.t.acolitos_ministro_apelidos || [], [])
  assert.match(c.enviados[n].t, /venceu/)
  await receber(c, evento(DONO, { conversation: 'sim' }, 'S3'))
  assert.equal(c.db.t.tarcisio_mensagens.find((m) => m.external_id === 'S3').respondida, false)
})

test("'sim' velho do 2º candidato não conta: a pergunta dele vem", async () => {
  // memória "sim" do Luís para a Ana (m4), que não tem pai ministro: vale nada
  const c = cenario({ banco: { acolitos_ministro_apelidos: [{ nome_pdf: 'luis', membro_id: 'm4', pai_ou_mae: 'pai', resposta: 'sim' }] } })
  await receber(c, pdf(DONO, 'PDF1'))
  const p1 = c.enviados.find((e) => e.botoes)
  const primeiro = /Carlos/.test(p1.t) ? 'João' : 'Pedro'
  await receber(c, toque(DONO, p1.botoes[1].id))   // não
  const p2 = c.enviados.at(-1)
  assert.ok(p2.botoes, 'pergunta do 2º candidato')
  assert.match(p2.t, /^'Luís' é Luís /)
  assert.ok(!p2.t.includes(primeiro))
})

test('toque repetido de apelido pergunta de novo a próxima pendente', async () => {
  const c = cenario()
  await receber(c, pdf(DONO, 'PDF1'))
  const p1 = c.enviados.find((e) => e.botoes)
  await receber(c, toque(DONO, p1.botoes[1].id))
  const p2 = c.enviados.at(-1)
  await receber(c, toque(DONO, p1.botoes[1].id))
  assert.match(c.enviados.at(-2).t, /^Já estava anotado/)
  assert.deepEqual(c.enviados.at(-1), p2)
})

test('memória velha (membro sem o pai ministro) é ignorada e pergunta de novo', async () => {
  const c = cenario({ banco: { acolitos_ministro_apelidos: [{ nome_pdf: 'luis', membro_id: 'm4', pai_ou_mae: 'pai', resposta: 'sim' }] } })
  await receber(c, pdf(DONO, 'PDF1'))
  assert.ok(!c.db.t.acolitos_escala_ministros.some((l) => l.membro_id === 'm4'))
  assert.equal(c.enviados.filter((e) => e.botoes).length, 1)
})

test("PDF ilegível: avisa 'não consegui ler' e não grava nada", async () => {
  for (const texto of ['', 'texto de outro layout 12/out 9:00h', () => { throw new Error('PDF corrompido') }]) {
    const c = cenario({ texto, banco: { acolitos_escala_ministros: [{ id: 'velha', mes: '2026-10-01', data: '2026-10-03', horario: '17h', comunidade: 'matriz', membro_id: 'm1' }] } })
    await receber(c, pdf(DONO))
    assert.equal(c.enviados.length, 1)
    assert.match(c.enviados[0].t, /Não consegui ler a escala dos ministros em "ESCALA OUTUBRO REV01.pdf"\. Nada foi gravado\./)
    assert.deepEqual(c.db.t.acolitos_escala_ministros.map((l) => l.id), ['velha'])
    assert.ok(!c.db.t.tarcisio_mensagens.some((m) => (m.ferramentas || []).some((f) => f.ferramenta === 'escala_ministros_pdf')))
  }
})

test('sim/não escrito sem pergunta pendente vai para a IA', async () => {
  const c = cenario()
  await receber(c, evento(DONO, { conversation: 'sim' }, 'S1'))
  assert.equal(c.db.t.tarcisio_mensagens[0].respondida, false)
  assert.deepEqual(c.enviados, [])
})

test('sem a config, a mensagem é guardada como conversa comum', async () => {
  const c = cenario()
  c.db.t.tarcisio_config = []
  await receber(c, toque(DONO, CONFIRMAR, 'C1'))
  assert.equal(c.db.t.tarcisio_mensagens[0].respondida, false)
  assert.equal(c.chamadas.confirmar, 0)
})

// ── leitura do webhook (formatos SINTÉTICOS da Evolution 2.x; conferir ao vivo na Task 11) ──

test('lê botão, lista, fluxo nativo, atalho por texto e documento', () => {
  assert.deepEqual([WEBHOOK.botao_resposta, WEBHOOK.botao_modelo, WEBHOOK.lista, WEBHOOK.fluxo_nativo].map((e) => lerMensagemRecebida(e).botao),
    ['escala:confirmar', 'escala:revisar', 'apelido:sim:SINT-LOTE.0', 'escala:confirmar'])
  assert.equal(lerMensagemRecebida(WEBHOOK.botao_resposta).tocou, true)
  assert.equal(lerMensagemRecebida(WEBHOOK.botao_resposta).texto, 'Confirmar')
  assert.deepEqual(lerMensagemRecebida(WEBHOOK.pdf).documento, { mimetype: 'application/pdf', nome: 'ESCALA OUTUBRO REV01.pdf' })
  assert.equal(lerMensagemRecebida(WEBHOOK.pdf).midia, 'documento')
  assert.equal(lerMensagemRecebida(WEBHOOK.pdf).botao, null)
  assert.deepEqual(lerMensagemRecebida(WEBHOOK.pdf_com_legenda).documento, { mimetype: 'application/pdf', nome: 'escala novembro.pdf' })
  const txt = (t) => lerMensagemRecebida(evento(DONO, { conversation: t }, 'A'))
  assert.deepEqual(['1', 'Confirmar', ' confirmar. ', '2', 'REVISAR', 'oi', '12', 'confirmar a escala'].map((t) => txt(t).botao),
    ['escala:confirmar', 'escala:confirmar', 'escala:confirmar', 'escala:revisar', 'escala:revisar', null, null, null])
  assert.equal(txt('1').tocou, false)
})

test('evolution.baixarMidia pede o base64 pelo id da mensagem', async () => {
  const pedidos = []
  const fetchFn = async (url, init) => { pedidos.push({ url, init }); return { ok: true, status: 200, text: async () => '{"base64":"JVBERi0=","mimetype":"application/pdf","fileName":"a.pdf"}' } }
  const evo = criarEvolution({ url: 'http://127.0.0.1:8080', chave: 'k', instancia: 'SaoTarcisio', fetchFn })
  assert.deepEqual(await evo.baixarMidia('ABC'), { base64: 'JVBERi0=', mimetype: 'application/pdf', nome: 'a.pdf' })
  assert.equal(pedidos[0].url, 'http://127.0.0.1:8080/chat/getBase64FromMediaMessage/SaoTarcisio')
  assert.deepEqual(JSON.parse(pedidos[0].init.body), { message: { key: { id: 'ABC' } }, convertToMp4: false })
})

// ── texto do PDF ─────────────────────────────────────────────────────────────────────────

test('monta o texto pela posição: títulos em ordem, um bloco por linha, marcador fora dos nomes', () => {
  // ordem crua embaralhada, como o pdf.js entrega o PDF do Drive
  const itens = [
    { str: '7:00h', x: 205, y: 473 }, { str: 'Ana', x: 245, y: 473 },
    { str: 'DOMINGO', x: 113, y: 206 }, { str: '25/out', x: 167, y: 206 },
    { str: '17:00h', x: 203, y: 496 }, { str: 'Rita E.', x: 245, y: 496 },
    { str: 'SÁBADO', x: 117, y: 235 }, { str: '24/out', x: 167, y: 235 },
    { str: '18:30h', x: 203, y: 485 }, { str: 'SANTO ANTÔNIO', x: 385, y: 485 }, { str: 'Bia', x: 612, y: 485 },
    { str: '17:00h', x: 203, y: 450 }, { str: 'Caio', x: 245, y: 450 },   // vão maior: outro bloco
    { str: 'SÁBADO', x: 117, y: 163 }, { str: '31/out', x: 167, y: 163 },
  ]
  assert.equal(montarTextoDosItens([itens]), 'SANTO ANTÔNIO\nSÁBADO 24/out\nDOMINGO 25/out\nSÁBADO 31/out\n\n17:00h Rita E. 18:30h Bia 7:00h Ana\n17:00h Caio')
  assert.equal(mesDosLidos([{ data: '2026-10-31' }, { data: '2026-11-01' }, { data: '2026-10-24' }]), '2026-10')
})

// PDF mínimo feito aqui (sem nome de ninguém) para provar a biblioteca de verdade uma vez.
function pdfMinimo(linhas) {
  const conteudo = linhas.map(([x, y, s]) => `BT /F1 10 Tf ${x} ${y} Td (${s}) Tj ET`).join('\n')
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    `<< /Length ${Buffer.byteLength(conteudo, 'latin1')} >>\nstream\n${conteudo}\nendstream`,
  ]
  let s = '%PDF-1.4\n'
  const pos = []
  objs.forEach((o, i) => { pos.push(Buffer.byteLength(s, 'latin1')); s += `${i + 1} 0 obj\n${o}\nendobj\n` })
  const xref = Buffer.byteLength(s, 'latin1')
  s += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + pos.map((p) => String(p).padStart(10, '0') + ' 00000 n \n').join('')
  s += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(s, 'latin1')
}

test('pdfjs-dist de verdade: PDF mínimo vira texto que o núcleo lê', async (t) => {
  try { await import('pdfjs-dist/legacy/build/pdf.mjs') } catch { return t.skip('pdfjs-dist não instalado (npm ci)') }
  const buf = pdfMinimo([[110, 500, 'S\xC1BADO 24/out'], [110, 470, 'DOMINGO 25/out'], [200, 500, '17:00h'], [240, 500, 'Rita E.'], [290, 500, 'Ana'], [200, 488, '7:00h'], [240, 488, 'Bia']])
  const texto = await extrairTextoPdf(buf)
  assert.deepEqual(NUCLEO.lerEscalaMinistros(texto, 2026), [
    { data: '2026-10-24', horario: '17h', comunidade: 'matriz', nomes: ['Rita E.', 'Ana'] },
    { data: '2026-10-25', horario: '7h', comunidade: 'matriz', nomes: ['Bia'] },
  ])
})

// ── estado intermediário 'confirmando' e respostas honestas sobre a arte ──
test('durante o Confirmar a semana fica em confirmando (com hora); no fim, confirmada', async () => {
  let visto
  const c = cenario({ confirmar: async () => { visto = { ...c.db.t.tarcisio_escala_auto.find((r) => r.semana === SAB) }; return { ok: true, arte: { novo: true } } } })
  await receber(c, toque(DONO, CONFIRMAR))
  assert.equal(visto.estado, 'confirmando')
  assert.ok(visto.confirmando_em)
  assert.equal(estadoSemana(c.db), 'confirmada')
  assert.equal(c.enviados.at(-1).t, RESPOSTAS.confirmada)
})
test('push parcial: volta a aguardando e o dono sabe que a arte foi pedida e quem faltou', async () => {
  const c = cenario({ confirmar: async () => ({ ok: false, motivo: 'push_parcial', erro: '1 pessoa não recebeu o aviso.', arte: { novo: true } }) })
  await receber(c, toque(DONO, CONFIRMAR))
  assert.equal(estadoSemana(c.db), 'aguardando')
  assert.match(c.enviados.at(-1).t, /1 pessoa não recebeu/)
  assert.match(c.enviados.at(-1).t, /arte/i)
  assert.match(c.enviados.at(-1).t, /Confirmar de novo/)
})
test('falha: volta de confirmando para aguardando', async () => {
  const c = cenario({ confirmar: async () => ({ ok: false, erro: 'push caiu' }) })
  await receber(c, toque(DONO, CONFIRMAR))
  assert.equal(estadoSemana(c.db), 'aguardando')
})
test('não promete "arte indo" quando a arte está desligada, já pedida, ou o disparo falhou', async () => {
  for (const [arte, re] of [[{ desligado: true }, /desligad/], [{ novo: false }, /já tinha sido pedida/], [{ novo: true, erroRegenerar: 'regenerar-arte respondeu 403' }, /403/]]) {
    const c = cenario({ confirmar: async () => ({ ok: true, arte }) })
    await receber(c, toque(DONO, CONFIRMAR))
    assert.equal(estadoSemana(c.db), 'confirmada')
    assert.ok(!c.enviados.some((e) => e.t === RESPOSTAS.confirmada), JSON.stringify(arte))
    assert.match(c.enviados.at(-1).t, re)
  }
})
