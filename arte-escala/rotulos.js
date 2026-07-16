// arte-escala/rotulos.js  (espelha projetos/acolitos/escala.html:360-364)
export const FUNCAO_LABEL = {
  apoio:'Apoio', cruz:'Cruz', vela:'Vela', sineta:'Sineta', sinao:'Sinão',
  altar:'Altar', turibulo:'Turíbulo', naveta:'Naveta', missal:'Missal',
  cred_altar:'Cerim. Altar', cred_credencia:'Cerim. Cred.', mitra:'Mitra', baculo:'Báculo'
}
export const COMUNIDADE_ARTE = { matriz:'JCBP', santo_antonio:'STO. ANTONIO' }
export const HOR_ORDEM = ['17h','18h30','7h','9h','19h']

export function rotuloFuncao(cod, extra) {
  if (extra && extra[cod]) return extra[cod]
  return FUNCAO_LABEL[cod] || cod
}
export function rotuloComunidade(cod) {
  return COMUNIDADE_ARTE[cod] || String(cod || '').toUpperCase()
}
export function rankHorario(h) {
  const i = HOR_ORDEM.indexOf(String(h || '').replace(/^0/, ''))
  return i < 0 ? 99 : i
}
