const { test } = require('node:test');
const assert = require('node:assert');
const { telefoneDeRecado, telefonesDe } = require('./telefones-core.js');

test('o recado sai do campo que o app mantém', () => {
  assert.strictEqual(telefoneDeRecado({ celular_recado: '(19) 90000-0001' }), '(19) 90000-0001');
});

test('ficha antiga da porta de família ainda funciona (reserva)', () => {
  assert.strictEqual(telefoneDeRecado({ celular_responsavel: '(19) 90000-0002' }), '(19) 90000-0002');
});

test('com os dois preenchidos e DIFERENTES, todo o app mostra o MESMO', () => {
  // São 4 pessoas assim no cadastro. Antes, o CRM mostrava um número e o resto do app
  // mostrava outro, porque cada tela juntava os campos numa ordem diferente.
  const m = { celular_recado: '(19) 90000-0001', celular_responsavel: '(19) 90000-0002' };
  assert.strictEqual(telefoneDeRecado(m), '(19) 90000-0001');
});

test('sem nada, é nulo — e não string vazia', () => {
  assert.strictEqual(telefoneDeRecado({ celular_recado: '   ', celular_responsavel: null }), null);
  assert.strictEqual(telefoneDeRecado(null), null);
});

test('a lista de telefones não repete o mesmo número escrito de dois jeitos', () => {
  const m = { telefone: '(19) 99999-0000', celular_recado: '19999990000' };
  assert.deepStrictEqual(telefonesDe(m), ['(19) 99999-0000']);
});

test('a lista junta todos os campos, na ordem em que se liga', () => {
  const m = { telefone: '(19) 91111-1111', celular_recado: '(19) 92222-2222',
              celular_responsavel: '(19) 93333-3333', celular_mae: '(19) 94444-4444' };
  assert.deepStrictEqual(telefonesDe(m),
    ['(19) 91111-1111', '(19) 92222-2222', '(19) 93333-3333', '(19) 94444-4444']);
});

test('"nenhum telefone" só quando é verdade', () => {
  assert.deepStrictEqual(telefonesDe({ celular_responsavel: '(19) 90000-0002' }).length, 1);
  assert.deepStrictEqual(telefonesDe({}), []);
});
