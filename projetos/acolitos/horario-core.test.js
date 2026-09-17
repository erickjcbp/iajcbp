// O horário da missa está guardado como TEXTO, sem zero na frente ('7h', '18h30', '19h30').
// Em ordem de texto, '9h' vem depois de '19h' — e era assim que as telas mostravam os
// domingos: 19h, 7h, 9h. Medido em 17/09/2026: 20 dos 39 dias com mais de uma missa saíam
// fora de ordem. Este ajudante é o espelho, em JavaScript, da função
// acolitos_minutos_do_horario do banco (migration 070) — se um mudar, o outro muda junto.
const { test } = require('node:test');
const assert = require('node:assert');
const { minutosDoHorario, compararHorario } = require('./horario-core.js');

test('lê os horários que existem no banco hoje', () => {
  assert.strictEqual(minutosDoHorario('7h'), 420);
  assert.strictEqual(minutosDoHorario('9h'), 540);
  assert.strictEqual(minutosDoHorario('16h'), 960);
  assert.strictEqual(minutosDoHorario('17h'), 1020);
  assert.strictEqual(minutosDoHorario('18h30'), 1110);
  assert.strictEqual(minutosDoHorario('19h'), 1140);
  assert.strictEqual(minutosDoHorario('19h30'), 1170);
});

test('lê também hora com dois pontos e com zero na frente', () => {
  assert.strictEqual(minutosDoHorario('19:00'), 1140);
  assert.strictEqual(minutosDoHorario('08:15'), 495);
  assert.strictEqual(minutosDoHorario('15:00:00'), 900);   // é assim que o EVENTO guarda
  assert.strictEqual(minutosDoHorario('07h'), 420);
  assert.strictEqual(minutosDoHorario('  19h '), 1140);
});

test('o que não dá para ler devolve nada — e nunca estoura', () => {
  for (const ruim of [null, undefined, '', '   ', 'sem hora', 'h', 'manhã']) {
    assert.strictEqual(minutosDoHorario(ruim), null, 'entrada: ' + JSON.stringify(ruim));
  }
});

test('ordena pela HORA, não pelo texto — o domingo é o caso real', () => {
  const domingo = ['19h', '7h', '9h'];
  assert.deepStrictEqual(domingo.slice().sort(compararHorario), ['7h', '9h', '19h']);
  const sabado = ['18h30', '17h'];
  assert.deepStrictEqual(sabado.slice().sort(compararHorario), ['17h', '18h30']);
});

test('o que não dá para ler vai para o FIM, e horários iguais empatam', () => {
  assert.deepStrictEqual(['19h', 'sem hora', '7h'].slice().sort(compararHorario), ['7h', '19h', 'sem hora']);
  assert.strictEqual(compararHorario('19h', '19:00'), 0);
  assert.strictEqual(compararHorario(null, null), 0);
});
