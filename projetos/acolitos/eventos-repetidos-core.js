// As datas de um evento que se repete. PURO (sem DOM, sem rede), no padrão dos outros -core.js.
//
// Ao contrário das TAREFAS, que só criam a próxima quando alguém conclui, um evento precisa
// existir no calendário ANTES de acontecer: as pessoas confirmam presença e a chamada é feita
// por ocorrência. Por isso aqui as datas são geradas de uma vez, como eventos de verdade —
// não como uma regra expandida na hora de desenhar.
(function (global) {
  'use strict';

  var LIMITE = 52;   // teto de segurança: um engano de digitação não pode encher o calendário

  // { inicio:'AAAA-MM-DD', repete:'semanal'|'quinzenal'|'mensal'|'nenhuma', ate:'AAAA-MM-DD' }
  // devolve a lista de datas, SEMPRE incluindo a primeira. Nunca passa de 52.
  function datasDoEvento(o) {
    o = o || {};
    if (!ehData(o.inicio)) return [];
    if (o.repete !== 'semanal' && o.repete !== 'quinzenal' && o.repete !== 'mensal') return [o.inicio];
    // Sem "até quando", não dá para saber quantos criar — e chutar encheria o calendário de
    // eventos que ninguém pediu. Cria só o primeiro e quem estiver chamando avisa.
    if (!ehData(o.ate) || o.ate < o.inicio) return [o.inicio];

    var saida = [o.inicio], atual = o.inicio;
    while (saida.length < LIMITE) {
      atual = o.repete === 'mensal' ? somarMeses(atual, 1)
            : somarDias(atual, o.repete === 'quinzenal' ? 14 : 7);
      if (atual > o.ate) break;
      saida.push(atual);
    }
    return saida;
  }

  function ehData(d) {
    if (!d || typeof d !== 'string') return false;
    var p = d.split('-'); if (p.length !== 3) return false;
    var a = +p[0], m = +p[1], x = +p[2];
    return !isNaN(a) && !isNaN(m) && !isNaN(x) && a > 1 && m >= 1 && m <= 12 && x >= 1 && x <= 31;
  }
  function texto(a, m, d) { return a + '-' + String(m).padStart(2,'0') + '-' + String(d).padStart(2,'0'); }
  function somarDias(data, n) {
    var p = data.split('-');
    var t = new Date(Date.UTC(+p[0], +p[1]-1, +p[2] + n));
    return texto(t.getUTCFullYear(), t.getUTCMonth()+1, t.getUTCDate());
  }
  function somarMeses(data, n) {
    var p = data.split('-'), a0 = +p[0], m0 = +p[1], d0 = +p[2];
    var total = a0*12 + (m0-1) + n, a = Math.floor(total/12), m = (total%12)+1;
    // 31/01 + 1 mês não é 31/02: cai no último dia de fevereiro, como no resto do app.
    var ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
    return texto(a, m, Math.min(d0, ultimo));
  }

  var api = { datasDoEvento: datasDoEvento, LIMITE_REPETICAO: LIMITE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { global.datasDoEvento = datasDoEvento; global.LIMITE_REPETICAO = LIMITE; }  // pelo NOME
})(typeof globalThis !== 'undefined' ? globalThis : this);
