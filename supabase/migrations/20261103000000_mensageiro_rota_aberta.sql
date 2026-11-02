begin;
alter table public.acolitos_game_sessoes drop constraint acolitos_game_sessoes_versao_check;
alter table public.acolitos_game_sessoes add constraint acolitos_game_sessoes_versao_check check(versao in (1,2,3,4));
alter table public.acolitos_game_sessoes add column distancia int not null default 0 check(distancia between 0 and 20000),add column entregas int not null default 0 check(entregas between 0 and 100);
create function public.acolitos_game_iniciar_v4(p_membro uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare j jsonb;recorde record;
begin
 j:=public.acolitos_game_sessao(p_membro,null);
 update public.acolitos_game_sessoes set versao=4 where id=(j->>'id')::uuid;
 select pontos,distancia into recorde from public.acolitos_game_sessoes where membro_id=p_membro and versao=4 and concluido_em is not null order by pontos desc,distancia desc,concluido_em limit 1;
 return j||jsonb_build_object('versao',4,'record',coalesce(recorde.pontos,0),'record_distance',coalesce(recorde.distancia,0));
end$$;
revoke all on function public.acolitos_game_iniciar_v4(uuid) from public,anon,authenticated;
grant execute on function public.acolitos_game_iniciar_v4(uuid) to authenticated;
create function public.acolitos_game_creditar_v4(p_sessao uuid,p_usuario uuid,p_ticks int,p_pontos int,p_xp int,p_distancia int,p_entregas int) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare j public.acolitos_game_sessoes;dia date:=(now() at time zone 'America/Sao_Paulo')::date;total int;ganho int;temp uuid;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Somente o servidor pode confirmar XP.' using errcode='42501';end if;
 if p_ticks is null or p_ticks not between 1 and 36000 or p_pontos is null or p_pontos not between 0 and 100000 or p_xp is null or p_xp not between 0 and 20 or p_distancia is null or p_distancia not between 0 and 20000 or p_entregas is null or p_entregas not between 0 and 100 then raise exception 'Resultado inválido.';end if;
 select * into j from public.acolitos_game_sessoes where id=p_sessao and usuario_id=p_usuario;
 if j.id is null or j.versao<>4 then raise exception 'Partida não encontrada.' using errcode='42501';end if;
 perform 1 from public.acolitos_membros where id=j.membro_id for update;
 select * into j from public.acolitos_game_sessoes where id=p_sessao for update;
 select coalesce(sum(xp),0) into total from public.acolitos_game_sessoes where membro_id=j.membro_id and concluido_em>=dia::timestamp at time zone 'America/Sao_Paulo' and concluido_em<(dia+1)::timestamp at time zone 'America/Sao_Paulo';
 if j.concluido_em is not null then return jsonb_build_object('xp',j.xp,'day_xp',total,'novo',false,'pontos',j.pontos,'distancia',j.distancia,'entregas',j.entregas);end if;
 if j.expira_em<=now() or p_ticks/60.0>extract(epoch from now()-j.iniciado_em)+1 then raise exception 'Tempo da partida inválido ou expirado.';end if;
 -- Revalida o vínculo no momento do crédito, mesmo que o perfil tenha sido alterado.
 if not exists(select 1 from public.pastoral_members pm join public.pastoral_modules mo on mo.id=pm.module_id where pm.user_id=p_usuario and mo.slug='acolitos' and mo.ativo and pm.role<>'novo') or not exists(select 1 from public.acolitos_membros alvo where alvo.id=j.membro_id and alvo.status='ativo' and alvo.serve and (alvo.user_id=p_usuario or (alvo.escalar_com_irmao and alvo.grupo_irmaos is not null and exists(select 1 from public.acolitos_membros dono where dono.user_id=p_usuario and dono.escalar_com_irmao and dono.grupo_irmaos=alvo.grupo_irmaos)))) then raise exception 'Perfil indisponível.' using errcode='42501';end if;
 ganho:=least(p_xp,greatest(0,60-total));
 update public.acolitos_game_sessoes set concluido_em=now(),ticks=p_ticks,pontos=p_pontos,xp=ganho,distancia=p_distancia,entregas=p_entregas where id=j.id;
 if ganho>0 then
  update public.acolitos_membros set xp_avulso=coalesce(xp_avulso,0)+ganho where id=j.membro_id;
  select id into temp from public.acolitos_temporadas where ativa order by created_at desc limit 1;
  if temp is not null then insert into public.acolitos_xp_temporada(membro_id,temporada_id,xp,origem) values(j.membro_id,temp,ganho,'game_mensageiro');end if;
 end if;
 return jsonb_build_object('xp',ganho,'day_xp',total+ganho,'novo',true,'pontos',p_pontos,'distancia',p_distancia,'entregas',p_entregas);
end $$;
revoke all on function public.acolitos_game_creditar_v4(uuid,uuid,int,int,int,int,int) from public,anon,authenticated;
grant execute on function public.acolitos_game_creditar_v4(uuid,uuid,int,int,int,int,int) to service_role;
create function public.acolitos_game_ranking_v4(p_membro uuid,p_periodo text default 'semana') returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid();resultado jsonb;inicio timestamptz;
begin
 if uid is null or not exists(select 1 from public.pastoral_members pm join public.pastoral_modules mo on mo.id=pm.module_id where pm.user_id=uid and mo.slug='acolitos' and mo.ativo and pm.role<>'novo') then raise exception 'Entre com um perfil do grupo.' using errcode='42501';end if;
 if not exists(select 1 from public.acolitos_membros alvo where alvo.id=p_membro and alvo.status='ativo' and alvo.serve and (alvo.user_id=uid or (alvo.escalar_com_irmao and alvo.grupo_irmaos is not null and exists(select 1 from public.acolitos_membros dono where dono.user_id=uid and dono.escalar_com_irmao and dono.grupo_irmaos=alvo.grupo_irmaos)))) then raise exception 'Perfil indisponível.' using errcode='42501';end if;
 if p_periodo is null or p_periodo not in ('semana','geral') then raise exception 'Período inválido.';end if;
 inicio:=case when p_periodo='semana' then date_trunc('week',now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo' else '-infinity'::timestamptz end;
 with melhores as (
 select distinct on(s.membro_id) s.membro_id,s.pontos,s.distancia,s.entregas,s.concluido_em,
 coalesce(nullif(btrim(m.apelido),''),nullif(split_part(btrim(m.nome),' ',1),''),'Mensageiro') as nome
 from public.acolitos_game_sessoes s join public.acolitos_membros m on m.id=s.membro_id
 where s.versao=4 and s.concluido_em>=inicio and m.status='ativo' and m.serve
 order by s.membro_id,s.pontos desc,s.distancia desc,s.concluido_em,s.id
 ), classificados as (
 select row_number() over(order by pontos desc,distancia desc,concluido_em,membro_id) as posicao,membro_id,nome,pontos,distancia,entregas from melhores
 ), visiveis as (
 select posicao,nome,pontos,distancia,entregas,(membro_id=p_membro) as eu from classificados
 )
 select jsonb_build_object('periodo',p_periodo,'top',coalesce((select jsonb_agg(to_jsonb(v) order by posicao) from visiveis v where posicao<=10),'[]'::jsonb),'meu',(select to_jsonb(v) from visiveis v where eu),'participantes',(select count(*) from classificados)) into resultado;
 return resultado;
end$$;
revoke all on function public.acolitos_game_ranking_v4(uuid,text) from public,anon,authenticated;
grant execute on function public.acolitos_game_ranking_v4(uuid,text) to authenticated;
commit;
