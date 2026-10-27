import {randomInt} from 'node:crypto';
import {MODELOS,criarDesafio} from './_bonus-banco.js';
import {conexao,calendario} from './_bonus-rotina.js';
const uuid=s=>typeof s==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(s);
export async function bonusAdmin(req,res,raw){const action=req.body.action;
 if(action==='jornada_programacao_ver'){const cfg=(await raw('acolitos_jornada_rotina?id=eq.true&select=cfg'))[0]?.cfg;const semanas=await raw('acolitos_bonus_semanas?select=semana,origem,criado_em,modelos&order=semana.desc&limit=4');const logs=await raw('acolitos_jornada_push?select=slot,estado,aceitos,criado_em&order=criado_em.desc&limit=40');return res.status(200).json({cfg,semanas,envios:logs});}
 if(action==='jornada_programacao_salvar'){const c=req.body.cfg;if(!c||typeof c.ativa!=='boolean'||typeof c.renovar!=='boolean'||typeof c.push!=='boolean'||typeof c.resumo_coord!=='boolean'||![1,2,3,4].includes(c.limite_fim_semana)||['sexta','sabado','domingo','domingo2','resumo'].some(k=>!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(c[k])||Number(c[k].slice(0,2))<6||Number(c[k].slice(0,2))>=21))return res.status(400).json({error:'Use horários entre 06h e 20h59 e limite de um a quatro convites.'});
 const minute=t=>Number(t.slice(0,2))*60+Number(t.slice(3));if(c.resumo_coord&&minute(c.resumo)-Math.max(minute(c.domingo),minute(c.domingo2))<120)return res.status(400).json({error:'Deixe o resumo da coordenação pelo menos duas horas após o convite de domingo.'});
 const cfg=Object.fromEntries(['ativa','renovar','push','resumo_coord','limite_fim_semana','sexta','sabado','domingo','domingo2','resumo'].map(k=>[k,c[k]]));await raw('acolitos_jornada_rotina?id=eq.true',{method:'PATCH',body:{cfg,atualizado_em:new Date().toISOString()},prefer:'return=minimal'});return res.status(200).json({ok:true,cfg});}
 return res.status(400).json({error:'Ação inválida.'});}
export default async function bonusHandler(req,res){res.setHeader('Cache-Control','no-store');if(req.method!=='POST')return res.status(405).json({error:'Use POST.'});const token=(req.headers.authorization||'').match(/^Bearer (.+)$/)?.[1],member=req.body?.membro_id;if(!token||!uuid(member))return res.status(401).json({error:'Entre no seu perfil para abrir as aventuras.'});
 const base=process.env.SUPABASE_URL,anon=process.env.SUPABASE_ANON_KEY;if(!base||!anon)return res.status(503).json({error:'Banco não configurado.'});
 try{const guard=await fetch(base+'/rest/v1/rpc/acolitos_xp_servico_meus',{method:'POST',headers:{apikey:anon,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({p_membro:member}),signal:AbortSignal.timeout(10000)});if(!guard.ok)return res.status(403).json({error:'Este perfil não está disponível para a sua conta.'});
 const raw=conexao(),cal=calendario();
 const available=await raw('acolitos_membros?id=eq.'+member+'&status=eq.ativo&serve=eq.true&select=id');if(!available.length)return res.status(403).json({error:'As aventuras estão disponíveis para perfis ativos de quem serve.'});
 if(req.body.action==='bonus_listar'){
  const active=await raw('acolitos_missoes?ativo=eq.true&criterio->bonus_semanal=not.is.null&expira_em=gte.'+cal.data+'&select=id,titulo,descricao,xp,criterio,expira_em');
  const sessions=await raw('acolitos_bonus_jogos?membro_id=eq.'+member+'&select=id,missao_id,concluido_em,iniciado_em&order=iniciado_em.desc&limit=60');const activeIds=new Set(active.map(q=>q.id));const oldIds=[...new Set(sessions.filter(s=>!s.concluido_em&&!activeIds.has(s.missao_id)).map(s=>s.missao_id))];
  let old=[];if(oldIds.length){const cutoff=new Date(cal.data+'T12:00:00Z');cutoff.setUTCDate(cutoff.getUTCDate()-7);old=await raw('acolitos_missoes?id=in.('+oldIds.join(',')+')&expira_em=gte.'+cutoff.toISOString().slice(0,10)+'&criterio->bonus_semanal=not.is.null&select=id,titulo,descricao,xp,criterio,expira_em');}
  const qs=[...active,...old];let progress=[];if(qs.length)progress=await raw('acolitos_missao_progresso?membro_id=eq.'+member+'&missao_id=in.('+qs.map(q=>q.id).join(',')+')&select=missao_id,status,obs_revisao');
  return res.status(200).json({semana:cal.semana,missoes:qs.map(q=>({...q,status:progress.find(p=>p.missao_id===q.id)?.status||'pendente',revisao:progress.find(p=>p.missao_id===q.id)?.obs_revisao,iniciada:sessions.some(s=>s.missao_id===q.id),semana_anterior:!activeIds.has(q.id)}))});
 }
 if(req.body.action==='bonus_iniciar'){const id=req.body.missao_id;if(!uuid(id))return res.status(400).json({error:'Missão inválida.'});const mission=(await raw('acolitos_missoes?id=eq.'+id+'&select=id,criterio,ativo,expira_em'))[0];const meta=mission?.criterio?.bonus_semanal,model=MODELOS.find(m=>m.id===meta?.modelo);if(!model)return res.status(404).json({error:'Aventura não encontrada.'});
  const previous=(await raw('acolitos_bonus_jogos?membro_id=eq.'+member+'&missao_id=eq.'+id+'&select=id,publico,concluido_em,iniciado_em'))[0];
  if(previous){const deadline=new Date(mission.expira_em+'T23:59:59-03:00').getTime()+7*86400000;if(Date.now()>deadline)return res.status(410).json({error:'O prazo desta aventura terminou.'});return res.status(200).json({id:previous.id,publico:previous.publico,concluido:!!previous.concluido_em});}
  const challenge=model.tipo==='jogo'?criarDesafio(model,()=>randomInt(1000000000)/1000000000):{publico:{passos:model.passos},respostas:[]};
  const data=await raw('rpc/acolitos_bonus_iniciar',{method:'POST',body:{p_membro:member,p_missao:id,p_publico:challenge.publico,p_resposta:challenge.respostas}});return res.status(200).json(data);
 }
 return res.status(400).json({error:'Ação inválida.'});
 }catch(e){return res.status(502).json({error:'Não foi possível abrir a aventura agora. Tente novamente.'});}}
