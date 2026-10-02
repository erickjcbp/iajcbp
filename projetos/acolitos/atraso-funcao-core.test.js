// O "?" da matriz só vale se quem leva a marca é quem está MESMO atrás dos pares, e se quem
// é novo de verdade (ou sem data) fica de fora. Estas provas guardam as duas coisas.
const { test } = require('node:test');
const assert = require('node:assert');
const { atrasos, funcoesEsperadas, resumo } = require('./atraso-funcao-core.js');

function grupo(n, nivel, criado) {
  return Array.from({ length: n }, (_, i) => ({ id: nivel + i, nivel, created_at: criado || '2026-06-01T03:00:00Z' }));
}

test('a função é esperada quando 70% do nível já é apto — e só com 5+ pessoas', () => {
  const ms = grupo(10, 'guardiao');
  const hab = {}; ms.slice(0, 8).forEach(m => { hab[m.id] = { naveta: 'apto' }; });   // 80%
  assert.deepStrictEqual(funcoesEsperadas(ms, hab, ['naveta', 'sineta'])['guardiao'], ['naveta']);
  // 4 pessoas, todas aptas: pouca gente para chamar de maioria
  const pequeno = grupo(4, 'raro'); const h2 = {}; pequeno.forEach(m => { h2[m.id] = { naveta: 'apto' }; });
  assert.deepStrictEqual(funcoesEsperadas(pequeno, h2, ['naveta'])['raro'], []);
});

test('quem não é apto na função esperada leva a marca; quem é, não', () => {
  const ms = grupo(10, 'guardiao'); const hab = {};
  ms.slice(0, 8).forEach(m => { hab[m.id] = { naveta: 'apto' }; });
  hab[ms[8].id] = { naveta: 'em_formacao' };   // em formação ainda é atraso
  const r = atrasos({ membros: ms, hab, funcoes: ['naveta'], hoje: '2026-10-01' });
  assert.deepStrictEqual(Object.keys(r).sort(), [ms[8].id, ms[9].id].sort());
  assert.strictEqual(r[ms[9].id].naveta.pares, 0.8);
});

test('quem entrou há pouco tempo, ou não tem data, não leva a marca', () => {
  const ms = grupo(9, 'guardiao'); const hab = {};
  ms.forEach(m => { hab[m.id] = { naveta: 'apto' }; });
  const novo = { id: 'novo', nivel: 'guardiao', created_at: '2026-09-20T03:00:00Z' };
  const semData = { id: 'sem', nivel: 'guardiao', created_at: null };
  const r = atrasos({ membros: ms.concat([novo, semData]), hab, funcoes: ['naveta'], hoje: '2026-10-01' });
  assert.deepStrictEqual(r, {});
});

test('resumo conta pessoas e marcas', () => {
  assert.deepStrictEqual(resumo({ a: { x: {}, y: {} }, b: { x: {} } }), { pessoas: 2, marcas: 3 });
  assert.deepStrictEqual(resumo({}), { pessoas: 0, marcas: 0 });
});
