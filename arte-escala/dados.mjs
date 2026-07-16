import { rotuloFuncao, rotuloComunidade, rankHorario } from './rotulos.js'
import { resolverLiturgico } from './liturgico.mjs'

const MES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const MES_ABR = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'] // header (mesAno)
const DIA_SEMANA = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado']

function parseISO(s) { const [y,m,d] = s.split('-').map(Number); return new Date(Date.UTC(y,m-1,d)) }
function horaPartes(h) {
  const s = String(h || '').replace('h', ':').replace(/:$/, ':00')
  const [hh, mm] = s.split(':')
  return { HH: String(hh).padStart(2,'0'), MM: String(mm || '00').padStart(2,'0') }
}
function dataLabel(iso) {
  const d = parseISO(iso)
  return `${DIA_SEMANA[d.getUTCDay()]}, ${d.getUTCDate()} de ${MES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`
}

export function montarMissas(celebracoes, escalasMap, funcExtra) {
  return [...celebracoes]
    .sort((a,b) => rankHorario(a.horario) - rankHorario(b.horario))
    .map(c => {
      const { HH, MM } = horaPartes(c.horario)
      const d = parseISO(c.data)
      const itens = (escalasMap[c.id] || [])
        .filter(e => e.status === 'escalado' && e.acolitos_membros)
        .map(e => ({ nome: e.acolitos_membros.nome, funcao: rotuloFuncao(e.funcao, funcExtra) }))
        .sort((a,b) => a.nome.localeCompare(b.nome, 'pt'))
      return {
        comunidade: c.comunidade,
        comunidadeLabel: rotuloComunidade(c.comunidade),
        horaHH: HH, horaMM: MM,
        dia: d.getUTCDay() === 6 ? 'SÁBADO' : 'DOMINGO',
        dataLabel: dataLabel(c.data),
        itens,
      }
    })
}

export async function carregarDados(sb, { sabado, domingo }, override) {
  const { data: celebracoes, error: ce } = await sb
    .from('acolitos_celebracoes').select('*').in('data', [sabado, domingo])
  if (ce) throw ce
  const ids = celebracoes.map(c => c.id)
  const { data: esc, error: ee } = await sb
    .from('acolitos_escalas')
    .select('*, acolitos_membros!membro_id(id,nome)')
    .in('celebracao_id', ids)
  if (ee) throw ee
  const { data: fcustom } = await sb
    .from('acolitos_listas').select('valor,label').eq('tipo','funcao')
  const funcExtra = Object.fromEntries((fcustom || []).map(f => [f.valor, f.label]))

  const escalasMap = {}
  for (const e of esc) (escalasMap[e.celebracao_id] = escalasMap[e.celebracao_id] || []).push(e)

  const missas = montarMissas(celebracoes, escalasMap, funcExtra)
  const lit = resolverLiturgico(domingo, override)
  const dSab = parseISO(sabado)

  return {
    tempo: lit.tempo, descricao: lit.descricao, cor: lit.cor,
    mesAno: `${MES_ABR[dSab.getUTCMonth()]} ${dSab.getUTCFullYear()}`,
    sabadoLabel: dataLabel(sabado), domingoLabel: dataLabel(domingo),
    missasSabado: missas.filter(m => m.dia === 'SÁBADO'),
    missasDomingo: missas.filter(m => m.dia === 'DOMINGO'),
  }
}
