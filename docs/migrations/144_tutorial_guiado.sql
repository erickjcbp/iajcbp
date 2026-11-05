-- Tutorial guiado do membro: guarda por ficha quais telas já foram explicadas (por banco, não por navegador,
-- para não repetir ao trocar de celular). Só a função abaixo grava, e só na ficha do próprio login ou de irmão
-- do mesmo grupo familiar (mesma regra de acolitos_xp_servico_meus). A coluna nasce protegida pela trava 138.
begin;
alter table public.acolitos_membros add column if not exists tutorial_visto jsonb not null default '{}'::jsonb;
comment on column public.acolitos_membros.tutorial_visto is 'Telas cujo tutorial guiado já foi visto: { "home": "2026-11-04T20:00:00Z" }.';

create or replace function public.acolitos_tutorial_marcar(p_membro uuid, p_tela text)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare uid uuid:=auth.uid(); permitido boolean; resultado jsonb;
begin
 if uid is null then raise exception 'Sem permissão.' using errcode='42501';end if;
 if p_tela is null or p_tela !~ '^[a-z0-9-]{1,40}$' then raise exception 'Tela inválida.' using errcode='22023';end if;
 select exists(select 1 from public.acolitos_membros alvo where alvo.id=p_membro and
  (alvo.user_id=uid or (alvo.escalar_com_irmao and alvo.grupo_irmaos is not null and exists(select 1 from public.acolitos_membros dono where dono.user_id=uid and dono.escalar_com_irmao and dono.grupo_irmaos=alvo.grupo_irmaos))))
 into permitido;
 if not coalesce(permitido,false) then raise exception 'Sem permissão.' using errcode='42501';end if;
 update public.acolitos_membros set tutorial_visto = coalesce(tutorial_visto,'{}'::jsonb) || jsonb_build_object(p_tela, to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS"Z"'))
  where id=p_membro and not (coalesce(tutorial_visto,'{}'::jsonb) ? p_tela)
  returning tutorial_visto into resultado;
 return coalesce(resultado,(select tutorial_visto from public.acolitos_membros where id=p_membro));
end $$;
revoke all on function public.acolitos_tutorial_marcar(uuid,text) from public, anon;
grant execute on function public.acolitos_tutorial_marcar(uuid,text) to authenticated;
commit;
notify pgrst, 'reload schema';
