// O portão de notificações: decide se a pessoa entra no app ou para numa parede.
//
// Só a REGRA mora aqui — nada de tela, nada de banco, nada de navegador. Quem junta os
// fatos do aparelho (tem suporte? deu permissão? está instalado? tem inscrição gravada?)
// é o shared.js; aqui a gente só responde o que fazer com eles. É o que deixa a regra
// testável sem abrir navegador.
//
// A ORDEM DAS PERGUNTAS É A REGRA. Cada parede ensina uma saída diferente, e mandar a
// pessoa pela saída errada é pior do que não mandar nada: ela tenta, não resolve, e
// desiste. Por isso "iPhone fora do app instalado" é perguntado antes de "sem suporte" e
// antes de "negado" — nesse estado o Safari responde as duas coisas, mas nem o Ajustes
// nem trocar de aparelho resolvem: só instalar na Tela de Início.
(function (global) {
  'use strict';

  function decidirPortaoNotificacoes(situacao) {
    var s = situacao || {};

    // Ainda esperando aprovação do cadastro: não é membro, não é escalado, não recebe
    // nada. É a ÚNICA isenção — nem coordenação nem superadmin têm outra.
    if (s.etapaCrm === 'aprovacao_cadastro') return { entra: true, parede: null };

    // Sino ligado E inscrição gravada. Permissão sozinha não vale: sem a linha no banco
    // o envio não acha o aparelho e a pessoa não recebe coisa nenhuma.
    if (s.inscrito === true) return { entra: true, parede: null };

    if (s.iosSemInstalar === true)      return { entra: false, parede: 'instalar-ios' };
    if (s.suporte === 'nao-suportado')  return { entra: false, parede: 'sem-suporte' };
    if (s.permissao === 'denied')       return { entra: false, parede: 'negado' };

    // Sobrou quem ainda pode ser perguntado — e quem tem permissão mas perdeu a inscrição
    // (desativou em Minha Conta, ou a linha sumiu). Nos dois casos o botão resolve.
    return { entra: false, parede: 'pedir' };
  }

  var api = { decidirPortaoNotificacoes: decidirPortaoNotificacoes };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { global.decidirPortaoNotificacoes = decidirPortaoNotificacoes; }   // pelo NOME: senão a tela fica em branco
})(typeof globalThis !== 'undefined' ? globalThis : this);
