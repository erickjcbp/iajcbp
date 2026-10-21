// Cliente mínimo da API da Anthropic (Messages + ferramentas). Mesmo provedor que o TENET usa.
export function criarIA({ chave, fetchFn = fetch }) {
  async function mensagem({ modelo, sistema, mensagens, ferramentas, maxTokens = 700 }) {
    const resp = await fetchFn('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: AbortSignal.timeout(60_000),
      headers: { 'x-api-key': chave, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: modelo, max_tokens: maxTokens, system: sistema, messages: mensagens, ...(ferramentas ? { tools: ferramentas } : {}) }),
    })
    const json = await resp.json().catch(() => null)
    if (!resp.ok) throw new Error(`IA respondeu ${resp.status}: ${json?.error?.message || 'sem detalhe'}`)
    return json
  }

  // Conversa com ferramentas: a IA pede, o robô executa (com as travas dele) e devolve, até
  // ela responder em texto — no máximo `limite` rodadas de ferramenta.
  async function conversar({ modelo, sistema, mensagens, ferramentas, executar, limite = 4 }) {
    const historico = [...mensagens]
    const usadas = []
    for (let i = 0; i <= limite; i++) {
      const r = await mensagem({ modelo, sistema, mensagens: historico, ferramentas: i < limite ? ferramentas : undefined })
      const pedidos = (r.content || []).filter((c) => c.type === 'tool_use')
      if (!pedidos.length || r.stop_reason !== 'tool_use') {
        const texto = (r.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n').trim()
        return { texto, usadas }
      }
      historico.push({ role: 'assistant', content: r.content })
      const resultados = []
      for (const p of pedidos) {
        let saida
        try { saida = await executar(p.name, p.input || {}) } catch (e) { saida = { erro: e.message } }
        usadas.push({ ferramenta: p.name, entrada: p.input, saida })
        resultados.push({ type: 'tool_result', tool_use_id: p.id, content: JSON.stringify(saida) })
      }
      historico.push({ role: 'user', content: resultados })
    }
    return { texto: '', usadas }
  }

  async function texto({ modelo, sistema, pedido, maxTokens = 500 }) {
    const r = await mensagem({ modelo, sistema, mensagens: [{ role: 'user', content: pedido }], maxTokens })
    return (r.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n').trim()
  }

  return { conversar, texto }
}
