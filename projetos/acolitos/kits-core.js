// Regra dos KITS (conjuntos de funções com critério próprio de quem pode servir).
// PURO (sem DOM, sem rede), igual navegacao-core.js e alertas-core.js.
(function (global) {
  'use strict';

  // O padrão histórico: no Sto. Antônio, cruz e vela liberadas a partir dos 7 anos.
  // Ele existia escrito no código em dois lugares; agora é só o valor inicial de um kit.
  var PADRAO = { comunidade: 'santo_antonio', funcoes: ['cruz', 'vela'], idade_min: 7 };

  // Aceita a configuração ANTIGA (um único `kit_leve`) e a nova (lista `kits`).
  // Nunca devolve nada vazio: sem config, vale o padrão histórico.
  function normalizarKits(ger) {
    ger = ger || {};
    if (Array.isArray(ger.kits) && ger.kits.length) {
      return ger.kits.map(function (k, i) {
        return {
          id: k.id || ('kit' + i),
          nome: k.nome || 'Kit',
          ativo: k.ativo !== false,
          modo: k.modo === 'trava' ? 'trava' : 'libera',
          comunidades: k.comunidades || (k.comunidade ? [k.comunidade] : []),
          funcoes: k.funcoes || [],
          idade_min: k.idade_min != null ? k.idade_min : 0,
          liberados: k.liberados || [],
        };
      });
    }
    var velho = ger.kit_leve || PADRAO;
    return [{
      id: 'leve', nome: 'Kit leve', ativo: true, modo: 'libera',
      comunidades: [velho.comunidade || PADRAO.comunidade],
      funcoes: velho.funcoes || PADRAO.funcoes,
      idade_min: velho.idade_min != null ? velho.idade_min : PADRAO.idade_min,
      liberados: [],
    }];
  }

  // Qual kit manda nesta função, nesta comunidade. Um kit desligado não manda em nada.
  function kitQueGoverna(kits, comunidade, funcao) {
    return (kits || []).filter(function (k) {
      return k.ativo !== false
        && (k.comunidades || []).indexOf(comunidade) >= 0
        && (k.funcoes || []).indexOf(funcao) >= 0;
    })[0] || null;
  }

  // A pergunta única: esta pessoa pode servir nesta função, nesta comunidade?
  //
  // Dois tipos de kit, e a diferença é o coração desta regra:
  //   'libera' — estar na idade JÁ BASTA, mesmo sem habilitação (é um atalho a mais).
  //   'trava'  — estar fora do critério IMPEDE, mesmo com habilitação (é uma proibição).
  // A trava nunca concede: quem passa nela ainda precisa da habilitação.
  function podeNaFuncao(o) {
    o = o || {};
    var kit = kitQueGoverna(o.kits, o.comunidade, o.funcao);

    if (kit && kit.modo === 'trava') {
      var liberado = (kit.liberados || []).indexOf(o.membroId) >= 0;
      if (!liberado) {
        if (o.idade == null) return false;          // idade desconhecida não vence trava
        if (o.idade < kit.idade_min) return false;
      }
      return !!o.temHabilitacao;
    }

    if (o.temHabilitacao) return true;

    if (kit && kit.modo === 'libera') {
      if (o.idade != null) return o.idade >= kit.idade_min;
      return (o.nivelInt || 0) >= 1;                // sem data → coroinha pra cima
    }
    return false;
  }


  // Por que esta marcação não vai valer? Responde só quando HÁ contradição: a pessoa foi
  // marcada como apta e mesmo assim um kit que TRAVA a reprova. Serve para a tela avisar
  // na hora de marcar, em vez de a pessoa sumir calada do campo de seleção da Escala.
  // Não repete a regra: pergunta à própria `podeNaFuncao`, para as duas telas nunca
  // discordarem. Devolve null quando não há nada a dizer.
  function avisoDeKit(o) {
    o = o || {};
    if (!o.temHabilitacao) return null;              // sem marcação não há contradição
    if (podeNaFuncao(o)) return null;                // passa: nada a avisar
    var kit = kitQueGoverna(o.kits, o.comunidade, o.funcao);
    if (!kit || kit.modo !== 'trava') return null;   // quem tira é a trava, e só ela
    return {
      motivo: o.idade == null ? 'sem_data' : 'idade',
      idadeMin: kit.idade_min,
      // Uma trava sem idade mínima ainda reprova quem não tem data de nascimento. Sem este
      // campo a tela escrevia "exige 0 anos" e culpava a idade por uma regra que é outra.
      exigeIdade: kit.idade_min > 0,
      kit: kit.nome,
      comunidade: o.comunidade,
    };
  }

  // A mesma pergunta, para TODAS as comunidades em que a pessoa pode servir. A Escala
  // decide pela comunidade da MISSA, não pela do membro, e quem tem
  // `pode_outras_comunidades` aparece nas missas das outras — perguntar só pela comunidade
  // da pessoa deixa calado justamente o caso cruzado. Devolve uma lista (pode ser vazia).
  function avisosDeKit(o) {
    o = o || {};
    var res = [];
    (o.comunidades || []).forEach(function (com) {
      var a = avisoDeKit(Object.assign({}, o, { comunidade: com }));
      if (a) res.push(a);
    });
    return res;
  }

  var api = { podeNaFuncao: podeNaFuncao, normalizarKits: normalizarKits, kitQueGoverna: kitQueGoverna, avisoDeKit: avisoDeKit, avisosDeKit: avisosDeKit };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else {                                            // mesmo contrato de navegacao-core.js:
    global.podeNaFuncao = podeNaFuncao;             // as telas chamam pelo nome direto
    global.normalizarKits = normalizarKits;
    global.kitQueGoverna = kitQueGoverna;
    global.avisoDeKit = avisoDeKit;
    global.avisosDeKit = avisosDeKit;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
