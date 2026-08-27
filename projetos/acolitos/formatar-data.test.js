// Provas do formatDate (shared.js).
//
// Ele recebe DOIS formatos do banco — data pura ("2013-04-10") e instante
// ("2026-08-01T12:00:00Z") — e antes grudava 'T00:00:00' em tudo. Num instante isso
// virava data inválida: a coluna "Data" da lista do CRM mostrava "Invalid Date" para
// todo mundo, porque etapa_iniciada_em tem hora. Descoberto em 27/08/2026 ao montar
// o cartão da pessoa.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const src = fs.readFileSync(path.join(__dirname, 'shared.js'), 'utf8');
const formatDate = new Function(src.match(/function formatDate[\s\S]*?\n}/)[0] + '; return formatDate;')();

test('data pura vira dd/mm/aaaa sem voltar um dia', () => {
  assert.strictEqual(formatDate('2013-04-10'), '10/04/2013');
  assert.strictEqual(formatDate('2026-01-01'), '01/01/2026');
});

test('data COM hora não vira "Invalid Date"', () => {
  const r = formatDate('2026-08-01T12:00:00Z');
  assert.ok(!/Invalid/i.test(r), 'saiu: ' + r);
  assert.strictEqual(r, '01/08/2026');
});

test('vazio e lixo viram travessão, nunca data doida', () => {
  assert.strictEqual(formatDate(null), '—');
  assert.strictEqual(formatDate(''), '—');
  assert.strictEqual(formatDate('nem data'), '—');
});
