-- Executar após141 em transação com ROLLBACK.
do $$declare r record;begin
 for r in select relname from pg_class where relnamespace='public'::regnamespace and relkind in('r','v','m','p') loop
  assert not has_table_privilege('anon','public.'||quote_ident(r.relname),'UPDATE,DELETE,TRUNCATE,TRIGGER,REFERENCES'),'anon com escrita: '||r.relname;
  assert r.relname='access_requests' or not has_table_privilege('anon','public.'||quote_ident(r.relname),'INSERT'),'anon com INSERT: '||r.relname;
 end loop;
end $$;
select '141: anon sem escrita em tabelas e views; só access_requests aceita INSERT';
