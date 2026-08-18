// Entrar e sair de um time — a REGRA, sem DOM e sem rede, testável em node.
// Estar num time não é só um item numa lista: é o que marca a pessoa como equipe e o que
// decide o acesso dela. Sair do ÚLTIMO time tira as duas coisas. Essa regra vivia só dentro
// do organograma das Casas; com a seção Times no Config passaram a existir duas portas para
// o mesmo lugar, e duas cópias divergiriam no primeiro conserto.
//
// Estas funções NÃO gravam: devolvem o que gravar. Quem chama é que fala com o banco e com a
// API de papéis — assim a regra dá para provar sem subir nada.
(function (global) {
  'use strict';

  // Papéis que mandam mais que "equipe": mexer no papel deles por causa de um time seria
  // rebaixar um administrador e tirá-lo do painel inteiro.
  var PAPEIS_ACIMA_DE_EQUIPE = ['coord_admin', 'subadmin'];

  function lista(m) {
    return Array.isArray(m && m.setores) ? m.setores.slice() : [];
  }

  // → { patch, promoverPara }
  // `promoverPara` é o papel a mandar para a API, ou null quando não há nada a fazer.
  function entrarNoTime(m, slug, papelAtual) {
    var atuais = lista(m);
    var novos = atuais.indexOf(slug) >= 0 ? atuais : atuais.concat([slug]);
    var jaTemAcesso = papelAtual === 'membro_equipe' || PAPEIS_ACIMA_DE_EQUIPE.indexOf(papelAtual) >= 0;
    return {
      patch: { setores: novos, eh_equipe: true },
      // Sem login não há papel para promover; a marca de equipe é do cadastro, não do acesso.
      promoverPara: (m && m.user_id && !jaTemAcesso) ? 'membro_equipe' : null,
    };
  }

  // → { patch, ultimo, rebaixarPara, semEfeito }
  // `papelBase` é o papel que corresponde ao nível da pessoa (quem chama calcula, porque
  // depende de NIVEIS, que é config do app e não regra de time).
  function sairDoTime(m, slug, papelAtual, papelBase) {
    var atuais = lista(m);
    if (atuais.indexOf(slug) < 0) return { semEfeito: true, patch: null, ultimo: false, rebaixarPara: null };
    var novos = atuais.filter(function (s) { return s !== slug; });
    var ultimo = novos.length === 0;
    var ehAdmin = PAPEIS_ACIMA_DE_EQUIPE.indexOf(papelAtual) >= 0;
    return {
      semEfeito: false,
      patch: ultimo ? { setores: novos, eh_equipe: false } : { setores: novos },
      ultimo: ultimo,
      // Só rebaixa quem saiu do último time, tem login, e não é administrador.
      rebaixarPara: (ultimo && m && m.user_id && !ehAdmin) ? (papelBase || null) : null,
    };
  }

  var api = { entrarNoTime: entrarNoTime, sairDoTime: sairDoTime };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { global.entrarNoTime = entrarNoTime; global.sairDoTime = sairDoTime; }
})(typeof globalThis !== 'undefined' ? globalThis : this);
