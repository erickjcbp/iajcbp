// Enviar e apagar mensagens: pelo painel (Conversas) e pelo WhatsApp do dono.
// Painel: grava tarcisio_envios (tipo 'manual') para enviar e marca apagar_pedido_em para apagar;
// o robô faz o resto aqui. Dono: escreve para o Tarcísio "enviar para <grupo ou número>: texto"
// ou "apagar [para <grupo ou número>]" e o Tarcísio executa e confirma.
// Só o número em tarcisio_config.numero_conferencia é obedecido (decidido em entrada-dono.mjs).
import { randomUUID } from 'node:crypto'

const exigir = ({ data, error }, onde) => { if (error) throw new Error(`${onde}: ${error.message}`); return data }
const sem = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const PARTICULAS = new Set(['para', 'pro', 'pra', 'o', 'a', 'os', 'as', 'no', 'na', 'ao', 'aos', 'grupo', 'grupos', 'de', 'do', 'da', 'dos', 'das', 'mensagem', 'msg', 'ultima', 'ultimo', 'que', 'voce', 'vc', 'enviou', 'mandou', 'ai', 'la', 'uma', 'por', 'favor'])
const resumo = (t, n = 60) => { const s = String(t || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s }

// "para o grupo de cerimoniários" → "cerimoniarios"; "5519 99999-0000" → número
export function limparDestino(frase) {
  const palavras = sem(frase).replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean)
  while (palavras.length && PARTICULAS.has(palavras[0])) palavras.shift()
  while (palavras.length && PARTICULAS.has(palavras.at(-1))) palavras.pop()
  return palavras.join(' ')
}

export function numeroDoDestino(frase) {
  const d = String(frase || '').replace(/\D/g, '')
  if (d.length < 10 || d.length > 13) return null
  return d.length <= 11 ? '55' + d : d
}

// Qual grupo o dono quis dizer. Devolve { grupo } ou { erro, opcoes }.
export function escolherGrupo(consulta, grupos) {
  const q = limparDestino(consulta)
  const palavras = q.split(' ').filter((p) => p.length >= 3 && p !== 'jcbp')
  if (!palavras.length) return { erro: 'sem_destino', opcoes: grupos.map((g) => g.nome) }
  const querPais = palavras.includes('pais')
  const pontuados = grupos
    .filter((g) => querPais || !/^pais/.test(sem(g.nome)))
    .map((g) => ({ g, n: palavras.filter((p) => sem(g.nome).includes(p)).length }))
    .filter((x) => x.n > 0)
  if (!pontuados.length) return { erro: 'nenhum', opcoes: grupos.map((g) => g.nome) }
  const topo = Math.max(...pontuados.map((x) => x.n))
  const melhores = pontuados.filter((x) => x.n === topo)
  if (melhores.length > 1) return { erro: 'varios', opcoes: melhores.map((x) => x.g.nome) }
  return { grupo: melhores[0].g }
}

// Texto do dono → comando, ou null (vira conversa normal com o assistente).
export function interpretar(texto) {
  const t = String(texto || '').trim()
  const env = /^(?:por favor[,\s]*)?(?:enviar|envie|mandar|mande|manda)\b([\s\S]*)$/i.exec(t)
  if (env) {
    const resto = env[1]
    const i = resto.search(/[:\n]/)
    if (i < 0) return null
    const destino = resto.slice(0, i).trim(), corpo = resto.slice(i + 1).trim()
    if (!destino || !corpo) return null
    return { tipo: 'enviar', destino, texto: corpo }
  }
  const apa = /^(?:por favor[,\s]*)?(?:apagar|apague|excluir|exclua|deletar|delete|remover|remova)\b([\s\S]*)$/i.exec(t)
  if (apa && t.length <= 120) return { tipo: 'apagar', destino: apa[1].trim() }
  return null
}

// Apaga para todos uma linha de tarcisio_envios ('envios') ou tarcisio_mensagens ('mensagens').
// Sempre grava o resultado na própria linha: apagada_em ou apagar_erro.
export async function apagarLinha({ db, evo, tabela, linha, agora = new Date() }) {
  const tab = tabela === 'envios' ? 'tarcisio_envios' : 'tarcisio_mensagens'
  const remoto = tabela === 'envios' ? (linha.destino_jid || linha.destino_numero) : linha.numero
  try {
    if (!linha.external_id) throw new Error('Esta mensagem não tem o código do WhatsApp (foi enviada antes deste recurso).')
    if (linha.direcao === 'entrada') throw new Error('Mensagem recebida do contato não pode ser apagada para todos.')
    await evo.apagarParaTodos(remoto, linha.external_id)
    exigir(await db.from(tab).update({ apagada_em: agora.toISOString(), apagar_erro: null }).eq('id', linha.id), 'marcar apagada')
    return { ok: true }
  } catch (e) {
    exigir(await db.from(tab).update({ apagar_erro: String(e.message).slice(0, 300) }).eq('id', linha.id), 'registrar erro ao apagar')
    return { ok: false, erro: e.message }
  }
}

// Pedidos feitos no painel (botão "Apagar para todos").
export async function cuidarApagarPedidos({ db, evo, log = console }) {
  for (const [tabela, tab] of [['envios', 'tarcisio_envios'], ['mensagens', 'tarcisio_mensagens']]) {
    const pedidos = exigir(await db.from(tab).select('*').not('apagar_pedido_em', 'is', null).is('apagada_em', null).is('apagar_erro', null).limit(5), 'ler pedidos de apagar')
    for (const linha of pedidos) {
      const r = await apagarLinha({ db, evo, tabela, linha })
      log[r.ok ? 'info' : 'warn'](`apagar ${tab} ${linha.id}: ${r.ok ? 'ok' : r.erro}`)
    }
  }
}

export function criarComandosDono({ db, evo, log = console, agora = () => new Date() }) {
  const opcoes = (l) => l.slice(0, 8).map((n) => `• ${n}`).join('\n')

  async function resolverDestino(frase) {
    const numero = numeroDoDestino(frase)
    if (numero) return { numero, nome: numero }
    const r = escolherGrupo(frase, await evo.grupos())
    if (r.grupo) return { jid: r.grupo.jid, nome: r.grupo.nome }
    const msg = r.erro === 'varios' ? 'Achei mais de um grupo. Diga qual:' : r.erro === 'nenhum' ? 'Não achei esse grupo. Os que eu conheço:' : 'Diga para quem (grupo ou número).'
    return { resposta: `${msg}\n${opcoes(r.opcoes)}` }
  }

  async function enviar(c) {
    const d = await resolverDestino(c.destino)
    if (d.resposta) return d.resposta
    exigir(await db.from('tarcisio_envios').insert({ tipo: 'manual', destino_numero: d.numero || null, destino_jid: d.jid || null, destino_nome: d.nome,
      texto: c.texto, estado: 'pendente', agendado_para: agora().toISOString(), chave_unica: 'manual:' + randomUUID() }), 'enfileirar envio')
    return `Enviando para ${d.nome}: «${resumo(c.texto)}». Se não era isso, responda "apagar".`
  }

  async function apagar(c) {
    let d = null
    if (limparDestino(c.destino) || numeroDoDestino(c.destino)) {
      d = await resolverDestino(c.destino)
      if (d.resposta) return d.resposta
    }
    const filtraEnv = (q) => d ? (d.jid ? q.eq('destino_jid', d.jid) : q.eq('destino_numero', d.numero)) : q
    const env = exigir(await filtraEnv(db.from('tarcisio_envios').select('*').eq('estado', 'enviado').not('external_id', 'is', null).is('apagada_em', null)
      .order('enviado_em', { ascending: false }).limit(1)), 'achar envio')[0]
    let msg = null
    if (!d?.jid) {
      let q = db.from('tarcisio_mensagens').select('*').eq('direcao', 'saida').not('external_id', 'is', null).is('apagada_em', null).order('created_at', { ascending: false }).limit(1)
      if (d?.numero) q = q.eq('numero', d.numero)
      msg = exigir(await q, 'achar resposta')[0]
    }
    const quando = (x, tab) => +new Date(tab === 'envios' ? x.enviado_em : x.created_at)
    const alvo = [env && ['envios', env], msg && ['mensagens', msg]].filter(Boolean).sort((a, b) => quando(b[1], b[0]) - quando(a[1], a[0]))[0]
    if (!alvo) return 'Não achei mensagem minha para apagar' + (d ? ` em ${d.nome}.` : '.')
    const r = await apagarLinha({ db, evo, tabela: alvo[0], linha: alvo[1] })
    const nome = alvo[0] === 'envios' ? (alvo[1].destino_nome || alvo[1].destino_numero) : alvo[1].numero
    return r.ok ? `Apaguei para todos (${nome}): «${resumo(alvo[1].texto)}».` : `Não consegui apagar (${nome}): ${r.erro}`
  }

  return {
    ehComando: (texto) => !!interpretar(texto),
    async executar(texto) {
      const c = interpretar(texto)
      if (!c) return null
      try { return c.tipo === 'enviar' ? await enviar(c) : await apagar(c) }
      catch (e) { log.error(`comando do dono: ${e.message}`); return `Deu erro: ${e.message}` }
    },
  }
}
