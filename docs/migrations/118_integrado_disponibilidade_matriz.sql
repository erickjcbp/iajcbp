-- Ao concluir o CRM, disponibilidade inicial em toda a grade da Matriz.
-- Grade oficial: HORARIOS em projetos/acolitos/shared.js; Santo Antônio é sábado 18h30.
-- Complementa o gatilho existente de nível/Apoio, sem alterá-lo nem editar integrados antigos.
begin;
create or replace function public.acolitos_integrado_disponibilidade_matriz()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if new.etapa is distinct from 'integrado' then return new; end if;
  -- Não repõe horários removidos deliberadamente depois da integração.
  if tg_op='UPDATE' and old.etapa is not distinct from 'integrado' then return new; end if;
  insert into public.acolitos_disponibilidade(membro_id,dia,horario,comunidade)
  select new.membro_id,h.dia,h.horario,'matriz'
  from (values ('sabado','17h'),('domingo','7h'),('domingo','9h'),('domingo','19h')) h(dia,horario)
  where not exists (
    select 1 from public.acolitos_disponibilidade d
    where d.membro_id=new.membro_id and d.dia=h.dia and d.horario=h.horario
  );
  return new;
end $$;
revoke all on function public.acolitos_integrado_disponibilidade_matriz() from public,anon,authenticated;
drop trigger if exists acolitos_crm_integrado_disponibilidade on public.acolitos_crm;
create trigger acolitos_crm_integrado_disponibilidade
after insert or update of etapa on public.acolitos_crm
for each row execute function public.acolitos_integrado_disponibilidade_matriz();
comment on function public.acolitos_integrado_disponibilidade_matriz() is
'Ao entrar em integrado no CRM, adiciona sábado 17h e domingo 7h, 9h, 19h da Matriz, sem apagar disponibilidades, duplicar horários ou repor edições posteriores.';
commit;
