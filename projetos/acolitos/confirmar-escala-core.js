// Quem ainda precisa ser avisado de que está escalado, e a poda do histórico.
// PURO (sem DOM, sem rede), no padrão de navegacao-core.js, kits-core.js e tarefas-core.js.
//
// A regra veio de uma decisão do dono, em 18/08/2026: NADA sai sozinho. Gerar a escala e
// editar uma missa não avisam ninguém — só o botão "Confirmar escala da semana" avisa, e ele
// alcança apenas quem ainda não foi avisado. Antes, a notificação saía no instante em que a
// escala era gerada, então um rascunho já ia para o celular de todo mundo.
(function (global) {
  'use strict';

  // Dado quem está escalado na semana e quem já recebeu aviso, devolve só os novos.
  // Sem duplicata: a mesma pessoa em duas missas da semana é UM aviso, não dois.
  function aNotificar(o) {
    o = o || {};
    var escalados = Array.isArray(o.escalados) ? o.escalados : [];
    var ja = {};
    (Array.isArray(o.jaAvisados) ? o.jaAvisados : []).forEach(function (id) { ja[id] = true; });
    var vistos = {}, saida = [];
    escalados.forEach(function (id) {
      if (!id || ja[id] || vistos[id]) return;
      vistos[id] = true; saida.push(id);
    });
    return saida;
  }

  // O histórico de avisados fica em acolitos_config (não há coluna no banco para isso e não
  // houve como aplicar migration). Sem poda ele cresceria para sempre, então guardamos por
  // chave de semana e descartamos as semanas velhas — passada a semana, o aviso não serve mais.
  function podarAvisados(o) {
    o = o || {};
    var mapa = (o.mapa && typeof o.mapa === 'object') ? o.mapa : {};
    var hoje = o.hoje;
    var dias = (typeof o.dias === 'number' && o.dias > 0) ? o.dias : 60;
    if (!ehData(hoje)) return { ...mapa };   // sem data confiável, não descarta nada
    var saida = {};
    Object.keys(mapa).forEach(function (chave) {
      // a chave é a data do domingo daquela semana, em AAAA-MM-DD
      if (!ehData(chave)) return;            // chave estranha é descartada
      if (diasEntre(chave, hoje) <= dias) saida[chave] = mapa[chave];
    });
    return saida;
  }

  function ehData(d) {
    if (!d || typeof d !== 'string') return false;
    var p = d.split('-');
    if (p.length !== 3) return false;
    var a = +p[0], m = +p[1], x = +p[2];
    return !isNaN(a) && !isNaN(m) && !isNaN(x) && a > 1 && m >= 1 && m <= 12 && x >= 1 && x <= 31;
  }
  function diasEntre(de, ate) {
    var a = de.split('-'), b = ate.split('-');
    var d1 = Date.UTC(+a[0], +a[1] - 1, +a[2]), d2 = Date.UTC(+b[0], +b[1] - 1, +b[2]);
    return Math.round((d2 - d1) / 86400000);
  }

  var api = { aNotificar: aNotificar, podarAvisados: podarAvisados };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { global.aNotificar = aNotificar; global.podarAvisados = podarAvisados; }  // pelo NOME
})(typeof globalThis !== 'undefined' ? globalThis : this);
