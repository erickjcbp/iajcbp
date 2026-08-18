// Regra: ao CONCLUIR uma tarefa recorrente, qual é a próxima.
// Rodar: node --test projetos/acolitos/tarefas-core.test.js
const test = require('node:test');
const assert = require('node:assert');
const { proximaTarefa } = require('./tarefas-core.js');

test('tarefa sem recorrência não gera próxima', () => {
  assert.strictEqual(proximaTarefa({ recorrencia:'nenhuma', prazo:'2026-08-23', hoje:'2026-08-17' }), null);
});

test('semanal soma 7 dias ao prazo da concluída', () => {
  assert.deepStrictEqual(proximaTarefa({ recorrencia:'semanal', prazo:'2026-08-23', hoje:'2026-08-17' }), { prazo:'2026-08-30' });
});

test('mensal cai no mesmo dia do mês seguinte', () => {
  assert.deepStrictEqual(proximaTarefa({ recorrencia:'mensal', prazo:'2026-08-23', hoje:'2026-08-17' }), { prazo:'2026-09-23' });
});

test('mensal em dia que não existe no mês seguinte cai no último dia dele', () => {
  // 31/01 + 1 mês não é 31/02. Sem esta regra o JS empurra para 03/03, que ninguém espera.
  assert.deepStrictEqual(proximaTarefa({ recorrencia:'mensal', prazo:'2026-01-31', hoje:'2026-01-01' }), { prazo:'2026-02-28' });
});

test('anual soma um ano', () => {
  assert.deepStrictEqual(proximaTarefa({ recorrencia:'anual', prazo:'2026-08-23', hoje:'2026-08-17' }), { prazo:'2027-08-23' });
});

test('sem prazo na concluída, conta a partir de hoje', () => {
  assert.deepStrictEqual(proximaTarefa({ recorrencia:'semanal', prazo:null, hoje:'2026-08-17' }), { prazo:'2026-08-24' });
});

test('a cada celebração usa a próxima celebração da agenda', () => {
  assert.deepStrictEqual(proximaTarefa({ recorrencia:'celebracao', prazo:'2026-08-16', hoje:'2026-08-17', proximaCelebracao:'2026-08-22' }), { prazo:'2026-08-22' });
});

test('a cada celebração SEM celebração futura nasce sem prazo, não com data inventada', () => {
  assert.deepStrictEqual(proximaTarefa({ recorrencia:'celebracao', prazo:'2026-08-16', hoje:'2026-08-17', proximaCelebracao:null }), { prazo:null });
});

test('recorrência desconhecida não gera próxima', () => {
  assert.strictEqual(proximaTarefa({ recorrencia:'quinzenal', prazo:'2026-08-23', hoje:'2026-08-17' }), null);
});

test('base ausente em semanal devolve objeto, não null (recorrência não se perde)', () => {
  assert.deepStrictEqual(proximaTarefa({ recorrencia:'semanal' }), { prazo: null });
});

test('prazo null e hoje indefinido em mensal devolve objeto com prazo null', () => {
  assert.deepStrictEqual(proximaTarefa({ recorrencia:'mensal', prazo:null }), { prazo: null });
});

test('data malformada (barra em vez de traço) devolve objeto com prazo null', () => {
  assert.deepStrictEqual(proximaTarefa({ recorrencia:'semanal', prazo:'2026/08/23', hoje:'2026-08-17' }), { prazo: null });
});

test('Date object em vez de string devolve objeto com prazo null', () => {
  assert.deepStrictEqual(proximaTarefa({ recorrencia:'mensal', prazo:new Date('2026-08-23'), hoje:'2026-08-17' }), { prazo: null });
});
