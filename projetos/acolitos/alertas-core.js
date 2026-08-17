// Regra dos alertas de frequência do Início — QUEM alerta, em que ORDEM, e o que foi
// dispensado. PURO (sem DOM, sem rede), igual navegacao-core.js e solicitacoes-core.js.
(function (global) {
  'use strict';

  // Quantas convocações a pessoa já teve (servidas + faltas). É o denominador da taxa.
  function realizadasDe(f) {
    return (f.servidas || 0) + (f.faltas_just || 0) + (f.faltas_nao_just || 0);
  }

  var DIAS_DISPENSA = 90;
  var MS_DIA = 86400000;

  // A dispensa é um "já vi isso" — vale para AQUELE quadro, não para sempre.
  // Vence em 90 dias; e cai na hora se a frequência piorou, porque aí o alerta é outro.
  function estaDispensado(disp, taxaAgora, agora) {
    if (!disp) return false;
    if (agora - disp.ts > DIAS_DISPENSA * MS_DIA) return false;
    if (taxaAgora < disp.taxa) return false;
    return true;
  }

  function montarAlertas(opts) {
    opts = opts || {};
    var nomePor = {};
    (opts.membros || []).forEach(function (m) { nomePor[m.id] = m.apelido || m.nome; });
    var dispensas = opts.dispensas || {};
    var agora = opts.agora || Date.now();

    return (opts.freq || []).filter(function (f) {
      // Regra herdada do Início: só vira alerta com histórico suficiente e taxa apurada.
      if (realizadasDe(f) < 3) return false;
      if (f.taxa == null || f.taxa >= 60) return false;
      // Sem nome = pessoa fora da lista de ativos; alertar seria acusar um fantasma.
      if (!nomePor[f.membro_id]) return false;
      return !estaDispensado(dispensas[f.membro_id], f.taxa, agora);
    }).map(function (f) {
      return {
        membroId: f.membro_id,
        nome: nomePor[f.membro_id],
        taxa: f.taxa,
        realizadas: realizadasDe(f),
      };
    }).sort(function (a, b) {
      // Pior primeiro: é o que a coordenação precisa ver quando só cabem 6 na tela.
      return a.taxa - b.taxa || a.nome.localeCompare(b.nome, 'pt', { sensitivity: 'base' });
    });
  }

  var api = { montarAlertas: montarAlertas, estaDispensado: estaDispensado };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { global.montarAlertas = montarAlertas; }   // mesmo contrato de navegacao-core.js
})(typeof globalThis !== 'undefined' ? globalThis : this);
