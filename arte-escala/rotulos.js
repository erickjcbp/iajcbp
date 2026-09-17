// arte-escala/rotulos.js  (espelha projetos/acolitos/escala.html:360-364)
import horarioDaMissa from '../projetos/acolitos/horario-core.js'
const { compararHorario } = horarioDaMissa

export const FUNCAO_LABEL = {
  apoio:'Apoio', cruz:'Cruz', vela:'Vela', sineta:'Sineta', sinao:'Sinão',
  altar:'Altar', turibulo:'Turíbulo', naveta:'Naveta', missal:'Missal',
  cred_altar:'Cerim. Altar', cred_credencia:'Cerim. Cred.', mitra:'Mitra', baculo:'Báculo'
}
export const COMUNIDADE_ARTE = { matriz:'JCBP', santo_antonio:'STO. ANTONIO' }

export function rotuloFuncao(cod, extra) {
  if (extra && extra[cod]) return extra[cod]
  return FUNCAO_LABEL[cod] || cod
}
export function rotuloComunidade(cod) {
  return COMUNIDADE_ARTE[cod] || String(cod || '').toUpperCase()
}
// A imagem junta SÁBADO e DOMINGO, então a ordem é: primeiro o dia, depois a hora.
//
// Antes havia aqui uma lista escrita à mão — ['17h','18h30','7h','9h','19h'] — que jogava para o
// FIM qualquer horário fora dela, e existem 16h e 19h30 cadastrados. A hora vem da mesma regra
// que o app usa (projetos/acolitos/horario-core.js): uma verdade só, para a imagem que vai para o
// grupo não sair numa ordem e a tela em outra.
export function compararCelebracao(a, b) {
  return String(a.data).localeCompare(String(b.data)) ||
    compararHorario(a.horario, b.horario)
}
