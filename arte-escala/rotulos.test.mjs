import { describe, it, expect } from 'vitest'
import { rotuloFuncao, rotuloComunidade, rankHorario, HOR_ORDEM } from './rotulos.js'

describe('rótulos', () => {
  it('funções conhecidas', () => {
    expect(rotuloFuncao('cred_altar')).toBe('Cerim. Altar')
    expect(rotuloFuncao('cred_credencia')).toBe('Cerim. Cred.')
    expect(rotuloFuncao('sinao')).toBe('Sinão')
  })
  it('função desconhecida cai no código', () => {
    expect(rotuloFuncao('xyz')).toBe('xyz')
  })
  it('função custom via extra', () => {
    expect(rotuloFuncao('novaf', { novaf: 'Nova' })).toBe('Nova')
  })
  it('comunidade → rótulo da arte', () => {
    expect(rotuloComunidade('matriz')).toBe('JCBP')
    expect(rotuloComunidade('santo_antonio')).toBe('STO. ANTONIO')
  })
  it('ordem dos horários', () => {
    expect(HOR_ORDEM).toEqual(['17h','18h30','7h','9h','19h'])
    expect(rankHorario('07h')).toBe(2) // normaliza 0 à esquerda
    expect(rankHorario('19h')).toBe(4)
  })
})
