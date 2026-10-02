// "?" na matriz: quem já devia estar apto numa função e ainda não está.
//
// PEDIDO DO DONO (01/10/2026): marcar com interrogação os quadradinhos de quem está há um
// certo tempo na pastoral e ainda não é apto na função que, pelo tempo, já deveria ser.
//
// A RÉGUA SAI DOS PARES, NÃO DE UMA TABELA ESCRITA POR MIM: o sistema não guarda "em que mês
// cada nível deveria dominar cada função" (a pastoral nunca escreveu isso). O que existe é o
// que o grupo REALMENTE faz. Então: uma função é esperada de alguém quando a MAIORIA dos que
// estão no mesmo nível já é apta nela. Se 88% dos Guardiões já fazem naveta e você não, o "?"
// vai no seu quadradinho. Se a coordenação escrever uma tabela oficial um dia, é só trocar
// `funcoesEsperadas`; o resto (a marca, a legenda, os testes) continua igual.
//
// TEMPO NA PASTORAL: não há data de ingresso no banco. O melhor que existe é `created_at`
// (para quem veio da planilha, é o dia da importação, ou seja, o MÍNIMO possível de tempo).
// Por isso a conta erra para o lado de NÃO marcar: quem é novo de verdade não leva "?".
(function (global) {
  'use strict';

  var APTOS = ['apto', 'experiente', 'referencia'];
  var CORTE_DOS_PARES = 0.7;   // fração do nível que já é apta para a função virar "esperada"
  var MIN_PARES = 5;           // nível com menos gente que isto não vira régua (3 pessoas não são "maioria")
  var MIN_DIAS = 60;           // menos que isto na pastoral: ainda está aprendendo, sem "?"

  function _dias(deISO, ateISO) {
    return Math.round((Date.parse(ateISO + 'T00:00:00Z') - Date.parse(deISO + 'T00:00:00Z')) / 86400000);
  }

  function ehApto(prof) { return APTOS.indexOf(prof) >= 0; }

  // { nivel: [funcao, ...] } — as funções que a maioria daquele nível já domina.
  function funcoesEsperadas(membros, habPorMembro, funcoes, opts) {
    opts = opts || {};
    var corte = opts.corte == null ? CORTE_DOS_PARES : opts.corte;
    var minPares = opts.minPares == null ? MIN_PARES : opts.minPares;
    var porNivel = {};
    (membros || []).forEach(function (m) {
      var n = m.nivel || 'aspirante';
      (porNivel[n] = porNivel[n] || []).push(m);
    });
    var res = {};
    Object.keys(porNivel).forEach(function (nivel) {
      var grupo = porNivel[nivel];
      res[nivel] = [];
      if (grupo.length < minPares) return;
      (funcoes || []).forEach(function (f) {
        var aptos = grupo.filter(function (m) { return ehApto((habPorMembro[m.id] || {})[f]); }).length;
        if (aptos / grupo.length >= corte) res[nivel].push(f);
      });
    });
    return res;
  }

  // { membroId: { funcao: { pares: 0.88 } } } só para quem está ATRASADO.
  function atrasos(opts) {
    opts = opts || {};
    var membros = opts.membros || [], hab = opts.hab || {}, hoje = opts.hoje;
    var minDias = opts.minDias == null ? MIN_DIAS : opts.minDias;
    var esperadas = funcoesEsperadas(membros, hab, opts.funcoes, opts);
    var total = {};
    membros.forEach(function (m) { var n = m.nivel || 'aspirante'; total[n] = (total[n] || 0) + 1; });
    var res = {};
    membros.forEach(function (m) {
      var desde = m.created_at ? String(m.created_at).slice(0, 10) : null;
      // Sem data não dá para afirmar que passou tempo: não marca (nunca acusar sem prova).
      if (!desde || !hoje || _dias(desde, hoje) < minDias) return;
      var n = m.nivel || 'aspirante';
      (esperadas[n] || []).forEach(function (f) {
        if (ehApto((hab[m.id] || {})[f])) return;
        var aptos = membros.filter(function (o) { return (o.nivel || 'aspirante') === n && ehApto((hab[o.id] || {})[f]); }).length;
        (res[m.id] = res[m.id] || {})[f] = { pares: aptos / total[n] };
      });
    });
    return res;
  }

  function resumo(atr) {
    var pessoas = 0, marcas = 0;
    Object.keys(atr || {}).forEach(function (id) { pessoas++; marcas += Object.keys(atr[id]).length; });
    return { pessoas: pessoas, marcas: marcas };
  }

  var api = { atrasos: atrasos, funcoesEsperadas: funcoesEsperadas, resumo: resumo, ehApto: ehApto,
              CORTE_DOS_PARES: CORTE_DOS_PARES, MIN_PARES: MIN_PARES, MIN_DIAS: MIN_DIAS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { global.AtrasoFuncao = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this);
