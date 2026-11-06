// Trava de entrada nos grupos de SERVOS (Acólitos e Cerimoniários).
//
// Regra do dono (05/11/2026): esses grupos são dos servos; família entra no grupo de PAIS. Só pode entrar
// no grupo de servos um número que seja o TELEFONE PRÓPRIO de uma ficha — ou uma exceção que a coordenação
// registrou de propósito (tabela tarcisio_grupo_excecoes).
//
// Por que existe: mães e responsáveis de servos foram
// parar no grupo de acólitos sem ninguém decidir isso. Três rotinas do robô adicionam gente a grupo
// sozinhas (acolhida, coleta de contato, validação de contato) e cada uma tinha a sua conferência; uma
// regra só, aqui, na porta do WhatsApp, vale para as três e para qualquer rotina futura.
//
// Falha FECHADA: se não der para ler as fichas, ninguém entra. É melhor atrasar uma entrada do que
// colocar um adulto no grupo de crianças. Tudo o que não é grupo de servos passa direto.
const exigir = ({ data, error }, onde) => {
  if (error) throw new Error(`${onde}: ${error.message}`)
  return data
}
const fim = (bruto) => {
  const d = String(bruto || '').replace(/\D/g, '')
  return d.length >= 8 ? d.slice(-8) : null
}

export const GRUPOS_PROTEGIDOS = ['acolitos', 'cerimoniarios']

// Ritmo das operações de grupo (entrar/sair). O WhatsApp RESTRINGIU o número do Tarcísio em 05/11/2026
// (dia com 86 envios contra ~35 de média e mudanças de grupo em série). Entrada e saída de participante é o que
// mais pesa na análise de abuso; por isso vão devagar, uma de cada vez, e param quando a coordenação manda.
//  - pausa_grupos_ate (tarcisio_config): enquanto estiver no futuro, nenhuma operação de grupo;
//  - no máximo 1 operação a cada 30 min e 3 NÚMEROS por 24 h (contado em tarcisio_grupo_operacoes, que
//    sobrevive a reinício do robô).
export const LIMITES = { intervaloMinimoMs: 30 * 60_000, maximoPor24h: 3 }

export class ErroGruposLimitados extends Error {
  constructor(mensagem, { motivo, ate } = {}) { super(mensagem); this.name = 'ErroGruposLimitados'; this.motivo = motivo; this.ate = ate }
}

export class ErroGrupoProtegido extends Error {
  constructor(mensagem, { papel, numeros } = {}) { super(mensagem); this.name = 'ErroGrupoProtegido'; this.papel = papel; this.numeros = numeros }
}

export function criarGuardaGrupos({ db, evo, log = console, agora = () => Date.now(), validade = 5 * 60_000 }) {
  let cache = null, cacheEm = 0

  async function carregar() {
    if (cache && agora() - cacheEm < validade) return cache
    const grupos = exigir(await db.from('tarcisio_grupos').select('jid,papel').in('papel', GRUPOS_PROTEGIDOS), 'ler grupos')
    const fichas = exigir(await db.from('acolitos_membros').select('telefone').not('telefone', 'is', null).limit(5000), 'ler telefones das fichas')
    // Sem a tabela (migration ainda não rodou) ou com erro: sem exceções — a trava continua valendo.
    let excecoes = []
    try { const r = await db.from('tarcisio_grupo_excecoes').select('numero_fim,papel'); if (!r.error && Array.isArray(r.data)) excecoes = r.data } catch (_) { /* sem exceções */ }
    cache = {
      papelDoGrupo: new Map(grupos.map((g) => [g.jid, g.papel])),
      proprios: new Set(fichas.map((f) => fim(f.telefone)).filter(Boolean)),
      excecoes: new Set(excecoes.map((e) => `${e.papel}:${e.numero_fim}`)),
    }
    cacheEm = agora()
    return cache
  }

  // Pode mexer em grupo agora? Lança ErroGruposLimitados (motivo: pausa | limite_diario | intervalo).
  // Falha FECHADA: sem conseguir ler a pausa ou o histórico, não mexe.
  async function verificarRitmo(qtd) {
    const cfg = exigir(await db.from('tarcisio_config').select('pausa_grupos_ate').eq('id', 1).maybeSingle(), 'ler pausa de grupos')
    const ate = cfg?.pausa_grupos_ate ? +new Date(cfg.pausa_grupos_ate) : 0
    if (ate > agora()) throw new ErroGruposLimitados('Entrada e saída de grupo estão em pausa até ' + new Date(ate).toISOString() + ' (restrição do WhatsApp).', { motivo: 'pausa', ate: new Date(ate).toISOString() })
    const desde = new Date(agora() - 24 * 3600_000).toISOString()
    const ops = exigir(await db.from('tarcisio_grupo_operacoes').select('quando,qtd').gte('quando', desde).order('quando', { ascending: false }), 'ler operações de grupo')
    const total = ops.reduce((a, o) => a + (Number(o.qtd) || 1), 0)
    if (total + qtd > LIMITES.maximoPor24h) throw new ErroGruposLimitados(`Limite de ${LIMITES.maximoPor24h} entradas/saídas de grupo por 24 h atingido.`, { motivo: 'limite_diario' })
    const ultima = ops[0] ? +new Date(ops[0].quando) : 0
    if (ultima && agora() - ultima < LIMITES.intervaloMinimoMs) {
      const ate2 = new Date(ultima + LIMITES.intervaloMinimoMs).toISOString()
      throw new ErroGruposLimitados('Intervalo mínimo entre operações de grupo ainda não passou.', { motivo: 'intervalo', ate: ate2 })
    }
  }

  async function registrar(acao, papel, numeros) {
    const r = await db.from('tarcisio_grupo_operacoes').insert({ acao, papel, qtd: (numeros || []).length || 1, numeros_fim: (numeros || []).map((n) => fim(n)).filter(Boolean).map((f) => f.slice(-4)) })
    if (r?.error) log.warn(`não registrei a operação de grupo (${acao}): ${r.error.message}`)
  }

  // Para quem precisa decidir ANTES de gravar qualquer coisa (acolhida, coleta de contato, validação).
  async function gruposLiberados() {
    try { await verificarRitmo(1); return { ok: true } }
    catch (e) { return e instanceof ErroGruposLimitados ? { ok: false, motivo: e.motivo, ate: e.ate } : { ok: false, motivo: 'erro_leitura' } }
  }

  async function adicionarAoGrupo(jid, numeros) {
    const c = await carregar()
    const papel = c.papelDoGrupo.get(jid)
    if (papel && GRUPOS_PROTEGIDOS.includes(papel)) {
      const barrados = (numeros || []).filter((n) => {
        const f = fim(n)
        return !f || !(c.proprios.has(f) || c.excecoes.has(`${papel}:${f}`))
      })
      if (barrados.length) {
        log.warn(`grupo de servos protegido (${papel}): barrei ${barrados.length} número(s) que não são telefone próprio de nenhuma ficha (final ${barrados.map((n) => fim(n) ? fim(n).slice(-4) : '?').join(', ')})`)
        throw new ErroGrupoProtegido('Esse número não é o telefone próprio de nenhum servo: família entra no grupo de Pais.', { papel, numeros: barrados })
      }
    }
    await verificarRitmo((numeros || []).length || 1)
    const r = await evo.adicionarAoGrupo(jid, numeros)
    await registrar('adicionar', papel || null, numeros)
    return r
  }

  async function removerDoGrupo(jid, numeros) {
    const c = await carregar()
    const papel = c.papelDoGrupo.get(jid)
    await verificarRitmo((numeros || []).length || 1)
    const r = await evo.removerDoGrupo(jid, numeros)
    await registrar('remover', papel || null, numeros)
    return r
  }

  return { ...evo, adicionarAoGrupo, removerDoGrupo, gruposLiberados }
}
