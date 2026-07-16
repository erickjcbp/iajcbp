import { describe, it, expect } from 'vitest'
import { montarMissas } from './dados.mjs'

const celebracoes = [
  { id:'c1', data:'2026-07-18', horario:'17h', comunidade:'matriz', tipo:'missa_comum' },
  { id:'c2', data:'2026-07-18', horario:'18h30', comunidade:'santo_antonio', tipo:'missa_comum' },
]
const escalasMap = {
  c1: [
    { funcao:'cruz', status:'escalado', acolitos_membros:{ nome:'Vitor Santana' } },
    { funcao:'apoio', status:'escalado', acolitos_membros:{ nome:'Ana Lima' } },
    { funcao:'altar', status:'ausente_justificado', acolitos_membros:{ nome:'Zzz Fulano' } },
  ],
  c2: [ { funcao:'altar', status:'escalado', acolitos_membros:{ nome:'Bruno X' } } ],
}

describe('montarMissas', () => {
  it('ordena missas por horário, filtra só escalados, ordena nomes A→Z', () => {
    const ms = montarMissas(celebracoes, escalasMap, {})
    expect(ms.map(m => m.horaHH + ':' + m.horaMM)).toEqual(['17:00','18:30'])
    expect(ms[0].comunidadeLabel).toBe('JCBP')
    expect(ms[0].dia).toBe('SÁBADO')
    expect(ms[0].itens.map(i => i.nome)).toEqual(['Ana Lima','Vitor Santana']) // ausente removido
    expect(ms[0].itens[0]).toEqual({ nome:'Ana Lima', funcao:'Apoio' })
    expect(ms[1].comunidadeLabel).toBe('STO. ANTONIO')
  })
})
