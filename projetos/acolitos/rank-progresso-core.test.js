// Barra de XP/nível da Home: quanto falta para o próximo nível.
// Antes: só contava capítulos FECHADOS (fez/tot) — ficava em 0% para quase todo mundo até terminar um
// capítulo inteiro, e a pessoa via "sempre vazia". Agora o capítulo em andamento também conta.
const test = require('node:test');
const assert = require('node:assert/strict');
const { progressoProximoNivel } = require('./rank-progresso-core.js');

const m = (o) => Object.assign({ obrigatoria: true, status: 'pendente', atual: 0, alvo: null }, o);
const cap = (completo, missoes) => ({ completo, missoes });

test('sem capítulos: 0 e sem dado', () => {
  assert.deepEqual(progressoProximoNivel([]), { pct: 0, capitulosFeitos: 0, capitulosTotal: 0, missoesFeitas: 0, missoesTotal: 0 });
  assert.equal(progressoProximoNivel(undefined).pct, 0);
});

test('nada feito: 0%', () => {
  const r = progressoProximoNivel([cap(false, [m({}), m({})]), cap(false, [m({})])]);
  assert.equal(r.pct, 0);
  assert.equal(r.capitulosTotal, 2);
});

test('uma missão de duas feita no 1º de 2 capítulos: 25% (não 0%)', () => {
  const r = progressoProximoNivel([cap(false, [m({ status: 'concluida' }), m({})]), cap(false, [m({})])]);
  assert.equal(r.pct, 25);
  assert.deepEqual([r.missoesFeitas, r.missoesTotal], [1, 2]);
});

test('capítulos fechados contam inteiros; o em andamento soma a fração', () => {
  const r = progressoProximoNivel([cap(true, [m({ status: 'concluida' })]), cap(false, [m({ status: 'concluida' }), m({}), m({}), m({})]), cap(false, [m({})]), cap(false, [m({})])]);
  assert.equal(r.capitulosFeitos, 1);
  assert.equal(r.pct, Math.round(100 * (1 + 0.25) / 4));   // 31%
});

test('missão com contagem parcial (atual/alvo) dá crédito proporcional, nunca fecha sozinha', () => {
  const r = progressoProximoNivel([cap(false, [m({ atual: 3, alvo: 10 }), m({})])]);
  assert.equal(r.pct, 15);                                    // (0,3 + 0) / 2 = 0,15
  const quase = progressoProximoNivel([cap(false, [m({ atual: 10, alvo: 10 })])]);
  assert.ok(quase.pct < 100, 'cumprir a contagem sem concluir ainda não enche a barra');
});

test('missão opcional não entra na conta', () => {
  const r = progressoProximoNivel([cap(false, [m({ obrigatoria: false, status: 'concluida' }), m({})])]);
  assert.equal(r.pct, 0);
  assert.equal(r.missoesTotal, 1);
});

test('todos os capítulos completos: 100%', () => {
  assert.equal(progressoProximoNivel([cap(true, [m({ status: 'concluida' })]), cap(true, [m({ status: 'concluida' })])]).pct, 100);
});

test('capítulo marcado completo vale 100% mesmo se a lista de missões veio vazia ou parcial', () => {
  assert.equal(progressoProximoNivel([cap(true, []), cap(false, [m({})])]).pct, 50);
});

test('nunca passa de 100 nem fica negativo, e dado sujo não vira NaN', () => {
  const r = progressoProximoNivel([cap(false, [m({ atual: -4, alvo: 0 }), m({ atual: 'x', alvo: 'y' }), null]), null]);
  assert.ok(Number.isFinite(r.pct) && r.pct >= 0 && r.pct <= 100);
});
