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
    // O item 'Faltar' SAIU daqui em 17/08: avisar ausência virou um botão dentro das
    // Escalas do membro. A ordem salva em acolitos_config.nav_ordem_jornada ainda cita o
    // id 'ausencias' em quem já usava o app; ordenarPorConfig ignora id que não existe
    // mais (linha 58), então a barra dessas pessoas não quebra.
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

  // ── Quem alcança o modo Coordenação ───────────────────────────────────────
  // Antes isto exigia `eh_equipe`, que só 4 dos 176 têm — e a permissão de módulo ficava
  // marcável e INERTE. Incoerente com o resto: o initModulo (shared.js) já libera a PÁGINA
  // só pela permissão, então liberar um módulo para quem não é da equipe abria a tela e
  // escondia o botão. A pessoa entrava digitando o endereço e não achava o caminho de volta.
  // Agora a permissão vale nos dois lugares.
  function temAcessoCoordenacao(opts) {
    if (opts.ehEquipe) return true;
    var mods = opts.ordemModulos || [];
    var perms = Array.isArray(opts.perms) ? opts.perms : [];
    // Só conta permissão que corresponde a um módulo de verdade: cadastro antigo pode ter
    // chave que não existe mais, e isso não pode virar passe para a coordenação.
    for (var i = 0; i < perms.length; i++) {
      if (mods.indexOf(perms[i]) >= 0) return true;
    }
    return false;
  }

  // 'jornada' | 'coordenacao'. `salvo` é a escolha da pessoa (localStorage 'nav-mode').
  function modoDaBarra(opts) {
    opts = opts || {};
    if (!temAcessoCoordenacao(opts)) return 'jornada';
    // Quem não serve na escala não tem jornada para ver: a coordenação é a casa dela.
    if (!opts.serve) return 'coordenacao';
    // Quem serve começa na jornada e alterna quando quiser — a permissão ABRE a porta,
    // não empurra ninguém para dentro. Valor torto no localStorage cai na jornada.
    return opts.salvo === 'coordenacao' ? 'coordenacao' : 'jornada';
  }

  // ── Qual botão acende numa tela que não tem botão próprio ──────────────────
  // Ausências e Chamada não estão na barra: abrem por dentro de outra seção (o menu
  // "⋯ Mais" da Escala, ou o botão nas Escalas do membro). A Ausências acendia o id
  // 'caixa' emprestado — a pessoa abria as Ausências e a barra dizia Caixa. Emprestar
  // o id de uma tela vizinha é mentir sobre onde a pessoa está; a barra passa a acender
  // a SEÇÃO de onde a tela sai, que é para onde o Voltar também leva.
  var SECAO_DA_TELA = {
    ausencias: { coordenacao:'escala', jornada:'escalas-membro' },
    chamada:   { coordenacao:'escala', jornada:'escalas-membro' },
  };

  // Se a seção não estiver na barra da pessoa (cerimoniário sem a permissão 'escala',
  // por exemplo), nada acende — que é o certo, e renderBottomNav aguenta sem quebrar.
  function idNaBarra(tela, modo) {
    var secao = SECAO_DA_TELA[tela];
    if (!secao) return tela;                 // tela com botão próprio: acende ela mesma
    return modo === 'coordenacao' ? secao.coordenacao : secao.jornada;
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

  var api = { montarItensNav: montarItensNav, modoDaBarra: modoDaBarra, temAcessoCoordenacao: temAcessoCoordenacao, idNaBarra: idNaBarra };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { global.montarItensNav = montarItensNav; global.modoDaBarra = modoDaBarra; global.temAcessoCoordenacao = temAcessoCoordenacao; global.idNaBarra = idNaBarra; }
})(typeof globalThis !== 'undefined' ? globalThis : this);
