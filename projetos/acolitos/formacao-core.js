// O acompanhamento da Formação: como cada pessoa é classificada e o que se diz a ela.
//
// POR QUE ISTO EXISTE: a tela da Jornada responde "quem está chegando lá" — e em 18/09/2026
// isso era 1 pessoa. Ninguém respondia "quem NÃO saiu do lugar", que eram as outras 155.
// Esta regra dá nome às faixas e escreve a mensagem, sem DOM e sem banco, para ter prova
// sem navegador.
//
// QUEM CLASSIFICA É O BANCO (`acolitos_formacao_acompanhamento`, migration 075): ele é o
// único que enxerga se a pessoa já entrou no app. Aqui só se traduz e se ordena — se as duas
// pontas classificassem, a tela e o banco discordariam no dia em que uma das duas mudasse.
(function (global) {
  'use strict';

  // Da mais urgente para a menos. A ordem É a regra: quem nunca entrou não tem problema de
  // formação, tem problema de acesso — e insistir em formação com essa pessoa é falar
  // sozinho.
  var FAIXAS = ['nunca_entrou', 'travado', 'parou', 'andando'];

  var ROTULO = {
    nunca_entrou: 'Nunca entrou no app',
    travado: 'Entrou e não começou',
    parou: 'Parou',
    andando: 'Andando',
  };

  var EXPLICACAO = {
    nunca_entrou: 'Tem conta, nunca abriu. O que falta é o acesso chegar, não formação.',
    travado: 'Já entrou no app, mas não cumpriu nenhuma missão ainda.',
    parou: 'Já andou na trilha e parou: mais de 30 dias sem missão e sem servir.',
    andando: 'Em movimento nos últimos 30 dias.',
  };

  function rotuloDaFaixa(faixa) { return ROTULO[faixa] || faixa || '—'; }
  function explicacaoDaFaixa(faixa) { return EXPLICACAO[faixa] || ''; }

  // Menor número = mais urgente. Faixa desconhecida vai para o fim, nunca para o topo:
  // errar para cima colocaria lixo na frente do que importa.
  function urgenciaDaFaixa(faixa) {
    var i = FAIXAS.indexOf(faixa);
    return i < 0 ? FAIXAS.length : i;
  }

  // Quantas pessoas em cada faixa. Devolve SEMPRE as quatro chaves, mesmo zeradas: faixa que
  // some da contagem faz a tela parecer que a situação não existe.
  function resumo(pessoas) {
    var fora = { total: 0 };
    FAIXAS.forEach(function (f) { fora[f] = 0; });
    (pessoas || []).forEach(function (p) {
      var f = p && p.faixa;
      if (fora[f] === undefined) return;   // faixa que a gente não conhece não entra na conta
      fora[f] += 1;
      fora.total += 1;
    });
    return fora;
  }

  // A mensagem que a coordenação manda. Escrita para a FAMÍLIA ler, não para o sistema:
  // quem nunca entrou precisa da senha, quem travou precisa de um empurrão, quem parou
  // precisa de alguém perguntando se está tudo bem.
  function mensagemWhatsapp(pessoa) {
    var p = pessoa || {};
    var nome = String(p.nome == null ? '' : p.nome).trim().split(/\s+/)[0] || 'Olá';
    if (p.faixa === 'nunca_entrou') {
      return 'Oi! Aqui é da Pastoral dos Acólitos e Coroinhas. O ' + nome + ' ainda não entrou ' +
        'no aplicativo — é lá que ficam a escala, os avisos e a formação. Quer que eu mande o acesso?';
    }
    if (p.faixa === 'travado') {
      return 'Oi! Vi que o ' + nome + ' já entrou no aplicativo mas ainda não começou a trilha. ' +
        'Posso ajudar a dar o primeiro passo?';
    }
    if (p.faixa === 'parou') {
      return 'Oi! Faz um tempo que não vemos o ' + nome + ' por aqui. Está tudo bem? ' +
        'Queremos ele de volta no altar.';
    }
    return 'Oi! Falando da Pastoral dos Acólitos e Coroinhas sobre o ' + nome + '.';
  }

  var api = {
    FAIXAS: FAIXAS,
    rotuloDaFaixa: rotuloDaFaixa,
    explicacaoDaFaixa: explicacaoDaFaixa,
    urgenciaDaFaixa: urgenciaDaFaixa,
    resumo: resumo,
    mensagemWhatsapp: mensagemWhatsapp,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else {
    global.FormacaoAcompanhamento = api;
    global.rotuloDaFaixa = rotuloDaFaixa;
    global.explicacaoDaFaixa = explicacaoDaFaixa;
    global.urgenciaDaFaixa = urgenciaDaFaixa;
    global.resumoDaFormacao = resumo;
    global.mensagemWhatsapp = mensagemWhatsapp;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
