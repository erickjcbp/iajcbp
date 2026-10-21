const test = require('node:test');
const assert = require('node:assert/strict');
const { gerarSemana, planejarVagas } = require('./gerador-escala-core.js');
const fx = require('./fixtures/gerador-semana.json');

// Fixture SINTÉTICA e anonimizada (nenhum dado real). `esperado` foi gravado rodando o código
// ANTIGO do gerador (que morava em escala.html) com o mesmo sorteio semeado.
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const modeloFor = (tipo, com) => (fx.modelos[tipo + '|' + com] || fx.modelos['missa_comum|' + com] || []).map(f => ({ funcao: f }));
function toSets(o) { const r = {}; for (const k in o) r[k] = new Set(o[k]); return r; }
function entrada(extra) {
  const e = JSON.parse(JSON.stringify(fx.entrada));
  return Object.assign({
    celebracoes: e.celebracoes, todosDaSemana: e.todosDaSemana, membros: e.membros, habMap: e.habMap, dispMap: e.dispMap,
    escalasExistentes: e.escalasExistentes, ausencias: toSets(e.ausencias), historicoSemanal: e.historicoSemanal,
    carga: e.carga, config: e.config, modeloFor, rnd: mulberry32(fx.seed), hoje: new Date(fx.hoje),
  }, extra || {});
}

test('mesmo resultado do código antigo na semana de referência', () => {
  assert.deepEqual(gerarSemana(entrada()).novas, fx.esperado);
});

test('mesmo resultado do código antigo sem informar as missas fora da seleção', () => {
  assert.deepEqual(gerarSemana(entrada({ todosDaSemana: undefined })).novas, fx.esperadoSemTodosDaSemana);
});

test('mesmo resultado do código antigo na geração de uma missa (planejarVagas)', () => {
  const p = fx.planejar, e = entrada();
  const ctx = { membros: e.membros, habMap: e.habMap, dispMap: e.dispMap, config: e.config, rnd: mulberry32(p.seed), hoje: e.hoje };
  const res = planejarVagas(ctx, p.vagas, p.horKey, new Set(p.ausentes), new Set(p.usados), Object.assign({}, e.carga),
    new Set(p.usadoFds), p.comunidade, p.data, e.historicoSemanal.slice());
  assert.deepEqual(res, p.esperado);
});

test('ninguém repete no fim de semana nem na mesma missa, e ausente fica de fora', () => {
  const e = entrada(), r = gerarSemana(e);
  const ids = r.novas.map(n => n.membro_id);
  assert.equal(new Set(ids).size, ids.length);
  r.novas.forEach(n => { assert.ok(!(e.ausencias[n.celebracao_id] || new Set()).has(n.membro_id)); });
  Object.values(e.escalasExistentes).flat().forEach(x => assert.ok(!ids.includes(x.membro_id)));
});

test('não altera os dados de entrada (carga e histórico são copiados)', () => {
  const e = entrada(), carga0 = JSON.stringify(e.carga), hist0 = JSON.stringify(e.historicoSemanal);
  gerarSemana(e);
  assert.equal(JSON.stringify(e.carga), carga0);
  assert.equal(JSON.stringify(e.historicoSemanal), hist0);
});
