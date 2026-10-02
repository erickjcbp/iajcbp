// Regras PURAS da aba RETIROS — o que a tela mostra de cada área: andamento do plano,
// lista de compras, cotações e a conciliação com a Tesouraria. Sem DOM, sem rede, no mesmo
// padrão de projeto-core.js e tarefas-core.js.
//
// `hoje` entra por parâmetro (AAAA-MM-DD): regra de data que lê o relógio por dentro não se prova.
//
// ⚠️ A CONTA QUE MAIS ENGANA É A DO CAIXA. Uma compra "comprada" tem de ter um lançamento de
// saída na Tesouraria (ligado por `retiro_compra_id`). Se alguém apaga o lançamento direto na
// Tesouraria, a compra continua "comprada" e o saldo da área fica mais bonito do que a
// realidade — sem erro nenhum. Por isso `conciliar` separa o que bate do que não bate, em vez
// de só somar.
(function (global) {
  'use strict';

  var SECOES = [
    ['cronograma', 'Cronograma'], ['pregacao', 'Pregações'], ['dinamica', 'Dinâmicas'],
    ['gincana', 'Gincanas'], ['refeicao', 'Refeições'],
  ];
  var CATEGORIAS_COMPRA = [
    ['ingredientes', 'Ingredientes'], ['decoracao', 'Decoração'], ['lembrancas', 'Lembranças'],
    ['papelaria', 'Papelaria'], ['higiene', 'Higiene'], ['limpeza', 'Limpeza'], ['outro', 'Outros'],
  ];
  var REFEICOES = [['cafe', 'Café da manhã'], ['almoco', 'Almoço'], ['lanche', 'Lanche'], ['janta', 'Janta']];

  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function arred(v) { return Math.round(num(v) * 100) / 100; }
  function ehData(v) { return /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')); }

  // Item do plano ou compra com prazo vencido e ainda não resolvido.
  function atrasado(x, hoje) {
    if (!x || !ehData(x.prazo) || !ehData(hoje)) return false;
    var resolvido = x.status === 'feito' || x.status === 'comprada';
    return !resolvido && String(x.prazo) < String(hoje);
  }

  // Cronograma: dia, depois hora; sem data vai para o fim; sem hora vem antes das com hora.
  function ordenarPlano(itens) {
    return (itens || []).slice().sort(function (a, b) {
      var da = a.data || '9999-12-31', db = b.data || '9999-12-31';
      if (da !== db) return da < db ? -1 : 1;
      var ha = a.hora || '', hb = b.hora || '';
      if (ha !== hb) return ha < hb ? -1 : 1;
      return String(a.titulo || '').localeCompare(String(b.titulo || ''), 'pt-BR');
    });
  }

  // Total de uma cotação para a quantidade da compra.
  function totalDaCotacao(cot, quantidade) { return arred(num(cot && cot.valor_unitario) * num(quantidade)); }

  // A mais barata (empate: a primeira). Cotação vencida não entra, se `hoje` for dado.
  function melhorCotacao(cotacoes, hoje) {
    var vivas = (cotacoes || []).filter(function (c) {
      return !(ehData(hoje) && ehData(c.validade) && String(c.validade) < String(hoje));
    });
    var melhor = null;
    vivas.forEach(function (c) { if (!melhor || num(c.valor_unitario) < num(melhor.valor_unitario)) melhor = c; });
    return melhor;
  }

  // Quanto se economiza escolhendo a mais barata contra a mais cara. null = não há o que comparar.
  function economia(cotacoes, quantidade) {
    var v = (cotacoes || []).map(function (c) { return num(c.valor_unitario); });
    if (v.length < 2) return null;
    return arred((Math.max.apply(null, v) - Math.min.apply(null, v)) * num(quantidade));
  }

  // O que vale para a compra no orçamento: o pago, se já comprou; senão o estimado; senão 0.
  function valorDaCompra(c) {
    if (!c) return 0;
    if (c.status === 'comprada' && c.valor_pago != null) return arred(c.valor_pago);
    return arred(c.valor_estimado);
  }

  // Conciliação com a Tesouraria. `lancs` = linhas de acolitos_financeiro DESTA área.
  function conciliar(compras, lancs) {
    var porCompra = {};
    (lancs || []).forEach(function (l) { if (l.retiro_compra_id) porCompra[l.retiro_compra_id] = l; });
    var semLancamento = [], divergentes = [];
    (compras || []).forEach(function (c) {
      if (c.status !== 'comprada') return;
      var l = porCompra[c.id];
      if (!l) semLancamento.push(c);
      else if (arred(l.valor) !== arred(c.valor_pago)) divergentes.push({ compra: c, lancamento: l });
    });
    var entradas = 0, saidas = 0, doacoes = 0, vendas = 0;
    (lancs || []).forEach(function (l) {
      var v = num(l.valor);
      if (l.tipo === 'entrada') {
        entradas += v;
        // 'venda_item'/'doacao' são as categorias da Tesouraria (087); 'rifa'/'dizimo' são as
        // antigas e continuam valendo. O resto (mensalidade, evento...) é só entrada.
        if (l.categoria === 'venda_item' || l.categoria === 'rifa') vendas += v;
        else if (l.categoria === 'doacao' || l.categoria === 'dizimo') doacoes += v;
      } else saidas += v;
    });
    return {
      entradas: arred(entradas), saidas: arred(saidas), saldo: arred(entradas - saidas),
      doacoes: arred(doacoes), vendas: arred(vendas),
      semLancamento: semLancamento, divergentes: divergentes,
      bate: !semLancamento.length && !divergentes.length,
    };
  }

  // O retrato da área para o cartão e para o topo da tela.
  function resumoDaArea(o, hoje) {
    o = o || {};
    var itens = o.itens || [], compras = o.compras || [], lancs = o.lancamentos || [];
    var feitos = itens.filter(function (i) { return i.status === 'feito'; }).length;
    var comprasFeitas = compras.filter(function (c) { return c.status === 'comprada'; }).length;
    var atrasados = itens.filter(function (i) { return atrasado(i, hoje); }).length +
                    compras.filter(function (c) { return atrasado(c, hoje); }).length;
    var orcamento = 0, pago = 0, semValor = 0;
    compras.forEach(function (c) {
      orcamento += valorDaCompra(c);
      if (c.status === 'comprada') pago += num(c.valor_pago);
      else if (c.valor_estimado == null) semValor++;
    });
    var tarefas = itens.length + compras.length;
    var resolvidas = feitos + comprasFeitas;
    var conc = conciliar(compras, lancs);
    return {
      itens: itens.length, feitos: feitos,
      compras: compras.length, comprasFeitas: comprasFeitas,
      atrasados: atrasados,
      orcamento: arred(orcamento), pago: arred(pago), comprasSemValor: semValor,
      percentual: tarefas ? Math.round((resolvidas / tarefas) * 100) : null,
      caixa: conc,
    };
  }

  // WhatsApp: só dígitos; 10-11 dígitos = número brasileiro sem país (entra o 55).
  function soDigitos(v) { return String(v == null ? '' : v).replace(/\D/g, ''); }
  function digitosWhatsapp(v) {
    var d = soDigitos(v);
    if (d.length === 10 || d.length === 11) return '55' + d;
    return d;
  }
  // Número válido = 10 ou 11 dígitos (DDD + número), com ou sem o 55 na frente.
  function whatsappValido(v) {
    var d = soDigitos(v);
    if (d.length === 12 || d.length === 13) return d.indexOf('55') === 0;
    return d.length === 10 || d.length === 11;
  }
  function linkWhatsapp(v) { return whatsappValido(v) ? 'https://wa.me/' + digitosWhatsapp(v) : null; }
  // Mostra (19) 99907-1702; o que não for número brasileiro conhecido volta como veio.
  function mostrarWhatsapp(v) {
    var d = soDigitos(v);
    if (d.length === 12 || d.length === 13) { if (d.indexOf('55') === 0) d = d.slice(2); else return String(v); }
    if (d.length === 11) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
    if (d.length === 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
    return String(v == null ? '' : v);
  }
  // Link de grupo: só os endereços do WhatsApp (nada de javascript:, nada de site qualquer).
  function grupoWhatsappValido(u) {
    return /^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9_-]{8,}\/?(\?.*)?$/.test(String(u || '').trim());
  }

  var api = {
    soDigitos: soDigitos, digitosWhatsapp: digitosWhatsapp, whatsappValido: whatsappValido,
    linkWhatsapp: linkWhatsapp, mostrarWhatsapp: mostrarWhatsapp, grupoWhatsappValido: grupoWhatsappValido,
    SECOES: SECOES, CATEGORIAS_COMPRA: CATEGORIAS_COMPRA, REFEICOES: REFEICOES,
    atrasado: atrasado, ordenarPlano: ordenarPlano, totalDaCotacao: totalDaCotacao,
    melhorCotacao: melhorCotacao, economia: economia, valorDaCompra: valorDaCompra,
    conciliar: conciliar, resumoDaArea: resumoDaArea,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { global.RetirosCore = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this);
