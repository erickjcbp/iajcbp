begin;
-- Lançamentos novos a partir da ativação; nenhum backfill de missas antigas.
create table if not exists public.acolitos_xp_servico_config (
 id boolean primary key default true check(id), ativado_em timestamptz not null default now(),
 xp_missa int not null default 20 check(xp_missa>0), xp_chamada int not null default 10 check(xp_chamada>0)
);
insert into public.acolitos_xp_servico_config(id) values(true) on conflict do nothing;
alter table public.acolitos_xp_servico_config enable row level security;
revoke all on public.acolitos_xp_servico_config from public,anon,authenticated;
create table if not exists public.acolitos_xp_servico (
 id uuid primary key default gen_random_uuid(), celebracao_id uuid not null,
 membro_id uuid not null references public.acolitos_membros(id) on delete cascade,
 origem text not null check(origem in ('missa','chamada')), valor int not null check(valor>0),
 creditado boolean not null default false, vista_em timestamptz,
 temporada_id uuid references public.acolitos_temporadas(id),
 criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now(),
 unique(celebracao_id,membro_id,origem)
);
create unique index if not exists acolitos_xp_uma_chamada on public.acolitos_xp_servico(celebracao_id) where origem='chamada';
alter table public.acolitos_xp_servico enable row level security;
revoke all on public.acolitos_xp_servico from public,anon,authenticated;
alter table public.acolitos_chamadas add column if not exists finalizada_em timestamptz;
alter table public.acolitos_chamadas add column if not exists finalizada_por uuid references auth.users(id);

-- Privada: reconcilia saldo por evento, inclusive correção/remoção de presença.
create or replace function public.acolitos_xp_servico_reconciliar(p_celebracao uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare c record; cfg record; item record; elegiveis uuid[]:='{}'; autor uuid; temp uuid;
 deve boolean; delta int; v_from int; inicio timestamptz;
begin
 perform pg_advisory_xact_lock(hashtextextended('xp-servico:'||p_celebracao::text,0));
 select * into cfg from public.acolitos_xp_servico_config where id;
 select ch.finalizada_em,ch.finalizada_por,ce.data,ce.minutos into c
 from public.acolitos_chamadas ch join public.acolitos_celebracoes ce on ce.id=ch.celebracao_id where ch.celebracao_id=p_celebracao;
 if c.finalizada_em is not null then
  inicio := (c.data::timestamp + make_interval(mins=>c.minutos)) at time zone 'America/Sao_Paulo';
  if inicio>=cfg.ativado_em and inicio<=now() then
   select coalesce(array_agg(distinct x.membro_id),'{}'::uuid[]) into elegiveis from (
    select e.membro_id from public.acolitos_chamadas_itens ci join public.acolitos_chamadas ch on ch.id=ci.chamada_id
     join public.acolitos_escalas e on e.id=ci.escala_id and e.celebracao_id=p_celebracao
     where ch.celebracao_id=p_celebracao and ci.resultado in ('presente','atrasado')
    union select ci.substituto_id from public.acolitos_chamadas_itens ci join public.acolitos_chamadas ch on ch.id=ci.chamada_id
     where ch.celebracao_id=p_celebracao and ci.resultado='ausente' and ci.substituto_id is not null
    union select pa.membro_id from public.acolitos_presencas_avulsas pa where pa.celebracao_id=p_celebracao
   ) x;
   select id into autor from public.acolitos_membros where user_id=c.finalizada_por order by id limit 1;
  end if;
 end if;
 select id into temp from public.acolitos_temporadas where ativa order by created_at desc limit 1;
 insert into public.acolitos_xp_servico(celebracao_id,membro_id,origem,valor,temporada_id)
 select p_celebracao,m,'missa',cfg.xp_missa,temp from unnest(elegiveis) m on conflict do nothing;
 if autor is not null then
  insert into public.acolitos_xp_servico(celebracao_id,membro_id,origem,valor,temporada_id)
  values(p_celebracao,autor,'chamada',cfg.xp_chamada,temp) on conflict do nothing;
 end if;
 -- Ordem fixa de membros e bloqueio no membro protegem saldo em chamadas concorrentes.
 for item in select * from public.acolitos_xp_servico where celebracao_id=p_celebracao order by membro_id,origem for update loop
  deve:=case when item.origem='missa' then item.membro_id=any(elegiveis) else autor is not null end;
  if deve is distinct from item.creditado then
   delta:=case when deve then item.valor else -item.valor end;
   perform 1 from public.acolitos_membros where id=item.membro_id for update;
   update public.acolitos_membros set xp_avulso=coalesce(xp_avulso,0)+delta where id=item.membro_id;
   if item.temporada_id is not null then
    insert into public.acolitos_xp_temporada(membro_id,temporada_id,xp,origem)
    values(item.membro_id,item.temporada_id,delta,'servico_'||item.origem||case when deve then '' else '_estorno' end);
   end if;
   update public.acolitos_xp_servico set creditado=deve,atualizado_em=now(),vista_em=case when not deve then coalesce(vista_em,now()) else vista_em end where id=item.id;
  end if;
 end loop;
end $$;
revoke all on function public.acolitos_xp_servico_reconciliar(uuid) from public,anon,authenticated;

create or replace function public.acolitos_xp_servico_trigger() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare cel uuid; ch uuid;
begin
 if coalesce(current_setting('acolitos.finalizando',true),'')='1' then return null;end if;
 if tg_table_name in ('acolitos_chamadas','acolitos_presencas_avulsas') then
  if tg_op='DELETE' then cel:=old.celebracao_id;else cel:=new.celebracao_id;end if;
 else
  if tg_op='DELETE' then ch:=old.chamada_id;else ch:=new.chamada_id;end if;
  select celebracao_id into cel from public.acolitos_chamadas where id=ch;
 end if;
 if cel is not null then perform public.acolitos_xp_servico_reconciliar(cel);end if;return null;
end $$;
revoke all on function public.acolitos_xp_servico_trigger() from public,anon,authenticated;
drop trigger if exists xp_servico_chamada on public.acolitos_chamadas;
create trigger xp_servico_chamada after insert or update or delete on public.acolitos_chamadas for each row execute function public.acolitos_xp_servico_trigger();
drop trigger if exists xp_servico_itens on public.acolitos_chamadas_itens;
create trigger xp_servico_itens after insert or update or delete on public.acolitos_chamadas_itens for each row execute function public.acolitos_xp_servico_trigger();
drop trigger if exists xp_servico_avulsos on public.acolitos_presencas_avulsas;
create trigger xp_servico_avulsos after insert or update or delete on public.acolitos_presencas_avulsas for each row execute function public.acolitos_xp_servico_trigger();

create or replace function public.acolitos_chamada_finalizar(p_celebracao uuid,p_itens jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); papel text:=public.acolitos_get_role(auth.uid()); ch uuid; cel record; a record; previsto int; recebido int;
begin
 if papel is null or papel not in ('coord_admin','subadmin','membro_equipe','cerimonario') then raise exception 'Sem permissão para finalizar chamada.' using errcode='42501';end if;
 if papel='membro_equipe' and not exists(select 1 from public.acolitos_membros where user_id=uid and 'escala'=any(permissoes)) then raise exception 'Sem acesso à Escala.' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('xp-servico:'||p_celebracao::text,0));
 select * into cel from public.acolitos_celebracoes where id=p_celebracao for update;
 if cel.id is null then raise exception 'Celebração não encontrada.';end if;
 if cel.minutos is null or ((cel.data::timestamp+make_interval(mins=>cel.minutos)) at time zone 'America/Sao_Paulo')>now() then raise exception 'A missa ainda não começou. Finalize a chamada após conferir as presenças.';end if;
 if jsonb_typeof(p_itens) is distinct from 'array' or jsonb_array_length(p_itens)>300 then raise exception 'Chamada inválida.';end if;
 select count(*) into previsto from public.acolitos_escalas where celebracao_id=p_celebracao;
 select count(distinct escala_id) into recebido from jsonb_to_recordset(p_itens) as x(escala_id uuid,resultado text,substituto_id uuid);
 if previsto=0 or recebido<>previsto or jsonb_array_length(p_itens)<>previsto then raise exception 'Confira todos os escalados antes de finalizar.';end if;
 if exists(select 1 from jsonb_to_recordset(p_itens) as x(escala_id uuid,resultado text,substituto_id uuid)
  left join public.acolitos_escalas e on e.id=x.escala_id and e.celebracao_id=p_celebracao
  where e.id is null or x.resultado is null or x.resultado not in ('presente','ausente','atrasado') or
   (x.substituto_id is not null and (x.resultado<>'ausente' or x.substituto_id=e.membro_id or not exists(select 1 from public.acolitos_membros m where m.id=x.substituto_id)))) then raise exception 'Há marcações inválidas na chamada.';end if;
 perform set_config('acolitos.finalizando','1',true);
 insert into public.acolitos_chamadas(celebracao_id,realizada_por,finalizada_por,finalizada_em)
 values(p_celebracao,uid,uid,now()) on conflict(celebracao_id) do update
 set finalizada_em=coalesce(acolitos_chamadas.finalizada_em,excluded.finalizada_em),finalizada_por=coalesce(acolitos_chamadas.finalizada_por,excluded.finalizada_por)
 returning id into ch;
 delete from public.acolitos_chamadas_itens where chamada_id=ch;
 insert into public.acolitos_chamadas_itens(chamada_id,escala_id,resultado,substituto_id)
 select ch,x.escala_id,x.resultado,x.substituto_id from jsonb_to_recordset(p_itens) as x(escala_id uuid,resultado text,substituto_id uuid);
 for a in select * from jsonb_to_recordset(p_itens) as x(escala_id uuid,resultado text,substituto_id uuid) loop
  update public.acolitos_escalas set status=case when a.substituto_id is not null then 'substituido' else a.resultado end,substituto_id=a.substituto_id where id=a.escala_id;
  if a.substituto_id is not null then perform public.acolitos_substituto_creditar(p_celebracao,a.substituto_id);end if;
 end loop;
 perform set_config('acolitos.finalizando','',true);
 perform public.acolitos_xp_servico_reconciliar(p_celebracao);
 return jsonb_build_object('ok',true,'chamada_id',ch);
end $$;
revoke all on function public.acolitos_chamada_finalizar(uuid,jsonb) from public,anon;
grant execute on function public.acolitos_chamada_finalizar(uuid,jsonb) to authenticated;

create or replace function public.acolitos_xp_servico_meus(p_membro uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); permitido boolean; saldo int;
begin
 select exists(select 1 from public.acolitos_membros alvo where alvo.id=p_membro and
  (alvo.user_id=uid or (alvo.escalar_com_irmao and alvo.grupo_irmaos is not null and exists(select 1 from public.acolitos_membros dono where dono.user_id=uid and dono.escalar_com_irmao and dono.grupo_irmaos=alvo.grupo_irmaos)))) into permitido;
 if not coalesce(permitido,false) then raise exception 'Sem permissão.' using errcode='42501';end if;
 select coalesce(xp_avulso,0)+(select coalesce(sum(xp_ganho),0) from public.acolitos_missao_progresso where membro_id=p_membro and status='concluida') into saldo from public.acolitos_membros where id=p_membro;
 return jsonb_build_object('eventos',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'gain',x.valor,'from_xp',greatest(0,saldo-x.total+coalesce(x.antes,0)),'origem',x.origem,'titulo',case when x.origem='chamada' then 'Chamada finalizada' else 'Você serviu nesta missa' end||coalesce(' · '||to_char(c.data,'DD/MM')||' às '||c.horario,'')) order by x.criado_em,x.id)
 from (select s.*,sum(valor) over() as total,sum(valor) over(order by criado_em,id rows between unbounded preceding and 1 preceding) as antes from public.acolitos_xp_servico s where s.membro_id=p_membro and s.creditado and s.vista_em is null) x left join public.acolitos_celebracoes c on c.id=x.celebracao_id),'[]'::jsonb));
end $$;
revoke all on function public.acolitos_xp_servico_meus(uuid) from public,anon;
grant execute on function public.acolitos_xp_servico_meus(uuid) to authenticated;
create or replace function public.acolitos_xp_servico_visto(p_evento uuid) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare m uuid;
begin
 select membro_id into m from public.acolitos_xp_servico where id=p_evento;
 if m is null then return false;end if;
 perform public.acolitos_xp_servico_meus(m); -- mesmo guard de proprietário/perfil familiar
 update public.acolitos_xp_servico set vista_em=now() where id=p_evento and creditado and vista_em is null;
 return found;
end $$;
revoke all on function public.acolitos_xp_servico_visto(uuid) from public,anon;
grant execute on function public.acolitos_xp_servico_visto(uuid) to authenticated;
commit;
