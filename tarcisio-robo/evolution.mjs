// Cliente da Evolution 2.3.7, portado de satorhub/supabase/functions/_shared/evolution.ts
// (mesma forma de chamar e de ler o erro). Fala só com 127.0.0.1: a Evolution do São Tarcísio
// não fica exposta na internet.

export class ErroGateway extends Error {
  constructor(status, mensagem, semWhatsapp = false) {
    super(mensagem)
    this.status = status
    this.semWhatsapp = semWhatsapp
  }
}

export function criarEvolution({ url, chave, instancia, fetchFn = fetch }) {
  const base = url.replace(/\/$/, '')
  const nome = encodeURIComponent(instancia)

  async function chamar(caminho, { metodo = 'GET', corpo } = {}) {
    let resp
    try {
      resp = await fetchFn(`${base}${caminho}`, {
        method: metodo,
        signal: AbortSignal.timeout(30_000),
        headers: { apikey: chave, 'Content-Type': 'application/json' },
        body: corpo === undefined ? undefined : JSON.stringify(corpo),
      })
    } catch {
      throw new ErroGateway(0, 'Não foi possível falar com a Evolution.')
    }
    const texto = await resp.text()
    let json = null
    try { json = texto ? JSON.parse(texto) : null } catch { json = { raw: texto } }
    if (!resp.ok) {
      const detalhe = json?.response?.message ?? json?.message ?? json?.error ?? resp.status
      const lista = Array.isArray(detalhe) ? detalhe : [detalhe]
      // número sem WhatsApp: a Evolution responde 400 com [{exists:false, number}]
      const semWhatsapp = lista.some((d) => d && typeof d === 'object' && d.exists === false)
      const msg = lista.map((d) => (typeof d === 'object' ? JSON.stringify(d) : String(d))).join(', ')
      throw new ErroGateway(resp.status, semWhatsapp ? 'Número sem WhatsApp' : `Evolution respondeu: ${msg}`, semWhatsapp)
    }
    return json
  }

  return {
    estado: async () => (await chamar(`/instance/connectionState/${nome}`))?.instance?.state ?? 'desconhecida',
    // devolve { base64 } enquanto não pareado
    conectar: async () => chamar(`/instance/connect/${nome}`),
    numeroConectado: async () => {
      const lista = await chamar(`/instance/fetchInstances?instanceName=${nome}`)
      const jid = (Array.isArray(lista) ? lista[0] : lista)?.ownerJid ?? null
      return jid ? String(jid).split('@')[0] : null
    },
    grupos: async () => {
      const lista = await chamar(`/group/fetchAllGroups/${nome}?getParticipants=false`)
      return (Array.isArray(lista) ? lista : []).map((g) => ({ jid: g.id, nome: g.subject || g.id }))
    },
    // Mensagens recebidas vão para o robô pela rede interna do compose (nada público).
    configurarWebhook: (url) => chamar(`/webhook/set/${nome}`, { metodo: 'POST', corpo: { webhook: {
      enabled: true, url, byEvents: false, base64: false, events: ['MESSAGES_UPSERT'] } } }),
    enviarTexto: (destino, texto) => chamar(`/message/sendText/${nome}`, { metodo: 'POST', corpo: { number: destino, text: texto } }),
    // Botões de resposta (Evolution 2.x, /message/sendButtons). botoes: [{ id, texto }].
    // A resposta do toque volta pelo webhook com o `id` (lida na Task 9).
    enviarBotoes: (destino, texto, botoes, titulo = 'São Tarcísio | JCBP', rodape = 'Responda 1 = Confirmar, 2 = Revisar') => chamar(`/message/sendButtons/${nome}`, {
      metodo: 'POST',
      corpo: { number: destino, title: titulo, description: texto, footer: rodape,
        buttons: botoes.map((b) => ({ type: 'reply', displayText: b.texto, id: b.id })) },
    }),
    // Arquivo recebido (PDF dos ministros): a Evolution devolve o conteúdo em base64 pelo id da
    // mensagem (o webhook vem com base64:false, então o arquivo não chega no corpo do evento).
    baixarMidia: async (externalId) => {
      const r = await chamar(`/chat/getBase64FromMediaMessage/${nome}`, {
        metodo: 'POST', corpo: { message: { key: { id: externalId } }, convertToMp4: false } })
      if (!r?.base64) throw new ErroGateway(0, 'A Evolution não devolveu o arquivo.')
      return { base64: String(r.base64), mimetype: r.mimetype ?? null, nome: r.fileName ?? null }
    },
    enviarImagem: (destino, url, legenda) => chamar(`/message/sendMedia/${nome}`, {
      metodo: 'POST',
      corpo: { number: destino, mediatype: 'image', mimetype: 'image/png', media: url, caption: legenda || '', fileName: 'sao-tarcisio.png' },
    }),
  }
}

// Toque em botão: o id volta em formatos diferentes conforme o aparelho e a versão da Evolution 2.x
// (botão de resposta, botão de modelo, lista, fluxo nativo). Nenhum desses formatos foi capturado
// do aparelho real ainda: os exemplos em fixtures/ são SINTÉTICOS (conferir ao vivo na Task 11).
function idDoBotao(m) {
  if (m.buttonsResponseMessage) return m.buttonsResponseMessage.selectedButtonId || null
  if (m.templateButtonReplyMessage) return m.templateButtonReplyMessage.selectedId || null
  if (m.listResponseMessage) return m.listResponseMessage.singleSelectReply?.selectedRowId || m.listResponseMessage.selectedRowId || null
  const nf = m.interactiveResponseMessage?.nativeFlowResponseMessage
  if (nf) {
    try { const p = JSON.parse(nf.paramsJson || '{}'); return p.id || p.selectedId || null } catch { return null }
  }
  return null
}
function textoDoBotao(m) {
  return m.buttonsResponseMessage?.selectedDisplayText || m.templateButtonReplyMessage?.selectedDisplayText
    || m.listResponseMessage?.title || m.interactiveResponseMessage?.body?.text || null
}
// Resposta por texto (botão não chegou ou o aparelho não mostra): "1"/"confirmar" e "2"/"revisar".
export function botaoDoTexto(texto) {
  const t = String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[.!\s]+$/g, '').trim()
  if (t === '1' || t === 'confirmar') return 'escala:confirmar'
  if (t === '2' || t === 'revisar') return 'escala:revisar'
  return null
}

// Lê um evento da Evolution (portado de parseEvolutionEvent, satorhub/_shared/evolution.ts).
// Só interessa mensagem recebida, no privado. Grupo, status e o que o próprio número mandou: ignora.
export function lerMensagemRecebida(corpo) {
  const evento = String(corpo?.event || '').toLowerCase().replace(/_/g, '.')
  if (evento !== 'messages.upsert') return null
  const d = corpo?.data
  const chave = d?.key
  const jid = String(chave?.remoteJid || '')
  if (!jid || chave?.fromMe || jid.endsWith('@g.us') || jid === 'status@broadcast') return null
  // WhatsApp novo esconde o número atrás de um @lid; a Evolution às vezes manda o real ao lado
  const real = jid.endsWith('@lid') ? String(chave?.remoteJidAlt || d?.senderPn || '') : jid
  const numero = real.split('@')[0].replace(/\D/g, '')
  if (!numero || !chave?.id) return null
  let m = d?.message || {}
  if (m.ephemeralMessage?.message) m = m.ephemeralMessage.message
  const doc = m.documentMessage || m.documentWithCaptionMessage?.message?.documentMessage || null
  const tocado = idDoBotao(m)
  const texto = m.conversation || m.extendedTextMessage?.text || m.imageMessage?.caption || m.videoMessage?.caption
    || doc?.caption || textoDoBotao(m) || null
  const midia = m.audioMessage ? 'audio' : m.imageMessage ? 'imagem' : m.videoMessage ? 'video' : doc ? 'documento'
    : m.stickerMessage ? 'figurinha' : (!texto && !tocado ? 'outro' : null)
  const documento = doc ? { mimetype: doc.mimetype ? String(doc.mimetype) : null, nome: doc.fileName ? String(doc.fileName).slice(0, 200) : null } : null
  return {
    numero, external_id: String(chave.id), texto: texto ? String(texto).slice(0, 4000) : null, midia,
    // botão tocado, ou o atalho por texto ("1"/"2"); `tocou` diz se veio de botão de verdade
    botao: tocado ? String(tocado).slice(0, 200) : (!doc ? botaoDoTexto(texto) : null),
    tocou: !!tocado,
    documento,
  }
}
