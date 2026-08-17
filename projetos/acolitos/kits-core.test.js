// Testes da regra dos kits (quem pode servir em cada função).
// Rodar: node --test projetos/acolitos/kits-core.test.js
const test = require('node:test');
const assert = require('node:assert');
const { podeNaFuncao, normalizarKits } = require('./kits-core.js');

// Kit que LIBERA: estar na idade já basta, mesmo sem habilitação. (é o Sto. Antônio de hoje)
const KIT_LIBERA = {
  id: 'leve', nome: 'Kit leve', ativo: true, modo: 'libera',
  comunidades: ['santo_antonio'], funcoes: ['cruz', 'vela'], idade_min: 7, liberados: [],
};
// Kit que TRAVA: fora do critério não serve NEM quem tem habilitação. (o processional da Matriz)
const KIT_TRAVA = {
  id: 'processional', nome: 'Kit processional', ativo: true, modo: 'trava',
  comunidades: ['matriz'], funcoes: ['cruz', 'vela'], idade_min: 14, liberados: ['m-liberado'],
};
const pede = (extra) => podeNaFuncao(Object.assign({
  kits: [KIT_LIBERA, KIT_TRAVA], comunidade: 'matriz', funcao: 'cruz',
  temHabilitacao: false, idade: null, nivelInt: 1, membroId: 'm1',
}, extra));

test('sem kit governando a função, só a habilitação decide', () => {
  assert.strictEqual(pede({ funcao: 'turibulo', temHabilitacao: true }), true);
  assert.strictEqual(pede({ funcao: 'turibulo', temHabilitacao: false }), false);
});

test('kit que LIBERA: criança dentro da idade entra sem habilitação', () => {
  assert.strictEqual(pede({ comunidade: 'santo_antonio', idade: 8, temHabilitacao: false }), true);
});

test('kit que LIBERA: abaixo da idade mínima não entra', () => {
  assert.strictEqual(pede({ comunidade: 'santo_antonio', idade: 6, temHabilitacao: false }), false);
});

test('kit que LIBERA: sem data de nascimento cai no nível (coroinha pra cima)', () => {
  assert.strictEqual(pede({ comunidade: 'santo_antonio', idade: null, nivelInt: 1 }), true);
  assert.strictEqual(pede({ comunidade: 'santo_antonio', idade: null, nivelInt: 0 }), false);
});

test('kit que TRAVA: quem tem habilitação mas está abaixo da idade NÃO entra', () => {
  assert.strictEqual(pede({ temHabilitacao: true, idade: 12 }), false);
});

test('kit que TRAVA: com habilitação e idade suficiente, entra', () => {
  assert.strictEqual(pede({ temHabilitacao: true, idade: 14 }), true);
});

test('kit que TRAVA: sem data de nascimento e sem liberação, NÃO entra', () => {
  assert.strictEqual(pede({ temHabilitacao: true, idade: null }), false);
});

test('kit que TRAVA: liberado nome a nome entra mesmo sem data e abaixo da idade', () => {
  assert.strictEqual(pede({ membroId: 'm-liberado', temHabilitacao: true, idade: null }), true);
  assert.strictEqual(pede({ membroId: 'm-liberado', temHabilitacao: true, idade: 9 }), true);
});

test('kit que TRAVA não CONCEDE: liberado sem habilitação continua de fora', () => {
  assert.strictEqual(pede({ membroId: 'm-liberado', temHabilitacao: false, idade: 30 }), false);
});

test('kit desligado é ignorado — volta a valer só a habilitação', () => {
  const kits = [Object.assign({}, KIT_TRAVA, { ativo: false })];
  assert.strictEqual(podeNaFuncao({ kits, comunidade:'matriz', funcao:'cruz', temHabilitacao:true, idade:9, nivelInt:1, membroId:'m1' }), true);
});

test('a configuração antiga (kit_leve) vira um kit que LIBERA, sem perder nada', () => {
  const kits = normalizarKits({ kit_leve: { comunidade:'santo_antonio', funcoes:['cruz','vela'], idade_min:7 } });
  assert.strictEqual(kits.length, 1);
  assert.strictEqual(kits[0].modo, 'libera');
  assert.strictEqual(kits[0].idade_min, 7);
  assert.deepStrictEqual(kits[0].comunidades, ['santo_antonio']);
  assert.deepStrictEqual(kits[0].funcoes, ['cruz', 'vela']);
});

test('sem configuração nenhuma, o padrão histórico é mantido (Sto. Antônio 7+)', () => {
  const kits = normalizarKits({});
  assert.deepStrictEqual(kits[0].comunidades, ['santo_antonio']);
  assert.strictEqual(kits[0].idade_min, 7);
});
