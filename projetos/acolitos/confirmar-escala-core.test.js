// Rodar: node --test projetos/acolitos/confirmar-escala-core.test.js
const test = require('node:test');
const assert = require('node:assert');
const { aNotificar, podarAvisados } = require('./confirmar-escala-core.js');

test('ninguém avisado ainda: avisa todos os escalados', () => {
  assert.deepStrictEqual(aNotificar({ escalados:['a','b','c'], jaAvisados:[] }), ['a','b','c']);
});

test('avisa só quem ainda não foi avisado', () => {
  assert.deepStrictEqual(aNotificar({ escalados:['a','b','c'], jaAvisados:['a','c'] }), ['b']);
});

test('todos já avisados: não avisa ninguém (apertar 2x não reenvia)', () => {
  assert.deepStrictEqual(aNotificar({ escalados:['a','b'], jaAvisados:['a','b'] }), []);
});

test('a mesma pessoa em duas missas da semana é UM aviso, não dois', () => {
  assert.deepStrictEqual(aNotificar({ escalados:['a','a','b','a'], jaAvisados:[] }), ['a','b']);
});

test('id vazio ou nulo não vira aviso', () => {
  assert.deepStrictEqual(aNotificar({ escalados:['a',null,'',undefined,'b'], jaAvisados:[] }), ['a','b']);
});

test('sem nada: lista vazia, nunca erro', () => {
  assert.deepStrictEqual(aNotificar({}), []);
  assert.deepStrictEqual(aNotificar(), []);
});

test('poda descarta semana velha e mantém a recente', () => {
  const m = { '2026-01-04':['a'], '2026-08-16':['b'] };
  assert.deepStrictEqual(podarAvisados({ mapa:m, hoje:'2026-08-18', dias:60 }), { '2026-08-16':['b'] });
});

test('poda mantém a semana no limite exato do prazo', () => {
  const m = { '2026-06-19':['a'] };   // 60 dias antes de 18/08
  assert.deepStrictEqual(podarAvisados({ mapa:m, hoje:'2026-08-18', dias:60 }), { '2026-06-19':['a'] });
});

test('poda descarta chave que não é data', () => {
  const m = { 'semana-passada':['a'], '2026-08-16':['b'] };
  assert.deepStrictEqual(podarAvisados({ mapa:m, hoje:'2026-08-18' }), { '2026-08-16':['b'] });
});

test('sem data confiável a poda não descarta nada — apagar por engano é pior', () => {
  const m = { '2026-01-04':['a'] };
  assert.deepStrictEqual(podarAvisados({ mapa:m, hoje:null }), m);
});

test('semana no futuro é mantida', () => {
  const m = { '2026-09-06':['a'] };
  assert.deepStrictEqual(podarAvisados({ mapa:m, hoje:'2026-08-18', dias:60 }), m);
});
