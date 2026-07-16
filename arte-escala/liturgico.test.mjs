import { describe, it, expect } from 'vitest'
import { pascoa, liturgicoDoDomingo, resolverLiturgico } from './liturgico.mjs'

describe('pascoa (Computus)', () => {
  it('Páscoa 2026 = 05/04', () => {
    expect(pascoa(2026).toISOString().slice(0,10)).toBe('2026-04-05')
  })
  it('Páscoa 2025 = 20/04', () => {
    expect(pascoa(2025).toISOString().slice(0,10)).toBe('2025-04-20')
  })
})

describe('liturgicoDoDomingo', () => {
  it('12/07/2026 → 15º Domingo do Tempo Comum, Ano A, verde (âncora do modelo)', () => {
    expect(liturgicoDoDomingo('2026-07-12')).toEqual({
      tempo: 'TEMPO COMUM',
      descricao: '15º Domingo do Tempo Comum, Ano A',
      cor: 'verde', auto: true
    })
  })
  it('Pentecostes 24/05/2026 → vermelho', () => {
    expect(liturgicoDoDomingo('2026-05-24').cor).toBe('vermelho')
  })
  it('1º Domingo do Advento 29/11/2026 → ADVENTO, roxo', () => {
    const r = liturgicoDoDomingo('2026-11-29')
    expect(r.tempo).toBe('ADVENTO')
    expect(r.descricao).toBe('1º Domingo do Advento, Ano B')
    expect(r.cor).toBe('roxo')
  })
  it('3º Domingo do Advento (Gaudete) 13/12/2026 → rosa', () => {
    expect(liturgicoDoDomingo('2026-12-13').cor).toBe('rosa')
  })
  it('4º Domingo da Quaresma (Laetare) 15/03/2026 → QUARESMA, rosa', () => {
    const r = liturgicoDoDomingo('2026-03-15')
    expect(r.tempo).toBe('QUARESMA')
    expect(r.cor).toBe('rosa')
  })
  it('Domingo de Ramos 29/03/2026 → vermelho', () => {
    expect(liturgicoDoDomingo('2026-03-29').cor).toBe('vermelho')
  })
  it('2º Domingo da Páscoa 12/04/2026 → TEMPO PASCAL, branco', () => {
    const r = liturgicoDoDomingo('2026-04-12')
    expect(r.tempo).toBe('TEMPO PASCAL')
    expect(r.cor).toBe('branco')
  })
})

describe('resolverLiturgico (override vence)', () => {
  it('override completo é usado', () => {
    const r = resolverLiturgico('2026-07-12', { tempo:'FESTA', descricao:'São Bento, Ano A', cor:'branco' })
    expect(r).toEqual({ tempo:'FESTA', descricao:'São Bento, Ano A', cor:'branco', auto:false })
  })
  it('sem override cai no cálculo', () => {
    expect(resolverLiturgico('2026-07-12', null).auto).toBe(true)
  })
})
