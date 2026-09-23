// Rodízio: as contas de quem está parado, sem tela e sem rede.
(function (global) {
  'use strict';

  // Datas do banco são data PURA ('2026-09-23'), sem hora e sem fuso. Lendo em UTC dos dois
  // lados, a diferença é exatamente o número de dias — sem a hora de horário de verão sobrando.
  function _dias(deISO, ateISO) {
    return Math.round((Date.parse(ateISO + 'T00:00:00Z') - Date.parse(deISO + 'T00:00:00Z')) / 86400000);
  }

  // Quantas semanas INTEIRAS se passaram desde `dataISO`. Sem data → null ("nunca"),
  // nunca 0: zero diria "foi esta semana" de quem nunca foi.
  function semanasSem(dataISO, hojeISO) {
    if (!dataISO) return null;
    var d = _dias(dataISO, hojeISO);
    if (!(d > 0)) return 0;   // data de hoje ou do futuro não vira semana negativa
    return Math.floor(d / 7);
  }


  var SERVIU = ['presente', 'atrasado'];
  var FALTOU = ['ausente', 'ausente_justificado'];

  function _maior(a, b) { return (!a || (b && b > a)) ? b : a; }

  // Uma linha por MEMBRO (nunca por escala): escala de quem saiu da lista viraria
  // linha fantasma, com nome vazio, no meio de quem importa.
  function montarRodizio(opts) {
    opts = opts || {};
    var hoje = opts.hoje;
    var meta = opts.meta == null ? META_PADRAO : opts.meta;
    var mesCorrente = mesDe(hoje);
    var por = {};
    var linhas = (opts.membros || []).map(function (m) {
      var l = { membro: m, ultimaEscalada: null, ultimaServida: null, ultimaPendente: null,
                faltas: 0, jaNaProxima: false, chamadaPendente: false,
                semEscalar: null, semServir: null, vezesNoMes: 0, abaixoDaRegra: true };
      por[m.id] = l;
      return l;
    });

    (opts.escalas || []).forEach(function (e) {
      if (!e.data) return;
      var titular = por[e.membro_id];

      // A REGRA é do MÊS, e conta escala já montada para os dias que ainda vêm: a pergunta
      // da coordenação é "dá tempo de arrumar?", e esconder quem já está encaixada mandaria
      // encaixar de novo. Por isso esta contagem vem ANTES do corte de futuro lá embaixo.
      if (titular && mesDe(e.data) === mesCorrente) titular.vezesNoMes++;

      // Celebração que ainda não aconteceu não mexe em relógio de passado — só avisa que a
      // pessoa já está encaixada. Sem isso, "sem escalar" viraria semana negativa.
      if (e.data > hoje) { if (titular) titular.jaNaProxima = true; return; }

      if (titular) {
        titular.ultimaEscalada = _maior(titular.ultimaEscalada, e.data);
        if (SERVIU.indexOf(e.status) >= 0) titular.ultimaServida = _maior(titular.ultimaServida, e.data);
        else if (FALTOU.indexOf(e.status) >= 0) titular.faltas++;
        else if (e.status === 'escalado') titular.ultimaPendente = _maior(titular.ultimaPendente, e.data);
        // 'substituido': foi escalado e não serviu — e NÃO é falta dele. Quem avisou a tempo
        // e arrumou quem fosse no lugar não fez nada de errado.
      }

      // O substituto serviu de verdade: os dois relógios dele zeram.
      if (e.status === 'substituido' && e.substituto_id) {
        var sub = por[e.substituto_id];
        if (sub) {
          sub.ultimaEscalada = _maior(sub.ultimaEscalada, e.data);
          sub.ultimaServida = _maior(sub.ultimaServida, e.data);
        }
      }
    });

    linhas.forEach(function (l) {
      l.semEscalar = semanasSem(l.ultimaEscalada, hoje);
      l.semServir = semanasSem(l.ultimaServida, hoje);
      // Escala passada que ficou no 'escalado' e é mais nova que a última presença: a pessoa
      // provavelmente serviu e ninguém fechou a chamada. Pendência mais VELHA que a última
      // presença não acende — seria alarme falso.
      l.chamadaPendente = !!l.ultimaPendente && (!l.ultimaServida || l.ultimaPendente > l.ultimaServida);
      l.abaixoDaRegra = l.vezesNoMes < meta;
    });
    return linhas;
  }

  // A REGRA da pastoral (dita pelo dono em 23/09/2026): todo membro serve 2x por mês.
  // Fica como número, e não cravada no meio da conta, porque é decisão dele e pode mudar.
  var META_PADRAO = 2;

  function mesDe(dataISO) { return String(dataISO || '').slice(0, 7); }

  // Quantos fins de semana ainda CABEM no mês. É o que diz se a lista ainda é acionável:
  // "3 pessoas em zero e nenhum fim de semana sobrando" é outra conversa de "e ainda cabem 2".
  // O domingo de hoje não conta: encaixar alguém na missa de hoje é tarde.
  function fimDeSemanaRestantes(hojeISO) {
    var t = Date.parse(hojeISO + 'T00:00:00Z');
    var d = new Date(t);
    var mes = d.getUTCMonth(), n = 0;
    // anda até o próximo domingo e conta os domingos que ainda caem dentro do mês
    var prox = new Date(t + ((7 - d.getUTCDay()) % 7 || 7) * 86400000);
    while (prox.getUTCMonth() === mes) { n++; prox = new Date(prox.getTime() + 7 * 86400000); }
    return n;
  }

  function resumoDaRegra(linhas) {
    var l = linhas || [];
    return {
      cumpriram: l.filter(function (x) { return !x.abaixoDaRegra; }).length,
      total: l.length,
      emZero: l.filter(function (x) { return !x.vezesNoMes; }).length,
    };
  }

  // O fim de semana de uma data: o DOMINGO que o fecha. Sábado e domingo caem no mesmo balde
  // (contar os dois como fins de semana separados cortaria as vagas pela metade e dobraria o
  // piso do grupo); missa de meio de semana entra no fim de semana seguinte, sem virar um a mais.
  function _fimDeSemanaDe(dataISO) {
    var t = Date.parse(dataISO + 'T00:00:00Z');
    var dow = new Date(t).getUTCDay();          // 0 = domingo, 6 = sábado
    return new Date(t + ((7 - dow) % 7) * 86400000).toISOString().slice(0, 10);
  }

  // Média de vagas preenchidas por fim de semana COM celebração. Semana sem missa não entra
  // na conta: ela diluiria a média e faria o grupo parecer menor do que é.
  function vagasPorFimDeSemana(escalas) {
    if (!escalas || !escalas.length) return null;
    var baldes = {}, total = 0;
    escalas.forEach(function (e) {
      if (!e || !e.data) return;
      baldes[_fimDeSemanaDe(e.data)] = true;
      total++;
    });
    var n = Object.keys(baldes).length;
    return n ? Math.round(total / n) : null;
  }

  // O tamanho do grupo dita a espera. 177 pessoas disputando 76 vagas por fim de semana dão
  // uma vez a cada 2,3 — e o gerador não repete ninguém no mesmo fim de semana. Sem esta régua
  // na tela, "3 semanas parado" parece defeito quando é o piso do grupo.
  function pisoDoGrupo(opts) {
    opts = opts || {};
    var vagas = Number(opts.vagasPorFimDeSemana) || 0;
    var ativos = Number(opts.ativos) || 0;
    if (!vagas || !ativos) return null;   // sem medida não se inventa régua
    var semanas = ativos / vagas;
    return { semanas: Math.round(semanas * 10) / 10, teto: Math.ceil(semanas) };
  }

  var MOTIVOS = {
    no_piso: '—',
    ja_na_proxima: 'Já está na próxima escala',
    chamada_pendente: 'Chamada não fechada',
    sem_disponibilidade: 'Sem disponibilidade cadastrada',
    sem_habilitacao: 'Sem habilitação nenhuma',
    poucas_portas: 'Só uma função ou só um horário',
    gerador_nao_pegou: 'Tem tudo — o gerador não pegou',
  };

  // POR QUE esta pessoa está parada. A ordem é de fora para dentro: primeiro o que não é
  // problema (está no piso, já está encaixada), depois o que é cadastro, e só no fim o
  // gerador — que é a resposta certa para a maioria, e a que some se a lista só contar semanas.
  function motivoDe(linha, dados, teto) {
    linha = linha || {}; dados = dados || {};
    var sem = linha.semEscalar;
    if (sem != null && teto != null && sem <= teto) return 'no_piso';
    if (linha.jaNaProxima) return 'ja_na_proxima';
    if (linha.chamadaPendente) return 'chamada_pendente';
    if (!dados.faixas) return 'sem_disponibilidade';
    if (!dados.habilitacoes) return 'sem_habilitacao';
    if (dados.habilitacoes <= 1 || dados.faixas <= 1) return 'poucas_portas';
    return 'gerador_nao_pegou';
  }

  function rotuloDoMotivo(k) {
    return Object.prototype.hasOwnProperty.call(MOTIVOS, k) ? MOTIVOS[k] : '—';
  }

  var api = { semanasSem: semanasSem, montarRodizio: montarRodizio,
               pisoDoGrupo: pisoDoGrupo, vagasPorFimDeSemana: vagasPorFimDeSemana, motivoDe: motivoDe, rotuloDoMotivo: rotuloDoMotivo,
               META_PADRAO: META_PADRAO, mesDe: mesDe,
               fimDeSemanaRestantes: fimDeSemanaRestantes, resumoDaRegra: resumoDaRegra };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { global.RodizioCore = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this);
