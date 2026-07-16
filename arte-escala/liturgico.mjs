const DIA = 24 * 60 * 60 * 1000
const U = (y, m, d) => new Date(Date.UTC(y, m - 1, d))
const iso = d => d.toISOString().slice(0, 10)
const parse = s => { const [y,m,d] = s.split('-').map(Number); return U(y, m, d) }
const semanas = (a, b) => Math.round((b - a) / (7 * DIA))

// Páscoa gregoriana (Meeus/Jones/Butcher)
export function pascoa(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100
  const d = Math.floor(b / 4), e = b % 4
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const mth = Math.floor((h + l - 7 * ((a + 11 * h + 22 * l) / 451 | 0) + 114) / 31)
  const day = ((h + l - 7 * ((a + 11 * h + 22 * l) / 451 | 0) + 114) % 31) + 1
  return U(year, mth, day)
}

// 1º Domingo do Advento do ANO CIVIL y: 4 domingos antes do Natal (25/12).
function primeiroAdvento(y) {
  const natal = U(y, 12, 25)
  const dow = natal.getUTCDay() // 0=Dom
  const back = dow === 0 ? 7 : dow
  const domingoAntesOuNoNatal = new Date(natal.getTime() - back * DIA)
  return new Date(domingoAntesOuNoNatal.getTime() - 3 * 7 * DIA) // 4º domingo antes
}

// Ciclo dominical A/B/C a partir do ano de início do Advento.
function anoCiclo(adventYear) {
  return ['C', 'A', 'B'][(adventYear + 1) % 3]
}

const ORD = n => n + 'º'

export function liturgicoDoDomingo(domingoISO) {
  const dom = parse(domingoISO)
  const y = dom.getUTCFullYear()
  const P = pascoa(y)
  const cinzas = new Date(P.getTime() - 46 * DIA)          // Quarta de Cinzas
  const ramos = new Date(P.getTime() - 7 * DIA)            // Domingo de Ramos
  const pentecostes = new Date(P.getTime() + 49 * DIA)     // Pentecostes
  const adventoEsteAno = primeiroAdvento(y)

  // Ano do ciclo: se já passou do Advento deste ano, o Advento é o de referência; senão o do ano anterior.
  const adventYear = dom >= adventoEsteAno ? y : y - 1
  const ciclo = anoCiclo(adventYear)
  const anoLbl = `Ano ${ciclo}`

  // ADVENTO
  if (dom >= adventoEsteAno && dom < U(y, 12, 25)) {
    const n = semanas(adventoEsteAno, dom) + 1
    return { tempo:'ADVENTO', descricao:`${ORD(n)} Domingo do Advento, ${anoLbl}`,
             cor: n === 3 ? 'rosa' : 'roxo', auto:true }
  }
  // QUARESMA (após Cinzas, até Ramos exclusive)
  if (dom >= cinzas && dom < ramos) {
    const primeiroQuar = (() => { // 1º Domingo da Quaresma = domingo após as Cinzas
      const dw = cinzas.getUTCDay(); return new Date(cinzas.getTime() + ((7 - dw) % 7) * DIA)
    })()
    const n = semanas(primeiroQuar, dom) + 1
    return { tempo:'QUARESMA', descricao:`${ORD(n)} Domingo da Quaresma, ${anoLbl}`,
             cor: n === 4 ? 'rosa' : 'roxo', auto:true }
  }
  // RAMOS
  if (iso(dom) === iso(ramos)) {
    return { tempo:'QUARESMA', descricao:`Domingo de Ramos, ${anoLbl}`, cor:'vermelho', auto:true }
  }
  // PENTECOSTES
  if (iso(dom) === iso(pentecostes)) {
    return { tempo:'TEMPO PASCAL', descricao:`Domingo de Pentecostes, ${anoLbl}`, cor:'vermelho', auto:true }
  }
  // TEMPO PASCAL (Páscoa .. Pentecostes exclusive)
  if (dom >= P && dom < pentecostes) {
    const n = semanas(P, dom) + 1 // Páscoa = 1º Domingo da Páscoa
    const desc = n === 1 ? `Domingo de Páscoa, ${anoLbl}` : `${ORD(n)} Domingo da Páscoa, ${anoLbl}`
    return { tempo:'TEMPO PASCAL', descricao:desc, cor:'branco', auto:true }
  }
  // TEMPO COMUM
  // Parte 2 (após Pentecostes): numerar contando de trás pra frente até Cristo Rei (34º).
  if (dom > pentecostes && dom < adventoEsteAno) {
    const cristoRei = new Date(adventoEsteAno.getTime() - 7 * DIA)
    const n = 34 - semanas(dom, cristoRei)
    const desc = iso(dom) === iso(cristoRei)
      ? `Solenidade de Nosso Senhor Jesus Cristo, Rei do Universo, ${anoLbl}`
      : `${ORD(n)} Domingo do Tempo Comum, ${anoLbl}`
    return { tempo:'TEMPO COMUM', descricao:desc, cor:'verde', auto:true }
  }
  // Parte 1 (após Batismo do Senhor, antes das Cinzas): domingo após o Batismo = 2º Domingo do TC.
  // Batismo do Senhor = domingo após 06/01 (ou o próprio 06/01 se for domingo).
  const epifania = U(y, 1, 6)
  const batismo = new Date(epifania.getTime() + ((7 - epifania.getUTCDay()) % 7 || 7) * DIA)
  if (dom > batismo && dom < cinzas) {
    const n = semanas(batismo, dom) + 1
    return { tempo:'TEMPO COMUM', descricao:`${ORD(n)} Domingo do Tempo Comum, ${anoLbl}`, cor:'verde', auto:true }
  }

  // Fallback (Tempo do Natal e casos não cobertos) → verde/Tempo Comum; espera-se override.
  return { tempo:'TEMPO COMUM', descricao:`Domingo, ${anoLbl}`, cor:'verde', auto:true }
}

export function resolverLiturgico(domingoISO, override) {
  if (override && override.tempo && override.descricao && override.cor) {
    return { tempo:override.tempo, descricao:override.descricao, cor:override.cor, auto:false }
  }
  return liturgicoDoDomingo(domingoISO)
}
