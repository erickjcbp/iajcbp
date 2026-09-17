// Ordenar e filtrar listas: a REGRA, sem tela.
//
// Pedido do dono em 16/09/2026: "na aba Membros não consigo ver quem entrou por último".
// Nenhuma lista do app deixava escolher a ordem. Seis telas vão dividir esta regra, e a
// barra que a desenha mora no shared.js (montarFiltroLista).
//
// Três regras que parecem detalhe e não são:
//   · mesmo filtro com duas opções SOMA (Matriz OU Santo Antônio); filtros diferentes
//     COMBINAM (Matriz E sem foto);
//   · vazio vai para o FIM, também na ordem decrescente — senão "mais recentes" abriria
//     com quem não tem data;
//   · empate desempata pelo nome. 156 dos 177 membros têm a mesma data de cadastro.
//
// Exposta como UM objeto (FiltroLista), não função por função: este app já quebrou por
// nome global repetido entre telas.
(function (global) {
  'use strict';

  function normalizar(s) {
    return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  }
  function vazio(v) { return v == null || v === ''; }

  function acharOrdem(config, id) {
    var os = (config && config.ordens) || [];
    for (var i = 0; i < os.length; i++) if (os[i].id === id) return os[i];
    return null;
  }
  function acharFiltro(config, id) {
    var fs = (config && config.filtros) || [];
    for (var i = 0; i < fs.length; i++) if (fs[i].id === id) return fs[i];
    return null;
  }
  function acharOpcao(filtro, id) {
    var os = (filtro && filtro.opcoes) || [];
    for (var i = 0; i < os.length; i++) if (os[i].id === id) return os[i];
    return null;
  }
  function copia(estado, mudar) {
    var e = { ordem: estado.ordem, ligados: estado.ligados.slice(), busca: estado.busca };
    for (var k in mudar) e[k] = mudar[k];
    return e;
  }

  function estadoInicial(config) {
    return { ordem: config.ordemPadrao, ligados: [], busca: '' };
  }

  function escolherOrdem(estado, config, ordemId) {
    if (!acharOrdem(config, ordemId)) return estado;
    return copia(estado, { ordem: ordemId });
  }

  function estaLigado(estado, filtroId, opcaoId) {
    return estado.ligados.some(function (l) { return l.f === filtroId && l.o === opcaoId; });
  }

  function alternar(estado, config, filtroId, opcaoId) {
    var f = acharFiltro(config, filtroId);
    if (!acharOpcao(f, opcaoId)) return estado;
    var jaLigado = estaLigado(estado, filtroId, opcaoId);
    // Filtro de escolha ÚNICA (ex.: período): ligar uma opção desliga as outras dele.
    var base = (f.unico && !jaLigado)
      ? estado.ligados.filter(function (l) { return l.f !== filtroId; })
      : estado.ligados;
    var ligados = jaLigado
      ? base.filter(function (l) { return !(l.f === filtroId && l.o === opcaoId); })
      : base.concat([{ f: filtroId, o: opcaoId }]);
    return copia(estado, { ligados: ligados });
  }

  function definirBusca(estado, texto) {
    return copia(estado, { busca: String(texto == null ? '' : texto) });
  }

  function limpar(estado) { return copia(estado, { ligados: [] }); }

  function contar(estado) { return estado.ligados.length; }

  function passa(item, estado, config) {
    var porFiltro = {};
    estado.ligados.forEach(function (l) { (porFiltro[l.f] = porFiltro[l.f] || []).push(l.o); });
    for (var fid in porFiltro) {
      var f = acharFiltro(config, fid);
      if (!f) continue;
      var algum = porFiltro[fid].some(function (oid) {
        var o = acharOpcao(f, oid);
        return !!(o && o.testa(item));
      });
      if (!algum) return false;
    }
    var termo = normalizar(estado.busca);
    if (termo && config.busca) {
      var campos = config.busca.campos(item) || [];
      var achou = campos.some(function (c) { return normalizar(c).indexOf(termo) >= 0; });
      if (!achou) return false;
    }
    return true;
  }

  function comparar(a, b) {
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    return String(a).localeCompare(String(b), 'pt-BR', { sensitivity: 'base' });
  }

  function aplicar(lista, estado, config) {
    var ordem = acharOrdem(config, estado.ordem) || acharOrdem(config, config.ordemPadrao);
    var desempate = config.desempate || function (i) { return i && i.nome; };
    var marcados = (lista || [])
      .filter(function (item) { return passa(item, estado, config); })
      .map(function (item, pos) { return { item: item, pos: pos, v: ordem ? ordem.valor(item) : null }; });
    marcados.sort(function (x, y) {
      var xv = vazio(x.v), yv = vazio(y.v);
      if (xv !== yv) return xv ? 1 : -1;
      if (!xv) {
        var c = comparar(x.v, y.v);
        if (c !== 0) return (ordem && ordem.desc) ? -c : c;
      }
      var dx = desempate(x.item), dy = desempate(y.item);
      var d = (vazio(dx) || vazio(dy)) ? 0 : comparar(dx, dy);
      return d !== 0 ? d : x.pos - y.pos;
    });
    return marcados.map(function (m) { return m.item; });
  }

  function etiquetas(estado, config) {
    var out = [];
    estado.ligados.forEach(function (l) {
      var o = acharOpcao(acharFiltro(config, l.f), l.o);
      if (o) out.push({ f: l.f, o: l.o, texto: o.nome });
    });
    return out;
  }

  function nomeDaOrdem(estado, config) {
    var o = acharOrdem(config, estado.ordem);
    return o ? o.nome : '';
  }

  function legenda(item, estado, config) {
    var o = acharOrdem(config, estado.ordem);
    return (o && o.legenda) ? (o.legenda(item) || '') : '';
  }

  function guardar(estado) {
    return JSON.stringify({ v: 1, ordem: estado.ordem, ligados: estado.ligados, busca: estado.busca });
  }

  function restaurar(texto, config) {
    var base = estadoInicial(config);
    var dado;
    try { dado = JSON.parse(texto); } catch (e) { return base; }
    if (!dado || typeof dado !== 'object' || Array.isArray(dado)) return base;
    var ordem = acharOrdem(config, dado.ordem) ? dado.ordem : base.ordem;
    var ligados = [];
    (Array.isArray(dado.ligados) ? dado.ligados : []).forEach(function (l) {
      if (!l) return;
      var f = acharFiltro(config, l.f);
      if (!acharOpcao(f, l.o)) return;
      var repetido = ligados.some(function (x) {
        return x.f === l.f && (f.unico || x.o === l.o);
      });
      if (!repetido) ligados.push({ f: l.f, o: l.o });
    });
    var busca = typeof dado.busca === 'string' ? dado.busca : '';
    return { ordem: ordem, ligados: ligados, busca: busca };
  }

  function escolhidos(estado, filtroId) {
    return estado.ligados.filter(function (l) { return l.f === filtroId; }).map(function (l) { return l.o; });
  }

  // Períodos das listas que filtram por data da missa. `hoje` vem de fora ('YYYY-MM-DD',
  // no fuso local) para a conta poder ser provada com uma data fixa.
  function intervaloDoPeriodo(periodoId, hoje) {
    var p = String(hoje || '').split('-').map(Number);
    var y = p[0], m = p[1], d = p[2];
    function ymd(Y, M, D) { return Y + '-' + String(M).padStart(2, '0') + '-' + String(D).padStart(2, '0'); }
    function ultimoDia(Y, M) { return new Date(Y, M, 0).getDate(); }
    if (!y || !m || !d) return { desde: null, ate: null };
    if (periodoId === 'proximas') return { desde: ymd(y, m, d), ate: null };
    if (periodoId === 'este_mes') return { desde: ymd(y, m, 1), ate: ymd(y, m, ultimoDia(y, m)) };
    if (periodoId === 'mes_passado') {
      var Y = m === 1 ? y - 1 : y, M = m === 1 ? 12 : m - 1;
      return { desde: ymd(Y, M, 1), ate: ymd(Y, M, ultimoDia(Y, M)) };
    }
    if (periodoId === 'ultimos_90') {
      var ini = new Date(y, m - 1, d - 90);
      return { desde: ymd(ini.getFullYear(), ini.getMonth() + 1, ini.getDate()), ate: ymd(y, m, d) };
    }
    return { desde: null, ate: null };
  }

  var api = {
    estadoInicial: estadoInicial,
    escolherOrdem: escolherOrdem,
    alternar: alternar,
    estaLigado: estaLigado,
    definirBusca: definirBusca,
    limpar: limpar,
    contar: contar,
    aplicar: aplicar,
    etiquetas: etiquetas,
    nomeDaOrdem: nomeDaOrdem,
    legenda: legenda,
    guardar: guardar,
    restaurar: restaurar,
    escolhidos: escolhidos,
    intervaloDoPeriodo: intervaloDoPeriodo,
    normalizar: normalizar,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.FiltroLista = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
