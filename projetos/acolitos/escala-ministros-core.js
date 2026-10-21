// Escala dos ministros (MECE): ler o texto do PDF e casar os nomes com os pais dos acólitos.
// PURO (sem DOM, sem rede), no padrão de confirmar-escala-core.js e kits-core.js.
// O robô do São Tarcísio importa ESTE mesmo arquivo (não há cópia).
//
// Como o texto do PDF chega (Google Drive): NÃO é linear. Primeiro vêm todos os títulos de
// dia ("SÁBADO 24/out", "Nossa Sra Aparecida 12/out"...), depois os blocos de nomes, um por
// linha ("17:00h Rita E. Eder ... 18:30h Ceilma Roseval 7:00h Vani ..."), na mesma ordem dos
// dias. Um bloco pode trazer DOIS dias (sábado + domingo): o dia seguinte começa onde a hora
// volta para trás (18h30 → 7h). Cada linha nova também começa um dia novo.
// A adoração (14h "EXPOR SANTÍSSIMO" ... "RETIRAR SANTÍSSIMO") não é missa e fica de fora.
(function (global) {
  'use strict';

  var MESES = { jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12 };
  var PARTICULAS = { de: 1, da: 1, do: 1, das: 1, dos: 1, e: 1 };

  // Mesmo comportamento do nomeLimpo do robô (tarcisio-robo/regras.mjs), copiado aqui.
  function nomeLimpo(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  }
  function dois(n) { return (n < 10 ? '0' : '') + n; }

  var RE_DATA = /(\d{1,2})\/(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\b/gi;
  var RE_HORA = /^(\d{1,2}):(\d{2})h$/i;
  var RE_ADORACAO = /adora[cç][aã]o|sant[ií]ssimo/i;

  // Títulos de dia, em ordem. Linha de adoração ("ADORAÇÃO 4/out") não é título de missa.
  function titulos(linhas, ano) {
    var datas = [], mes0 = null, anoAtual = ano;
    linhas.forEach(function (l) {
      if (RE_HORA.test(l.split(/\s+/)[0] || '') || RE_ADORACAO.test(l)) return;
      var m; RE_DATA.lastIndex = 0;
      while ((m = RE_DATA.exec(l))) {
        var dia = +m[1], mes = MESES[m[2].toLowerCase()];
        if (dia < 1 || dia > 31) continue;
        if (mes0 !== null && mes < mes0) anoAtual = ano + 1;   // dezembro → janeiro
        if (mes0 === null) mes0 = mes;
        datas.push(anoAtual + '-' + dois(mes) + '-' + dois(dia));
      }
    });
    return datas;
  }

  // Só usado logo depois da hora (nome de lugar); no meio dos nomes, "JB" é gente.
  function maiuscula(tok) { return /^[A-ZÀ-Ý]{2,}$/.test(tok); }   // "MORRO", "ALTO", "EXPOR"

  // Nomes de um trecho (a adoração, com EXPOR/RETIRAR, já foi cortada antes): palavra com ponto ("E.", "Bot.", "S.R") é a inicial de quem veio antes.
  function nomesDe(toks) {
    var nomes = [];
    toks.forEach(function (t) {
      t.split('/').forEach(function (p) {
        if (!p) return;
        if (p.indexOf('.') >= 0 && nomes.length && nomes[nomes.length - 1].indexOf(' ') < 0) nomes[nomes.length - 1] += ' ' + p;
        else if (/^[A-Za-zÀ-ÿ]/.test(p)) nomes.push(p);
      });
    });
    return nomes;
  }

  // Grupos de dia: cada um é uma lista de { minutos, horario, comunidade, nomes }.
  function gruposDeDia(linhas) {
    var grupos = [];
    for (var i = 0; i < linhas.length; i++) {
      var toks = linhas[i].split(/\s+/);
      if (!RE_HORA.test(toks[0])) continue;
      if (RE_ADORACAO.test(linhas[i])) break;   // daqui em diante é a adoração
      var grupo = [], anterior = -1, atual = null;
      grupos.push(grupo);
      toks.forEach(function (t) {
        var h = RE_HORA.exec(t);
        if (h) {
          var min = (+h[1]) * 60 + (+h[2]);
          if (anterior >= 0 && min < anterior) { grupo = []; grupos.push(grupo); }
          anterior = min;
          atual = { min: min, horario: (+h[1]) + 'h' + (h[2] === '00' ? '' : h[2]), comunidade: h[2] === '30' && +h[1] === 18 ? 'santo_antonio' : 'matriz', toks: [], lugar: true };
          grupo.push(atual);
          return;
        }
        if (!atual) return;
        if (atual.lugar && maiuscula(t)) { atual.comunidade = 'outra'; return; }   // "8:30h MORRO ALTO"
        atual.lugar = false;
        atual.toks.push(t);
      });
    }
    return grupos;
  }

  // Sábado começa às 17h ou depois; domingo começa antes do meio-dia. Dia de semana
  // (feriado, como 12/out numa segunda) não é conferido.
  function diaConfere(data, min) {
    var p = String(data || '').split('-'), dow = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).getUTCDay();
    if (dow === 6) return min >= 17 * 60;
    if (dow === 0) return min < 12 * 60;
    return true;
  }

  function lerEscalaMinistros(texto, ano) {
    try {
      if (typeof texto !== 'string' || !texto.trim()) return [];
      ano = +ano || new Date().getFullYear();
      var linhas = texto.split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
      var datas = titulos(linhas, ano), grupos = gruposDeDia(linhas), saida = [];
      // Travas de mês ilegível: o casamento dia↔bloco é por ORDEM, então um bloco a menos
      // ou a mais desloca todas as datas seguintes sem ninguém ver. Na dúvida, nada.
      if (datas.length !== grupos.length) return [];
      for (var i = 0; i < grupos.length; i++) if (!diaConfere(datas[i], grupos[i][0].min)) return [];
      grupos.forEach(function (g, i) {
        g.forEach(function (m) {
          var nomes = nomesDe(m.toks);
          if (nomes.length) saida.push({ data: datas[i], horario: m.horario, comunidade: m.comunidade, nomes: nomes });
        });
      });
      return saida;
    } catch (e) { return []; }
  }

  // ---------- casar nomes do PDF com os pais ministros ----------

  function partesDoPdf(nome) {
    var p = nomeLimpo(nome).split(' ');
    return { primeiro: p[0] || '', inicial: (p[1] || '').replace(/[^a-z]/g, '').charAt(0) };
  }
  // Iniciais aceitas do pai/mãe: a 1ª letra da 2ª palavra CRUA e a da 1ª palavra que não é
  // partícula (de/da/do/das/dos/e). "Rita de Cássia" aceita "Rita D." e "Rita C.".
  function partesDoPai(nome) {
    var p = nomeLimpo(nome).split(' ').filter(Boolean);
    var resto = p.slice(1).filter(function (x) { return !PARTICULAS[x]; });
    var iniciais = [(p[1] || '').charAt(0), (resto[0] || '').charAt(0)].filter(Boolean);
    return { primeiro: p[0] || '', iniciais: iniciais };
  }
  function nomeDoPai(m, pm) { return pm === 'pai' ? m.nome_pai_ministro : m.nome_mae_ministro; }
  function temPai(m, pm) { return pm === 'pai' ? m.tem_pai_ministro === true : m.tem_mae_ministro === true; }

  function candidatos(nome, membros) {
    var pdf = partesDoPdf(nome), saida = [];
    if (!pdf.primeiro) return saida;
    membros.forEach(function (m) {
      if (!m) return;
      ['pai', 'mae'].forEach(function (pm) {
        if (!temPai(m, pm) || !nomeDoPai(m, pm)) return;
        var pai = partesDoPai(nomeDoPai(m, pm));
        if (pai.primeiro !== pdf.primeiro) return;
        if (pdf.inicial && pai.iniciais.length && pai.iniciais.indexOf(pdf.inicial) < 0) return;
        saida.push({ membro_id: m.id, pai_ou_mae: pm, rotulo: (pm === 'pai' ? 'pai de ' : 'mãe de ') + m.nome });
      });
    });
    return saida;
  }

  function casarNomes(lidos, membros, apelidos) {
    var r = { casados: [], duvidas: [], ignorados: [] };
    try {
      lidos = Array.isArray(lidos) ? lidos : [];
      membros = Array.isArray(membros) ? membros : [];
      apelidos = Array.isArray(apelidos) ? apelidos : [];
      var porId = {};
      membros.forEach(function (m) { if (m) porId[m.id] = m; });
      var jaDuvida = {}, jaIgnorado = {};

      lidos.forEach(function (l) {
        (l && Array.isArray(l.nomes) ? l.nomes : []).forEach(function (nome) {
          var chave = nomeLimpo(nome), primeiro = partesDoPdf(nome).primeiro;
          var memorias = apelidos.filter(function (a) { return a && nomeLimpo(a.nome_pdf) === chave; });
          // "sim" só vale se o membro ainda tem esse pai ministro com o mesmo primeiro nome
          var sims = memorias.filter(function (a) {
            var m = porId[a.membro_id];
            return a.resposta === 'sim' && m && temPai(m, a.pai_ou_mae) && partesDoPai(nomeDoPai(m, a.pai_ou_mae)).primeiro === primeiro;
          });
          var opcoes = sims.length
            ? sims.map(function (a) { return { membro_id: a.membro_id, pai_ou_mae: a.pai_ou_mae }; })
            : candidatos(nome, membros).filter(function (o) {
                return !memorias.some(function (a) { return a.resposta === 'nao' && a.membro_id === o.membro_id && a.pai_ou_mae === o.pai_ou_mae; });
              });
          if (sims.length || opcoes.length === 1) {
            opcoes.forEach(function (o) {
              r.casados.push({ data: l.data, horario: l.horario, comunidade: l.comunidade, membro_id: o.membro_id, pai_ou_mae: o.pai_ou_mae, nome: nome });
            });
          } else if (opcoes.length > 1) {
            if (!jaDuvida[chave]) { jaDuvida[chave] = true; r.duvidas.push({ nome: nome, opcoes: opcoes }); }
          } else if (!jaIgnorado[chave]) { jaIgnorado[chave] = true; r.ignorados.push(nome); }
        });
      });
      return r;
    } catch (e) { return r; }
  }

  var api = { lerEscalaMinistros: lerEscalaMinistros, casarNomes: casarNomes, nomeLimpo: nomeLimpo };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { global.lerEscalaMinistros = lerEscalaMinistros; global.casarNomes = casarNomes; }   // pelo NOME
})(typeof globalThis !== 'undefined' ? globalThis : this);
