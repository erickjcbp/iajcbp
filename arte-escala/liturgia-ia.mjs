// Conferência da liturgia do domingo com a IA. O cálculo local (liturgico.mjs) cobre o ciclo regular e as
// datas fixas mais comuns; a IA é a segunda opinião para o que o cálculo não enxerga (solenidade ou festa
// que toma o lugar do domingo, data transferida pela CNBB, Tempo do Natal...). Só vale com chave da IA.
const CORES = ['verde', 'branco', 'roxo', 'vermelho', 'rosa']

const SISTEMA = `Você é especialista em liturgia católica do Rito Romano, forma ordinária, no calendário da Igreja no Brasil (CNBB).
Responda SÓ com um objeto JSON, sem texto fora dele.`

export function pedidoDaConferencia(domingo, calculado) {
  return `Qual é a celebração litúrgica do domingo ${domingo} no Brasil?
Considere a precedência da Tabela dos dias litúrgicos: domingos do Advento, da Quaresma e da Páscoa vencem solenidades e festas; solenidades e festas do Senhor que caem em domingo do Tempo Comum tomam o lugar dele; confira também datas transferidas pela CNBB.
O cálculo automático do app diz: "${calculado.descricao}" (tempo: ${calculado.tempo}, cor: ${calculado.cor}).
Responda neste formato:
{"concorda": true|false, "tempo": "TEMPO COMUM|ADVENTO|NATAL|QUARESMA|TEMPO PASCAL|SOLENIDADE|FESTA DO SENHOR|FINADOS", "descricao": "texto curto como 'Solenidade de Todos os Santos, Ano A' ou '31º Domingo do Tempo Comum, Ano A'", "cor": "verde|branco|roxo|vermelho|rosa", "motivo": "uma frase"}
"concorda" é true só se o cálculo do app estiver correto no nome e na cor.`
}

export function lerResposta(texto) {
  const m = String(texto || '').match(/\{[\s\S]*\}/)
  if (!m) return null
  let j
  try { j = JSON.parse(m[0]) } catch { return null }
  const descricao = String(j.descricao || '').trim(), tempo = String(j.tempo || '').trim().toUpperCase(), cor = String(j.cor || '').trim().toLowerCase()
  if (typeof j.concorda !== 'boolean') return null
  if (!descricao || descricao.length > 120 || !tempo || tempo.length > 30 || !CORES.includes(cor)) return null
  return { concorda: j.concorda, tempo, descricao, cor, motivo: String(j.motivo || '').slice(0, 300) }
}

// Devolve { ok:true, concorda, tempo, descricao, cor, motivo } ou { ok:false, motivo } (sem chave, erro, resposta inválida).
export async function conferirLiturgia({ domingo, calculado, chave, modelo, fetchFn = fetch }) {
  if (!chave) return { ok: false, motivo: 'sem chave da IA' }
  try {
    const r = await fetchFn('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: AbortSignal.timeout(25_000),
      headers: { 'content-type': 'application/json', 'x-api-key': chave, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: modelo || 'claude-sonnet-5-5', max_tokens: 500, system: SISTEMA,
        messages: [{ role: 'user', content: pedidoDaConferencia(domingo, calculado) }] }),
    })
    if (!r.ok) return { ok: false, motivo: `IA respondeu ${r.status}` }
    const corpo = await r.json()
    const lido = lerResposta((corpo.content || []).map((c) => c.text || '').join(''))
    return lido ? { ok: true, ...lido } : { ok: false, motivo: 'resposta da IA fora do formato' }
  } catch (e) { return { ok: false, motivo: `IA indisponível: ${e.message}` } }
}
