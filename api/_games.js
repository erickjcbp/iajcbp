import Core from '../projetos/acolitos/mensageiro-core-v2.js';
import Legacy from '../projetos/acolitos/mensageiro-core.js';
// Pontuação reproduzida no servidor; nenhuma quantidade de XP do cliente é aceita.
export default async function gamesHandler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'Use POST.'});
 const base=process.env.SUPABASE_URL,anon=process.env.SUPABASE_ANON_KEY,service=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!base||!anon||!service)return res.status(503).json({error:'Games com XP ainda não estão disponíveis. Você pode jogar em modo treino.'});
 const token=(req.headers.authorization||'').match(/^Bearer (.+)$/)?.[1];if(!token)return res.status(401).json({error:'Entre novamente para registrar o XP.'});
 const {action,membro_id,sessao_id,ticks,commands}=req.body||{};
 const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
 if(!uuid(membro_id)||!['game_iniciar','game_iniciar_v2','game_ranking','game_finalizar'].includes(action))return res.status(400).json({error:'Pedido de jogo inválido.'});
 if(action==='game_finalizar'&&(!uuid(sessao_id)||!Number.isInteger(ticks)||ticks<1||ticks>Core.MAX_TICKS||!Array.isArray(commands)||commands.length>Core.MAX_TICKS||JSON.stringify(commands).length>130000))return res.status(400).json({error:'Partida inválida.'});
 async function rpc(name,body,elevated=false){const r=await fetch(base+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:elevated?service:anon,Authorization:'Bearer '+(elevated?service:token),'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});const d=await r.json();if(!r.ok){const unavailable=d.code==='PGRST202'||d.code==='42883';throw Object.assign(Error(unavailable?'O XP dos games ainda não está disponível.':d.message||'Não foi possível registrar esta partida.'),{status:unavailable?503:403});}return d;}
 try{
  // RPC usa auth.uid() e confere propriedade/perfil familiar e vínculo com o módulo.
  if(action==='game_ranking')return res.status(200).json(await rpc('acolitos_game_ranking',{p_membro:membro_id,p_periodo:req.body.periodo||'semana'}));
  if(action==='game_iniciar_v2'){const s=await rpc('acolitos_game_iniciar_v2',{p_membro:membro_id});return res.status(200).json({id:s.id,seed:s.seed,record:s.record,day_xp:s.day_xp,versao:s.versao});}
  const s=await rpc('acolitos_game_sessao',{p_membro:membro_id,p_sessao:action==='game_finalizar'?sessao_id:null});
  if(action==='game_iniciar')return res.status(200).json({id:s.id,seed:s.seed,record:s.record,day_xp:s.day_xp});
  let result;try{if(![1,2].includes(s.versao??1))throw Error('Versão inválida');result=(s.versao===2?Core:Legacy).replay(s.seed,commands,ticks);}catch(_){return res.status(400).json({error:'Não foi possível validar os movimentos desta partida.'});}
  if(!result.done)return res.status(400).json({error:'Termine a corrida antes de registrar o XP.'});
  const elapsed=(Date.now()-Date.parse(s.iniciado_em))/1000;
  if(!Number.isFinite(elapsed)||ticks/60>elapsed+1)return res.status(400).json({error:'O tempo desta partida não confere.'});
  return res.status(200).json(await rpc('acolitos_game_creditar',{p_sessao:s.id,p_usuario:s.usuario_id,p_ticks:ticks,p_pontos:result.score,p_xp:result.xp},true));
 }catch(e){return res.status(e.status||504).json({error:e.status?e.message:'A conexão demorou. Tente salvar esta mesma partida novamente.'});}
}
