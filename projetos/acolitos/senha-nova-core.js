// A regra da senha que a pessoa cria no primeiro acesso.
//
// Em 30/08/2026 foram criados 138 logins com a MESMA senha impressa numa folha. Enquanto
// alguém não trocar, quem tiver a folha na mão entra na conta daquela criança. Esta regra
// é o que fecha esse buraco — por isso ela recusa, explicitamente, a própria senha da
// folha: "trocar" para a mesma coisa não protegeu ninguém.
//
// Só a REGRA mora aqui, sem tela e sem banco, para dar prova sem navegador.
(function (global) {
  'use strict';

  var SENHA_DA_FOLHA = 'coroinha2026';
  var MINIMO = 6;

  // → { ok, erro }. `erro` é a frase que a pessoa lê, em português de gente.
  function validarSenhaNova(o) {
    o = o || {};
    var senha = String(o.senha == null ? '' : o.senha);
    var repetida = String(o.repetida == null ? '' : o.repetida);
    var limpa = senha.trim();

    if (!limpa) return { ok: false, erro: 'Escreva a sua senha nova.' };
    if (senha !== repetida) return { ok: false, erro: 'As duas senhas precisam ser iguais.' };
    if (limpa.length < MINIMO) return { ok: false, erro: 'A senha precisa ter ao menos ' + MINIMO + ' letras ou números.' };
    // Comparada sem caixa e sem espaço nas pontas: para quem está com a folha na mão,
    // "Coroinha2026" abre a conta do mesmo jeito.
    if (limpa.toLowerCase() === SENHA_DA_FOLHA) {
      return { ok: false, erro: 'Essa é a senha da folha. Escolha uma senha que só você saiba.' };
    }
    return { ok: true, erro: null };
  }

  var api = { validarSenhaNova: validarSenhaNova, SENHA_DA_FOLHA: SENHA_DA_FOLHA, MINIMO: MINIMO };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { global.validarSenhaNova = validarSenhaNova; global.SENHA_DA_FOLHA = SENHA_DA_FOLHA; }
})(typeof globalThis !== 'undefined' ? globalThis : this);
