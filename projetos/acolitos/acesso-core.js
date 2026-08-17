// Quem vê a Caixa e quem vê a tela de Ausências. PURO (sem DOM, sem rede),
// no mesmo padrão de navegacao-core.js, alertas-core.js e kits-core.js.
(function (global) {
  'use strict';

  // A Caixa é onde se DECIDE (aprovar troca, candidatura, cobrir vaga, confirmar
  // aviso da página pública). Quem decide é admin ou quem recebeu a permissão.
  // A tela de Ausências é onde se CONSULTA e se REGISTRA — e aí entra o
  // cerimoniário, que registra ausência de outro mas não aprova nada.
  function podeVerTela(o) {
    o = o || {};
    var caps = o.caps || {};
    var perms = caps.perms || [];
    if (o.tela === 'caixa')     return !!caps.isAdmin || perms.indexOf('caixa') >= 0;
    if (o.tela === 'ausencias') return !!caps.isAdmin || !!caps.ehEquipe || !!caps.isCerimo;
    return false;
  }

  var api = { podeVerTela: podeVerTela };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { global.podeVerTela = podeVerTela; }   // pelo NOME: senão a tela fica em branco
})(typeof globalThis !== 'undefined' ? globalThis : this);
