// O que chega do dono (e de quem pode mandar o PDF dos ministros) é tratado AQUI, no webhook,
// antes de virar conversa para a IA: botões Confirmar / Revisar da escala de terça (ou "1"/"2"),
// o PDF da escala dos ministros e as respostas Sim / Não das dúvidas de nome.
// O número do dono vem só de tarcisio_config.numero_conferencia; nada fica escrito no código.
// Projeto: docs/superpowers/specs/2026-10-20-escala-automatica-design.md (seções 5 e 7)
import { agoraSP } from './regras.mjs'
import { ehPdf, simOuNao, quemAutorizado, donoDe } from './ministros-pdf.mjs'

const exigir = ({ data, error }, onde) => {
  if (error) throw new Error(`${onde}: ${error.message}`)
  return data
}

export const TRATADA = 'Essa escala já foi tratada.'
export const RESPOSTAS = {
  confirmada: 'Confirmada. Arte indo para os grupos.',
  revisar: 'Combinado, revise no app.',
}
// Toque repetido (ou na mensagem velha) depois que a semana já saiu de 'aguardando'.
const JA_DECIDIDA = {
  confirmada: 'Esta escala já está confirmada. Nada foi enviado de novo.',
  ja_confirmada: 'Esta escala já está confirmada. Nada foi enviado de novo.',
  em_revisao: 'Esta escala está em revisão: confirme pelo app.',
}

// deps: db (chave de serviço), evo, confirmarSemana(semana) → { ok, erro? } (Task 6),
// ministros = criarMinistrosPdf(...), relogio, log.
export function criarEntradaDono({ db, evo, confirmarSemana, ministros, relogio = () => new Date(), log = console }) {
  const lerCfg = async () => exigir(await db.from('tarcisio_config').select('*').eq('id', 1).single(), 'ler config')

  async function cas(semana, de, para, extra = {}) {
    return exigir(await db.from('tarcisio_escala_auto').update({ estado: para, ...extra }).eq('semana', semana).eq('estado', de).select('semana'),
      'mudar estado da semana').length > 0
  }

  // Só age com a semana em 'aguardando'. botao: 'escala:<acao>:<semana>' (botão) ou
  // 'escala:<acao>' (atalho "1"/"2"). Botão de outra semana, ou semana já tratada: só o aviso.
  // Atalho sem semana esperando: false (vira conversa normal), salvo aviso de semana já decidida.
  const avisadosDesconhecidos = new Map()
  async function tratarRespostaDono({ numero, botao, cfg = null }) {
    cfg ??= await lerCfg()
    const dono = donoDe(cfg, numero)
    const m = /^escala:(confirmar|revisar)(?::(\d{4}-\d{2}-\d{2}))?$/.exec(String(botao || ''))
    if (!dono) {
      // Toque de botão da escala vindo de número que não é o do dono (ex.: o aparelho do dono chegou como
      // outro identificador): continua ignorado, mas deixa rastro no log, no máximo 1x por hora por número.
      const chave = String(numero || '')
      const agora = relogio().getTime()
      if (m && agora - (avisadosDesconhecidos.get(chave) || 0) > 3_600_000) {
        avisadosDesconhecidos.set(chave, agora)
        log.warn(`botão da escala de número não reconhecido (${chave.slice(0, 4)}…${chave.slice(-3)}): ignorado`)
      }
      return false
    }
    if (!m) return false
    const [, acao, daSemana] = m
    const hoje = agoraSP(relogio()).data
    const semanas = exigir(await db.from('tarcisio_escala_auto').select('semana,estado').gte('semana', hoje).order('semana'), 'ler semanas')
    const alvo = semanas.find((s) => s.estado === 'aguardando')
    const responder = (t) => evo.enviarTexto(dono, t)
    const jaDecidida = async () => { await responder(TRATADA); return true }
    if (daSemana) {
      if (!alvo || alvo.semana !== daSemana) return jaDecidida()
    } else if (!alvo) {
      const perto = semanas[0]
      if (!perto || !JA_DECIDIDA[perto.estado]) return false
      await responder(JA_DECIDIDA[perto.estado])
      return true
    }

    if (acao === 'revisar') {
      if (!(await cas(alvo.semana, 'aguardando', 'em_revisao'))) return jaDecidida()
      await responder(RESPOSTAS.revisar)
      return true
    }
    // Confirmar: a troca de estado é a trava (dois toques ao mesmo tempo, só um passa). Fica em
    // 'confirmando' enquanto avisa; se o robô cair no meio, a varredura de 15 min devolve a
    // 'aguardando' (escala-auto.mjs) e o dono pode tocar de novo.
    if (!(await cas(alvo.semana, 'aguardando', 'confirmando', { confirmando_em: relogio().toISOString() }))) return jaDecidida()
    let r
    try { r = await confirmarSemana(alvo.semana) } catch (e) { r = { ok: false, erro: e.message } }
    if (r?.ok) {
      try { await cas(alvo.semana, 'confirmando', 'confirmada') } catch (e) { log.error(e.message) }
      await responder(respostaConfirmada(r.arte))
      log.info(`escala ${alvo.semana}: confirmada pelo dono no WhatsApp`)
      return true
    }
    // não confirmou (ou só em parte): a semana volta a esperar (pode tocar de novo ou confirmar no app)
    try { await cas(alvo.semana, 'confirmando', 'aguardando') } catch (e) { log.error(e.message) }
    if (r?.motivo === 'push_parcial') {
      await responder(`Confirmada em parte: ${r.erro} ${r.arte?.erro || r.arte?.erroRegenerar ? 'E a arte dos grupos não foi pedida.' : 'A arte dos grupos já foi pedida.'} Toque Confirmar de novo para avisar só quem faltou.`)
      return true
    }
    await responder(`Não consegui confirmar: ${r?.erro || 'erro desconhecido'}. A escala continua esperando: toque de novo ou confirme pelo app.`)
    return true
  }

  // O que dizer depois do Confirmar: só promete "arte indo" quando ela foi mesmo pedida e disparada.
  function respostaConfirmada(arte) {
    if (!arte) return RESPOSTAS.confirmada
    if (arte.desligado) return 'Confirmada. O envio da escala para os grupos está desligado em São Tarcísio, então nenhuma arte vai.'
    if (arte.erro) return `Confirmada, mas a arte não entrou na fila dos grupos (${arte.erro}). Veja em São Tarcísio.`
    if (arte.erroRegenerar) return `Confirmada, mas não consegui mandar fazer a arte (${arte.erroRegenerar}). Gere a arte na Escala.`
    if (!arte.novo) return 'Confirmada. A arte desta semana já tinha sido pedida; nada foi reenviado.'
    return RESPOSTAS.confirmada
  }

  // Precisa ser olhada aqui (e não pela IA)? Decide antes de gravar, só com a config.
  function precisaOlhar(msg, cfg) {
    if (msg.documento && ehPdf(msg.documento)) return true
    if (msg.tocou) return true
    if (!quemAutorizado(cfg, msg.numero)) return false
    return !!msg.botao || !!simOuNao(msg.texto)
  }

  // true = tratada (ou ignorada de propósito): a IA não responde.
  async function tratar(msg, cfg) {
    if (msg.documento && ehPdf(msg.documento)) {
      // PDF de número não autorizado: ignorado, sem resposta nenhuma
      await ministros.receberPdfMinistros({ numero: msg.numero, documento: msg.documento, external_id: msg.external_id, cfg })
      return true
    }
    if (String(msg.botao || '').startsWith('apelido:')) {
      return (await ministros.responderApelido({ numero: msg.numero, botao: msg.botao, cfg })) || msg.tocou
    }
    if (String(msg.botao || '').startsWith('escala:')) {
      return (await tratarRespostaDono({ numero: msg.numero, botao: msg.botao, cfg })) || msg.tocou
    }
    if (msg.tocou) return true   // botão de outra coisa: nada a fazer, e a IA não precisa ver
    return ministros.responderPorTexto({ numero: msg.numero, texto: msg.texto, cfg })
  }

  // Webhook: grava a mensagem (o external_id único barra o evento repetido da Evolution) e, se for
  // do dono, trata antes da IA. Fica marcada como respondida desde o início para a IA não pegá-la
  // no meio (baixar e ler o PDF leva segundos); se no fim não era nada do dono, volta para a IA.
  async function receber(msg) {
    if (!msg) return
    // sem a config não dá para saber quem é o dono: guarda como conversa comum (como antes)
    let cfg = null
    try { cfg = await lerCfg() } catch (e) { log.error(`webhook sem config: ${e.message}`) }
    const olhar = !!cfg && precisaOlhar(msg, cfg)
    const linha = { numero: msg.numero, external_id: msg.external_id, texto: msg.texto, midia: msg.midia, direcao: 'entrada', respondida: olhar }
    const gravada = exigir(await db.from('tarcisio_mensagens').upsert(linha, { onConflict: 'external_id', ignoreDuplicates: true }).select('id'), 'guardar mensagem')
    if (!olhar || !gravada.length) return
    let tratada = true
    try { tratada = await tratar(msg, cfg) } catch (e) {
      log.error(`resposta do dono: ${e.message}`)
      const quem = quemAutorizado(cfg, msg.numero)
      if (quem) {
        try { await evo.enviarTexto(quem, `Deu erro ao tratar sua mensagem: ${e.message}. Confira no app.`) } catch { /* sem como avisar */ }
      }
    }
    if (!tratada) exigir(await db.from('tarcisio_mensagens').update({ respondida: false }).eq('id', gravada[0].id), 'devolver para a IA')
  }

  return { tratarRespostaDono, tratar, receber, precisaOlhar }
}
