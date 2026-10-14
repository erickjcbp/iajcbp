-- O plano semanal substitui a preferência de mais frequência, inclusive em clientes antigos.
create or replace function public.acolitos_normalizar_frequencia()
returns trigger language plpgsql security invoker set search_path=public as $$
begin
  if new.servir_toda_semana then new.escalar_frequente:=false; end if;
  return new;
end;
$$;
revoke all on function public.acolitos_normalizar_frequencia() from public;
create trigger acolitos_frequencia_exclusiva
before insert or update of servir_toda_semana,escalar_frequente
on public.acolitos_membros for each row execute function public.acolitos_normalizar_frequencia();
update public.acolitos_membros set escalar_frequente=false where servir_toda_semana and escalar_frequente;
alter table public.acolitos_membros add constraint acolitos_frequencias_exclusivas
check (not (servir_toda_semana and coalesce(escalar_frequente,false)));
