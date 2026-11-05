// Tutorial guiado do membro — QUAIS telas têm tutorial, QUAIS são os passos e QUANDO abrir.
// PURO (sem DOM, sem rede): quem desenha é tutorial.js, quem grava é o banco
// (acolitos_tutorial_marcar). Assim o texto que as crianças vão ler e a regra de "só uma vez, sem maratona"
// dá para provar em node, igual navegacao-core.js.
//
// Alvo de cada passo: { ancora: 'Rótulo na tela' } acha o elemento pelo texto visível; { seletor: 'css' } por CSS;
// sem alvo (ou alvo que não existe naquele dia) o balão aparece no centro — o passo nunca some por isso.
(function (global) {
  'use strict';

  // Chave = o activePage que cada tela passa para renderHeader(). Só estas seis, por decisão do dono (04/11/2026).
  var TUTORIAIS = {
    home: {
      titulo: 'Início',
      passos: [
        { titulo: 'Bem-vindo ao app da pastoral! 🙏', texto: 'Em menos de um minuto você conhece o Início. Toque em Próximo.' },
        { seletor: '#app-nav', titulo: 'Seus atalhos', texto: 'Aqui embaixo ficam as telas: Quests, Escalas, Agenda, Conquistas e Destaques. Cada uma tem uma explicação própria.' },
        { ancora: 'Meu nível', titulo: 'Seu nível', texto: 'Mostra onde você está na jornada, de aspirante até cerimoniário mor. Cada nível novo traz novas missões.' },
        { ancora: 'Minhas Próximas Escalas', titulo: 'Suas escalas', texto: 'Quando você for escalado para uma missa, ela aparece aqui.' },
        { ancora: 'Agenda da Pastoral', titulo: 'Agenda da pastoral', texto: 'As próximas celebrações da pastoral aparecem aqui.' },
        { seletor: '#tutorial-ajuda', titulo: 'Precisou de ajuda?', texto: 'Toque neste ? a qualquer momento e a explicação da tela em que você está abre de novo.' },
      ],
    },
    missoes: {
      titulo: 'Quests',
      passos: [
        { titulo: 'Quests ⭐', texto: 'Quests são desafios para você crescer na pastoral e ganhar XP, a pontuação da sua jornada.' },
        { ancora: 'Sua próxima descoberta', titulo: 'Escolha um desafio', texto: 'Aqui você escolhe a próxima quest. Toque em uma para começar.' },
        { ancora: 'Conquistas →', titulo: 'Suas conquistas', texto: 'Tudo o que você completa vira conquista. Toque para ver as suas.' },
      ],
    },
    'escalas-membro': {
      titulo: 'Escalas',
      passos: [
        { titulo: 'Suas escalas 📅', texto: 'Aqui você vê as missas em que está escalado e pode pedir para servir mais.' },
        { ancora: 'Minhas missas', titulo: 'Minhas missas', texto: 'A lista das missas em que você serve. Confira sempre o dia, o horário e o local.' },
        { ancora: 'Escala eu!', titulo: 'Quer servir mais?', texto: 'Toque aqui para se colocar em uma missa que ainda tem vaga.' },
        { ancora: 'Não poderei ir em alguma missa', titulo: 'Não vai poder ir?', texto: 'Avise por aqui, pelo app, o quanto antes. A ausência é informada no aplicativo, e não só por mensagem no WhatsApp.' },
      ],
    },
    agenda: {
      titulo: 'Agenda',
      passos: [
        { titulo: 'Agenda 🗓️', texto: 'Aqui ficam as celebrações e os eventos da pastoral. Toque num dia para ver os detalhes.' },
        { ancora: 'Calendário', titulo: 'Calendário ou lista', texto: 'Troque entre o calendário do mês e a linha do tempo, que mostra um evento depois do outro.' },
        { ancora: 'Filtrar', titulo: 'Filtrar', texto: 'Escolha o que quer ver: só as suas escalas, só eventos, e assim por diante.' },
        { titulo: 'Confirme sua presença ✅', texto: 'Quando um evento pedir, confirme se você vai. Assim a coordenação conta com você.' },
      ],
    },
    conquistas: {
      titulo: 'Conquistas',
      passos: [
        { titulo: 'Conquistas 🏆', texto: 'Esta é a sua história de serviço: insígnias, marcos, medalhas e troféus.' },
        { ancora: 'Insígnias', titulo: 'Insígnias', texto: 'Cada nível da jornada dá uma insígnia. Elas aparecem coloridas quando você as conquista.' },
        { ancora: 'Medalhas', titulo: 'Medalhas', texto: 'Medalhas premiam o que você faz na pastoral. Toque numa para ver como ganhou.' },
      ],
    },
    destaques: {
      titulo: 'Destaques',
      passos: [
        { titulo: 'Destaques 🌟', texto: 'Um reconhecimento à dedicação de cada um. Aqui aparecem os servos que mais se destacam.' },
        { ancora: 'Servos do Altar', titulo: 'Por categoria', texto: 'Cada quadro reconhece algo diferente: quem serve em mais funções, quem está sempre pronto, quem ajuda mais.' },
      ],
    },
  };

  function tutorialDa(tela) {
    return Object.prototype.hasOwnProperty.call(TUTORIAIS, tela) ? TUTORIAIS[tela] : null;
  }

  // Só o modo membro (jornada) e só quem serve: coordenação fica de fora. `ctx` é o que shared.js já monta.
  // modo: 'jornada' | 'coordenacao'. serve === false (equipe que não serve) não recebe.
  function aplicaA(ctx, modo) {
    if (!ctx || !ctx.membro || !ctx.membro.id) return false;
    if (modo === 'coordenacao') return false;
    if (ctx.membro.serve === false) return false;
    var papel = ctx.membership && ctx.membership.role;
    if (papel === 'novo') return false; // ainda na integração: tem a própria tela
    return true;
  }

  // Abre sozinho? Só se a tela tem tutorial, a pessoa nunca viu aquela tela e nada impede.
  // `visto` é a coluna tutorial_visto ({ tela: 'data' }). Sem maratona: cada tela decide por si, só quando é aberta.
  function deveAbrirSozinho(tela, visto, ctx, modo) {
    if (!tutorialDa(tela) || !aplicaA(ctx, modo)) return false;
    var v = visto && typeof visto === 'object' ? visto : {};
    return !v[tela];
  }

  function aoCompletar(visto, tela, agoraIso) {
    var novo = {};
    var v = visto && typeof visto === 'object' ? visto : {};
    Object.keys(v).forEach(function (k) { novo[k] = v[k]; });
    if (!novo[tela]) novo[tela] = agoraIso;
    return novo;
  }

  // Navega entre passos sem sair do intervalo; devolve null ao passar do último (= terminou).
  function proximo(indice, total) { return indice + 1 >= total ? null : indice + 1; }
  function anterior(indice) { return indice <= 0 ? 0 : indice - 1; }

  var api = {
    TUTORIAIS: TUTORIAIS, tutorialDa: tutorialDa, aplicaA: aplicaA, deveAbrirSozinho: deveAbrirSozinho,
    aoCompletar: aoCompletar, proximo: proximo, anterior: anterior,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { global.TutorialCore = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this);
