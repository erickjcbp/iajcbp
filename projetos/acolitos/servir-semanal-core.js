// Plano mensal: quatro semanas distintas, duas funções aptas e dois apoios.
(function(global){
  'use strict';
  function semana(data){
    var d=new Date(data+'T00:00:00Z');
    d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));
    return d.toISOString().slice(0,10);
  }
  function situacao(id,data,historico){
    var mes=data.slice(0,7), sem=semana(data), apoio=0, funcao=0, naSemana=false, semanas=new Set();
    (historico||[]).forEach(function(e){
      var titular=e.status==='substituido'?e.substituto_id:e.membro_id;
      if(titular!==id||!e.data)return;
      if(semana(e.data)===sem)naSemana=true;
      if(e.data.slice(0,7)===mes){semanas.add(semana(e.data));if(e.funcao==='apoio')apoio++;else funcao++;}
    });
    return {apoio:apoio,funcao:funcao,total:apoio+funcao,naSemana:naSemana,semanas:semanas.size};
  }
  function pode(m,funcao,data,historico,habMap){
    if(!m.servir_toda_semana)return true;
    if(!data||!Array.isArray(historico))return false; // não arrisca duplicar sem ler o mês
    var s=situacao(m.id,data,historico);
    var apto=['apto','experiente','referencia'].indexOf((habMap[m.id]||{})[funcao])>=0;
    return !s.naSemana&&s.total<4&&s.apoio<=2&&s.funcao<=2&&(funcao==='apoio'?s.apoio<2:s.funcao<2&&apto);
  }
  // Reserva primeiro os participantes do plano; remaneja vagas para não roubar a única
  // função possível de alguém que tem menos opções. Uma vaga e uma semana por pessoa.
  function reservar(membros,slots,candidato){
    var edges=new Map(), porSlot=new Map();
    membros.filter(function(m){return m.servir_toda_semana;}).forEach(function(m){edges.set(m,slots.filter(function(s){return candidato(m,s);}));});
    function encaixar(m,vistos){
      for(var s of edges.get(m)||[]){
        if(vistos.has(s))continue;vistos.add(s);
        var anterior=porSlot.get(s);
        if(!anterior||encaixar(anterior,vistos)){porSlot.set(s,m);return true;}
      }
      return false;
    }
    [...edges.keys()].sort(function(a,b){return edges.get(a).length-edges.get(b).length;}).forEach(function(m){encaixar(m,new Set());});
    return [...porSlot].map(function(par){return {slot:par[0],membro:par[1]};});
  }
  async function carregar(sb,lerTudo,datas){
    var ds=datas.slice().sort(), primeiro=ds[0], ultimo=ds[ds.length-1];
    var de=new Date(primeiro.slice(0,7)+'-01T00:00:00Z');de.setUTCDate(de.getUTCDate()-7);
    var ate=new Date(ultimo+'T00:00:00Z');ate.setUTCMonth(ate.getUTCMonth()+1,0);ate.setUTCDate(ate.getUTCDate()+7);
    var res=await lerTudo(function(){return sb.from('acolitos_escalas').select('membro_id,substituto_id,status,funcao,celebracao_id,acolitos_celebracoes!inner(data)').gte('acolitos_celebracoes.data',de.toISOString().slice(0,10)).lte('acolitos_celebracoes.data',ate.toISOString().slice(0,10));});
    if(res.error)throw res.error;
    return (res.data||[]).map(function(e){return {...e,data:e.acolitos_celebracoes?.data||e.data};});
  }
  var api={semana:semana,situacao:situacao,pode:pode,reservar:reservar,carregar:carregar};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else global.SemanalCore=api;
})(typeof globalThis!=='undefined'?globalThis:this);
