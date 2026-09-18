// Regras PURAS do PROJETO — a tarefa que tem começo, meio e fim.
//
// Espelha `src/compartilhado/regras-de-projeto.js` do erickIA, a pedido do dono (18/09/2026):
// "quero o mais próximo possível da feature Áreas do erickIA". Os nomes dos campos são os
// DESTA casa (`prazo`, `concluido_em`, `passos`), não os de lá (`venc`, `feito`, `subtarefas`)
// — traduzir na borda é melhor do que carregar dois vocabulários no mesmo app.
//
// Projeto não é entidade nova: é uma tarefa com `tipo = 'projeto'`, e por isso herda prazo,
// hora, responsável, estados e etiqueta do time sem nenhuma tela aprender um conceito novo.
// MARCO é o passo COM prazo; passo sem prazo continua sendo só um passo.
//
// ⚠️ O QUE ESTA REGRA EXISTE PARA MOSTRAR: o risco não aparece na barra de progresso — aparece
// na COMPARAÇÃO entre quanto andou e quanto do tempo já correu. 30% feito com 80% do prazo
// consumido é um projeto que não vai fechar, e ninguém percebe olhando só o progresso.
//
// E a cicatriz que veio junto do erickIA: lá a barra de tempo lia um campo que NINGUÉM
// preenchia — ficava vazia para todo projeto, desde sempre, sem erro nenhum. Por isso aqui
// "não sei" é uma resposta explícita (null), e não um zero disfarçado.
//
// `hoje` entra por parâmetro: regra de data que lê o relógio por dentro não se prova.
(function (global) {
  'use strict';

  var MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

  function meiaNoite(iso) { var d = new Date(String(iso) + 'T00:00:00'); d.setHours(0, 0, 0, 0); return d; }
  function ehData(v) { return /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')); }
  function difEmDias(de, ate) { return Math.round((meiaNoite(ate) - meiaNoite(de)) / 86400000); }
  function diaMes(iso) {
    var d = meiaNoite(iso);
    return String(d.getDate()).padStart(2, '0') + '/' + MESES[d.getMonth()];
  }
  function feito(p) { return !!(p && p.concluido_em); }

  function ehProjeto(t) { return !!(t && t.tipo === 'projeto'); }

  // Os marcos, em ordem de prazo. Passo sem prazo não é marco — fica de fora.
  function marcosDe(t) {
    return ((t && t.passos) || [])
      .filter(function (p) { return ehData(p && p.prazo); })
      .sort(function (a, b) { return String(a.prazo).localeCompare(String(b.prazo)); });
  }

  // Quanto do TEMPO do projeto já correu, de 0 a 100. NULO quando não dá para saber: sem
  // início não existe caminho a medir, e inventar um número seria pior do que não mostrar.
  function percentualDoTempo(t, hoje) {
    if (!t || !ehData(t.inicio) || !ehData(t.prazo) || !ehData(hoje)) return null;
    var total = difEmDias(t.inicio, t.prazo);
    var corrido = difEmDias(t.inicio, hoje);
    if (total <= 0) return corrido >= 0 ? 100 : 0;   // começa e vence no mesmo dia
    return Math.max(0, Math.min(100, Math.round((corrido / total) * 100)));
  }

  // O retrato do projeto: quanto andou × quanto do tempo passou.
  function situacaoDoProjeto(t, hoje) {
    var passos = (t && t.passos) || [];
    var marcos = marcosDe(t);
    var feitos = passos.filter(feito).length;
    var vencidos = marcos.filter(function (m) { return !feito(m) && String(m.prazo) < String(hoje); });
    var diasRestantes = (t && ehData(t.prazo) && ehData(hoje)) ? difEmDias(hoje, t.prazo) : null;
    return {
      passos: passos.length,
      feitos: feitos,
      pctFeito: passos.length ? Math.round((feitos / passos.length) * 100) : 0,
      pctTempo: percentualDoTempo(t, hoje),
      diasRestantes: diasRestantes,
      marcos: marcos.length,
      marcosVencidos: vencidos.length,
      proximoMarco: marcos.filter(function (m) { return !feito(m); })[0] || null,
      // Atrasado é mais do que "passou do prazo final": um marco vencido já é atraso, e é o
      // aviso que chega a tempo de fazer alguma coisa.
      atrasado: vencidos.length > 0 || (diasRestantes !== null && diasRestantes < 0),
    };
  }

  // O que o cartão precisa para mostrar um Projeto COMO projeto. Devolve NULO para tarefa
  // comum: sem isto, dez projetos viram dez linhas iguais a tarefa qualquer, e some o
  // progresso, a janela e o aviso de marco vencido.
  function resumoDoProjeto(t, hoje) {
    if (!ehProjeto(t)) return null;
    var s = situacaoDoProjeto(t, hoje);
    var marcos = marcosDe(t);
    return {
      marcosFeitos: marcos.filter(feito).length,
      marcosTotal: s.marcos,
      pctFeito: s.pctFeito,
      pctTempo: s.pctTempo,
      diasRestantes: s.diasRestantes,
      // A JANELA, e não só o fim: um projeto que começa em 30/09 e vence em 05/10 é outra
      // coisa de um que começou em 14/09 e vence no mesmo dia.
      janela: (ehData(t.inicio) && ehData(t.prazo)) ? (diaMes(t.inicio) + ' → ' + diaMes(t.prazo))
        : (ehData(t.prazo) ? diaMes(t.prazo) : ''),
      atrasado: s.atrasado,
      marcosVencidos: s.marcosVencidos,
      proximoMarco: s.proximoMarco,
    };
  }

  var api = {
    ehProjeto: ehProjeto, marcosDe: marcosDe,
    situacaoDoProjeto: situacaoDoProjeto, resumoDoProjeto: resumoDoProjeto,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else {
    global.ProjetoDaArea = api;
    global.ehProjeto = ehProjeto;
    global.marcosDe = marcosDe;
    global.situacaoDoProjeto = situacaoDoProjeto;
    global.resumoDoProjeto = resumoDoProjeto;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
