// Emite SQL que deve ser anexado à migração SEM COMMIT e executado com ROLLBACK.
console.log(`
do $proof$ declare t text;n int;r jsonb;id uuid:=gen_random_uuid();begin
foreach t in array array['config','fontes','lotes','uso','versoes','semanas','atribuicoes','historico','recompensas'] loop
 if has_table_privilege('anon','public.acolitos_motor_'||t,'SELECT') or has_table_privilege('authenticated','public.acolitos_motor_'||t,'SELECT') then raise exception 'Tabela privada exposta: %',t;end if;
end loop;
if has_function_privilege('authenticated','public.acolitos_motor_aprovar(uuid,int,uuid)','EXECUTE') then raise exception 'Aprovação pública';end if;
r:=public.acolitos_motor_reservar_geracao(id,null,(now() at time zone 'America/Sao_Paulo')::date,8);if r->>'reservado'<>'true' then raise exception 'Reserva falhou';end if;
r:=public.acolitos_motor_reservar_geracao(id,null,(now() at time zone 'America/Sao_Paulo')::date,8);if r->>'reservado'<>'false' then raise exception 'Pedido repetido cobrado';end if;
raise notice 'PASS: tabelas privadas, aprovação restrita e reserva idempotente.';
end $proof$;
rollback;
`);
