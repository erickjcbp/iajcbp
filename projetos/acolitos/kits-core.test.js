// Testes da regra dos kits (quem pode servir em cada função).
// Rodar: node --test projetos/acolitos/kits-core.test.js
const test = require('node:test');
const assert = require('node:assert');
const { podeNaFuncao, normalizarKits, avisoDeKit, avisosDeKit } = require('./kits-core.js');

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

// ── O AVISO: marquei a pessoa como apta, mas um kit que TRAVA vai anular isso ────────
// Nasceu de um caso real (21/09/2026): a Ana Beatriz foi marcada apta em "vela" e sumiu
// do campo de seleção da Escala sem nenhum aviso — a trava dos 14 anos da Matriz a
// reprovava ANTES de olhar a habilitação. A tela de Membros aceitava calada.
test('aviso: marcada apta mas abaixo da idade da trava — diz a idade que falta', () => {
  const a = avisoDeKit({ kits: [KIT_LIBERA, KIT_TRAVA], comunidade: 'matriz', funcao: 'cruz',
    membroId: 'm1', temHabilitacao: true, idade: 12, nivelInt: 1 });
  assert.ok(a, 'devia avisar');
  assert.strictEqual(a.motivo, 'idade');
  assert.strictEqual(a.idadeMin, 14);
  assert.strictEqual(a.kit, 'Kit processional');
});

test('aviso: marcada apta e SEM data de nascimento — a trava reprova por falta de data', () => {
  const a = avisoDeKit({ kits: [KIT_LIBERA, KIT_TRAVA], comunidade: 'matriz', funcao: 'vela',
    membroId: 'm1', temHabilitacao: true, idade: null, nivelInt: 1 });
  assert.ok(a, 'devia avisar');
  assert.strictEqual(a.motivo, 'sem_data');
  assert.strictEqual(a.idadeMin, 14);
});

test('aviso: quem passa na trava não é avisado', () => {
  assert.strictEqual(avisoDeKit({ kits: [KIT_LIBERA, KIT_TRAVA], comunidade: 'matriz',
    funcao: 'cruz', membroId: 'm1', temHabilitacao: true, idade: 14, nivelInt: 1 }), null);
});

test('aviso: liberado nome a nome não é avisado', () => {
  assert.strictEqual(avisoDeKit({ kits: [KIT_LIBERA, KIT_TRAVA], comunidade: 'matriz',
    funcao: 'cruz', membroId: 'm-liberado', temHabilitacao: true, idade: 9, nivelInt: 1 }), null);
});

test('aviso: quem NÃO foi marcado apto não é avisado (não há contradição a mostrar)', () => {
  assert.strictEqual(avisoDeKit({ kits: [KIT_LIBERA, KIT_TRAVA], comunidade: 'matriz',
    funcao: 'cruz', membroId: 'm1', temHabilitacao: false, idade: 9, nivelInt: 1 }), null);
});

test('aviso: função sem kit governando nunca avisa', () => {
  assert.strictEqual(avisoDeKit({ kits: [KIT_LIBERA, KIT_TRAVA], comunidade: 'matriz',
    funcao: 'turibulo', membroId: 'm1', temHabilitacao: true, idade: 9, nivelInt: 1 }), null);
});

test('aviso: kit que LIBERA nunca avisa — ele só concede, nunca tira', () => {
  assert.strictEqual(avisoDeKit({ kits: [KIT_LIBERA, KIT_TRAVA], comunidade: 'santo_antonio',
    funcao: 'cruz', membroId: 'm1', temHabilitacao: true, idade: 5, nivelInt: 1 }), null);
});

test('aviso: kit desligado não avisa', () => {
  const kits = [Object.assign({}, KIT_TRAVA, { ativo: false })];
  assert.strictEqual(avisoDeKit({ kits, comunidade: 'matriz', funcao: 'cruz',
    membroId: 'm1', temHabilitacao: true, idade: 9, nivelInt: 1 }), null);
});

// ── O aviso tem de olhar TODAS as comunidades onde a pessoa serve ────────────────────
// Furo do primeiro conserto, achado na revisão: o aviso perguntava pela comunidade DA
// PESSOA, mas a Escala decide pela comunidade DA MISSA — e quem tem
// `pode_outras_comunidades` aparece nas missas das outras. No dado real havia o André
// (12 anos, Sto. Antônio, pode servir na Matriz): passa no kit do Sto. Antônio, é travado
// na Matriz, e o aviso ficava calado exatamente no caso que ele existe para cobrir.
const ONDE = ['matriz', 'santo_antonio'];

test('avisos: quem passa na própria comunidade mas é travado na outra É avisado, e diz onde', () => {
  const avs = avisosDeKit({ kits: [KIT_LIBERA, KIT_TRAVA], comunidades: ONDE, funcao: 'vela',
    membroId: 'm1', temHabilitacao: true, idade: 12, nivelInt: 1 });
  assert.strictEqual(avs.length, 1);
  assert.strictEqual(avs[0].comunidade, 'matriz');
  assert.strictEqual(avs[0].idadeMin, 14);
});

test('avisos: quem passa em todas as comunidades não é avisado', () => {
  assert.deepStrictEqual(avisosDeKit({ kits: [KIT_LIBERA, KIT_TRAVA], comunidades: ONDE,
    funcao: 'vela', membroId: 'm1', temHabilitacao: true, idade: 20, nivelInt: 1 }), []);
});

test('avisos: uma comunidade só continua funcionando (é o caso de quem não sai da sua)', () => {
  const avs = avisosDeKit({ kits: [KIT_LIBERA, KIT_TRAVA], comunidades: ['santo_antonio'],
    funcao: 'vela', membroId: 'm1', temHabilitacao: true, idade: 12, nivelInt: 1 });
  assert.deepStrictEqual(avs, []);
});

test('avisos: sem marcação não avisa em comunidade nenhuma', () => {
  assert.deepStrictEqual(avisosDeKit({ kits: [KIT_LIBERA, KIT_TRAVA], comunidades: ONDE,
    funcao: 'vela', membroId: 'm1', temHabilitacao: false, idade: 12, nivelInt: 1 }), []);
});

test('avisos: sem lista de comunidades não inventa nenhuma', () => {
  assert.deepStrictEqual(avisosDeKit({ kits: [KIT_LIBERA, KIT_TRAVA], comunidades: [],
    funcao: 'vela', membroId: 'm1', temHabilitacao: true, idade: 12, nivelInt: 1 }), []);
});

test('aviso: trava SEM idade mínima não diz "exige 0 anos" — o que reprova é a falta de data', () => {
  const kits = [Object.assign({}, KIT_TRAVA, { idade_min: 0, liberados: [] })];
  const a = avisoDeKit({ kits, comunidade: 'matriz', funcao: 'cruz',
    membroId: 'm1', temHabilitacao: true, idade: null, nivelInt: 1 });
  assert.ok(a, 'devia avisar: a trava reprova quem não tem data, com ou sem idade mínima');
  assert.strictEqual(a.motivo, 'sem_data');
  assert.strictEqual(a.idadeMin, 0);
  assert.strictEqual(a.exigeIdade, false, 'a tela precisa saber que NÃO há idade a citar');
});

test('aviso: trava COM idade mínima marca que há idade a citar', () => {
  const a = avisoDeKit({ kits: [KIT_LIBERA, KIT_TRAVA], comunidade: 'matriz', funcao: 'cruz',
    membroId: 'm1', temHabilitacao: true, idade: 12, nivelInt: 1 });
  assert.strictEqual(a.exigeIdade, true);
});
