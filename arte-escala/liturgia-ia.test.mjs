import { test, expect } from 'vitest'
import { lerResposta, conferirLiturgia } from './liturgia-ia.mjs'
import { garantirLiturgia } from '../api/_liturgia-conferida.js'

const resp = (obj) => async () => ({ ok: true, status: 200, json: async () => ({ content: [{ text: typeof obj === 'string' ? obj : JSON.stringify(obj) }] }) })
const CALC = { descricao: '31º Domingo do Tempo Comum, Ano A', tempo: 'TEMPO COMUM', cor: 'verde' }
const D = '2026-11-01'

test('lê só resposta válida: cor conhecida, campos preenchidos, concorda booleano', () => {
  const ok = lerResposta('texto {"concorda":false,"tempo":"SOLENIDADE","descricao":"Solenidade de Todos os Santos, Ano A","cor":"branco","motivo":"x"} fim')
  expect(ok.cor).toBe('branco')
  expect(lerResposta('{"concorda":"sim","tempo":"X","descricao":"Y","cor":"branco"}')).toBe(null)
  expect(lerResposta('{"concorda":true,"tempo":"X","descricao":"Y","cor":"dourado"}')).toBe(null)
  expect(lerResposta('sem json')).toBe(null)
})

test('conferência: sem chave, erro de rede e HTTP ruim não derrubam', async () => {
  expect((await conferirLiturgia({ domingo: D, calculado: CALC, chave: '' })).ok).toBe(false)
  expect((await conferirLiturgia({ domingo: D, calculado: CALC, chave: 'k', fetchFn: async () => { throw new Error('rede') } })).ok).toBe(false)
  expect((await conferirLiturgia({ domingo: D, calculado: CALC, chave: 'k', fetchFn: async () => ({ ok: false, status: 500 }) })).ok).toBe(false)
})

function supabaseFalso({ override = [] } = {}) {
  const chamadas = []
  const fetchFn = async (url, op = {}) => {
    if (String(url).includes('anthropic')) return fetchFn.ia(url, op)
    chamadas.push({ url: String(url), metodo: op.method || 'GET', corpo: op.body && JSON.parse(op.body) })
    return { ok: true, json: async () => override }
  }
  fetchFn.chamadas = chamadas
  return fetchFn
}
const base = { URL: 'https://x.supabase.co', SRK: 's', chave: 'k', agora: new Date('2026-10-28T12:00:00Z'), log: { warn() {} } }

test('IA discorda do cálculo: grava o override do domingo', async () => {
  const f = supabaseFalso()
  f.ia = resp({ concorda: false, tempo: 'SOLENIDADE', descricao: 'Solenidade de Todos os Santos, Ano A', cor: 'branco', motivo: 'Todos os Santos' })
  const r = await garantirLiturgia({ ...base, fetchFn: f })
  expect(r.fonte).toBe('ia-corrigiu')
  expect(r.domingo).toBe(D)
  const post = f.chamadas.find((c) => c.metodo === 'POST')
  expect(post.corpo).toEqual({ domingo_data: D, tempo: 'SOLENIDADE', descricao: 'Solenidade de Todos os Santos, Ano A', cor: 'branco' })
})

test('IA concorda: nada é gravado', async () => {
  const f = supabaseFalso()
  f.ia = resp({ concorda: true, tempo: 'SOLENIDADE', descricao: 'x', cor: 'branco' })
  expect((await garantirLiturgia({ ...base, fetchFn: f })).fonte).toBe('calculo-conferido')
  expect(f.chamadas.some((c) => c.metodo === 'POST')).toBe(false)
})

test('override manual da coordenação nunca é sobrescrito e a IA nem é chamada', async () => {
  const f = supabaseFalso({ override: [{ domingo_data: D }] })
  f.ia = async () => { throw new Error('não devia chamar') }
  expect((await garantirLiturgia({ ...base, fetchFn: f })).fonte).toBe('override-manual')
})

test('sem chave da IA: segue o cálculo local, sem gravar', async () => {
  const f = supabaseFalso()
  f.ia = async () => { throw new Error('x') }
  const r = await garantirLiturgia({ ...base, chave: '', fetchFn: f })
  expect(r.fonte).toBe('calculo')
  expect(f.chamadas.some((c) => c.metodo === 'POST')).toBe(false)
})
