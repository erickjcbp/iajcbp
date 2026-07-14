// Motor de escolha de substituto — ÚNICO ponto de verdade das regras, usado por
// escala.html e ausencias.html. Função PURA (sem I/O): quem chama monta o ctx.
// Espelha as regras do gerador (elegibilidade, comunidade, cerimoniário, rodízio).
(function(global){
  'use strict';
  // Espelho de shared.js NIVEIS (int por slug de nível da jornada)
  var NIVEL_INT = {
    aspirante:0, coroinha:1, acolito_aspirante:2, acolito_guardiao:3, acolito_sentinela:4,
    aspirante_cerimoniario:5, cerimoniario_aspirante:6, cerimoniario_guardiao:7,
    cerimoniario_magistral:8, cerimoniario_mor:9
  };
  function nivelInt(slug){ return NIVEL_INT[slug] != null ? NIVEL_INT[slug] : 0; }
  function calcIdade(dn){
    if(!dn) return null;
    var d = new Date(dn); if(isNaN(d.getTime())) return null;
    var t = new Date(); var a = t.getFullYear()-d.getFullYear();
    var m = t.getMonth()-d.getMonth();
    if(m<0 || (m===0 && t.getDate()<d.getDate())) a--;
    return a;
  }
  function elegivelFuncao(m, f, comKey, habMap, config){
    var h = (habMap[m.id]||{})[f];
    if (h && (h==='apto'||h==='experiente'||h==='referencia')) return true;
    var ger = (config && config.gerador) || {};
    var kit = ger.kit_leve || { comunidade:'santo_antonio', funcoes:['cruz','vela'], idade_min:7 };
    if (kit && comKey===kit.comunidade && (kit.funcoes||[]).indexOf(f) >= 0){
      var idade = m.data_nascimento ? calcIdade(m.data_nascimento) : null;
      if (idade != null) return idade >= (kit.idade_min!=null ? kit.idade_min : 7);
      return nivelInt(m.nivel||'aspirante') >= 1;   // sem idade → coroinha pra cima
    }
    return false;
  }
  function escolherSubstituto(ctx){
    var funcao = ctx.funcao, comKey = ctx.comunidade, horKey = ctx.horKey;
    var roster = ctx.roster || [], habMap = ctx.habMap || {}, dispMap = ctx.dispMap || {};
    var carga = ctx.cargaMap || {};
    var usadosNaMissa = ctx.usadosNaMissa || new Set();
    var usadoFds = ctx.usadoFds || new Set();
    var config = ctx.config || {};
    var rnd = ctx.rnd || Math.random;
    var maiores = (config.funcoes_maiores && config.funcoes_maiores.length)
      ? config.funcoes_maiores
      : ['cred_altar','cred_credencia','missal','turibulo','naveta','mitra','baculo'];
    var MAIORES = {}; maiores.forEach(function(f){ MAIORES[f]=true; });

    var disp = function(id){ return !horKey || (dispMap[id]||[]).indexOf(horKey) >= 0; };
    var pool = roster.filter(function(m){
      return m.id !== ctx.membroAusenteId
        && !usadosNaMissa.has(m.id)
        && disp(m.id)
        && elegivelFuncao(m, funcao, comKey, habMap, config);
    });
    if(!pool.length) return { membroId:null, motivo:'sem_candidato' };

    // camadas de comunidade
    var mesma = pool.filter(function(m){ return !comKey || (m.comunidade||'')===comKey; });
    var cruza = pool.filter(function(m){ return (m.comunidade||'')!==comKey && m.pode_outras_comunidades; });
    var base = [mesma, cruza, pool].find(function(t){ return t.length; }) || pool;

    var ehCerimo = function(m){ return nivelInt(m.nivel||'aspirante') >= 6; };
    var menor = !MAIORES[funcao];
    var tiers = menor
      ? [ base.filter(function(m){ return !ehCerimo(m) && !usadoFds.has(m.id); }),
          base.filter(function(m){ return !ehCerimo(m); }),
          base.filter(function(m){ return !usadoFds.has(m.id); }),
          base ]
      : [ base.filter(function(m){ return !usadoFds.has(m.id); }), base ];
    var grupo = tiers.find(function(t){ return t.length; });
    if(!grupo || !grupo.length) return { membroId:null, motivo:'sem_candidato' };

    // rodízio: menor carga primeiro, empate aleatório
    grupo = grupo.slice().sort(function(a,b){
      return (carga[a.id]||0) - (carga[b.id]||0) || (rnd()-0.5);
    });
    return { membroId: grupo[0].id, motivo:null };
  }

  // --- Camada de I/O (recebe o client supabase `sb`) ---
  // O JS escolhe o substituto (escolherSubstituto) e a RPC grava atômico (cobre cerimonário via RLS).
  async function aplicarTrocaEscala(sb, arg, ctxBuilder){
    // arg: {celebracao_id, comunidade, data, membroAusenteId}
    // ctxBuilder(funcao, usadosNaMissa, usadoFds) -> ctx (cada página injeta suas queries)
    const { data: linhas } = await sb.from('acolitos_escalas')
      .select('id,membro_id,funcao,status')
      .eq('celebracao_id', arg.celebracao_id);
    const alvo = (linhas||[]).find(e => e.membro_id===arg.membroAusenteId
      && (e.status==='escalado' || e.status==='presente' || e.status==='atrasado'));
    if(!alvo) return null; // não estava escalado (ativo) nessa missa
    const usadosNaMissa = new Set((linhas||[]).map(e=>e.membro_id));
    // IMPORTANTE (mesmo furo pego na Task 3): excluir TODOS os ausentes desta missa, não só o alvo —
    // senão o motor poderia sugerir alguém que também declarou ausência. Ausência vem por celebracao_id
    // OU por data (celebracao_id null). Dobramos no set de excluídos (o motor exclui usadosNaMissa).
    const [{ data: ausCel }, { data: ausData }] = await Promise.all([
      sb.from('acolitos_ausencias').select('membro_id').eq('celebracao_id', arg.celebracao_id),
      sb.from('acolitos_ausencias').select('membro_id').is('celebracao_id', null).eq('data', arg.data)
    ]);
    (ausCel||[]).forEach(a => usadosNaMissa.add(a.membro_id));
    (ausData||[]).forEach(a => usadosNaMissa.add(a.membro_id));
    const ctx = await ctxBuilder(alvo.funcao, usadosNaMissa, new Set());
    const r = escolherSubstituto(ctx);
    const novoId = r.membroId || null;
    // grava atômico via RPC (SECURITY DEFINER; funciona p/ coord E cerimonário)
    const { data: res, error } = await sb.rpc('acolitos_aplicar_troca_escala', {
      p_celebracao_id: arg.celebracao_id, p_membro_ausente_id: arg.membroAusenteId, p_novo_membro_id: novoId
    });
    if(error || !res || res.erro || res.nao_escalado) return null;
    return { funcao: res.funcao, saiu: arg.membroAusenteId, entrou: novoId,
             novoEscalaId: res.novo_escala_id || null, alvoId: res.alvo_id };
  }

  async function desfazerTroca(sb, troca){
    await sb.rpc('acolitos_desfazer_troca_escala', {
      p_alvo_id: troca.alvoId, p_novo_escala_id: troca.novoEscalaId || null
    });
  }

  function abrirResumoTrocas(trocas, nomes, onDesfazer){
    var nome = function(id){ return id ? (nomes[id]||id) : '—'; };
    var ov = document.createElement('div');
    ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9000;display:flex;align-items:center;justify-content:center;padding:16px;';
    var card = document.createElement('div');
    card.style.cssText='background:#241019;border:1px solid #5a3a3f;border-radius:16px;max-width:440px;width:100%;padding:18px;color:#f7ebe7;max-height:80vh;overflow:auto;';
    var h = document.createElement('div'); h.textContent='⚡ Trocas por ausência ('+trocas.length+')';
    h.style.cssText='font-weight:800;font-size:16px;margin-bottom:10px;color:#ffd97a;'; card.appendChild(h);
    trocas.forEach(function(t){
      var row = document.createElement('div');
      row.style.cssText='display:flex;justify-content:space-between;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid #43282e;font-size:13px;';
      var txt = document.createElement('div');
      txt.innerHTML = '<b>'+nome(t.saiu)+'</b> ('+(t.funcao)+') ausente<br>→ '+(t.entrou?('entrou <b>'+nome(t.entrou)+'</b>'):'<span style="color:#e0607a">SEM substituto ⚠ (vaga vazia)</span>');
      row.appendChild(txt);
      if(t.entrou){
        var d = document.createElement('button'); d.textContent='Desfazer';
        d.style.cssText='flex:none;background:#3a1c24;border:1px solid #7a5a1a;color:#ffd97a;border-radius:8px;padding:6px 10px;font-size:12px;cursor:pointer;';
        d.onclick=async function(){ d.disabled=true; d.textContent='...'; await onDesfazer(t); txt.innerHTML='<b>'+nome(t.saiu)+'</b> ('+t.funcao+') — vaga vazia (desfeito)'; d.remove(); };
        row.appendChild(d);
      }
      card.appendChild(row);
    });
    var fechar = document.createElement('button'); fechar.textContent='Ok';
    fechar.style.cssText='margin-top:14px;width:100%;background:linear-gradient(160deg,#ffd97a,#8a6a24);color:#2a1500;border:none;border-radius:10px;padding:11px;font-weight:800;cursor:pointer;';
    fechar.onclick=function(){ ov.remove(); if(typeof onDesfazer._done==='function') onDesfazer._done(); };
    card.appendChild(fechar); ov.appendChild(card); document.body.appendChild(ov);
  }

  var API = { escolherSubstituto: escolherSubstituto, elegivelFuncao: elegivelFuncao, nivelInt: nivelInt, calcIdade: calcIdade,
              aplicarTrocaEscala: aplicarTrocaEscala, desfazerTroca: desfazerTroca, abrirResumoTrocas: abrirResumoTrocas };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;   // node/testes
  global.GeradorSubstituto = API;                                             // navegador
})(typeof window !== 'undefined' ? window : globalThis);
