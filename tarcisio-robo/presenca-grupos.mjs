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
  const todos = [...proprio, ...familia]
  const r = {}
  if (listas.servo) r.no_grupo_whatsapp = noGrupo(todos, listas.servo)
  if (listas.pais) r.no_grupo_pais = noGrupo(familia, listas.pais)
  if (listas.cerimoniarios) r.no_grupo_cerimoniarios = NIVEIS_CERIMONIARIO.includes(ficha.nivel) && noGrupo(todos, listas.cerimoniarios)
  return r
}

// Grupo(s) em que a ficha deve estar: cerimoniário no dos Cerimoniários; os demais no dos servos; responsável no de Pais.
// Cerimoniário estar também no dos servos não é erro (regra ainda não decidida pelo dono).
export function gruposEsperados(ficha) {
  const esperados = NIVEIS_CERIMONIARIO.includes(ficha.nivel) ? ['cerimoniarios'] : ['servo']
  if (fim(ficha.celular_mae) || fim(ficha.celular_responsavel)) esperados.push('pais')
  return esperados
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
    const fichas = exigir(await db.from('acolitos_membros').select('id,nivel,telefone,celular_responsavel,celular_mae,celular_recado,no_grupo_whatsapp,no_grupo_pais,no_grupo_cerimoniarios').limit(5000), 'ler fichas')
    let mudou = 0
    for (const f of fichas) {
      const novo = calcularPresenca(f, listas)
      const diff = Object.fromEntries(Object.entries(novo).filter(([k, v]) => f[k] !== v))
      if (!Object.keys(diff).length) continue
      exigir(await db.from('acolitos_membros').update(diff).eq('id', f.id), 'gravar presença')
      mudou++
    }
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
