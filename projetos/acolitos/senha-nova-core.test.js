// Provas da regra da senha nova — a tela que 138 famílias vão ver na primeira vez.
//
// Só a REGRA mora aqui: nada de tela, nada de banco. Assim o que decide se uma criança
// consegue ou não entrar no app dá para provar sem abrir navegador.
const { test } = require('node:test');
const assert = require('node:assert');
const { validarSenhaNova, SENHA_DA_FOLHA } = require('./senha-nova-core.js');

const ok = (senha, repetida) => validarSenhaNova({ senha, repetida });

test('senha boa passa', () => {
  assert.deepStrictEqual(ok('minhasenha1', 'minhasenha1'), { ok: true, erro: null });
});

test('as duas têm de ser iguais', () => {
  const r = ok('minhasenha1', 'minhasenha2');
  assert.strictEqual(r.ok, false);
  assert.match(r.erro, /iguais/i);
});

test('menos de 6 letras não serve', () => {
  const r = ok('abc12', 'abc12');
  assert.strictEqual(r.ok, false);
  assert.match(r.erro, /6/);
});

test('não pode ser a senha da folha — é o motivo desta tela existir', () => {
  // Se a pessoa "trocar" para a mesma senha impressa, a folha continua abrindo a conta
  // dela, e a troca obrigatória não protegeu ninguém.
  const r = ok(SENHA_DA_FOLHA, SENHA_DA_FOLHA);
  assert.strictEqual(r.ok, false);
  assert.match(r.erro, /folha/i);
});

test('nem a senha da folha escrita de outro jeito', () => {
  // "Coroinha2026" e " coroinha2026 " são a mesma senha para quem tem a folha na mão.
  assert.strictEqual(ok('Coroinha2026', 'Coroinha2026').ok, false);
  assert.strictEqual(ok('  coroinha2026  ', '  coroinha2026  ').ok, false);
});

test('em branco não passa', () => {
  assert.strictEqual(ok('', '').ok, false);
  assert.strictEqual(ok('      ', '      ').ok, false);
});

test('espaço nas pontas não conta como letra, mas no meio conta', () => {
  // "abc123  " tem 6 letras de verdade; "abc 123" tem 7 e vale.
  assert.strictEqual(ok('abc 123', 'abc 123').ok, true);
});
