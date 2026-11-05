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

  // ── Gravar a inscrição de push ────────────────────────────────────────────────────────────
  // Caso real (05/11/2026): o aparelho já tinha uma inscrição gravada por OUTRA conta (celular
  // compartilhado em família). A tabela só deixa cada conta mexer nas próprias linhas, então o
  // upsert por endpoint era negado e a parede ficava em "Ativar" sem dizer nada. Quem sabe trocar o
  // dono do aparelho com segurança é a função do banco `acolitos_push_registrar` (só troca quando
  // quem pede traz as MESMAS chaves da inscrição). Sem a função (migration ainda não rodou), cai no
  // upsert de antes. Devolve sempre um resultado — nunca lança, nunca fica calado.
  async function registrarInscricaoPush(sb, uid, sub, userAgent) {
    var j = typeof sub.toJSON === 'function' ? sub.toJSON() : sub;
    var keys = (j && j.keys) || {};
    try {
      var r = await sb.rpc('acolitos_push_registrar', { p_endpoint: sub.endpoint, p_p256dh: keys.p256dh, p_auth: keys.auth, p_user_agent: userAgent });
      if (!r.error) return { ok: true, via: 'rpc' };
      var cod = r.error.code || '';
      var semFuncao = cod === 'PGRST202' || cod === '42883' || /could not find the function|does not exist/i.test(r.error.message || '');
      if (!semFuncao) return { ok: false, via: 'rpc', motivo: cod === '42501' ? 'outro-aparelho' : 'salvar', detalhe: cod || r.error.message };
    } catch (e) { /* rede/transporte: tenta o upsert abaixo */ }
    var up = await sb.from('acolitos_push_subs').upsert({
      user_id: uid, endpoint: sub.endpoint, p256dh: keys.p256dh, auth: keys.auth, user_agent: userAgent,
    }, { onConflict: 'endpoint' });
    if (up.error) return { ok: false, via: 'upsert', motivo: 'salvar', detalhe: up.error.code || up.error.message };
    return { ok: true, via: 'upsert' };
  }

  // O que dizer quando a ativação falha. A parede cobre o aviso rápido (toast), então esta frase vai
  // escrita DENTRO da parede. Motivo que a pessoa resolve sozinha não mostra código; os outros
  // mostram, para a coordenação conseguir diagnosticar por mensagem.
  function explicarFalhaNotificacao(motivo, detalhe) {
    var cod = detalhe ? ' (código: ' + detalhe + ')' : '';
    var t = {
      permissao: 'O aparelho não deixou ligar as notificações. Abra as configurações do celular, procure "Acólitos" (ou o Chrome) em Notificações e permita. Depois toque em "Ativar agora" de novo.',
      suporte: 'Este navegador não consegue receber notificações. Abra o app pelo Chrome do celular.',
      sw: 'O app ainda está se preparando no aparelho. Feche o app por completo, abra de novo e toque em "Ativar agora".',
      inscricao: 'O aparelho não conseguiu criar a inscrição das notificações. Toque em "Ativar agora" de novo. Se continuar, fale com a coordenação' + cod + '.',
      'outro-aparelho': 'Este aparelho já foi usado por outra conta nas notificações. Toque em "Ativar agora" mais uma vez. Se continuar, fale com a coordenação' + cod + '.',
      salvar: 'Não consegui guardar a inscrição agora. Toque em "Ativar agora" de novo em instantes. Se continuar, fale com a coordenação' + cod + '.',
    };
    return t[motivo] || ('Não foi possível ativar as notificações. Toque em "Ativar agora" de novo. Se continuar, fale com a coordenação' + cod + '.');
  }

  var api = { decidirPortaoNotificacoes: decidirPortaoNotificacoes, registrarInscricaoPush: registrarInscricaoPush, explicarFalhaNotificacao: explicarFalhaNotificacao };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else {   // pelo NOME: senão a tela fica em branco
    global.decidirPortaoNotificacoes = decidirPortaoNotificacoes;
    global.registrarInscricaoPush = registrarInscricaoPush;
    global.explicarFalhaNotificacao = explicarFalhaNotificacao;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
