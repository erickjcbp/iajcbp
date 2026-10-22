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
