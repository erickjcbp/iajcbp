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
    enviarBotoes: (destino, texto, botoes, titulo = 'São Tarcísio | JCBP') => chamar(`/message/sendButtons/${nome}`, {
      metodo: 'POST',
      corpo: { number: destino, title: titulo, description: texto, footer: 'Responda 1 = Confirmar, 2 = Revisar',
        buttons: botoes.map((b) => ({ type: 'reply', displayText: b.texto, id: b.id })) },
    }),
    enviarImagem: (destino, url, legenda) => chamar(`/message/sendMedia/${nome}`, {
      metodo: 'POST',
      corpo: { number: destino, mediatype: 'image', mimetype: 'image/png', media: url, caption: legenda || '', fileName: 'sao-tarcisio.png' },
    }),
  }
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
  const m = d?.message || {}
  const texto = m.conversation || m.extendedTextMessage?.text || m.imageMessage?.caption || m.videoMessage?.caption || null
  const midia = m.audioMessage ? 'audio' : m.imageMessage ? 'imagem' : m.videoMessage ? 'video' : m.documentMessage ? 'documento'
    : m.stickerMessage ? 'figurinha' : (!texto ? 'outro' : null)
  return { numero, external_id: String(chave.id), texto: texto ? String(texto).slice(0, 4000) : null, midia }
}
