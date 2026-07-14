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

  var API = { escolherSubstituto: escolherSubstituto, elegivelFuncao: elegivelFuncao, nivelInt: nivelInt, calcIdade: calcIdade };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;   // node/testes
  global.GeradorSubstituto = API;                                             // navegador
})(typeof window !== 'undefined' ? window : globalThis);
