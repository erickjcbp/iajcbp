// O robô fala com o site (Vercel) por duas rotas, com a chave só dele (ROBO_PUSH_SECRET, cabeçalho
// x-cron-secret), que cada rota aceita para UMA coisa:
//   /api/enviar-push    → tipo escalado_robo (o "você foi escalado" do Confirmar)
//   /api/regenerar-arte → dispara a arte da escala (formato automático) para os grupos
// A URL da arte sai do PUSH_URL (mesmo site, troca o último pedaço), sem variável nova;
// REGENERAR_ARTE_URL só existe para apontar para outro lugar, se um dia precisar.
export const urlIrma = (url, rota) => new URL(rota, url).toString()

export function criarSite({ pushUrl, arteUrl = null, segredo, fetch = globalThis.fetch }) {
  const exigir = () => { if (!pushUrl || !segredo) throw new Error('faltam PUSH_URL e ROBO_PUSH_SECRET no robo.env') }
  const postar = async (url, corpo) => {
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-cron-secret': segredo }, body: JSON.stringify(corpo) })
    if (!r.ok) throw new Error(`${new URL(url).pathname} respondeu ${r.status}`)
  }
  return {
    async enviarPushEscalado(membros) {
      exigir()
      await postar(pushUrl, { tipo: 'escalado_robo', membros })
      return { ok: true }
    },
    async regenerarArte() {
      exigir()
      await postar(arteUrl || urlIrma(pushUrl, 'regenerar-arte'), { formato: 'automatico' })
    },
  }
}

// A prévia vai só ao dono, antes dos botões. Não cria pedidos na fila dos grupos.
// Exige uma arte nova para não validar uma imagem anterior às alterações da escala.
export function criarConferenciaImagem({ db, evo, site, supabaseUrl, agora = () => Date.now(),
  esperar = (ms) => new Promise((r) => setTimeout(r, ms)), limiteMs = 10 * 60_000 }) {
  return async (numero, sabado) => {
    const inicio = agora()
    const domingo = new Date(sabado + 'T12:00:00Z')
    domingo.setUTCDate(domingo.getUTCDate() + 1)
    await site.regenerarArte()
    while (agora() - inicio < limiteMs) {
      const { data: arte, error } = await db.from('acolitos_escala_artes')
        .select('png_url,png_url_domingo,gerado_em').eq('domingo_data', domingo.toISOString().slice(0, 10)).maybeSingle()
      if (error) throw new Error(`ler prévia: ${error.message}`)
      if (arte?.png_url && new Date(arte.gerado_em).getTime() >= inicio) {
        const urls = [arte.png_url, arte.png_url_domingo].filter(Boolean).map((valor) => {
          const url = new URL(valor)
          if (url.origin !== new URL(supabaseUrl).origin || !url.pathname.startsWith('/storage/v1/object/public/artes-escala/'))
            throw new Error('Imagem de conferência fora do armazenamento do projeto')
          url.searchParams.set('v', String(new Date(arte.gerado_em).getTime()))
          return url.toString()
        })
        for (let i = 0; i < urls.length; i++)
          await evo.enviarImagem(numero, urls[i], `Prévia da escala para conferência (${i + 1}/${urls.length}). Aguarde as opções Confirmar / Revisar.`)
        return
      }
      await esperar(5_000)
    }
    throw new Error('A imagem da escala não ficou pronta em 10 minutos; confira no app.')
  }
}
