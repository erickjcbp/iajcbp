import { describe, it, expect } from 'vitest'
import { distribuirColunas } from './colunas.mjs'

const missa = (hora, n) => ({ horaHH: hora, itens: Array.from({ length: n }, (_, i) => ({ nome: 'p' + i })) })
const horas = c => ({ esq: c.esq.map(m => m.horaHH), dir: c.dir.map(m => m.horaHH) })

describe('distribuirColunas', () => {
  it('a missa seguinte entra embaixo da coluna mais curta, não num par novo', () => {
    // sábado de 3/10/2026: 17h (18 nomes), 18h30 (8), 19h (11) — o 19h cabe sob o 18h30
    const c = distribuirColunas([missa('17', 18), missa('18', 8), missa('19', 11)])
    expect(horas(c)).toEqual({ esq: ['17'], dir: ['18', '19'] })
  })
  it('duas missas ficam uma de cada lado, a primeira à esquerda', () => {
    expect(horas(distribuirColunas([missa('07', 17), missa('09', 17)]))).toEqual({ esq: ['07'], dir: ['09'] })
  })
  it('uma missa só fica à esquerda', () => {
    expect(horas(distribuirColunas([missa('19', 5)]))).toEqual({ esq: ['19'], dir: [] })
  })
  it('missa sem ninguém escalado ainda ocupa lugar (mostra "escala não montada")', () => {
    const c = distribuirColunas([missa('07', 0), missa('09', 0), missa('19', 0)])
    expect(horas(c)).toEqual({ esq: ['07', '19'], dir: ['09'] })
  })
})
