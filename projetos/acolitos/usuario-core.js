// Gera o usuário de acesso a partir do nome — a regra por trás dos 138 logins criados
// em 30/08/2026 para quem estava no cadastro sem conta nenhuma.
//
// POR QUE "PRIMEIRO NOME + ÚLTIMO SOBRENOME": medido nas 138 pessoas reais antes de
// escolher. Só o primeiro nome é impossível (14 "Maria", 8 "Miguel", 5 "João"). Primeiro
// + PRIMEIRO sobrenome repete 10 vezes entre elas e bate em 2 contas que já existem.
// Primeiro + iniciais não repete nenhuma, mas produz coisa que criança não decora
// ("mariaema"). Primeiro + ÚLTIMO sobrenome repete 2 vezes em 138, bate em ZERO conta
// existente, e é o estilo dos logins que a pastoral já usa (carolsantos, juliamello).
//
// Escrito em CommonJS como os outros *-core: `node --test` carrega direto, e o script
// da carga em lote também. O usuário vira o nome com que a criança entra no app pelos
// próximos anos — não é coisa de "arruma depois".
(function (global) {
  'use strict';

  var PARTICULAS = ['de', 'da', 'do', 'das', 'dos', 'e', 'di', 'del'];

  function pedacos(nome) {
    return String(nome == null ? '' : nome)
      .normalize('NFD').replace(/[̀-ͯ]/g, '')     // tira acento
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, ' ')                          // ponto de inicial vira espaço
      .split(/\s+/)
      .filter(function (p) { return p && PARTICULAS.indexOf(p) < 0; });
  }

  // → 'maysasilva'. String vazia quando não há nome nenhum.
  function usuarioDe(nome) {
    var p = pedacos(nome);
    if (!p.length) return '';
    var primeiro = p[0];
    // O sobrenome é a última palavra DE VERDADE. Inicial solta não conta: "Maria Eduarda
    // M. Araujo" tem de virar mariaaraujo, e "Ana Paula Souza S." tem de virar anasouza —
    // um login chamado "mariam" não diz a ninguém de quem é.
    var sobrenome = '';
    for (var i = p.length - 1; i >= 1; i--) {
      if (p[i].length > 1) { sobrenome = p[i]; break; }
    }
    return primeiro + sobrenome;
  }

  // Distribui usuários únicos. `jaExistentes` são os logins que o app já tem: repetir um
  // deles jogaria a criança nova para dentro da conta de outra pessoa.
  // A ordem da lista manda, e nada é sorteado — rodar duas vezes dá o mesmo resultado.
  function gerarUsuarios(pessoas, jaExistentes) {
    var usados = {};
    (jaExistentes || []).forEach(function (u) { if (u) usados[String(u).toLowerCase()] = true; });
    return (pessoas || []).map(function (pes) {
      var base = usuarioDe(pes.nome), usuario = base;
      for (var n = 2; base && usados[usuario]; n++) usuario = base + n;
      if (usuario) usados[usuario] = true;
      return Object.assign({}, pes, { usuario: usuario });
    });
  }

  var api = { usuarioDe: usuarioDe, pedacos: pedacos, gerarUsuarios: gerarUsuarios };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { global.usuarioDe = usuarioDe; global.gerarUsuarios = gerarUsuarios; }
})(typeof globalThis !== 'undefined' ? globalThis : this);
