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
    return evo.adicionarAoGrupo(jid, numeros)
  }

  return { ...evo, adicionarAoGrupo }
}
