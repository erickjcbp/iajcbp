import test from 'node:test'
import assert from 'node:assert/strict'
import { calcularPresenca, criarPresencaGrupos } from './presenca-grupos.mjs'

const S = new Set(['99990000']), P = new Set(['88881111']), C = new Set(['77772222'])
const listas = { servo: S, pais: P, cerimoniarios: C }

test('servo: só o telefone PRÓPRIO conta; número da mãe no grupo dos servos NÃO é o servo no grupo', () => {
  assert.equal(calcularPresenca({ telefone: '(19) 9999-0000' }, listas).no_grupo_whatsapp, true)
  // Caso real (05/11/2026): a mãe estava no grupo dos servos e a ficha do filho aparecia como "está no grupo".
  assert.equal(calcularPresenca({ celular_mae: '19 9 9999-0000' }, listas).no_grupo_whatsapp, false)
  assert.equal(calcularPresenca({ celular_responsavel: '19 9 9999-0000', celular_recado: '19 9 9999-0000' }, listas).no_grupo_whatsapp, false)
  assert.equal(calcularPresenca({ telefone: '19 90000-1111' }, listas).no_grupo_whatsapp, false)
})
test('pais: só número da família conta', () => {
  assert.equal(calcularPresenca({ celular_mae: '19 98888-1111' }, listas).no_grupo_pais, true)
  assert.equal(calcularPresenca({ telefone: '19 98888-1111' }, listas).no_grupo_pais, false)
})
test('cerimoniários: família no grupo dos cerimoniários também não conta', () => {
  assert.equal(calcularPresenca({ nivel: 'cerimoniario_mor', celular_mae: '19 97777-2222' }, listas).no_grupo_cerimoniarios, false)
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
  assert.deepEqual(gruposEsperados({ nivel: 'cerimoniario_guardiao', telefone: '19 97777-2222' }), ['cerimoniarios'])
  assert.deepEqual(gruposEsperados({ nivel: 'coroinha', telefone: '19 96666-0000', celular_mae: '19 98888-1111' }), ['servo', 'pais'])
  assert.deepEqual(gruposEsperados({ nivel: 'aspirante', telefone: '19 96666-0000' }), ['servo'])
})
test('servo SEM telefone próprio não é cobrado no grupo dos servos (só a família, no de Pais)', () => {
  assert.deepEqual(gruposEsperados({ nivel: 'coroinha', celular_mae: '19 98888-1111' }), ['pais'])
  assert.deepEqual(gruposEsperados({ nivel: 'aspirante' }), [])
  assert.deepEqual(gruposEsperados({ nivel: 'cerimoniario_mor' }), [])
})
test('só cobra ficha nova, ativa e depois da carência de 48 h', () => {
  const base = { status: 'ativo', nivel: 'coroinha', telefone: '19 96666-0000', created_at: '2026-11-05T12:00:00Z', no_grupo_whatsapp: false }
  assert.deepEqual(faltaGrupo(base, agoraT), ['servo'])
  assert.deepEqual(faltaGrupo({ ...base, created_at: '2026-11-09T12:00:00Z' }, agoraT), [])   // ainda na carência
  assert.deepEqual(faltaGrupo({ ...base, created_at: '2026-06-01T00:00:00Z' }, agoraT), [])   // antiga: fora, decisão do dono
  assert.deepEqual(faltaGrupo({ ...base, no_grupo_whatsapp: true }, agoraT), [])
  assert.deepEqual(faltaGrupo({ ...base, status: 'afastado' }, agoraT), [])
  assert.equal(CORTE, '2026-11-04T00:00:00Z')
})

// ── Alerta: número de FAMÍLIA dentro de um grupo de servos ────────────────────────────────────────
import { intrusosDeFamilia } from './presenca-grupos.mjs'
const fichasI = [
  { nome: 'Servo Um', telefone: '19 95528-0001', celular_responsavel: '19 93180-1111', celular_recado: '19 92696-2222' },
  { nome: 'Servo Dois', telefone: '19 99637-3583', celular_responsavel: '19 94140-3333', celular_recado: '19 94140-3333' },
  { nome: 'Servo Três', telefone: '19 91111-9999', celular_recado: '19 99828-4444' },
]
const fim8 = (n) => String(n).replace(/\D/g, '').slice(-8)
test('acha família no grupo dos servos e diz de qual ficha é', () => {
  const participantes = new Set([fim8('19 95528-0001'), fim8('19 93180-1111'), fim8('19 94140-3333')])
  const r = intrusosDeFamilia({ participantes, fichas: fichasI, papel: 'acolitos' })
  assert.deepEqual(r.map((x) => x.fim).sort(), [fim8('19 93180-1111'), fim8('19 94140-3333')].sort())
  assert.match(JSON.stringify(r), /Servo Um/)
  assert.match(JSON.stringify(r), /Servo Dois/)
})
test('telefone próprio de servo e número que não é de família nenhuma (o do Tarcísio) não são intrusos', () => {
  const participantes = new Set([fim8('19 95528-0001'), fim8('19 99637-3583'), fim8('19 96848-0000')])
  assert.deepEqual(intrusosDeFamilia({ participantes, fichas: fichasI, papel: 'acolitos' }), [])
})
test('exceção da coordenação não é intruso, mas só no grupo da exceção', () => {
  const participantes = new Set([fim8('19 99828-4444')])
  const excecoes = new Set(['acolitos:' + fim8('19 99828-4444')])
  assert.deepEqual(intrusosDeFamilia({ participantes, fichas: fichasI, papel: 'acolitos', excecoes }), [])
  assert.equal(intrusosDeFamilia({ participantes, fichas: fichasI, papel: 'cerimoniarios', excecoes }).length, 1)
})
test('número que é telefone próprio de UMA ficha e contato de família de OUTRA não é intruso', () => {
  const fichas = [{ nome: 'A', telefone: '19 90000-1234' }, { nome: 'B', telefone: '19 98888-0000', celular_recado: '19 90000-1234' }]
  assert.deepEqual(intrusosDeFamilia({ participantes: new Set([fim8('19 90000-1234')]), fichas, papel: 'acolitos' }), [])
})

// cuidar(): o alerta vai para a coordenação uma vez só por número e grupo
function bancoComPendencias({ fichas, excecoes = [], abertas = [] }) {
  const inseridas = [], gravados = []
  const from = (tabela) => {
    const q = {
      select() { return q }, in() { return q }, limit() { return q }, gte() { return q }, eq() { return q }, not() { return q }, contains() { return q },
      update(v) { gravados.push(v); return { eq: async () => ({ error: null }), not: async () => ({ error: null }) } },
      insert(v) { inseridas.push(v); return Promise.resolve({ error: null }) },
      then(ok, er) {
        const data = tabela === 'tarcisio_grupos' ? [{ jid: 'servos@g.us', papel: 'acolitos' }]
          : tabela === 'acolitos_membros' ? fichas : tabela === 'tarcisio_grupo_excecoes' ? excecoes : tabela === 'tarcisio_pendencias' ? abertas : []
        return Promise.resolve({ data, error: null }).then(ok, er)
      },
    }
    return q
  }
  return { from, inseridas }
}
const participantesReais = ['5519955280001', '5519931801111', '5519999990001', '5519999990002']
test('cuidar avisa a coordenação do número de família no grupo dos servos (uma vez por número)', async () => {
  const db = bancoComPendencias({ fichas: fichasI })
  const evo = { participantes: async () => participantesReais }
  const presenca = criarPresencaGrupos({ db, evo, log: aviso })
  await presenca.cuidar(new Date(), { forcar: true })
  const alertas = db.inseridas.filter((x) => x.dados?.intruso_grupo)
  assert.equal(alertas.length, 1)
  assert.equal(alertas[0].tipo, 'coordenacao')
  assert.match(alertas[0].resumo, /Servo Um/)
  assert.match(alertas[0].resumo, /só dos servos/i)
  assert.doesNotMatch(alertas[0].resumo, /5519931801111|931801111/, 'não escreve o número inteiro')
  const dbAberta = bancoComPendencias({ fichas: fichasI, abertas: [{ id: 'x' }] })
  await criarPresencaGrupos({ db: dbAberta, evo, log: aviso }).cuidar(new Date(), { forcar: true })
  assert.equal(dbAberta.inseridas.filter((x) => x.dados?.intruso_grupo).length, 0, 'já há pendência aberta: não repete')
})
