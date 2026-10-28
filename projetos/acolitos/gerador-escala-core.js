// Gerador de escala: a regra pura, sem tela e sem rede (igual kits-core.js e rodizio-core.js).
// Foi MOVIDO de escala.html sem mudar a lógica nem a ordem de desempate; o que mudou é só
// de onde vêm os dados (campos de `entrada` em vez de variáveis globais da página) e o
// sorteio (`entrada.rnd` em vez de Math.random), para dar para testar e para rodar sem tela.
(function (global) {
  'use strict';

  var node = typeof module !== 'undefined' && module.exports;
  var kits = node ? require('./kits-core.js') : global;
  var podeNaFuncao = kits.podeNaFuncao, normalizarKits = kits.normalizarKits;
  var SemanalCore = node ? require('./servir-semanal-core.js') : global.SemanalCore;
  var RodizioCore = node ? require('./rodizio-core.js') : global.RodizioCore;
  var compararHorario = (node ? require('./horario-core.js') : global).compararHorario;

  var MAIORES_PADRAO = ['cred_altar', 'cred_credencia', 'missal', 'turibulo', 'naveta', 'mitra', 'baculo'];
  var SEM_CERIMONIARIO = ['apoio']; // cerimoniário só tem apoio automático ao aderir ao plano semanal

  // Espelho de shared.js NIVEIS (int por slug de nível da jornada), como em gerador-substituto.js
  var NIVEL_INT = {
    aspirante: 0, coroinha: 1, acolito_aspirante: 2, acolito_guardiao: 3, acolito_sentinela: 4,
    aspirante_cerimoniario: 5, cerimoniario_aspirante: 6, cerimoniario_guardiao: 7,
    cerimoniario_magistral: 8, cerimoniario_mor: 9
  };
  function nivelInt(slug) { return NIVEL_INT[slug] != null ? NIVEL_INT[slug] : 0; }
  function calcIdade(dataNasc, hoje) {
    var h = hoje || new Date(), nasc = new Date(dataNasc);
    var idade = h.getFullYear() - nasc.getFullYear();
    var m = h.getMonth() - nasc.getMonth();
    if (m < 0 || (m === 0 && h.getDate() < nasc.getDate())) idade--;
    return idade;
  }
  // mesma regra de escala.html horKeyDe: chave de disponibilidade "domingo_9h" / "sabado_19h"
  function horKeyDe(celeb) {
    const dow = new Date(celeb.data + 'T00:00:00').getDay();
    const diaKey = dow === 0 ? 'domingo' : dow === 6 ? 'sabado' : null;
    return diaKey ? diaKey + '_' + celeb.horario : null;
  }

  function maioresDe(config) {
    var mm = config && config.funcoes_maiores;
    return new Set(Array.isArray(mm) && mm.length ? mm : MAIORES_PADRAO);
  }

  // Quem pode servir numa função é regra pura e mora em kits-core.js. Aqui só se junta o que
  // a tela sabe da pessoa. Dois tipos de kit: 'libera' (a idade concede a função mesmo sem
  // habilitação) e 'trava' (estar fora do critério proíbe, mesmo com habilitação).
  // ctx = { habMap, config, hoje }
  function elegivelFuncao(ctx, m, f, comKey) {
    var h = ((ctx.habMap || {})[m.id] || {})[f];
    var ger = (ctx.config && ctx.config.gerador) || {};
    return podeNaFuncao({
      kits: normalizarKits(ger),
      comunidade: comKey,
      funcao: f,
      membroId: m.id,
      temHabilitacao: ['apto', 'experiente', 'referencia'].includes(h),
      idade: m.data_nascimento ? calcIdade(m.data_nascimento, ctx.hoje) : null,
      nivelInt: nivelInt(m.nivel || 'aspirante'),
    });
  }

  // Núcleo do gerador de UMA missa. vagas = array de funções (uma por vaga aberta). Retorna array alinhado de membro_id|null.
  // Regras: apto + não-ausente + sem repetir na missa; IRMÃOS juntos = bloco tudo-ou-nada;
  //   cerimoniários priorizados nas MAIORES (só em último caso vão p/ menores); não repetir no fim de semana (usadoFds);
  //   COMUNIDADE da missa preferida (cruza só faltando); rodízio justo do mês (carga); mix de experiência nas menores.
  // ctx = { membros, habMap, dispMap, config, rnd, hoje }
  function planejarVagas(ctx, vagas, horKey, ausNesta, usados, carga, usadoFds, comKey, data, historico) {
    var membros = ctx.membros, habMap = ctx.habMap || {}, dispMap = ctx.dispMap || {}, rnd = ctx.rnd;
    var FUNCOES_MAIORES = maioresDe(ctx.config), FUNCOES_SEM_CERIMONIARIO = new Set(SEM_CERIMONIARIO);
    usadoFds = usadoFds || new Set();
    const res = new Array(vagas.length).fill(null);
    const nint = {}; membros.forEach(m => { nint[m.id] = nivelInt(m.nivel || 'aspirante'); });
    const memById = {}; membros.forEach(m => { memById[m.id] = m; });
    const apta = (id, f) => { const m = memById[id]; if (!m) return false; if (FUNCOES_SEM_CERIMONIARIO.has(f) && nint[id] >= 6 && !m.servir_toda_semana) return false; return elegivelFuncao(ctx, m, f, comKey) && SemanalCore.pode(m, f, data, historico, habMap); }; // apoio de cerimoniário exige adesão explícita ao plano semanal
    const disp = id => !horKey || (dispMap[id] || []).includes(horKey);
    const livres = () => res.map((r, i) => r ? -1 : i).filter(i => i >= 0);
    // sobe O MÊS e a janela de uma vez: subir só a janela deixaria quem acabou de ser
    // escalado ainda valendo como "0 no mês" para a vaga seguinte.
    const assign = (i, id) => { res[i] = id; usados.add(id); usadoFds.add(id); carga[id] = (carga[id] || 0) + RodizioCore.PESO_MES + 1; if (historico) historico.push({ membro_id: id, funcao: vagas[i], data }); };
    const bloqueados = new Set();
    const ehCerimo = m => nint[m.id] >= 6; // cerimoniário = nível 6+
    // POOL DURO: apto + DISPONÍVEL no horário + não-ausente + sem repetir na missa + não bloqueado
    const cands = (i) => membros.filter(m => apta(m.id, vagas[i]) && disp(m.id) && !usados.has(m.id) && !ausNesta.has(m.id) && !bloqueados.has(m.id));

    function placeUnit(ids) {
      const slots = livres();
      const order = ids.slice().sort((a, b) => slots.filter(i => apta(a, vagas[i])).length - slots.filter(i => apta(b, vagas[i])).length);
      const used = new Set(); const plan = [];
      for (const id of order) {
        const idx = slots.find(i => !used.has(i) && apta(id, vagas[i]));
        if (idx === undefined) return false;
        used.add(idx); plan.push([idx, id]);
      }
      plan.forEach(([i, id]) => assign(i, id));
      return true;
    }

    // Matriz: reserva a cruz para um cerimoniário elegível antes das demais funções.
    // O pool mantém idade/kit, habilitação, disponibilidade, ausência e plano semanal.
    if (comKey === 'matriz') livres().filter(i => vagas[i] === 'cruz').forEach(i => {
      const pool = cands(i).filter(m => ehCerimo(m) && !usadoFds.has(m.id));
      if (!pool.length) return;
      const mesma = m => (m.comunidade || '') === comKey;
      const grupo = [pool.filter(mesma), pool.filter(m => !mesma(m) && m.pode_outras_comunidades), pool].find(t => t.length).slice();
      grupo.sort((a,b) => ((carga[a.id] || 0) - (carga[b.id] || 0)) || (rnd() - 0.5));
      assign(i, grupo[0].id);
    });

    if (membros.some(m => m.servir_toda_semana)) {
      const slots = livres(), pools = new Map(slots.map(i => [i, new Set(cands(i).map(m => m.id))]));
      SemanalCore.reservar(membros, slots, (m, i) => pools.get(i).has(m.id)).forEach(({ slot, membro }) => assign(slot, membro.id));
    }

    // 0) COMPLETAR FAMÍLIA dos já escalados (manual/existente): irmãos que servem junto entram também.
    //    Não remove a escolha manual — só adiciona o(s) irmão(s) disponível(is) numa vaga apta.
    Array.from(usados).forEach(id => {
      const m = membros.find(x => x.id === id);
      if (!m || !m.escalar_com_irmao || !m.grupo_irmaos) return;
      membros.filter(x => x.grupo_irmaos === m.grupo_irmaos && x.escalar_com_irmao && x.id !== id && !usados.has(x.id) && !ausNesta.has(x.id) && disp(x.id))
        .forEach(irm => { const i = livres().find(j => apta(irm.id, vagas[j])); if (i !== undefined) assign(i, irm.id); });
    });

    // 1) blocos de irmãos (tudo-ou-nada)
    const visited = new Set(); const sibUnits = [];
    membros.forEach(m => {
      if (visited.has(m.id)) return;
      if (m.escalar_com_irmao && m.grupo_irmaos) {
        const grp = membros.filter(x => x.grupo_irmaos === m.grupo_irmaos && x.escalar_com_irmao);
        grp.forEach(x => visited.add(x.id));
        const unit = grp.filter(x => !usados.has(x.id) && !usadoFds.has(x.id) && !ausNesta.has(x.id) && disp(x.id) && livres().some(i => apta(x.id, vagas[i])));
        if (unit.length >= 2) sibUnits.push(unit.map(x => x.id));
      } else visited.add(m.id);
    });
    sibUnits.sort((A, B) => {
      const ua = A.some(id => usadoFds.has(id)) ? 1 : 0, ub = B.some(id => usadoFds.has(id)) ? 1 : 0; if (ua !== ub) return ua - ub;
      const fa = Math.min(...A.map(id => carga[id] || 0)), fb = Math.min(...B.map(id => carga[id] || 0)); return (fa - fb) || (B.length - A.length);
    });
    sibUnits.forEach(u => { if (!placeUnit(u)) u.forEach(id => bloqueados.add(id)); });

    const mesmaCom = m => !comKey || (m.comunidade || '') === comKey;

    // 2) vagas individuais — funções MAIORES primeiro (cerimoniários nelas), depois mais escassas
    livres()
      .map(i => ({ i, maior: FUNCOES_MAIORES.has(vagas[i]), n: cands(i).length }))
      .sort((a, b) => (b.maior ? 1 : 0) - (a.maior ? 1 : 0) || a.n - b.n)
      .forEach(({ i }) => {
        if (res[i]) return;
        const menor = !FUNCOES_MAIORES.has(vagas[i]);
        const pool = cands(i); // já filtrado por disponibilidade (duro)
        if (!pool.length) return; // ninguém apto E disponível → vaga fica VAZIA (não força)
        // CAMADA DE COMUNIDADE: prefere quem é da comunidade da missa; cruza só faltando (e quem pode); por fim qualquer
        const comTiers = [pool.filter(mesmaCom),
          pool.filter(m => !mesmaCom(m) && m.pode_outras_comunidades),
          pool];
        const comPool = comTiers.find(t => t.length);
        // camadas internas — cada uma só usada se a anterior estiver vazia:
        const tiers = menor
          ? [comPool.filter(m => !ehCerimo(m) && !usadoFds.has(m.id)),  // 1) não-cerimoniário e novo no fds
            comPool.filter(m => !ehCerimo(m)),                         // 2) não-cerimoniário (mesmo repetindo)
            comPool.filter(m => !usadoFds.has(m.id)),                  // 3) novo no fds (aceita cerimoniário)
            comPool]                                                   // 4) qualquer (último caso)
          : [comPool.filter(m => !usadoFds.has(m.id)),                 // maior: 1) ainda não usado no fds
            comPool];                                                  // 2) qualquer
        // ORDENA: rodízio primeiro (quem serviu menos no histórico), e EMPATE É ALEATÓRIO.
        // (nível/mix saíram do meio de propósito — eram determinísticos e causavam repetição semana a semana.)
        const grupo = tiers.find(t => t.length).slice();
        grupo.sort((a, b) => {
          if ((carga[a.id] || 0) !== (carga[b.id] || 0)) return (carga[a.id] || 0) - (carga[b.id] || 0); // RODÍZIO
          return rnd() - 0.5;                                                                              // empate → aleatório (varia)
        });
        const escolhido = grupo[0];
        assign(i, escolhido.id);
      });
    return res;
  }

  // Gera a escala de um fim de semana inteiro (preenche só as vagas ainda vazias). PURO: devolve
  // as linhas novas; quem grava (e quem NÃO avisa ninguém) é a tela.
  // entrada.todosDaSemana (opcional): as missas do fim de semana INTEIRO, mesmo as fora da seleção —
  // a regra "ninguém repete no fim de semana" precisa delas. Default = celebracoes.
  // entrada.escalasExistentes: { celebracao_id: [{membro_id, funcao}] }.
  function gerarSemana(entrada) {
    var membros = entrada.membros, habMap = entrada.habMap || {}, dispMap = entrada.dispMap || {};
    var rnd = entrada.rnd, modeloFor = entrada.modeloFor;
    var escalasMap = entrada.escalasExistentes || {}, ausFresh = entrada.ausencias || {};
    var ctx = { membros: membros, habMap: habMap, dispMap: dispMap, config: entrada.config || {}, rnd: rnd, hoje: entrada.hoje };
    var FUNCOES_MAIORES = maioresDe(ctx.config), FUNCOES_SEM_CERIMONIARIO = new Set(SEM_CERIMONIARIO);
    var celebs = entrada.celebracoes;
    var carga = Object.assign({}, entrada.carga || {});
    var historico = (entrada.historicoSemanal || []).slice();

    const ordc = celebs.slice().sort((a, b) => a.data.localeCompare(b.data) || compararHorario(a.horario, b.horario));
    const todosFds = (entrada.todosDaSemana && entrada.todosDaSemana.length) ? entrada.todosDaSemana : celebs;
    const usadoFds = new Set();                // ninguém repete no fim de semana
    todosFds.forEach(c => (escalasMap[c.id] || []).forEach(e => usadoFds.add(e.membro_id))); // já escalados contam
    const nint = {}; membros.forEach(m => { nint[m.id] = nivelInt(m.nivel || 'aspirante'); });
    const ehCerimo = m => nint[m.id] >= 6;

    // Monta TODAS as vagas abertas da semana (de todas as missas)
    const usadosMissa = {}; const slots = [];
    ordc.forEach(c => {
      const existing = escalasMap[c.id] || [];
      usadosMissa[c.id] = new Set(existing.map(e => e.membro_id));
      const existPorFunc = {}; existing.forEach(e => { existPorFunc[e.funcao] = (existPorFunc[e.funcao] || 0) + 1; });
      const cnt = {};
      modeloFor(c.tipo, c.comunidade).forEach(s => {
        cnt[s.funcao] = (cnt[s.funcao] || 0) + 1;
        if (cnt[s.funcao] > (existPorFunc[s.funcao] || 0)) slots.push({ c, funcao: s.funcao, hk: horKeyDe(c), com: c.comunidade, filled: false });
      });
    });
    var ger = ctx.config.gerador || {}, minimoMes = Number(ger.minimo_mes); if (!(minimoMes > 0)) minimoMes = 2;
    // entrada.vezesNoMes { membro_id: n }: as vezes EXATAS do mês. Só com elas o teto do mês vale
    // (a carga é peso de rodízio — "frequente" tira meia vez — e não serve de contagem dura).
    // Sem elas a geração é a de sempre (paridade com o código antigo) e a conta de
    // alemDoMinimo usa a parte "mês" da carga.
    // Pode vir POR MÊS ({ '2026-10': {id: n}, '2026-11': {...} }): um fim de semana que cruza o mês
    // (31/10 e 01/11) conta cada missa no mês dela. Chave simples { id: n } vale para todas as missas.
    var vezesBase = (entrada.vezesNoMes && typeof entrada.vezesNoMes === 'object') ? entrada.vezesNoMes : null;
    var porMes = !!vezesBase && Object.keys(vezesBase).some(function (k) { return /^\d{4}-\d{2}$/.test(k); });
    const mesDe = c => String((c && c.data) || '').slice(0, 7);
    var novasPorMes = {}, semTeto = !vezesBase;
    const novasDe = (id, mes) => ((novasPorMes[mes] || {})[id] || 0);
    // quem tem "Servir toda semana" segue a regra própria (4×, SemanalCore): o mínimo dele é 4.
    const minimoDe = m => m && m.servir_toda_semana ? Math.max(minimoMes, RodizioCore.metaDoMembro(m)) : minimoMes;
    const vezes = (id, mes) => (vezesBase ? ((porMes ? (vezesBase[mes] || {}) : vezesBase)[id] || 0) : Math.floor(((entrada.carga || {})[id] || 0) / RodizioCore.PESO_MES)) + novasDe(id, mes);
    // pool DURO de candidatos p/ uma vaga, no estado atual
    const candsDe = s => {
      const aus = ausFresh[s.c.id] || new Set();
      return membros.filter(m => elegivelFuncao(ctx, m, s.funcao, s.com)
        && !(FUNCOES_SEM_CERIMONIARIO.has(s.funcao) && ehCerimo(m) && !m.servir_toda_semana)
        && SemanalCore.pode(m, s.funcao, s.c.data, historico, habMap)
        && (!s.hk || (dispMap[m.id] || []).includes(s.hk))
        && !usadoFds.has(m.id) && !usadosMissa[s.c.id].has(m.id) && !aus.has(m.id)
        && (semTeto || vezes(m.id, mesDe(s.c)) < minimoDe(m)));
    };
    // escolha dentro do pool: comunidade → reserva cerimoniário (nas menores) → RODÍZIO → aleatório
    const escolher = (s, pool) => {
      const mesmaCom = m => !s.com || (m.comunidade || '') === s.com;
      const comPool = [pool.filter(mesmaCom), pool.filter(m => !mesmaCom(m) && m.pode_outras_comunidades), pool].find(t => t.length);
      const menor = !FUNCOES_MAIORES.has(s.funcao);
      const tiers = menor ? [comPool.filter(m => !ehCerimo(m)), comPool] : [comPool];
      const grupo = tiers.find(t => t.length).slice();
      // 2ª passada (além do mínimo): o MENOS servido no mês primeiro; depois o rodízio de sempre.
      if (semTeto && vezesBase) grupo.sort((a, b) => (vezes(a.id, mesDe(s.c)) - vezes(b.id, mesDe(s.c))) || ((carga[a.id] || 0) - (carga[b.id] || 0)) || (rnd() - 0.5));
      else grupo.sort((a, b) => ((carga[a.id] || 0) - (carga[b.id] || 0)) || (rnd() - 0.5));
      return grupo[0];
    };
    const novas = [];
    const colocar = (s, m) => {
      s.filled = true; usadoFds.add(m.id); usadosMissa[s.c.id].add(m.id); carga[m.id] = (carga[m.id] || 0) + RodizioCore.PESO_MES + 1;
      novas.push({ celebracao_id: s.c.id, membro_id: m.id, funcao: s.funcao }); (novasPorMes[mesDe(s.c)] = novasPorMes[mesDe(s.c)] || {})[m.id] = novasDe(m.id, mesDe(s.c)) + 1;
      historico.push({ celebracao_id: s.c.id, membro_id: m.id, funcao: s.funcao, data: s.c.data });
    };
    // A cruz da Matriz tem preferência de cerimoniário, antes das outras reservas.
    // Filho de ministro continua reservado às missas em que os pais servem.
    const coincideMinistro = (e,c) => e.data === c.data && compararHorario(e.horario,c.horario) === 0
      && e.comunidade !== 'outra' && (!e.comunidade || !c.comunidade || e.comunidade === c.comunidade);
    // O vínculo importado pode estar em apenas um irmão. Só quem optou por
    // acompanhar os pais herda a missa; a opção individual falsa permanece livre.
    const ministros = [];
    (entrada.ministros || []).forEach(e => {
      const origem = membros.find(m => m.id === e.membro_id);
      if (!origem || origem.escalar_com_pais !== false) ministros.push(e);
      if (origem && origem.grupo_irmaos) membros.forEach(m => {
        if (m.id !== origem.id && m.grupo_irmaos === origem.grupo_irmaos && m.escalar_com_pais === true)
          ministros.push(Object.assign({}, e, { membro_id: m.id }));
      });
    });
    const respeitaMinistro = (m,s) => {
      const vinculos = ministros.filter(e => e.membro_id === m.id && ordc.some(c => coincideMinistro(e,c)));
      return !vinculos.length || vinculos.some(e => coincideMinistro(e,s.c));
    };
    for (const s of slots.filter(s => s.com === 'matriz' && s.funcao === 'cruz')) {
      const pool = candsDe(s).filter(m => ehCerimo(m) && respeitaMinistro(m,s));
      if (pool.length) colocar(s, escolher(s, pool));
    }
    if (membros.some(m => m.servir_toda_semana)) {
      const livresSemanal = slots.filter(s => !s.filled);
      const pools = new Map(livresSemanal.map(s => [s, new Set(candsDe(s).map(m => m.id))]));
      SemanalCore.reservar(membros, livresSemanal, (m, s) => pools.get(s).has(m.id)).forEach(({ slot, membro }) => colocar(slot, membro));
    }
    // FILHO DE MINISTRO: entrada.ministros = [{data, horario, comunidade, membro_id}] (membro_id = o FILHO).
    // Reserva antes do greedy, na missa em que o pai/mãe serve; as regras duras continuam valendo.
    // Quem não couber não é forçado: volta em semVagaFilhoDeMinistro.
    const semVagaFilhoDeMinistro = [];
    const casaMissa = (e, c) => e.data === c.data && compararHorario(e.horario, c.horario) === 0
      && e.comunidade !== 'outra' && (!e.comunidade || !c.comunidade || e.comunidade === c.comunidade);
    const porFilho = new Map();
    ministros.forEach(e => { if (e && e.membro_id) { if (!porFilho.has(e.membro_id)) porFilho.set(e.membro_id, []); porFilho.get(e.membro_id).push(e); } });
    const membroPorId = {}; membros.forEach(m => { membroPorId[m.id] = m; });
    porFilho.forEach((lista, id) => {
      if (usadoFds.has(id)) return;                      // já escalado no fim de semana: nada a reservar
      if (!membroPorId[id]) { semVagaFilhoDeMinistro.push({ membro_id: id, motivo: 'fora_da_lista' }); return; }
      const missas = ordc.filter(c => lista.some(e => casaMissa(e, c)));
      if (!missas.length) { semVagaFilhoDeMinistro.push({ membro_id: id, motivo: 'missa_fora_da_geracao' }); return; }
      if (missas.every(c => (ausFresh[c.id] || new Set()).has(id))) { semVagaFilhoDeMinistro.push({ membro_id: id, motivo: 'ausente' }); return; }
      let melhor = null, melhorN = 0;
      for (const c of missas) {
        for (const s of slots) {
          if (s.filled || s.c.id !== c.id) continue;
          const cs = candsDe(s);
          if (!cs.some(m => m.id === id)) continue;
          if (melhor === null || cs.length < melhorN) { melhor = s; melhorN = cs.length; }
        }
        if (melhor) break;                               // primeira missa em que cabe
      }
      if (melhor) colocar(melhor, membroPorId[id]);
      else semVagaFilhoDeMinistro.push({ membro_id: id, motivo: 'sem_vaga_compativel' });
    });
    // GREEDY GLOBAL: preenche sempre a vaga com MENOS candidatos primeiro (reserva os "frescos" p/ onde há pouca opção)
    // 1ª passada: só quem ainda está ABAIXO do mínimo do mês (minimo_mes, padrão 2).
    // 2ª passada (sem o teto do mês): as vagas que sobraram vazias, com quem já cumpriu o mínimo —
    // o menos servido no mês primeiro, empate pelo rodízio e depois sorteio. As regras duras não mudam.
    const vaziasPass = new Set();
    const passada = () => { vaziasPass.clear();
    while (true) {
      let best = null, bestCands = null;
      for (const s of slots) {
        if (s.filled || vaziasPass.has(s)) continue;
        const cs = candsDe(s);
        if (best === null || cs.length < bestCands.length) { best = s; bestCands = cs; }
      }
      if (!best) break;
      if (!bestCands.length) { vaziasPass.add(best); continue; } // ninguém apto+disponível → vaga fica vazia (nesta passada)
      const m = escolher(best, bestCands);
      colocar(best, m);
      // IRMÃOS JUNTOS: se serve com irmão, tenta colocar o(s) irmão(s) na MESMA missa
      if (m.escalar_com_irmao && m.grupo_irmaos) {
        membros.filter(x => x.grupo_irmaos === m.grupo_irmaos && x.escalar_com_irmao && !usadoFds.has(x.id))
          .forEach(irm => {
            const s2 = slots.find(s => !s.filled && s.c.id === best.c.id && candsDe(s).some(cc => cc.id === irm.id));
            if (s2) colocar(s2, irm);
          });
      }
    } };
    passada();
    if (!semTeto && vaziasPass.size && ger.permitir_alem_do_minimo !== false) { semTeto = true; passada(); }
    // vagas abertas que ninguém pôde ocupar: `slots` sem linha correspondente em `novas`
    const sobra = {};
    novas.forEach(n => { const k = n.celebracao_id + '|' + n.funcao; sobra[k] = (sobra[k] || 0) + 1; });
    const vazias = [];
    slots.forEach(s => {
      const k = s.c.id + '|' + s.funcao;
      if (sobra[k] > 0) sobra[k]--; else vazias.push({ celebracao_id: s.c.id, funcao: s.funcao });
    });
    const semanalPendentes = membros.filter(m => m.servir_toda_semana && ordc.some(c => { const st = SemanalCore.situacao(m.id, c.data, historico); return (!st.naSemana && st.total < 4) || st.funcao > 2 || st.apoio > 2 || (st.total >= 4 && st.semanas < 4); })).map(m => m.apelido || m.nome);
    // quem terminou ACIMA do mínimo do mês nesta geração (as vezes do mês + as novas)
    const alemDoMinimo = [];
    const porId = {}; membros.forEach(m => { porId[m.id] = m; });
    const maxVezes = {};
    Object.keys(novasPorMes).forEach(mes => Object.keys(novasPorMes[mes]).forEach(id => { const v = vezes(id, mes); if (v > minimoDe(porId[id]) && v > (maxVezes[id] || 0)) maxVezes[id] = v; }));
    Object.keys(maxVezes).forEach(id => alemDoMinimo.push({ membro_id: id, vezes: maxVezes[id] }));
    return { novas: novas, vazias: vazias, alemDoMinimo: alemDoMinimo, semanalPendentes: semanalPendentes, semVagaFilhoDeMinistro: semVagaFilhoDeMinistro };
  }

  var api = { gerarSemana: gerarSemana, planejarVagas: planejarVagas, elegivelFuncao: elegivelFuncao, MAIORES_PADRAO: MAIORES_PADRAO };
  if (node) module.exports = api;
  else global.GeradorEscalaCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
