// Quando uma tarefa recorrente é concluída, qual é a próxima. PURO (sem DOM, sem rede),
// no padrão de navegacao-core.js, alertas-core.js, kits-core.js e acesso-core.js.
//
// A recorrência dispara na CONCLUSÃO, nunca pelo relógio. Marcou feita, nasce a próxima;
// se ninguém concluir, nenhuma nova nasce e fica uma só, atrasada, cobrando. Foi decisão
// do dono: as alternativas (acumular, ou vencer a anterior) foram descartadas, e essa
// escolha elimina a necessidade de um robô e a pergunta do que fazer com a não concluída.
(function (global) {
  'use strict';

  // Datas em texto 'AAAA-MM-DD', sem fuso: o app inteiro já trata data assim, e usar
  // Date com hora aqui traria o bug de virar o dia dependendo do fuso do aparelho.
  function partes(d) { var p = String(d).split('-'); return { a:+p[0], m:+p[1], d:+p[2] }; }
  function texto(a, m, d) {
    return a + '-' + String(m).padStart(2,'0') + '-' + String(d).padStart(2,'0');
  }
  function ultimoDia(a, m) { return new Date(Date.UTC(a, m, 0)).getUTCDate(); }

  function somarMeses(data, n) {
    var p = partes(data);
    var total = p.a * 12 + (p.m - 1) + n;
    var a = Math.floor(total / 12), m = (total % 12) + 1;
    // 31/01 + 1 mês não é 31/02: cai no último dia de fevereiro. Sem isto o JS
    // empurraria para março, que é o tipo de surpresa que ninguém confere.
    return texto(a, m, Math.min(p.d, ultimoDia(a, m)));
  }
  function somarDias(data, n) {
    var p = partes(data);
    var t = new Date(Date.UTC(p.a, p.m - 1, p.d + n));
    return texto(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
  }

  function proximaTarefa(o) {
    o = o || {};
    var base = o.prazo || o.hoje;
    switch (o.recorrencia) {
      case 'semanal':    return { prazo: somarDias(base, 7) };
      case 'mensal':     return { prazo: somarMeses(base, 1) };
      case 'anual':      return { prazo: somarMeses(base, 12) };
      // Sem celebração futura cadastrada, a próxima nasce SEM prazo. Inventar uma data
      // seria pior: cobraria a pessoa por um dia que ninguém marcou.
      case 'celebracao': return { prazo: o.proximaCelebracao || null };
      default:           return null;
    }
  }

  var api = { proximaTarefa: proximaTarefa };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { global.proximaTarefa = proximaTarefa; }   // pelo NOME: senão a tela fica em branco
})(typeof globalThis !== 'undefined' ? globalThis : this);
