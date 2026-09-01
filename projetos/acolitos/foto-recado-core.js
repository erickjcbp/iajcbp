// Recado da foto: quem ainda vê o convite, e quando ele some.
//
// Nasceu de um defeito real: de 09/06 a 01/09/2026 NENHUMA foto subiu no app —
// a trava do armazenamento barrava todo mundo (migration 065). Quem tentou levou
// um "não foi possível enviar a foto" e desistiu, e não ficou registro nenhum de
// quem foi barrado. O recado é o pedido de desculpas: avisa que já dá.
//
// A regra é diferente de todos os outros avisos do app, e é por isso que ela mora
// aqui em vez de ficar solta no shared.js: os outros somem por terem APARECIDO;
// este some por a foto ter SUBIDO. Enquanto não subir ele fica pendente no banco,
// e aparece no máximo uma vez por sessão para não virar cobrança.
//
// Só a REGRA mora aqui — nada de tela, nada de banco. Assim o que 26 pessoas vão
// ler dá para provar sem abrir navegador.
(function (global) {
  'use strict';

  var TIPO = 'foto_conserto';

  // A ficha guarda a foto em `foto_url`. Vazio, só espaço ou nulo = sem foto.
  function temFotoDePerfil(membro) {
    if (!membro) return false;
    return String(membro.foto_url == null ? '' : membro.foto_url).trim() !== '';
  }

  // `true` = este aviso NÃO pode ser marcado como visto agora.
  // É o coração da regra: o recado da foto sobrevive a ter aparecido, e só se
  // rende à foto no ar. Qualquer outro aviso responde `false` e segue o fluxo
  // normal (marcado como visto assim que aparece).
  function recadoDaFotoFicaPendente(aviso, temFoto) {
    if (!aviso || aviso.tipo !== TIPO) return false;
    if (aviso.seen) return false;
    return !temFoto;
  }

  // Fecha o recado da foto (a foto subiu). Devolve uma lista NOVA — nunca mexe na
  // que veio, porque quem chama costuma estar segurando a lista da tela.
  function marcarRecadoDaFotoVisto(avisos) {
    if (!Array.isArray(avisos)) return [];
    return avisos.map(function (a) {
      return (a && a.tipo === TIPO && !a.seen) ? Object.assign({}, a, { seen: true }) : a;
    });
  }

  // Tem recado da foto esperando?
  function temRecadoDaFotoPendente(avisos, temFoto) {
    if (!Array.isArray(avisos)) return false;
    return avisos.some(function (a) { return recadoDaFotoFicaPendente(a, temFoto); });
  }

  // O texto vive aqui para poder ser provado. Ele precisa servir para DOIS
  // públicos ao mesmo tempo: quem tentou e apanhou, e quem nunca tentou — não dá
  // para saber quem é quem. Por isso "se você tentou", e nunca "você tentou".
  function textoDoRecadoDaFoto() {
    return {
      titulo: 'Sua foto pode subir agora',
      linhas: [
        'A foto de perfil estava com defeito e não subia. Já consertamos.',
        'Se você tentou e não conseguiu, pode colocar a sua agora.',
      ],
      botao: 'Colocar minha foto',
      depois: 'Agora não',
    };
  }

  var api = {
    TIPO_RECADO_DA_FOTO: TIPO,
    temFotoDePerfil: temFotoDePerfil,
    recadoDaFotoFicaPendente: recadoDaFotoFicaPendente,
    marcarRecadoDaFotoVisto: marcarRecadoDaFotoVisto,
    temRecadoDaFotoPendente: temRecadoDaFotoPendente,
    textoDoRecadoDaFoto: textoDoRecadoDaFoto,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else {  // pelo NOME: senão a tela fica em branco
    global.TIPO_RECADO_DA_FOTO = TIPO;
    global.temFotoDePerfil = temFotoDePerfil;
    global.recadoDaFotoFicaPendente = recadoDaFotoFicaPendente;
    global.marcarRecadoDaFotoVisto = marcarRecadoDaFotoVisto;
    global.temRecadoDaFotoPendente = temRecadoDaFotoPendente;
    global.textoDoRecadoDaFoto = textoDoRecadoDaFoto;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
