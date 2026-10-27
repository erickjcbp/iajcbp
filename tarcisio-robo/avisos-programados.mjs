import { agoraSP, somarDias } from './regras.mjs'
const exigir = (r) => { if (r.error) throw new Error(r.error.message); return r.data }
export function horarioPreparacao(aviso, celebracoes) {
  const data = agoraSP(new Date(aviso.quando)).data
  if (aviso.configuracao.horario) return { quando: `${data}T${aviso.configuracao.horario}:00-03:00`, limite: `${data}T21:00:00-03:00` }
  const minutos = celebracoes.map(c => c.minutos).filter(n => Number.isInteger(n) && n >= 0 && n < 1440)
  if (!minutos.length) return null
  const primeira = Math.min(...minutos), alvo = Math.max(0, primeira - (aviso.configuracao.antecedencia_min || 60))
  const hm = n => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`
  return { quando: `${data}T${hm(alvo)}:00-03:00`, limite: `${data}T${hm(primeira)}:00-03:00` }
}
export async function cuidarPreparacao({ db, evo, aviso, agora }) {
  const data = agoraSP(new Date(aviso.quando)).data
  const cels = aviso.configuracao.horario ? [] : exigir(await db.from('acolitos_celebracoes').select('minutos').eq('data', data))
  const alvo = horarioPreparacao(aviso, cels)
  if (!alvo && agoraSP(agora).data < data) return
  const avancar = async () => {
    const prox = somarDias(data, 7)
    const horario = aviso.configuracao.horario || '00:00'
    exigir(await db.from('tarcisio_avisos').update({ quando: `${prox}T${horario}:00-03:00` }).eq('id', aviso.id).eq('ativo', true))
  }
  if (!alvo) { await avancar(); return }
  if (+new Date(alvo.quando) !== +new Date(aviso.quando))
    exigir(await db.from('tarcisio_avisos').update({ quando: alvo.quando }).eq('id', aviso.id).eq('ativo', true))
  if (+agora < +new Date(alvo.quando)) return
  if (+agora >= +new Date(alvo.limite)) { await avancar(); return }
  const grupos = (await evo.grupos()).filter(g => /jcbp/i.test(g.nome))
  // Sem grupo: conserva a ocorrência para tentar de novo antes da primeira missa.
  if (!grupos.length) return
  const linhas = grupos.map(g => ({ tipo: 'aviso', aviso_id: aviso.id, destino_jid: g.jid, destino_nome: g.nome,
    texto: aviso.texto, imagem_url: aviso.imagem_url, agendado_para: alvo.quando,
    chave_unica: `preparacao-missa:${aviso.id}:${data}:${g.jid}` }))
  exigir(await db.from('tarcisio_envios').upsert(linhas, { onConflict: 'chave_unica', ignoreDuplicates: true }))
  await avancar()
}
