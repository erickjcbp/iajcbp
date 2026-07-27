// Montagem da barra de navegação — QUEM aparece e em QUE ordem. PURO (sem DOM, sem rede).
// Usado por shared.js (renderBottomNav) e testável em node, igual solicitacoes-core.js.
// Os ids são contrato: estão gravados em acolitos_config.nav_ordem_coord/nav_ordem_jornada.
// Pode acrescentar id novo; NUNCA renomear id existente.
(function (global) {
  'use strict';

  // Chamada foi fundida na Escala: o cerimoniário faz a chamada pelo botão no card de escala.
  var ITENS_JORNADA = [
    { id:'home',            href:'index.html',           label:'Início',     icon:'home' },
    { id:'quests',          href:'missoes.html',         label:'Quests',     icon:'star' },
    { id:'escalas-membro',  href:'escalas-membro.html',  label:'Escalas',    icon:'calendar' },
    { id:'agenda',          href:'agenda.html',          label:'Agenda',     icon:'calendar-days' },
    { id:'conquistas',      href:'conquistas.html',      label:'Conquistas', icon:'award' },
    { id:'destaques',       href:'destaques.html',       label:'Destaques',  icon:'star' },
    { id:'minha-casa',      href:'minha-casa.html',      label:'Casa',       icon:'shield' },
    // id 'ausencias' é contrato com nav_ordem_jornada — só o rótulo muda.
    // "Faltar" diz o que a tela faz pro membro; pra equipe a mesma tela é a Caixa.
    { id:'ausencias',       href:'ausencias.html',       label:'Faltar',     icon:'x-circle' },
  ];

  var ITENS_COORD_FIXOS = [
    { id:'home',   href:'index.html',  label:'Início', icon:'home' },
    { id:'agenda', href:'agenda.html', label:'Agenda', icon:'calendar-days' },
  ];

  function montarItensNav(opts) {
    opts = opts || {};
    var itens;

    if (opts.modo === 'coordenacao') {
      itens = ITENS_COORD_FIXOS.map(function (x) { return Object.assign({}, x); });
      (opts.ordemModulos || []).forEach(function (chave) {
        if ((opts.perms || []).indexOf(chave) === -1) return;
        var mod = (opts.modulos || {})[chave];
        if (!mod) return;
        itens.push({ id: chave, href: mod.href, label: mod.label, icon: mod.icon });
      });
      if (opts.isSuperadmin) {
        itens.push({ id:'config', href:'config.html', label:'Config', icon:'settings' });
      }
    } else {
      itens = ITENS_JORNADA.map(function (x) { return Object.assign({}, x); });
    }

    // Ordem customizável (Config › Navegação).
    // A ordem salva no banco é ANTERIOR a qualquer item novo, então ela nunca conhece
    // o recém-chegado. Mandá-lo pro fim (o que se fazia antes) esconde item novo atrás
    // da seta ›: a mudança que vem pra revelar uma tela a entregaria escondida.
    // Por isso o desconhecido herda a posição que tem na ordem padrão do código —
    // entra logo depois do vizinho que o antecede lá.
    return ordenarPorConfig(itens, opts.ordemCfg);
  }

  function ordenarPorConfig(itens, ord) {
    if (!Array.isArray(ord) || !ord.length) return itens;
    var padrao = itens.map(function (x) { return x.id; });          // ordem padrão do código
    var finalIds = ord.filter(function (id) { return padrao.indexOf(id) >= 0; }); // ignora id que já não existe

    padrao.forEach(function (id, i) {
      if (finalIds.indexOf(id) >= 0) return;                        // já posicionado pela ordem salva
      var pos = finalIds.length;                                    // sem vizinho anterior → fim
      for (var j = i - 1; j >= 0; j--) {
        var at = finalIds.indexOf(padrao[j]);
        if (at >= 0) { pos = at + 1; break; }                       // logo depois do vizinho anterior
      }
      finalIds.splice(pos, 0, id);
    });

    return finalIds.map(function (id) {
      return itens.filter(function (x) { return x.id === id; })[0];
    }).filter(Boolean);
  }

  var api = { montarItensNav: montarItensNav };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { global.montarItensNav = montarItensNav; }
})(typeof globalThis !== 'undefined' ? globalThis : this);
