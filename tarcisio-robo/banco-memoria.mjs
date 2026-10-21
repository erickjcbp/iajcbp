// Só para testes: banco em memória com o pedaço da API do supabase-js que o robô usa.
// from(t).select/insert/upsert/update/delete + eq/gte/lte/lt/in/contains/order/limit,
// terminando em await, maybeSingle ou single. Nada sai daqui: nenhum dado real.
export function bancoMemoria(inicial = {}, falhar = () => false) {
  const t = structuredClone(inicial)
  let seq = 0
  let relogio = Date.parse('2026-10-01T00:00:00Z')
  const contem = (dentro, parte) => {
    if (Array.isArray(parte)) return Array.isArray(dentro) && parte.every((p) => dentro.some((d) => contem(d, p)))
    if (parte && typeof parte === 'object') return !!dentro && typeof dentro === 'object' && Object.entries(parte).every(([k, v]) => contem(dentro[k], v))
    return dentro === parte
  }
  const passa = (r, [f, c, v]) => f === 'eq' ? r[c] === v : f === 'gte' ? r[c] >= v : f === 'lte' ? r[c] <= v
    : f === 'lt' ? r[c] < v : f === 'in' ? v.includes(r[c]) : f === 'contains' ? contem(r[c], v) : true
  const FILTROS = ['eq', 'gte', 'lte', 'lt', 'in', 'contains']
  function exec(tabela, ops) {
    const linhas = (t[tabela] ||= [])
    const achar = (nome) => ops.find((o) => o[0] === nome)
    const casa = (r) => ops.filter((o) => FILTROS.includes(o[0])).every((o) => passa(r, o))
    const ins = achar('insert'), ups = achar('upsert'), upd = achar('update'), del = achar('delete')
    if (falhar(tabela, ops)) return { data: null, error: { message: `falha simulada em ${tabela}` } }
    const novo = (x) => ({ id: `${tabela.slice(0, 3)}${++seq}`, created_at: new Date(relogio += 1000).toISOString(), ...x })
    if (del) { const fora = linhas.filter(casa); t[tabela] = linhas.filter((r) => !fora.includes(r)); return { data: fora, error: null } }
    if (ins) { const novos = [].concat(ins[1]).map(novo); linhas.push(...novos); return { data: structuredClone(novos), error: null } }
    if (ups) {
      const chaves = String(ups[2]?.onConflict || 'id').split(',').map((s) => s.trim())
      const saida = []
      for (const n of [].concat(ups[1])) {
        const ja = linhas.find((r) => chaves.every((k) => r[k] === n[k]))
        if (ja) { if (!ups[2]?.ignoreDuplicates) { Object.assign(ja, n); saida.push(ja) } }
        else { const x = novo(n); linhas.push(x); saida.push(x) }
      }
      return { data: structuredClone(saida), error: null }
    }
    if (upd) { const alvo = linhas.filter(casa); alvo.forEach((r) => Object.assign(r, upd[1])); return { data: structuredClone(alvo), error: null } }
    let achados = linhas.filter(casa)
    for (const o of ops.filter((x) => x[0] === 'order')) {
      const desc = o[2]?.ascending === false
      achados = achados.slice().sort((a, b) => (a[o[1]] < b[o[1]] ? -1 : a[o[1]] > b[o[1]] ? 1 : 0) * (desc ? -1 : 1))
    }
    const lim = achar('limit')
    if (lim) achados = achados.slice(0, lim[1])
    achados = structuredClone(achados)
    if (achar('maybeSingle')) return { data: achados[0] ?? null, error: null }
    if (achar('single')) return achados.length ? { data: achados[0], error: null } : { data: null, error: { message: 'nenhuma linha' } }
    return { data: achados, error: null }
  }
  const from = (tabela) => {
    const ops = []
    const q = new Proxy({}, {
      get(_, nome) {
        if (nome === 'then') return (ok, erro) => Promise.resolve(exec(tabela, ops)).then(ok, erro)
        return (...args) => { ops.push([nome, ...args]); return q }
      },
    })
    return q
  }
  return { from, t }
}
