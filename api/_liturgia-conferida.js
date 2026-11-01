// Antes de gerar a arte da escala: confere a liturgia do domingo com a IA e, se o cálculo do app estiver
// errado, grava a correção em acolitos_liturgia_override (que o gerador já respeita). Override que a
// coordenação criou à mão nunca é sobrescrito. Nunca derruba o gatilho: falhou, a arte sai com o cálculo local.
// Os módulos do gerador são .mjs: import dinâmico dentro do try funciona tanto com o empacotamento da
// Vercel quanto no teste, e uma falha de carga nunca derruba o disparo da arte.

export async function garantirLiturgia({ URL, SRK, chave, modelo, agora = new Date(), fetchFn = fetch, log = console } = {}) {
  try {
    const [{ alvoFimDeSemana }, { liturgicoDoDomingo }, { conferirLiturgia }] = await Promise.all([
      import('../arte-escala/fim-de-semana.mjs'), import('../arte-escala/liturgico.mjs'), import('../arte-escala/liturgia-ia.mjs')]);
    const { domingo } = alvoFimDeSemana(agora);
    const H = { apikey: SRK, Authorization: `Bearer ${SRK}`, 'content-type': 'application/json' };
    const ja = await fetchFn(`${URL}/rest/v1/acolitos_liturgia_override?domingo_data=eq.${domingo}&select=domingo_data`, { headers: H });
    if (ja.ok && (await ja.json()).length) return { domingo, fonte: 'override-manual' };
    const calculado = liturgicoDoDomingo(domingo);
    const r = await conferirLiturgia({ domingo, calculado, chave, modelo, fetchFn });
    if (!r.ok) { log.warn(`liturgia ${domingo}: conferência não feita (${r.motivo}); vale o cálculo local: ${calculado.descricao}`); return { domingo, fonte: 'calculo', aviso: r.motivo }; }
    if (r.concorda) return { domingo, fonte: 'calculo-conferido' };
    const grava = await fetchFn(`${URL}/rest/v1/acolitos_liturgia_override`, { method: 'POST', headers: { ...H, Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify({ domingo_data: domingo, tempo: r.tempo, descricao: r.descricao, cor: r.cor }) });
    log.warn(`liturgia ${domingo}: a IA corrigiu "${calculado.descricao}" (${calculado.cor}) para "${r.descricao}" (${r.cor}). ${r.motivo}`);
    return { domingo, fonte: grava.ok ? 'ia-corrigiu' : 'ia-nao-gravou', corrigido: r };
  } catch (e) { log.warn(`liturgia: conferência falhou (${e.message})`); return { fonte: 'erro', aviso: e.message }; }
}
