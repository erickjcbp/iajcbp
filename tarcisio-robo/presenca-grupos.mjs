// Presença das fichas nos três grupos (servos, pais, cerimoniários), conferida pela lista real de participantes.
// Só escreve quando a lista do grupo veio inteira; grupo sem lista (fora do ar, vazio) nunca vira "ninguém está".
const exigir = ({ data, error }, onde) => {
  if (error) throw new Error(`${onde}: ${error.message}`)
  return data
}

export const NIVEIS_CERIMONIARIO = ['cerimoniario_aspirante', 'cerimoniario_guardiao', 'cerimoniario_magistral', 'cerimoniario_mor']
const MINIMO_PARTICIPANTES = 3
const INTERVALO = 60 * 60_000

const fim = (bruto) => {
  const d = String(bruto || '').replace(/\D/g, '')
  return d.length >= 8 ? d.slice(-8) : null
}
const noGrupo = (numeros, grupo) => numeros.some((n) => n && grupo.has(n))

// listas: { servo, pais, cerimoniarios } com os últimos 8 dígitos dos participantes; grupo ausente não é calculado.
export function calcularPresenca(ficha, listas) {
  const proprio = [fim(ficha.telefone)]
  const familia = [fim(ficha.celular_responsavel), fim(ficha.celular_mae), fim(ficha.celular_recado)]
  const r = {}
  // Grupos de SERVOS: só o telefone PRÓPRIO conta. Antes qualquer número da ficha contava, e uma mãe dentro
  // do grupo dos acólitos fazia a ficha do filho aparecer como "está no grupo" sem ele estar (05/11/2026).
  if (listas.servo) r.no_grupo_whatsapp = noGrupo(proprio, listas.servo)
  if (listas.pais) r.no_grupo_pais = noGrupo(familia, listas.pais)
  if (listas.cerimoniarios) r.no_grupo_cerimoniarios = NIVEIS_CERIMONIARIO.includes(ficha.nivel) && noGrupo(proprio, listas.cerimoniarios)
  return r
}

// Grupo(s) em que a ficha deve estar: cerimoniário no dos Cerimoniários; os demais no dos servos; responsável no de Pais.
// Cerimoniário estar também no dos servos não é erro (regra ainda não decidida pelo dono).
// Servo sem telefone próprio não é cobrado no grupo dos servos: família não entra lá, só no de Pais.
export function gruposEsperados(ficha) {
  const esperados = []
  if (fim(ficha.telefone)) esperados.push(NIVEIS_CERIMONIARIO.includes(ficha.nivel) ? 'cerimoniarios' : 'servo')
  if (fim(ficha.celular_mae) || fim(ficha.celular_responsavel)) esperados.push('pais')
  return esperados
}

// Números de FAMÍLIA que estão dentro de um grupo de servos. Telefone próprio de alguma ficha, exceção
// registrada pela coordenação e número que não é de família nenhuma (o do Tarcísio) não são intrusos.
// `participantes` e `excecoes` usam os últimos 8 dígitos; excecoes tem chaves 'papel:fim'.
export function intrusosDeFamilia({ participantes, fichas, papel, excecoes = new Set(), ignorar = new Set() }) {
  const proprios = new Set(fichas.map((f) => fim(f.telefone)).filter(Boolean))
  const familia = new Map()
  for (const f of fichas) {
    for (const campo of ['celular_responsavel', 'celular_mae', 'celular_recado']) {
      const v = fim(f[campo])
      if (!v) continue
      if (!familia.has(v)) familia.set(v, [])
      familia.get(v).push({ nome: f.nome, campo: campo.replace('celular_', '') })
    }
  }
  const achados = []
  for (const p of participantes) {
    if (!p || proprios.has(p) || ignorar.has(p) || excecoes.has(`${papel}:${p}`)) continue
    if (familia.has(p)) achados.push({ fim: p, membros: familia.get(p) })
  }
  return achados
}
const COLUNA = { servo: 'no_grupo_whatsapp', pais: 'no_grupo_pais', cerimoniarios: 'no_grupo_cerimoniarios' }
const NOME_GRUPO = { servo: 'Acólitos e Coroinhas', pais: 'Pais', cerimoniarios: 'Cerimoniários' }
// Só fichas criadas de CORTE em diante, depois de 48 h (a acolhida tem esse tempo para incluir); as antigas ficam de fora por decisão do dono.
export const CORTE = '2026-11-04T00:00:00Z'
export const CARENCIA = 48 * 60 * 60_000

export function faltaGrupo(ficha, agora) {
  if (ficha.status !== 'ativo' || !ficha.created_at || ficha.created_at < CORTE || +agora - +new Date(ficha.created_at) < CARENCIA) return []
  return gruposEsperados(ficha).filter((g) => !ficha[COLUNA[g]])
}

export function criarPresencaGrupos({ db, evo, log = console }) {
  let ultima = 0
  const PAPEIS = [['servo', 'acolitos', 'grupo_servo_conferido_em'], ['pais', 'pais', 'grupo_pais_conferido_em'], ['cerimoniarios', 'cerimoniarios', 'grupo_cerimoniarios_conferido_em']]

  async function lerLista(jid, nome) {
    try {
      const numeros = (await evo.participantes(jid)).map(fim).filter(Boolean)
      if (numeros.length < MINIMO_PARTICIPANTES) { log.warn(`presença: lista do grupo ${nome} veio com ${numeros.length} participante(s); não gravo`); return null }
      return new Set(numeros)
    } catch (e) { log.warn(`presença: não li o grupo ${nome}: ${e.message}`); return null }
  }

  async function cuidar(agora, { forcar = false } = {}) {
    if (!forcar && +agora - ultima < INTERVALO) return { pulou: true }
    ultima = +agora
    const grupos = exigir(await db.from('tarcisio_grupos').select('jid,papel').in('papel', PAPEIS.map((p) => p[1])), 'ler grupos')
    const listas = {}
    for (const [chave, papel] of PAPEIS) {
      const g = grupos.find((x) => x.papel === papel)
      if (g) { const l = await lerLista(g.jid, papel); if (l) listas[chave] = l }
    }
    if (!Object.keys(listas).length) return { lidos: 0 }
    const fichas = exigir(await db.from('acolitos_membros').select('id,nome,nivel,telefone,celular_responsavel,celular_mae,celular_recado,no_grupo_whatsapp,no_grupo_pais,no_grupo_cerimoniarios').limit(5000), 'ler fichas')
    let mudou = 0
    for (const f of fichas) {
      const novo = calcularPresenca(f, listas)
      const diff = Object.fromEntries(Object.entries(novo).filter(([k, v]) => f[k] !== v))
      if (!Object.keys(diff).length) continue
      exigir(await db.from('acolitos_membros').update(diff).eq('id', f.id), 'gravar presença')
      mudou++
    }
    // Família dentro de grupo de servos: avisa a coordenação (uma pendência por número e grupo, enquanto estiver aberta).
    let excecoes = new Set()
    try { const r = await db.from('tarcisio_grupo_excecoes').select('numero_fim,papel'); if (!r.error && Array.isArray(r.data)) excecoes = new Set(r.data.map((e) => `${e.papel}:${e.numero_fim}`)) } catch (_) { /* tabela ainda não existe: sem exceções */ }
    let intrusos = 0
    for (const [chave, papel] of [['servo', 'acolitos'], ['cerimoniarios', 'cerimoniarios']]) {
      if (!listas[chave]) continue
      for (const x of intrusosDeFamilia({ participantes: listas[chave], fichas, papel, excecoes })) {
        const abertas = exigir(await db.from('tarcisio_pendencias').select('id').eq('tipo', 'coordenacao').eq('estado', 'aberta').contains('dados', { intruso_grupo: papel, numero_fim: x.fim }), 'ler pendências de intruso')
        if (abertas.length) continue
        const de = x.membros.slice(0, 3).map((m) => `${m.nome} (${m.campo})`).join(', ')
        exigir(await db.from('tarcisio_pendencias').insert({ tipo: 'coordenacao', numero: x.fim, resumo: `Número de família no grupo ${NOME_GRUPO[chave]}: ${de}, final ${x.fim.slice(-4)}. Esse grupo é só dos servos — remova do grupo ou registre a exceção.`, dados: { intruso_grupo: papel, numero_fim: x.fim, membros: x.membros } }), 'avisar coordenação do intruso')
        intrusos++
      }
    }
    if (intrusos) log.warn(`presença nos grupos: ${intrusos} número(s) de família em grupo de servos; coordenação avisada`)
    const iso = new Date(+agora).toISOString()
    for (const [chave, , coluna] of PAPEIS) {
      if (listas[chave]) exigir(await db.from('acolitos_membros').update({ [coluna]: iso }).not('id', 'is', null), 'gravar conferência')
    }
    const fresco = exigir(await db.from('acolitos_membros').select('id,nome,status,nivel,created_at,telefone,celular_responsavel,celular_mae,celular_recado,no_grupo_whatsapp,no_grupo_pais,no_grupo_cerimoniarios').gte('created_at', CORTE).limit(500), 'ler fichas novas')
    let avisos = 0
    for (const f of fresco) {
      for (const g of faltaGrupo(f, agora)) {
        if (!listas[g]) continue
        const numero = [f.telefone, f.celular_mae, f.celular_responsavel, f.celular_recado].find((n) => fim(n))
        if (!numero) continue
        const abertas = exigir(await db.from('tarcisio_pendencias').select('id').eq('tipo', 'coordenacao').eq('estado', 'aberta').contains('dados', { grupo_esperado: g, membro_id: f.id }), 'ler pendências')
        if (abertas.length) continue
        exigir(await db.from('tarcisio_pendencias').insert({ tipo: 'coordenacao', numero: String(numero).replace(/\D/g, ''), resumo: `Ficha nova fora do grupo certo: ${f.nome} deveria estar em ${NOME_GRUPO[g]} e não está (passaram 48 h).`, dados: { grupo_esperado: g, membro_id: f.id } }), 'avisar coordenação')
        avisos++
      }
    }
    if (avisos) log.info(`presença nos grupos: ${avisos} aviso(s) à coordenação`)
    if (mudou) log.info(`presença nos grupos: ${mudou} ficha(s) atualizada(s)`)
    return { lidos: Object.keys(listas).length, mudou }
  }

  return { cuidar }
}
