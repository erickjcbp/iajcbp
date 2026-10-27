import test from 'node:test'
import assert from 'node:assert/strict'
import { bancoMemoria } from './banco-memoria.mjs'
import { horarioPreparacao, cuidarPreparacao } from './avisos-programados.mjs'
const aviso = (extra = {}) => ({ id: 'aviso1', ativo: true, texto: 'Prepare sua veste e chegue com antecedência.', imagem_url: null,
  quando: '2026-10-25T00:00:00-03:00', configuracao: { tipo: 'preparacao_missa', antecedencia_min: 60 }, ...extra })
const grupos = { grupos: async () => [{ jid: 'p@g.us', nome: 'Pais - JCBP' }, { jid: 'c@g.us', nome: 'Cerimoniários - JCBP' }, { jid: 'r@g.us', nome: 'Equipe - RETIRO 24/10' }] }
test('calcula 16h sábado e 06h domingo; não prende o domingo na janela de 08h', () => {
  assert.match(horarioPreparacao(aviso({ quando: '2026-10-24T00:00:00-03:00' }), [{ minutos: 1110 }, { minutos: 1020 }]).quando, /T16:00:00/)
  assert.match(horarioPreparacao(aviso(), [{ minutos: 1140 }, { minutos: 420 }, { minutos: 540 }]).quando, /T06:00:00/)
  assert.equal(horarioPreparacao(aviso(), []), null)
})
test('recalcula com mudança na primeira missa e não enfileira antes da hora', async () => {
  const a = aviso({ quando: '2026-10-25T06:00:00-03:00' })
  const db = bancoMemoria({ tarcisio_avisos: [a], acolitos_celebracoes: [{ data: '2026-10-25', minutos: 480 }] })
  await cuidarPreparacao({ db, evo: grupos, aviso: a, agora: new Date('2026-10-25T06:00:00-03:00') })
  assert.match(db.t.tarcisio_avisos[0].quando, /T07:00:00/)
  assert.equal(db.t.tarcisio_envios?.length || 0, 0)
})
test('um envio por grupo pastoral/dia; repetição não duplica; próxima semana fica agendada', async () => {
  const a = aviso()
  const db = bancoMemoria({ tarcisio_avisos: [a], acolitos_celebracoes: [{ data: '2026-10-25', minutos: 420 }] })
  const args = { db, evo: grupos, aviso: a, agora: new Date('2026-10-25T06:00:00-03:00') }
  await cuidarPreparacao(args); await cuidarPreparacao(args)
  assert.equal(db.t.tarcisio_envios.length, 2)
  assert.deepEqual(db.t.tarcisio_envios.map(l => l.destino_jid), ['p@g.us', 'c@g.us'])
  assert.ok(db.t.tarcisio_envios.every(l => !l.destino_numero && l.aviso_id === a.id))
  assert.match(db.t.tarcisio_avisos[0].quando, /^2026-11-01/)
})
test('sexta às 18h funciona sem missa nesse dia', async () => {
  const a = aviso({ quando: '2026-10-23T18:00:00-03:00', configuracao: { tipo: 'preparacao_missa', horario: '18:00' } })
  const db = bancoMemoria({ tarcisio_avisos: [a] })
  await cuidarPreparacao({ db, evo: grupos, aviso: a, agora: new Date(a.quando) })
  assert.equal(db.t.tarcisio_envios.length, 2)
  assert.match(db.t.tarcisio_avisos[0].quando, /^2026-10-30T18:00/)
})
test('depois da primeira missa ou sem missa cadastrada no dia não manda mensagem atrasada', async () => {
  for (const cels of [[], [{ data: '2026-10-25', minutos: 420 }]]) {
    const a = aviso(), db = bancoMemoria({ tarcisio_avisos: [a], acolitos_celebracoes: cels })
    await cuidarPreparacao({ db, evo: grupos, aviso: a, agora: new Date('2026-10-25T07:00:00-03:00') })
    assert.equal(db.t.tarcisio_envios?.length || 0, 0)
    assert.match(db.t.tarcisio_avisos[0].quando, /^2026-11-01/)
  }
})
