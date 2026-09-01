// De onde sai o telefone de uma pessoa — uma regra só, para o app inteiro.
//
// POR QUE ISTO EXISTE: o número de quem responde pela criança mora em DOIS campos,
// conforme a porta por onde ela se cadastrou. O cadastro de família gravava
// `celular_responsavel`; o formulário de novos e o "Complete seu cadastro" gravam
// `celular_recado`. Cada tela juntava os dois do seu jeito — e em ordem DIFERENTE:
// o CRM lia `celular_recado || celular_responsavel`, o shared.js lia
// `celular_responsavel || celular_recado`. Para as 4 pessoas que têm os dois campos
// preenchidos com números DIFERENTES (medido em 31/08/2026), a mesma pessoa aparecia
// com um telefone no CRM e outro no resto do app.
//
// Regra única, e ela é explicável em voz alta: o telefone de recado é o
// `celular_recado` — é o campo que o app mantém, o que o "Complete seu cadastro"
// pergunta. O `celular_responsavel` é RESERVA, para as fichas gravadas pela porta de
// família antes de 31/08/2026.
(function (global) {
  'use strict';

  var limpo = function (v) {
    var s = String(v == null ? '' : v).trim();
    return s ? s : null;
  };

  // O número de quem responde pela criança.
  function telefoneDeRecado(m) {
    if (!m) return null;
    return limpo(m.celular_recado) || limpo(m.celular_responsavel) || limpo(m.celular_mae);
  }

  // TODOS os números que a ficha conhece, sem repetir e sem buraco. Serve para dizer
  // "essa pessoa não tem telefone nenhum" sem mentir — foi olhando só um dos campos que
  // o CRM disse "nenhum telefone" para 6 das 7 pessoas do funil, com o número ali do lado.
  function telefonesDe(m) {
    if (!m) return [];
    var vistos = {}, saida = [];
    [m.telefone, m.celular_recado, m.celular_responsavel, m.celular_mae].forEach(function (t) {
      var v = limpo(t);
      if (!v) return;
      var chave = v.replace(/\D/g, '');          // (19) 9 9999-0000 e 19999990000 são o mesmo
      if (!chave || vistos[chave]) return;
      vistos[chave] = true; saida.push(v);
    });
    return saida;
  }

  var api = { telefoneDeRecado: telefoneDeRecado, telefonesDe: telefonesDe };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { global.telefoneDeRecado = telefoneDeRecado; global.telefonesDe = telefonesDe; }
})(typeof globalThis !== 'undefined' ? globalThis : this);
