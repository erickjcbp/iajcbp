// Boas-vindas ao time: monta o que fica guardado para a pessoa ver e o que chega no celular.
//
// Só a REGRA mora aqui — nada de tela, nada de banco. Quem grava e quem desenha é o
// shared.js. Assim o texto que 47 pessoas vão ler dá para provar sem abrir navegador.
(function (global) {
  'use strict';

  function primeiroNomeDe(nome) {
    var limpo = String(nome == null ? '' : nome).trim().replace(/\s+/g, ' ');
    if (!limpo) return 'Você';
    return limpo.split(' ')[0];
  }

  // → { aviso, primeiroNome, hero, sub, push } — ou null se não houver time.
  function montarBoasVindas(o) {
    o = o || {};
    var slug = o.slug ? String(o.slug) : '';
    if (!slug) return null;

    // Rótulo é o que a pessoa lê. Sem ele, "sua equipe" — nunca o nome técnico do banco,
    // que para um adolescente não quer dizer nada ("ordem_disciplina").
    var rotulo = String(o.label == null ? '' : o.label).trim();
    var comoFala = rotulo || 'sua equipe';
    // Duas formas, porque as frases pedem preposições diferentes: "você agora é DO time
    // Escala" e "você entrou NO time Escala". Uma só produzia "entrou do time".
    var doTime = rotulo ? 'do time ' + rotulo : 'da equipe';
    var noTime = rotulo ? 'no time ' + rotulo : 'na equipe';

    var recado = String(o.recado == null ? '' : o.recado).trim();
    if (!recado) recado = null;

    var primeiro = primeiroNomeDe(o.nome);

    return {
      aviso: {
        tipo: 'boas_vindas_time',
        time: slug,              // guardado como está: quem lê isto é o app, não a pessoa
        time_label: rotulo,
        recado: recado,
        seen: false,             // nasce não visto, senão a animação nunca apareceria
      },
      primeiroNome: primeiro,
      hero: primeiro + ', você agora é ' + doTime,
      // O texto padrão, para quando o recado é pulado: melhor um texto pronto e bem escrito
      // do que uma festa sem uma linha dirigida à pessoa.
      sub: 'Você faz parte da equipe da pastoral. As tarefas de ' + comoFala +
           ' já aparecem para você.',
      push: {
        titulo: 'Bem-vindo à equipe',
        texto: primeiro + ', você entrou ' + noTime + '.',
      },
    };
  }

  var api = { montarBoasVindas: montarBoasVindas, primeiroNomeDe: primeiroNomeDe };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { global.montarBoasVindas = montarBoasVindas; }   // pelo NOME: senão a tela fica em branco
})(typeof globalThis !== 'undefined' ? globalThis : this);
