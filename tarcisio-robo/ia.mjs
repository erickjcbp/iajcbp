// Cliente mínimo da API da Anthropic (Messages + ferramentas). Mesmo provedor que o TENET usa.
export function criarIA({ chave, fetchFn = fetch }) {
  async function mensagem({ modelo, sistema, mensagens, ferramentas, maxTokens = 1200 }) {
    const resp = await fetchFn('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: AbortSignal.timeout(60_000),
      headers: { 'x-api-key': chave, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      // thinking desligado: com o prompt longo do assistente o raciocínio interno gastava os 700 tokens e a resposta saía vazia (stop_reason=max_tokens), virando o aviso genérico
      body: JSON.stringify({ model: modelo, max_tokens: maxTokens, thinking: { type: 'disabled' }, system: sistema, messages: mensagens, ...(ferramentas ? { tools: ferramentas } : {}) }),
    })
    const json = await resp.json().catch(() => null)
    if (!resp.ok) throw new Error(`IA respondeu ${resp.status}: ${json?.error?.message || 'sem detalhe'}`)
    return json
  }

  // Conversa com ferramentas: a IA pede, o robô executa (com as travas dele) e devolve, até
  // ela responder em texto — no máximo `limite` rodadas de ferramenta.
  async function conversar({ modelo, sistema, mensagens, ferramentas, executar, limite = 4, log = console }) {
    const historico = [...mensagens]
    const usadas = []
    let reforco = false
    for (let i = 0; i <= limite; i++) {
      const r = await mensagem({ modelo, sistema: reforco ? sistema + '\nResponda SEMPRE em texto à última mensagem da pessoa; nunca devolva resposta vazia.' : sistema, mensagens: historico, ferramentas: i < limite ? ferramentas : undefined })
      const pedidos = (r.content || []).filter((c) => c.type === 'tool_use')
      if (!pedidos.length || r.stop_reason !== 'tool_use') {
        const texto = (r.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n').trim()
        // Resposta vazia (sem texto e sem ferramenta): tenta uma vez de novo com reforço, em vez de mandar o aviso genérico.
        if (!texto && !reforco) { log.warn(`IA devolveu resposta vazia (stop_reason=${r.stop_reason}); repetindo uma vez com reforço`); reforco = true; i--; continue }
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
