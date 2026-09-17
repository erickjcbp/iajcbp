// A hora da missa, em minutos — para ordenar.
//
// O horário é TEXTO no banco, sem zero na frente: '7h', '9h', '18h30', '19h30'. Comparar
// texto põe '9h' depois de '19h', e era assim que as telas mostravam os domingos
// (19h, 7h, 9h). Em 17/09/2026, 20 dos 39 dias com mais de uma missa estavam assim.
//
// ESTE ARQUIVO É O ESPELHO, em JavaScript, da função acolitos_minutos_do_horario do banco
// (migration 070). Mudou um, muda o outro — senão a tela e o banco ordenam diferente.
//
// O EVENTO guarda hora de verdade ('15:00:00') e também é lido aqui, porque a Agenda mistura
// missas e eventos na mesma lista.
(function (global) {
  'use strict';

  function minutosDoHorario(texto) {
    var m = String(texto == null ? '' : texto).trim().match(/^(\d{1,2})\s*[h:]\s*(\d{0,2})/);
    if (!m) return null;
    var h = Number(m[1]);
    var min = m[2] === '' ? 0 : Number(m[2]);
    if (!isFinite(h) || !isFinite(min)) return null;
    return h * 60 + min;
  }

  // Para usar direto em sort(): hora menor primeiro; o que não dá para ler vai para o fim.
  function compararHorario(a, b) {
    var ma = minutosDoHorario(a), mb = minutosDoHorario(b);
    if (ma === null && mb === null) return 0;
    if (ma === null) return 1;
    if (mb === null) return -1;
    return ma - mb;
  }

  var api = { minutosDoHorario: minutosDoHorario, compararHorario: compararHorario };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else {  // pelo NOME: as telas chamam direto
    global.HorarioDaMissa = api;
    global.minutosDoHorario = minutosDoHorario;
    global.compararHorario = compararHorario;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
