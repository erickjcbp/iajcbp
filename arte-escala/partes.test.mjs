import { describe, it, expect } from 'vitest'
import { partesDaArte } from './partes.mjs'
const dados = (sab, dom) => ({ missasSabado: Array(sab).fill({}), missasDomingo: Array(dom).fill({}) })
describe('formato das artes', () => {
  it('cinco missas continuam numa imagem', () => expect(partesDaArte(dados(2,3))).toEqual(['unica']))
  it('seis missas separam por dia no automático', () => expect(partesDaArte(dados(2,4))).toEqual(['sabado','domingo']))
  it('permite uma imagem mesmo acima de cinco', () => expect(partesDaArte(dados(2,4),'unica')).toEqual(['unica']))
  it('permite separar cinco missas por dia', () => expect(partesDaArte(dados(2,3),'por_dia')).toEqual(['sabado','domingo']))
  it('não inventa arte para dia sem missa', () => expect(partesDaArte(dados(0,6),'por_dia')).toEqual(['unica']))
  it('não gera fim de semana vazio', () => expect(partesDaArte(dados(0,0))).toEqual([]))
  it('recusa formato desconhecido', () => expect(()=>partesDaArte(dados(2,3),'outro')).toThrow())
})
