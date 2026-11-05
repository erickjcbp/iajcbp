// Progresso até o próximo nível, para a barra da Home.
//
// A barra espelhava só os capítulos FECHADOS (fez/tot): ficava em 0% para quase todo mundo até terminar
// um capítulo inteiro, e a pessoa via "sempre vazia" mesmo tendo avançado. Agora cada capítulo fechado
// vale 1 e o capítulo em andamento (o primeiro não fechado) soma a fração das missões OBRIGATÓRIAS já
// feitas, com crédito proporcional para missão de contagem (atual/alvo) que ainda não fechou.
//
// Só olha o capítulo em andamento porque o board mostra, nos capítulos seguintes, apenas parte das
// missões pendentes — somar o que aparece lá inflaria a barra. O denominador é sempre o nº de capítulos.
//
// PURO (sem DOM, sem rede), UMD: roda em `node --test` como o navegacao-core.js.
(function (global) {
  'use strict';

  function fracaoMissao(m) {
    if (!m || m.obrigatoria === false) return null;                      // opcional não entra na conta
    if (m.status === 'concluida') return 1;
    var atual = Number(m.atual), alvo = Number(m.alvo);
    if (isFinite(atual) && isFinite(alvo) && alvo > 0 && atual > 0) return Math.min(atual / alvo, 0.99);   // parcial nunca "fecha" sozinho
    return 0;
  }

  function progressoProximoNivel(capitulos) {
    var caps = Array.isArray(capitulos) ? capitulos.filter(Boolean) : [];
    var r = { pct: 0, capitulosFeitos: 0, capitulosTotal: caps.length, missoesFeitas: 0, missoesTotal: 0 };
    if (!caps.length) return r;
    var soma = 0, andamento = null;
    caps.forEach(function (c) {
      if (c.completo) { r.capitulosFeitos++; soma += 1; return; }
      if (andamento === null) andamento = c;                              // o primeiro não fechado
    });
    if (andamento) {
      var fr = (Array.isArray(andamento.missoes) ? andamento.missoes : []).map(fracaoMissao).filter(function (x) { return x !== null; });
      r.missoesTotal = fr.length;
      r.missoesFeitas = fr.filter(function (x) { return x === 1; }).length;
      if (fr.length) soma += fr.reduce(function (a, b) { return a + b; }, 0) / fr.length;
    }
    r.pct = Math.max(0, Math.min(100, Math.round(100 * soma / caps.length)));
    return r;
  }

  var api = { progressoProximoNivel: progressoProximoNivel };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.progressoProximoNivel = progressoProximoNivel;
})(typeof globalThis !== 'undefined' ? globalThis : this);
