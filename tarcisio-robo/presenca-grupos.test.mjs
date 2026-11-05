import test from 'node:test'
import assert from 'node:assert/strict'
import { calcularPresenca, criarPresencaGrupos } from './presenca-grupos.mjs'

const S = new Set(['99990000']), P = new Set(['88881111']), C = new Set(['77772222'])
const listas = { servo: S, pais: P, cerimoniarios: C }

test('servo: qualquer número da ficha no grupo dos servos', () => {
  assert.equal(calcularPresenca({ telefone: '(19) 9999-0000' }, listas).no_grupo_whatsapp, true)
  assert.equal(calcularPresenca({ celular_mae: '19 9 9999-0000' }, listas).no_grupo_whatsapp, true)
  assert.equal(calcularPresenca({ telefone: '19 90000-1111' }, listas).no_grupo_whatsapp, false)
})
test('pais: só número da família conta', () => {
  assert.equal(calcularPresenca({ celular_mae: '19 98888-1111' }, listas).no_grupo_pais, true)
  assert.equal(calcularPresenca({ telefone: '19 98888-1111' }, listas).no_grupo_pais, false)
})
test('cerimoniários: só vale a partir de cerimoniario_aspirante; aspirante puro fica fora', () => {
  const f = { telefone: '19 97777-2222' }
  assert.equal(calcularPresenca({ ...f, nivel: 'cerimoniario_aspirante' }, listas).no_grupo_cerimoniarios, true)
  assert.equal(calcularPresenca({ ...f, nivel: 'aspirante' }, listas).no_grupo_cerimoniarios, false)
  assert.equal(calcularPresenca({ ...f, nivel: 'acolito_guardiao' }, listas).no_grupo_cerimoniarios, false)
})
test('grupo sem lista não é calculado (não vira "ninguém está")', () => {
  assert.deepEqual(calcularPresenca({ telefone: '19 99999-0000' }, { servo: S }), { no_grupo_whatsapp: true })
})

function banco(fichas, gruposTabela) {
  const gravados = []
  const consulta = (tabela) => ({
    select: () => ({ in: async () => ({ data: gruposTabela }), limit: async () => ({ data: fichas }), gte: () => ({ limit: async () => ({ data: [] }) }) }),
    update: (v) => ({ eq: async (c, id) => { gravados.push({ id, v }); return { error: null } }, not: async () => { gravados.push({ todos: v }); return { error: null } } }),
  })
  return { from: consulta, gravados }
}
const aviso = { warn() {}, info() {} }

test('lista curta demais não grava nada', async () => {
  const db = banco([{ id: 'a', telefone: '19 99999-0000', no_grupo_whatsapp: true }], [{ jid: 'g1', papel: 'acolitos' }])
  const evo = { participantes: async () => ['5519999990000'] }
  const r = await criarPresencaGrupos({ db, evo, log: aviso }).cuidar(new Date(), { forcar: true })
  assert.equal(r.lidos, 0)
  assert.equal(db.gravados.length, 0)
})
test('grava só o que mudou e registra a conferência', async () => {
  const db = banco([
    { id: 'a', telefone: '19 99999-0000', no_grupo_whatsapp: false },
    { id: 'b', telefone: '19 90000-1111', no_grupo_whatsapp: false },
  ], [{ jid: 'g1', papel: 'acolitos' }])
  const evo = { participantes: async () => ['5519999990000', '5519911112222', '5519922223333'] }
  const r = await criarPresencaGrupos({ db, evo, log: aviso }).cuidar(new Date(), { forcar: true })
  assert.equal(r.mudou, 1)
  assert.deepEqual(db.gravados[0], { id: 'a', v: { no_grupo_whatsapp: true } })
  assert.ok(db.gravados[1].todos.grupo_servo_conferido_em)
})

import { gruposEsperados, faltaGrupo, CORTE } from './presenca-grupos.mjs'
const agoraT = new Date('2026-11-10T12:00:00Z')
test('grupo esperado: cerimoniário só no dele; demais no dos servos; responsável também no de Pais', () => {
  assert.deepEqual(gruposEsperados({ nivel: 'cerimoniario_guardiao' }), ['cerimoniarios'])
  assert.deepEqual(gruposEsperados({ nivel: 'coroinha', celular_mae: '19 98888-1111' }), ['servo', 'pais'])
  assert.deepEqual(gruposEsperados({ nivel: 'aspirante' }), ['servo'])
})
test('só cobra ficha nova, ativa e depois da carência de 48 h', () => {
  const base = { status: 'ativo', nivel: 'coroinha', created_at: '2026-11-05T12:00:00Z', no_grupo_whatsapp: false }
  assert.deepEqual(faltaGrupo(base, agoraT), ['servo'])
  assert.deepEqual(faltaGrupo({ ...base, created_at: '2026-11-09T12:00:00Z' }, agoraT), [])   // ainda na carência
  assert.deepEqual(faltaGrupo({ ...base, created_at: '2026-06-01T00:00:00Z' }, agoraT), [])   // antiga: fora, decisão do dono
  assert.deepEqual(faltaGrupo({ ...base, no_grupo_whatsapp: true }, agoraT), [])
  assert.deepEqual(faltaGrupo({ ...base, status: 'afastado' }, agoraT), [])
  assert.equal(CORTE, '2026-11-04T00:00:00Z')
})
