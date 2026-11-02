begin;
alter table public.acolitos_game_sessoes drop constraint acolitos_game_sessoes_versao_check;
alter table public.acolitos_game_sessoes add constraint acolitos_game_sessoes_versao_check check(versao in (1,2,3));
create function public.acolitos_game_iniciar_v3(p_membro uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare j jsonb;recorde int;
begin
 j:=public.acolitos_game_iniciar_v2(p_membro);
 update public.acolitos_game_sessoes set versao=3 where id=(j->>'id')::uuid;
 select coalesce(max(pontos),0) into recorde from public.acolitos_game_sessoes where membro_id=p_membro and versao in (2,3) and concluido_em is not null;
 return j||jsonb_build_object('versao',3,'record',recorde);
end$$;
revoke all on function public.acolitos_game_iniciar_v3(uuid) from public,anon,authenticated;
grant execute on function public.acolitos_game_iniciar_v3(uuid) to authenticated;
create or replace function public.acolitos_game_ranking(p_membro uuid,p_periodo text default 'semana') returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid();resultado jsonb;inicio timestamptz;
begin
 if uid is null or not exists(select 1 from public.pastoral_members pm join public.pastoral_modules mo on mo.id=pm.module_id where pm.user_id=uid and mo.slug='acolitos' and mo.ativo and pm.role<>'novo') then raise exception 'Entre com um perfil do grupo.' using errcode='42501';end if;
 if not exists(select 1 from public.acolitos_membros alvo where alvo.id=p_membro and alvo.status='ativo' and alvo.serve and (alvo.user_id=uid or (alvo.escalar_com_irmao and alvo.grupo_irmaos is not null and exists(select 1 from public.acolitos_membros dono where dono.user_id=uid and dono.escalar_com_irmao and dono.grupo_irmaos=alvo.grupo_irmaos)))) then raise exception 'Perfil indisponível.' using errcode='42501';end if;
 if p_periodo is null or p_periodo not in ('semana','geral') then raise exception 'Período inválido.';end if;
 inicio:=case when p_periodo='semana' then date_trunc('week',now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo' else '-infinity'::timestamptz end;
 with melhores as (
 select distinct on(s.membro_id) s.membro_id,s.pontos,s.concluido_em,
 coalesce(nullif(btrim(m.apelido),''),nullif(split_part(btrim(m.nome),' ',1),''),'Mensageiro') as nome
 from public.acolitos_game_sessoes s join public.acolitos_membros m on m.id=s.membro_id
 where s.versao in (2,3) and s.concluido_em>=inicio and m.status='ativo' and m.serve
 order by s.membro_id,s.pontos desc,s.concluido_em,s.id
 ), classificados as (
 select row_number() over(order by pontos desc,concluido_em,membro_id) as posicao,membro_id,nome,pontos from melhores
 ), visiveis as (
 select posicao,nome,pontos,(membro_id=p_membro) as eu from classificados
 )
 select jsonb_build_object('periodo',p_periodo,'top',coalesce((select jsonb_agg(to_jsonb(v) order by posicao) from visiveis v where posicao<=10),'[]'::jsonb),'meu',(select to_jsonb(v) from visiveis v where eu),'participantes',(select count(*) from classificados)) into resultado;
 return resultado;
end$$;
revoke all on function public.acolitos_game_ranking(uuid,text) from public,anon,authenticated;
grant execute on function public.acolitos_game_ranking(uuid,text) to authenticated;
commit;
