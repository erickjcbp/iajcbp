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
    enviarTexto: (destino, texto) => chamar(`/message/sendText/${nome}`, { metodo: 'POST', corpo: { number: destino, text: texto } }),
    enviarImagem: (destino, url, legenda) => chamar(`/message/sendMedia/${nome}`, {
      metodo: 'POST',
      corpo: { number: destino, mediatype: 'image', mimetype: 'image/png', media: url, caption: legenda || '', fileName: 'sao-tarcisio.png' },
    }),
  }
}
