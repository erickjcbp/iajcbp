begin;
create or replace function public.acolitos_jornada_push_reservar(p_usuario uuid,p_semana date,p_slot text,p_payload jsonb,p_limite int default 2) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare id_novo uuid;
begin
 if auth.role()<>'service_role' then raise exception 'Sem permissão.' using errcode='42501';end if;
 if p_slot not in ('sexta','sabado','domingo','domingo2','resumo') or p_limite not between 1 and 4 then raise exception 'Agendamento inválido.';end if;
 perform pg_advisory_xact_lock(hashtextextended('push-jornada:'||p_usuario::text||p_semana::text,0));
 if p_slot<>'resumo' and (select count(*) from public.acolitos_jornada_push where usuario_id=p_usuario and semana=p_semana and slot<>'resumo')>=p_limite then return null;end if;
 insert into public.acolitos_jornada_push(usuario_id,semana,slot,payload) values(p_usuario,p_semana,p_slot,p_payload) on conflict do nothing returning id into id_novo;
 return id_novo;
end $$;
revoke all on function public.acolitos_jornada_push_reservar(uuid,date,text,jsonb,int) from public,anon,authenticated;
grant execute on function public.acolitos_jornada_push_reservar(uuid,date,text,jsonb,int) to service_role;

update public.acolitos_jornada_rotina set cfg=cfg || '{"sexta":"18:00","sabado":"16:00","domingo":"06:30","domingo2":"08:30","limite_fim_semana":4}'::jsonb,atualizado_em=now() where id=true;

commit;
