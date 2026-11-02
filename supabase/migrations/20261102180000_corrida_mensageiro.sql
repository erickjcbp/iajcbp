-- CLI Supabase indisponível (SIGKILL); timestamp segue convenção existente.
begin;
create table public.acolitos_game_sessoes(
 id uuid primary key default gen_random_uuid(),membro_id uuid not null references public.acolitos_membros(id) on delete cascade,
 usuario_id uuid not null,seed bigint not null check(seed between 0 and 4294967295),versao int not null default 1 check(versao=1),
 iniciado_em timestamptz not null default now(),expira_em timestamptz not null default now()+interval '20 minutes',
 concluido_em timestamptz,pontos int not null default 0 check(pontos>=0),xp int not null default 0 check(xp between 0 and 20),ticks int
);
create index on public.acolitos_game_sessoes(membro_id,iniciado_em);
create index on public.acolitos_game_sessoes(membro_id,concluido_em) where concluido_em is not null;
alter table public.acolitos_game_sessoes enable row level security;
revoke all on public.acolitos_game_sessoes from public,anon,authenticated;
grant all on public.acolitos_game_sessoes to service_role;

create function public.acolitos_game_sessao(p_membro uuid,p_sessao uuid default null) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid();j public.acolitos_game_sessoes;dia date:=(now() at time zone 'America/Sao_Paulo')::date;total int;recorde int;
begin
 if uid is null or not exists(select 1 from public.pastoral_members pm join public.pastoral_modules mo on mo.id=pm.module_id where pm.user_id=uid and mo.slug='acolitos' and mo.ativo and pm.role<>'novo') then raise exception 'Entre com um perfil do grupo.' using errcode='42501';end if;
 if not exists(select 1 from public.acolitos_membros alvo where alvo.id=p_membro and alvo.status='ativo' and alvo.serve and
 (alvo.user_id=uid or (alvo.escalar_com_irmao and alvo.grupo_irmaos is not null and exists(select 1 from public.acolitos_membros dono where dono.user_id=uid and dono.escalar_com_irmao and dono.grupo_irmaos=alvo.grupo_irmaos)))) then raise exception 'Este perfil não está disponível para jogar.' using errcode='42501';end if;
 if p_sessao is null then
  perform 1 from public.acolitos_membros where id=p_membro for update;
  if (select count(*) from public.acolitos_game_sessoes where membro_id=p_membro and iniciado_em>now()-interval '1 day')>=120 then raise exception 'Limite de partidas conectadas atingido. Volte amanhã ou jogue em treino.';end if;
  update public.acolitos_game_sessoes set expira_em=now() where membro_id=p_membro and concluido_em is null and expira_em>now();
  insert into public.acolitos_game_sessoes(membro_id,usuario_id,seed) values(p_membro,uid,floor(random()*4294967296)::bigint) returning * into j;
 else
  select * into j from public.acolitos_game_sessoes where id=p_sessao and membro_id=p_membro and usuario_id=uid;
  if j.id is null then raise exception 'Partida não encontrada para este perfil.' using errcode='42501';end if;
  if j.concluido_em is null and j.expira_em<=now() then raise exception 'Esta partida expirou. Comece uma nova corrida.';end if;
 end if;
 select coalesce(sum(xp),0) into total from public.acolitos_game_sessoes where membro_id=p_membro and concluido_em>=dia::timestamp at time zone 'America/Sao_Paulo' and concluido_em<(dia+1)::timestamp at time zone 'America/Sao_Paulo';
 select coalesce(max(pontos),0) into recorde from public.acolitos_game_sessoes where membro_id=p_membro and concluido_em is not null;
 return to_jsonb(j)||jsonb_build_object('day_xp',total,'record',recorde);
end $$;
revoke all on function public.acolitos_game_sessao(uuid,uuid) from public,anon;
grant execute on function public.acolitos_game_sessao(uuid,uuid) to authenticated;

-- Chamada exclusivamente pelo backend após replay. Serializa pelo membro para
-- limite diário inclusive entre abas, e só credita uma vez por sessão.
create function public.acolitos_game_creditar(p_sessao uuid,p_usuario uuid,p_ticks int,p_pontos int,p_xp int) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare j public.acolitos_game_sessoes;dia date:=(now() at time zone 'America/Sao_Paulo')::date;total int;ganho int;temp uuid;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Somente o servidor pode confirmar XP.' using errcode='42501';end if;
 if p_ticks is null or p_ticks not between 1 and 5400 or p_pontos is null or p_pontos not between 0 and 100000 or p_xp is null or p_xp not between 0 and 20 then raise exception 'Resultado inválido.';end if;
 select * into j from public.acolitos_game_sessoes where id=p_sessao and usuario_id=p_usuario;
 if j.id is null then raise exception 'Partida não encontrada.' using errcode='42501';end if;
 perform 1 from public.acolitos_membros where id=j.membro_id for update;
 select * into j from public.acolitos_game_sessoes where id=p_sessao for update;
 select coalesce(sum(xp),0) into total from public.acolitos_game_sessoes where membro_id=j.membro_id and concluido_em>=dia::timestamp at time zone 'America/Sao_Paulo' and concluido_em<(dia+1)::timestamp at time zone 'America/Sao_Paulo';
 if j.concluido_em is not null then return jsonb_build_object('xp',j.xp,'day_xp',total,'novo',false,'pontos',j.pontos);end if;
 if j.expira_em<=now() or p_ticks/60.0>extract(epoch from now()-j.iniciado_em)+1 then raise exception 'Tempo da partida inválido ou expirado.';end if;
 -- Revalida o vínculo no momento do crédito, mesmo que o perfil tenha sido alterado.
 if not exists(select 1 from public.pastoral_members pm join public.pastoral_modules mo on mo.id=pm.module_id where pm.user_id=p_usuario and mo.slug='acolitos' and mo.ativo and pm.role<>'novo') or not exists(select 1 from public.acolitos_membros alvo where alvo.id=j.membro_id and alvo.status='ativo' and alvo.serve and (alvo.user_id=p_usuario or (alvo.escalar_com_irmao and alvo.grupo_irmaos is not null and exists(select 1 from public.acolitos_membros dono where dono.user_id=p_usuario and dono.escalar_com_irmao and dono.grupo_irmaos=alvo.grupo_irmaos)))) then raise exception 'Perfil indisponível.' using errcode='42501';end if;
 ganho:=least(p_xp,greatest(0,60-total));
 update public.acolitos_game_sessoes set concluido_em=now(),ticks=p_ticks,pontos=p_pontos,xp=ganho where id=j.id;
 if ganho>0 then
  update public.acolitos_membros set xp_avulso=coalesce(xp_avulso,0)+ganho where id=j.membro_id;
  select id into temp from public.acolitos_temporadas where ativa order by created_at desc limit 1;
  if temp is not null then insert into public.acolitos_xp_temporada(membro_id,temporada_id,xp,origem) values(j.membro_id,temp,ganho,'game_mensageiro');end if;
 end if;
 return jsonb_build_object('xp',ganho,'day_xp',total+ganho,'novo',true,'pontos',p_pontos);
end $$;
revoke all on function public.acolitos_game_creditar(uuid,uuid,int,int,int) from public,anon,authenticated;
grant execute on function public.acolitos_game_creditar(uuid,uuid,int,int,int) to service_role;
commit;
