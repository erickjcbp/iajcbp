// Verificação explícita da integração publicada. Chaves e senha ficam somente na memória.
// Usa uma conta descartável; remove vínculo e usuário em finally. Sem mensagens a terceiros.
import fs from 'node:fs';import {randomBytes,randomUUID,createHash} from 'node:crypto';
const base=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY,anon=process.env.SUPABASE_ANON_KEY;
if(new URL(base).hostname!=='fttjgsotuosjfrasttds.supabase.co'||!key||!anon)throw Error('Confira projeto e acesso.');
const site='https://coroinhas.jcbplimeira.com.br';const catalog=JSON.parse(fs.readFileSync(new URL('../jornada-catalogo.json',import.meta.url)));
const request=async(path,{method='GET',body,token=key,auth=false}={})=>{const r=await fetch(base+path,{method,headers:{apikey:auth?anon:key,Authorization:'Bearer '+token,'Content-Type':'application/json',Prefer:'return=representation'},...(body?{body:JSON.stringify(body)}:{})});const d=await r.json().catch(()=>null);if(!r.ok)throw Error('Falha de verificação no banco: '+r.status+' '+(d?.code||''));return d;};
let uid,memberId,access;const created=[];
try{
 const mod=(await request('/rest/v1/pastoral_modules?slug=eq.acolitos&select=id'))[0];if(!mod)throw Error('Módulo não encontrado.');
 const email='jornada-validacao-'+randomUUID()+'@example.invalid',password=randomBytes(36).toString('base64url');
 const user=await request('/auth/v1/admin/users',{method:'POST',body:{email,password,email_confirm:true,user_metadata:{nome:'Verificação temporária da Jornada'}}});uid=user.id;
 const link=await request('/rest/v1/pastoral_members',{method:'POST',body:{user_id:uid,module_id:mod.id,role:'coord_admin'}});memberId=link[0]?.id;
 const login=await request('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password},auth:true,token:anon});access=login.access_token;if(!access)throw Error('Sessão de teste não criada.');
 const call=async(action,body={})=>{const r=await fetch(site+'/api/acolito-admin',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+access},body:JSON.stringify({action,...body}),signal:AbortSignal.timeout(65000)});const d=await r.json().catch(()=>null);if(!r.ok)throw Error('A API '+action+' respondeu '+r.status+': '+(d?.error||'sem resposta'));return d;};
 const cfg=await call('jornada_config');if(!cfg.operacional)throw Error('A geração não está configurada no servidor.');
 const reserve=await call('jornada_abastecimento');if(reserve.niveis?.length!==10||reserve.niveis.some(n=>!Number.isInteger(n.membros_sem_novidade)))throw Error('Reserva não retornou os dez níveis.');
 if(process.argv.includes('--somente-reserva')){
  const out={site,reserva:reserve.niveis,operacional:cfg.operacional};
  await request('/rest/v1/pastoral_members?id=eq.'+memberId,{method:'DELETE'});memberId=null;await request('/auth/v1/admin/users/'+uid,{method:'DELETE'});uid=null;
  fs.writeFileSync('/Users/erickmartins/arquivos/sao-tarcisio/jornada-implementacao-2026-10-25/reserva-producao.json',JSON.stringify(out,null,2));console.log(JSON.stringify(out));
 }else{
 const gen=await call('jornada_gerar',{pedido_id:randomUUID(),nivel:'aspirante',objetivo:'Descobrir o ponto de encontro, o local de preparação e a pessoa a quem pedir ajuda na chegada.',referencias:'Atividade somente acompanhada e combinada com a equipe. Não abrir portas fechadas nem manipular objetos. Os espaços e seus nomes são apresentados pelo orientador no encontro. O objetivo é reconhecer os três pontos de apoio, com conversa ou indicação visual; não decorar nomes. Não afirmar qualquer norma litúrgica.'});
 if(gen.rascunho?.estado!=='rascunho')throw Error('Geração não produziu rascunho.');
 const iaDraft=gen.rascunho.id;
 // Publicação editorial do catálogo inicial, autorizada pelo dono. IDs estáveis por versão/nível.
 if(process.argv.includes('--publicar-catalogo'))for(const content of catalog){
  const hex=createHash('sha256').update('jornada-viva-1:'+content.nivel).digest('hex');const id=hex.slice(0,8)+'-'+hex.slice(8,12)+'-5'+hex.slice(13,16)+'-a'+hex.slice(17,20)+'-'+hex.slice(20,32);
  const rows=await request('/rest/v1/acolitos_missoes?id=eq.'+id+'&select=id,criterio,niveis_alvo');if(rows?.length){created.push(id);continue;}
  const draft=await call('jornada_rascunho',{pedido_id:id,nivel:content.nivel,conteudo:content});
  await call('jornada_publicar',{id,revisao:draft.rascunho.revisao,conteudo:content,revisado:true});
  const actual=(await request('/rest/v1/acolitos_missoes?id=eq.'+id+'&select=id,criterio,niveis_alvo,obrigatoria,nivel_alvo,validacao'))[0];
  if(actual?.criterio?.jornada?.caminhos?.length!==2||actual.obrigatoria!==false||actual.nivel_alvo!==null||actual.validacao!=='reivindicada'||actual.niveis_alvo?.[0]!==content.nivel)throw Error('Quest publicada fora do contrato.');created.push(id);
 }
 const result={site,geracao_real:true,rascunho_ia:iaDraft,titulo_ia:gen.rascunho.conteudo.titulo,episodios_publicados:created.length,quests:created,conta_temporaria_removida:false};
 // Relatório público de conteúdo/configuração, nunca tokens ou dados pessoais reais.
 await request('/rest/v1/pastoral_members?id=eq.'+memberId,{method:'DELETE'});memberId=null;await request('/auth/v1/admin/users/'+uid,{method:'DELETE'});uid=null;result.conta_temporaria_removida=true;
 const out='/Users/erickmartins/arquivos/sao-tarcisio/jornada-implementacao-2026-10-25/producao.json';fs.writeFileSync(out,JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }
}finally{if(memberId)await request('/rest/v1/pastoral_members?id=eq.'+memberId,{method:'DELETE'}).catch(()=>{});if(uid)await request('/auth/v1/admin/users/'+uid,{method:'DELETE'}).catch(()=>{});}
