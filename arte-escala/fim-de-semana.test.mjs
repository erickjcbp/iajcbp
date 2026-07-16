// arte-escala/fim-de-semana.test.mjs
import { describe, it, expect } from 'vitest'
import { alvoFimDeSemana } from './fim-de-semana.mjs'

describe('alvoFimDeSemana', () => {
  it('domingo 21h → sábado/domingo da semana seguinte (+6/+7)', () => {
    // 2026-07-12 é domingo; 21h BRT = 2026-07-13T00:00Z
    const r = alvoFimDeSemana(new Date('2026-07-13T00:00:00Z'))
    expect(r).toEqual({ sabado: '2026-07-18', domingo: '2026-07-19' })
  })
  it('numa quarta → o sábado/domingo dessa mesma semana à frente', () => {
    // 2026-07-15 quarta 12:00 BRT = 15:00Z
    const r = alvoFimDeSemana(new Date('2026-07-15T15:00:00Z'))
    expect(r).toEqual({ sabado: '2026-07-18', domingo: '2026-07-19' })
  })
})
