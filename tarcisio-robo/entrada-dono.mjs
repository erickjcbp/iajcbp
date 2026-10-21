// O que chega do dono (e de quem pode mandar o PDF dos ministros) é tratado AQUI, no webhook,
// antes de virar conversa para a IA: botões Confirmar / Revisar da escala de terça (ou "1"/"2"),
// o PDF da escala dos ministros e as respostas Sim / Não das dúvidas de nome.
// O número do dono vem só de tarcisio_config.numero_conferencia; nada fica escrito no código.
// Projeto: docs/superpowers/specs/2026-10-20-escala-automatica-design.md (seções 5 e 7)
import { agoraSP } from './regras.mjs'
import { ehPdf, numeroLimpo, simOuNao, remetentesAutorizados } from './ministros-pdf.mjs'

const exigir = ({ data, error }, onde) => {
  if (error) throw new Error(`${onde}: ${error.message}`)
  return data
}

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

  async function cas(semana, de, para) {
    return exigir(await db.from('tarcisio_escala_auto').update({ estado: para }).eq('semana', semana).eq('estado', de).select('semana'),
      'mudar estado da semana').length > 0
  }

  // Só age com a semana em 'aguardando'. Outros estados: nada muda; toque repetido recebe aviso.
  async function tratarRespostaDono({ numero, botao, cfg = null }) {
    cfg ??= await lerCfg()
    const dono = numeroLimpo(cfg?.numero_conferencia)
    if (!dono || numeroLimpo(numero) !== dono) return false
    if (botao !== 'escala:confirmar' && botao !== 'escala:revisar') return false
    const hoje = agoraSP(relogio()).data
    const semanas = exigir(await db.from('tarcisio_escala_auto').select('semana,estado').gte('semana', hoje).order('semana'), 'ler semanas')
    const alvo = semanas.find((s) => s.estado === 'aguardando') || semanas[0]
    if (!alvo) return true
    const responder = (t) => evo.enviarTexto(dono, t)
    const jaDecidida = async () => {
      const agora = exigir(await db.from('tarcisio_escala_auto').select('estado').eq('semana', alvo.semana).maybeSingle(), 'ler semana')
      if (JA_DECIDIDA[agora?.estado]) await responder(JA_DECIDIDA[agora.estado])
      return true
    }
    if (alvo.estado !== 'aguardando') return jaDecidida()

    if (botao === 'escala:revisar') {
      if (!(await cas(alvo.semana, 'aguardando', 'em_revisao'))) return jaDecidida()
      await responder(RESPOSTAS.revisar)
      return true
    }
    // Confirmar: a troca de estado é a trava (dois toques ao mesmo tempo, só um passa).
    if (!(await cas(alvo.semana, 'aguardando', 'confirmada'))) return jaDecidida()
    let r
    try { r = await confirmarSemana(alvo.semana) } catch (e) { r = { ok: false, erro: e.message } }
    if (r?.ok) {
      await responder(RESPOSTAS.confirmada)
      log.info(`escala ${alvo.semana}: confirmada pelo dono no WhatsApp`)
      return true
    }
    // não confirmou: a semana volta a esperar (pode tocar de novo ou confirmar no app)
    try { await cas(alvo.semana, 'confirmada', 'aguardando') } catch (e) { log.error(e.message) }
    await responder(`Não consegui confirmar: ${r?.erro || 'erro desconhecido'}. A escala continua esperando: toque de novo ou confirme pelo app.`)
    return true
  }

  // Precisa ser olhada aqui (e não pela IA)? Decide antes de gravar, só com a config.
  function precisaOlhar(msg, cfg) {
    if (msg.documento && ehPdf(msg.documento)) return true
    if (msg.tocou) return true
    const autorizado = remetentesAutorizados(cfg).has(numeroLimpo(msg.numero))
    if (!autorizado) return false
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
      if (remetentesAutorizados(cfg).has(numeroLimpo(msg.numero))) {
        try { await evo.enviarTexto(numeroLimpo(msg.numero), `Deu erro ao tratar sua mensagem: ${e.message}. Confira no app.`) } catch { /* sem como avisar */ }
      }
    }
    if (!tratada) exigir(await db.from('tarcisio_mensagens').update({ respondida: false }).eq('id', gravada[0].id), 'devolver para a IA')
  }

  return { tratarRespostaDono, tratar, receber, precisaOlhar }
}
