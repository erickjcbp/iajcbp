// Montagem da barra de navegação — QUEM aparece e em QUE ordem. PURO (sem DOM, sem rede).
// Usado por shared.js (renderBottomNav) e testável em node, igual solicitacoes-core.js.
// Os ids são contrato: estão gravados em acolitos_config.nav_ordem_coord/nav_ordem_jornada.
// Pode acrescentar id novo; NUNCA renomear id existente.
(function (global) {
  'use strict';

  var ITENS_JORNADA = [
    { id:'home',            href:'index.html',           label:'Início',    icon:'home' },
    { id:'quests',          href:'missoes.html',         label:'Quests',    icon:'star' },
    { id:'escalas-membro',  href:'escalas-membro.html',  label:'Escalas',   icon:'calendar' },
    { id:'agenda',          href:'agenda.html',          label:'Agenda',    icon:'calendar-days' },
    { id:'destaques',       href:'destaques.html',       label:'Destaques', icon:'star' },
    { id:'minha-casa',      href:'minha-casa.html',      label:'Casa',      icon:'shield' },
    { id:'ausencias',       href:'ausencias.html',       label:'Ausência',  icon:'x-circle' },
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

    // Ordem customizável (Config › Navegação). Quem não está na lista vai pro fim.
    var ord = opts.ordemCfg;
    if (Array.isArray(ord) && ord.length) {
      itens.sort(function (a, b) {
        var ia = ord.indexOf(a.id), ib = ord.indexOf(b.id);
        return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
      });
    }
    return itens;
  }

  var api = { montarItensNav: montarItensNav };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { global.montarItensNav = montarItensNav; }
})(typeof globalThis !== 'undefined' ? globalThis : this);
