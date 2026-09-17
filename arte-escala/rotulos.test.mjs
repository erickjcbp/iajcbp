import { describe, it, expect } from 'vitest'
import { rotuloFuncao, rotuloComunidade, compararCelebracao } from './rotulos.js'

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
  it('ordem do fim de semana: o dia primeiro, a hora depois', () => {
    // A imagem junta sábado e domingo. Ordenar só pela hora poria a missa de domingo às 7h
    // ANTES da de sábado às 17h — por isso a data entra na conta.
    const sab = '2026-09-19', dom = '2026-09-20'
    const fim = [
      { data: dom, horario: '19h' }, { data: sab, horario: '18h30' },
      { data: dom, horario: '7h' }, { data: sab, horario: '16h' }, { data: dom, horario: '9h' },
    ].sort(compararCelebracao).map(c => c.horario)
    expect(fim).toEqual(['16h', '18h30', '7h', '9h', '19h'])
  })
  it('horário fora da lista antiga (16h, 19h30) não vai mais para o fim', () => {
    // A lista escrita à mão que havia aqui dava 99 para o que não conhecia, então 16h caía
    // DEPOIS de 18h30 na imagem que vai para o grupo.
    const sab = '2026-09-19'
    const ordem = [
      { data: sab, horario: '19h30' }, { data: sab, horario: '16h' }, { data: sab, horario: '18h30' },
    ].sort(compararCelebracao).map(c => c.horario)
    expect(ordem).toEqual(['16h', '18h30', '19h30'])
  })
  it('horário que não dá para ler vai para o fim, sem estourar', () => {
    const sab = '2026-09-19'
    const ordem = [
      { data: sab, horario: 'a combinar' }, { data: sab, horario: '17h' }, { data: sab, horario: null },
    ].sort(compararCelebracao).map(c => c.horario)
    expect(ordem[0]).toBe('17h')
    expect(ordem.length).toBe(3)
  })
})
