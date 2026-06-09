-- P0 — Endurecimento de segurança Acólitos (2026-06-09)
-- Funções SECURITY DEFINER ignoram a RLS. Por padrão o Supabase concede EXECUTE
-- a PUBLIC (logo anon e authenticated). Aqui fechamos a superfície:
--   - revoga de PUBLIC e anon (ninguém sem login chama RPC)
--   - concede só a authenticated + service_role
-- Verificado: nenhuma página pré-login usa RPC (login.html não carrega shared.js;
-- shared.js exige getSession antes de qualquer chamada).

do $$
declare r record;
begin
  for r in
    select (p.oid::regprocedure)::text as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f' and p.prosecdef
  loop
    execute format('revoke execute on function %s from public', r.sig);
    execute format('revoke execute on function %s from anon', r.sig);
    execute format('grant execute on function %s to authenticated, service_role', r.sig);
  end loop;
end $$;

-- Helpers internos/triggers: nem authenticated precisa chamar (callers internos
-- rodam como owner via SECURITY DEFINER). cred_temp escreve XP sem guarda própria.
revoke execute on function public.acolitos_cred_temp(uuid, integer, text) from authenticated;
revoke execute on function public._acolitos_medalha_ao_apto() from authenticated;
revoke execute on function public.handle_new_user() from authenticated;

-- Futuras funções não nascem abertas a anon/public.
alter default privileges in schema public revoke execute on functions from public, anon;
