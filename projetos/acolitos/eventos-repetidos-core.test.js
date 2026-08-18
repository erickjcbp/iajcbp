// Rodar: node --test projetos/acolitos/eventos-repetidos-core.test.js
const test = require('node:test');
const assert = require('node:assert');
const { datasDoEvento, LIMITE_REPETICAO } = require('./eventos-repetidos-core.js');

test('sem repetição: só a data escolhida', () => {
  assert.deepStrictEqual(datasDoEvento({ inicio:'2026-08-20', repete:'nenhuma' }), ['2026-08-20']);
});

test('semanal até uma data: uma por semana, incluindo a primeira', () => {
  assert.deepStrictEqual(datasDoEvento({ inicio:'2026-08-06', repete:'semanal', ate:'2026-08-27' }),
    ['2026-08-06','2026-08-13','2026-08-20','2026-08-27']);
});

test('a última cai exatamente no "até": entra', () => {
  assert.deepStrictEqual(datasDoEvento({ inicio:'2026-08-06', repete:'semanal', ate:'2026-08-13' }),
    ['2026-08-06','2026-08-13']);
});

test('quinzenal soma 14 dias', () => {
  assert.deepStrictEqual(datasDoEvento({ inicio:'2026-08-06', repete:'quinzenal', ate:'2026-09-10' }),
    ['2026-08-06','2026-08-20','2026-09-03']);
});

test('mensal cai no mesmo dia do mês', () => {
  assert.deepStrictEqual(datasDoEvento({ inicio:'2026-08-15', repete:'mensal', ate:'2026-11-01' }),
    ['2026-08-15','2026-09-15','2026-10-15']);
});

test('mensal a partir do dia 31 cai no último dia dos meses curtos', () => {
  assert.deepStrictEqual(datasDoEvento({ inicio:'2026-01-31', repete:'mensal', ate:'2026-04-01' }),
    ['2026-01-31','2026-02-28','2026-03-28']);
});

test('semanal virando o ano', () => {
  assert.deepStrictEqual(datasDoEvento({ inicio:'2026-12-28', repete:'semanal', ate:'2027-01-11' }),
    ['2026-12-28','2027-01-04','2027-01-11']);
});

test('sem "até quando" cria só o primeiro — chutar encheria o calendário', () => {
  assert.deepStrictEqual(datasDoEvento({ inicio:'2026-08-20', repete:'semanal' }), ['2026-08-20']);
});

test('"até" antes do início cria só o primeiro', () => {
  assert.deepStrictEqual(datasDoEvento({ inicio:'2026-08-20', repete:'semanal', ate:'2026-08-01' }), ['2026-08-20']);
});

test('nunca passa do teto de 52, mesmo pedindo dez anos', () => {
  const r = datasDoEvento({ inicio:'2026-01-01', repete:'semanal', ate:'2036-01-01' });
  assert.strictEqual(r.length, LIMITE_REPETICAO);
  assert.strictEqual(r.length, 52);
});

test('data de início inválida devolve lista vazia, nunca data inventada', () => {
  assert.deepStrictEqual(datasDoEvento({ inicio:'2026/08/20', repete:'semanal', ate:'2026-09-01' }), []);
  assert.deepStrictEqual(datasDoEvento({}), []);
  assert.deepStrictEqual(datasDoEvento(), []);
});

test('repetição desconhecida trata como sem repetição', () => {
  assert.deepStrictEqual(datasDoEvento({ inicio:'2026-08-20', repete:'diario', ate:'2026-09-01' }), ['2026-08-20']);
});
