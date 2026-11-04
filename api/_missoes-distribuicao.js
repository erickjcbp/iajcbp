import {createHash} from 'node:crypto';
import {SLOTS,classificarEsforco} from './_missoes-core.js';
import {paginar} from './_missoes-util.js';
const score=s=>createHash('sha256').update(s).digest('hex');
export function planejarSemana({semana,membros,versoes,historico,capacidades,existentes=[]}){
 const atribuicoes=[],lacunas=[],usage=new Map(),seenVersion=new Map();const cutoff=new Date(semana+'T12:00:00Z');cutoff.setUTCDate(cutoff.getUTCDate()-28);const min=cutoff.toISOString().slice(0,10);
 for(const a of existentes){const v=versoes.find(v=>v.id===a.versao_id);if(v){usage.set(v.conteudo.alvo_local,(usage.get(v.conteudo.alvo_local)||0)+1);seenVersion.set(v.id,(seenVersion.get(v.id)||0)+1);}}
 for(const m of [...membros].sort((a,b)=>score(semana+a.id).localeCompare(score(semana+b.id)))){
  if(existentes.filter(a=>a.membro_id===m.id).length===8)continue;
  const chosen=new Set();for(let slot=0;slot<SLOTS.length;slot++){
   const tipo=SLOTS[slot];const candidates=versoes.filter(v=>v.estado==='aprovada'&&v.conteudo.tipo===tipo&&v.conteudo.niveis.includes(m.nivel)&&!chosen.has(v.conteudo.objetivo_chave)&&!historico.some(h=>h.membro_id===m.id&&h.objetivo_chave===v.conteudo.objetivo_chave&&(h.concluida||h.semana>=min))&&Number.isInteger(capacidades[v.conteudo.alvo_local])&&capacidades[v.conteudo.alvo_local]>(usage.get(v.conteudo.alvo_local)||0));
   candidates.sort((a,b)=>(seenVersion.get(a.id)||0)-(seenVersion.get(b.id)||0)||score(semana+m.id+a.id).localeCompare(score(semana+m.id+b.id)));
   const v=candidates[0];if(!v){lacunas.push({membro_id:m.id,nivel:m.nivel,tipo,slot,motivo:'Falta missão inédita aprovada ou vaga confirmada.'});continue;}const c=v.conteudo;chosen.add(c.objetivo_chave);usage.set(c.alvo_local,(usage.get(c.alvo_local)||0)+1);seenVersion.set(v.id,(seenVersion.get(v.id)||0)+1);atribuicoes.push({membro_id:m.id,versao_id:v.id,slot,xp:classificarEsforco(tipo).xp});
  }
 }
 return {semana,atribuicoes:lacunas.length?[]:atribuicoes,lacunas,total_xp:130};
}
export async function prepararSemana(raw,semana,{publicar=false,capacidades:override}={}){
 const [membros,versoes,historico,existentes,cfg]=await Promise.all([paginar(raw,'acolitos_membros?status=eq.ativo&serve=eq.true&user_id=not.is.null&select=id,nivel&order=id'),paginar(raw,'acolitos_motor_versoes?estado=eq.aprovada&select=*&order=id'),paginar(raw,'acolitos_motor_historico?select=*&order=id'),paginar(raw,'acolitos_motor_atribuicoes?semana=eq.'+semana+'&select=*&order=id'),raw('acolitos_motor_config?id=eq.true')]);
 const plano=planejarSemana({semana,membros,versoes,historico,existentes,capacidades:override||cfg[0]?.capacidades||{}});if(publicar&&!plano.lacunas.length)await raw('rpc/acolitos_motor_publicar_semana',{method:'POST',body:{p_semana:semana,p_plano:plano.atribuicoes}});return plano;
}
