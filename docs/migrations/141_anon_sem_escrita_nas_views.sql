-- A 140 percorreu só tabelas e deixou escrita de anon na view acolitos_frequencia.
begin;
do $$declare t text;begin
 for t in select relname from pg_class where relnamespace='public'::regnamespace and relkind in('v','m') loop
  execute format('revoke insert,update,delete,truncate,trigger,references on public.%I from anon',t);
  execute format('revoke truncate,trigger,references on public.%I from authenticated',t);
 end loop;
end $$;
commit;
