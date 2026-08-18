// Estado, filtro, ordenação e quem pode ser responsável por uma tarefa.
// PURO (sem DOM, sem rede), no padrão dos outros -core.js deste projeto.
(function (global) {
  'use strict';

  // ── O ESTADO SAI DAS DATAS, não de uma coluna de texto ──────────────
  // Assim não existe linha dizendo "em andamento" com data de conclusão preenchida: as duas
  // afirmações não podem se contradizer porque só existe uma fonte.
  function estadoDaTarefa(t) {
    if (!t) return 'afazer';
    if (t.concluida_em) return 'feita';
    if (t.andamento_em) return 'andamento';
    return 'afazer';
  }

  // ── QUEM PODE SER RESPONSÁVEL ───────────────────────────────────────
  // Decisão do dono em 18/08/2026: só quem está DE FATO num time E é da equipe. Antes a lista
  // trazia os 176 membros, e escolher alguém de fora do time criava uma cobrança que a pessoa
  // nem sabia que existia.
  //
  // ATENÇÃO ao usar: a lista é curta enquanto pouca gente estiver em algum time. Lista curta
  // é o DADO, não defeito da regra — quem a destrava é pôr gente nos times, no organograma
  // das Casas. Lista VAZIA, porém, já foi defeito: ver o comentário dentro da função.
  function podeSerResponsavel(m, timeSlug) {
    if (!m) return false;
    // NÃO se olha `eh_equipe` aqui. A RPC `acolitos_responsaveis_de_tarefa` devolve só
    // {id, nome, apelido, setores} — o campo nunca chega, ficava `undefined`, e a lista de
    // responsáveis saía SEMPRE vazia no ar, qualquer que fosse o dado no banco. Quem decide
    // é estar num time, que é a regra do dono e a mesma da migration 053.
    var setores = Array.isArray(m.setores) ? m.setores : [];
    if (!setores.length) return false;
    // Sem time informado, basta estar em ALGUM. Com time, tem de estar NAQUELE — não faz
    // sentido pôr alguém da Formação como responsável por uma tarefa do Almoxarifado.
    return timeSlug ? setores.indexOf(timeSlug) >= 0 : true;
  }

  function responsaveisPossiveis(membros, timeSlug) {
    return (Array.isArray(membros) ? membros : []).filter(function (m) {
      return podeSerResponsavel(m, timeSlug);
    });
  }

  // ── FILTRO ──────────────────────────────────────────────────────────
  // Campo vazio não filtra nada. Isso importa: filtro que "some com tudo" quando está vazio
  // faz a tela parecer sem dado.
  function filtrar(tarefas, f) {
    f = f || {};
    var texto = (f.texto || '').trim().toLowerCase();
    return (Array.isArray(tarefas) ? tarefas : []).filter(function (t) {
      if (f.time && t.time_slug !== f.time) return false;
      if (f.estado && estadoDaTarefa(t) !== f.estado) return false;
      if (f.responsavel === '__sem__') { if (t.responsavel_id) return false; }
      else if (f.responsavel && t.responsavel_id !== f.responsavel) return false;
      if (texto) {
        var alvo = ((t.titulo || '') + ' ' + (t.observacao || '')).toLowerCase();
        if (alvo.indexOf(texto) < 0) return false;
      }
      return true;
    });
  }

  // ── ORDENAÇÃO ───────────────────────────────────────────────────────
  // Sem prazo vai SEMPRE para o fim, nos dois sentidos: uma tarefa sem data não é "a mais
  // urgente" nem "a menos", ela simplesmente não entra na conta de urgência.
  function ordenar(tarefas, campo, desc) {
    var lista = (Array.isArray(tarefas) ? tarefas : []).slice();
    var chave = {
      prazo:       function (t) { return t.prazo || null; },
      titulo:      function (t) { return (t.titulo || '').toLowerCase(); },
      time:        function (t) { return (t.time_slug || '').toLowerCase(); },
      responsavel: function (t) { return nomeResp(t).toLowerCase(); },
    }[campo] || function (t) { return t.prazo || null; };

    lista.sort(function (a, b) {
      var x = chave(a), y = chave(b);
      var vazioX = (x === null || x === undefined || x === ''), vazioY = (y === null || y === undefined || y === '');
      if (vazioX && vazioY) return 0;
      if (vazioX) return 1;      // vazio no fim, independente do sentido
      if (vazioY) return -1;
      if (x < y) return desc ? 1 : -1;
      if (x > y) return desc ? -1 : 1;
      return 0;
    });
    return lista;
  }

  function nomeResp(t) {
    var r = t && t.responsavel;
    if (!r) return '';
    return r.apelido || r.nome || '';
  }

  // ── AGRUPAR POR TIME ────────────────────────────────────────────────
  // Todo time da lista aparece, mesmo sem tarefa: um time vazio é informação (ninguém cuidou
  // de nada ali), e escondê-lo faria parecer que o time não existe.
  function agruparPorTime(tarefas, times) {
    var mapa = {};
    (Array.isArray(times) ? times : []).forEach(function (t) { mapa[t.valor] = { time: t, tarefas: [] }; });
    (Array.isArray(tarefas) ? tarefas : []).forEach(function (t) {
      var k = t.time_slug;
      if (!mapa[k]) mapa[k] = { time: { valor: k, label: k }, tarefas: [] };  // time apagado do catálogo
      mapa[k].tarefas.push(t);
    });
    return Object.keys(mapa).map(function (k) { return mapa[k]; });
  }

  var api = { estadoDaTarefa: estadoDaTarefa, podeSerResponsavel: podeSerResponsavel,
              responsaveisPossiveis: responsaveisPossiveis, filtrar: filtrar,
              ordenar: ordenar, agruparPorTime: agruparPorTime };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else {  // pelo NOME: expor só o objeto deixaria a tela em branco com os testes verdes
    global.estadoDaTarefa = estadoDaTarefa; global.podeSerResponsavel = podeSerResponsavel;
    global.responsaveisPossiveis = responsaveisPossiveis; global.filtrar = filtrar;
    global.ordenar = ordenar; global.agruparPorTime = agruparPorTime;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
