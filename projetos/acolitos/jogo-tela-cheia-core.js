// Tela cheia dos jogos (Tíquico e Davi) ligada ao histórico do navegador.
//
// Entrar na tela cheia empilha um estado no histórico; o "voltar" do celular (gesto da borda, botão do
// sistema) volta SÓ esse estado e sai da tela cheia — a página continua onde está. O segundo "voltar"
// é o do navegador, normal. Sair pelo botão "Recolher" devolve o estado empilhado (history.back) e
// engole o popstate dessa devolução, para não sair da tela cheia duas vezes.
//
// Por que existe: com o jogo em tela cheia e o dedo deslizando no cenário, um toque que começava
// perto da borda virava "voltar" do sistema e a pessoa caía na tela anterior no meio da partida.
//
// UMD e sem DOM próprio (recebe entrar/sair/historico/janela), para provar em `node --test`.
(function (global) {
  'use strict';

  function criar(o) {
    var historico = o.historico, janela = o.janela;
    var ativo = false, empilhado = false, ignorar = 0;

    function abrir() {
      if (ativo) return;
      ativo = true;
      o.entrar();
      try { historico.pushState({ jogoTelaCheia: true }, ''); empilhado = true; } catch (_) { empilhado = false; }
    }

    function fechar() {
      if (!ativo) return;
      ativo = false;
      o.sair();
      if (empilhado) {
        empilhado = false;
        ignorar++;
        try { historico.back(); } catch (_) { ignorar--; }
      }
    }

    janela.addEventListener('popstate', function () {
      if (ignorar > 0) { ignorar--; return; }      // é o popstate da devolução feita por fechar()
      if (!ativo) return;                           // "voltar" normal do navegador: não é com a gente
      ativo = false; empilhado = false;
      o.sair();                                     // o "voltar" foi consumido por sair da tela cheia
    });

    return { abrir: abrir, fechar: fechar, get ativo() { return ativo; } };
  }

  var api = { criar: criar };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.JogoTelaCheia = api;
})(typeof window !== 'undefined' ? window : globalThis);
