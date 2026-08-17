// Testes da regra dos alertas de frequência do Início.
// Rodar: node --test projetos/acolitos/alertas-core.test.js
const test = require('node:test');
const assert = require('node:assert');
const { montarAlertas } = require('./alertas-core.js');

// Atalho: monta uma linha de acolitos_frequencia com o total de convocações desejado.
// realizadas = servidas + faltas_just + faltas_nao_just (é o que a regra conta).
const freq = (membro_id, taxa, realizadas) => ({
  membro_id, taxa, servidas: 0, faltas_just: 0, faltas_nao_just: realizadas,
});
const MEMBROS = [
  { id: 'm1', nome: 'Ana Souza' },
  { id: 'm2', nome: 'Bruno Lima' },
  { id: 'm3', nome: 'Carla Dias' },
];
const base = { membros: MEMBROS, dispensas: {}, agora: Date.parse('2026-08-17T12:00:00Z') };

test('o alerta diz o nome da pessoa, não só o número', () => {
  const r = montarAlertas({ ...base, freq: [freq('m1', 40, 5)] });
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0].nome, 'Ana Souza');
  assert.strictEqual(r[0].membroId, 'm1');
  assert.strictEqual(r[0].taxa, 40);
  assert.strictEqual(r[0].realizadas, 5);
});

test('não alerta quem teve menos de 3 convocações', () => {
  const r = montarAlertas({ ...base, freq: [freq('m1', 0, 2)] });
  assert.deepStrictEqual(r, []);
});

test('não alerta quem está com 60% ou mais', () => {
  const r = montarAlertas({ ...base, freq: [freq('m1', 60, 5)] });
  assert.deepStrictEqual(r, []);
});

test('não alerta quem ainda não tem taxa calculada', () => {
  const r = montarAlertas({ ...base, freq: [freq('m1', null, 5)] });
  assert.deepStrictEqual(r, []);
});

test('não alerta quem saiu da lista de ativos', () => {
  const r = montarAlertas({ ...base, freq: [freq('desligado', 10, 5)] });
  assert.deepStrictEqual(r, []);
});

test('o pior caso vem primeiro', () => {
  const r = montarAlertas({ ...base, freq: [freq('m1', 50, 4), freq('m2', 0, 3), freq('m3', 25, 4)] });
  assert.deepStrictEqual(r.map(a => a.nome), ['Bruno Lima', 'Carla Dias', 'Ana Souza']);
});

test('empate na taxa desempata por nome', () => {
  const r = montarAlertas({ ...base, freq: [freq('m3', 30, 3), freq('m1', 30, 3)] });
  assert.deepStrictEqual(r.map(a => a.nome), ['Ana Souza', 'Carla Dias']);
});

const ONTEM = Date.parse('2026-08-16T12:00:00Z');
const CEM_DIAS_ATRAS = Date.parse('2026-05-09T12:00:00Z');

test('alerta dispensado ontem não reaparece', () => {
  const r = montarAlertas({
    ...base, freq: [freq('m1', 40, 5)],
    dispensas: { m1: { taxa: 40, ts: ONTEM } },
  });
  assert.deepStrictEqual(r, []);
});

test('a dispensa vence em 90 dias', () => {
  const r = montarAlertas({
    ...base, freq: [freq('m1', 40, 5)],
    dispensas: { m1: { taxa: 40, ts: CEM_DIAS_ATRAS } },
  });
  assert.strictEqual(r.length, 1);
});

test('dispensa não vale mais se a frequência PIOROU — é outro alerta', () => {
  const r = montarAlertas({
    ...base, freq: [freq('m1', 20, 6)],
    dispensas: { m1: { taxa: 40, ts: ONTEM } },
  });
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0].taxa, 20);
});

test('dispensa continua valendo se a frequência melhorou (mas ainda alerta)', () => {
  const r = montarAlertas({
    ...base, freq: [freq('m1', 55, 6)],
    dispensas: { m1: { taxa: 40, ts: ONTEM } },
  });
  assert.deepStrictEqual(r, []);
});
