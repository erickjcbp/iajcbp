// Ponto de entrada do container: liga banco + Evolution (+ IA, se houver chave), recebe as
// mensagens da Evolution pela rede interna e roda o robô a cada 5 s, sem sobrepor rodadas.
import http from 'node:http'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { criarEvolution, lerMensagemRecebida } from './evolution.mjs'
import { criarRobo } from './robo.mjs'
import { criarIA } from './ia.mjs'
import { criarAssistente } from './assistente.mjs'
import { criarEscalaAuto, criarCarregarEntrada } from './escala-auto.mjs'
import { criarMinistrosPdf } from './ministros-pdf.mjs'
import { criarEntradaDono } from './entrada-dono.mjs'

const precisa = (nome) => {
  const v = process.env[nome]
  if (!v) { console.error(`falta a variável ${nome}`); process.exit(1) }
  return v
}

const db = createClient(precisa('SUPABASE_URL'), precisa('SUPABASE_SERVICE_KEY'), { auth: { persistSession: false } })
const evo = criarEvolution({ url: precisa('EVOLUTION_URL'), chave: precisa('EVOLUTION_API_KEY'), instancia: process.env.EVOLUTION_INSTANCIA || 'SaoTarcisio' })
const ia = process.env.ANTHROPIC_API_KEY ? criarIA({ chave: process.env.ANTHROPIC_API_KEY }) : null
const assistente = criarAssistente({ db, evo, ia })
// Escala automática de terça: o gerador e os núcleos puros são os MESMOS da tela (projetos/acolitos),
// lidos só na hora de usar. Se faltarem na imagem, a geração falha, o estado vira 'falhou' e o dono
// é avisado; o resto do robô segue. Na VPS, ACOLITOS_CORE_DIR aponta para a cópia desses arquivos.
const PASTA_NUCLEOS = process.env.ACOLITOS_CORE_DIR || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../projetos/acolitos')
const exigirNucleo = createRequire(import.meta.url)
let nucleos = null
const lerNucleos = () => (nucleos ??= (() => {
  const ler = (arquivo) => exigirNucleo(path.join(PASTA_NUCLEOS, arquivo))
  const g = ler('gerador-escala-core.js')
  return { Gerador: g.gerarSemana ? g : g.GeradorEscalaCore, RodizioCore: ler('rodizio-core.js'),
    SemanalCore: ler('servir-semanal-core.js'), lerTudo: ler('paginar-core.js').lerTudo }
})())
const escalaAuto = criarEscalaAuto({ db, evo, log: console,
  gerarSemana: (entrada) => lerNucleos().Gerador.gerarSemana(entrada),
  carregarEntrada: (banco, sabado) => criarCarregarEntrada(lerNucleos())(banco, sabado) })
// Respostas do dono e PDF dos ministros: tratados no webhook, antes da IA.
// O núcleo dos ministros é o MESMO da tela (projetos/acolitos/escala-ministros-core.js).
const ministros = criarMinistrosPdf({ db, evo, log: console,
  nucleo: () => exigirNucleo(path.join(PASTA_NUCLEOS, 'escala-ministros-core.js')) })
// PROVISÓRIO até a Task 6 (regra única de confirmar, confirmar-escala-core.js): o toque em
// Confirmar NÃO confirma nada ainda; o dono recebe o aviso abaixo, a semana volta para
// 'aguardando' e ele confirma pelo app. Trocar por confirmarSemana real quando a Task 6 entrar.
const confirmarSemana = async () => ({ ok: false, erro: 'confirmação automática ainda não ligada' })
const entradaDono = criarEntradaDono({ db, evo, ministros, confirmarSemana, log: console })
const robo = criarRobo({ db, evo, ia, assistente, escalaAuto, supabaseUrl: process.env.SUPABASE_URL })

// Entrada das mensagens: só a Evolution, de dentro do compose, fala com esta porta (não é publicada).
const PORTA = 3000
http.createServer((req, res) => {
  if (req.method !== 'POST' || req.url !== '/webhook') { res.writeHead(404); return res.end() }
  let corpo = ''
  req.on('data', (c) => { corpo += c; if (corpo.length > 2_000_000) req.destroy() })
  req.on('end', async () => {
    res.writeHead(200); res.end()
    try {
      await entradaDono.receber(lerMensagemRecebida(JSON.parse(corpo || '{}')))
    } catch (e) { console.error('webhook:', e.message) }
  })
}).listen(PORTA, () => console.info(`entrada de mensagens na porta ${PORTA}`))

try { await evo.configurarWebhook(`http://robo:${PORTA}/webhook`) } catch (e) { console.error('ligar webhook:', e.message) }
await robo.iniciar()
console.info(`São Tarcísio no ar${ia ? ' (com IA)' : ' (sem chave da IA: não responde conversas)'}`)
for (;;) {
  await robo.rodada()
  await new Promise((r) => setTimeout(r, 5_000))
}
