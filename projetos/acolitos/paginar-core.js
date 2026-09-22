// Leitor PAGINADO do banco. PURO (sem DOM, sem rede), igual navegacao-core.js e kits-core.js.
//
// Por que existe: o Supabase devolve NO MÁXIMO 1000 linhas por pergunta, responde HTTP 200
// e NÃO avisa que cortou. Pedir `.limit(5000)` não vence esse teto — o servidor manda mil e
// pronto. Medido em 22/09/2026: a tela Início desenhava 68 escalas de setembro quando eram
// 302, porque o corte come justamente as linhas mais recentes.
//
// A regra de ouro daqui: **falha nunca vira lista curta**. Trocar um corte silencioso por
// outro seria não ter consertado nada — por isso um erro no meio joga fora o que já veio e
// devolve o erro, e parar no teto de segurança levanta a bandeira `truncado`.
(function (global) {
  'use strict';

  var PAGINA_PADRAO = 1000;   // o teto do próprio PostgREST
  var MAXIMO_PADRAO = 50000;  // trava contra laço infinito se o banco responder torto

  // montarQuery: função SEM argumentos que devolve uma consulta nova a cada chamada.
  // Tem de ser função, e não a consulta pronta: a consulta do supabase-js é de uso único,
  // e reaproveitá-la traria a mesma página para sempre.
  // Devolve { data, error, truncado } — o mesmo formato do supabase-js, para poder
  // substituir a leitura antiga sem mudar quem já confere o `error`.
  async function lerTudo(montarQuery, opcoes) {
    opcoes = opcoes || {};
    var pagina = opcoes.pagina || PAGINA_PADRAO;
    var maximo = opcoes.maximo || MAXIMO_PADRAO;
    var tudo = [];
    for (var de = 0; de < maximo; de += pagina) {
      var pedir = Math.min(pagina, maximo - de);
      var r = await montarQuery().range(de, de + pedir - 1);
      if (r && r.error) return { data: null, error: r.error, truncado: false };
      var lote = (r && r.data) || [];
      tudo = tudo.concat(lote);
      if (lote.length < pedir) return { data: tudo, error: null, truncado: false };
    }
    // Chegou ao teto de segurança com o banco ainda tendo o que dar: a lista está CURTA e
    // quem chamou precisa saber, senão é o defeito de novo com outra roupa.
    return { data: tudo, error: null, truncado: true };
  }

  var api = { lerTudo: lerTudo, PAGINA_PADRAO: PAGINA_PADRAO };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { global.lerTudo = lerTudo; global.PAGINA_PADRAO = PAGINA_PADRAO; }
})(typeof globalThis !== 'undefined' ? globalThis : this);
