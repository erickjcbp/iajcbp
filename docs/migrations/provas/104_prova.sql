-- Prova da 104: tudo dentro de transação revertida. Não grava nada real.
begin;
\i docs/migrations/104_escala_automatica.sql
select pm.user_id as coord from pastoral_members pm join pastoral_modules m on m.id=pm.module_id
 where m.slug='acolitos' and pm.role='coord_admin' limit 1 \gset
select id as membro from acolitos_membros limit 1 \gset
select gen_random_uuid() as fake \gset

-- anon: nada
set local role anon;
do $$ begin
  begin perform 1 from tarcisio_escala_auto; raise exception 'ANON LEU escala_auto'; exception when insufficient_privilege then raise notice 'ok anon bloqueado escala_auto'; end;
  begin perform 1 from acolitos_escala_ministros; raise exception 'ANON LEU ministros'; exception when insufficient_privilege then raise notice 'ok anon bloqueado ministros'; end;
  begin perform 1 from acolitos_ministro_apelidos; raise exception 'ANON LEU apelidos'; exception when insufficient_privilege then raise notice 'ok anon bloqueado apelidos'; end;
end $$;
reset role;

-- autenticado NÃO coordenador: não insere
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'fake', 'role','authenticated')::text, true);
do $$ begin
  begin insert into tarcisio_escala_auto(semana,estado) values ('2099-01-03','gerando'); raise exception 'NAO-COORD INSERIU'; exception when insufficient_privilege then raise notice 'ok nao-coord bloqueado (escala_auto)'; end;
  begin insert into acolitos_ministro_apelidos(nome_pdf,membro_id,pai_ou_mae,resposta) values ('x',(select id from acolitos_membros limit 1),'pai','sim'); raise exception 'NAO-COORD INSERIU'; exception when insufficient_privilege then raise notice 'ok nao-coord bloqueado (apelidos)'; end;
  begin insert into acolitos_escala_ministros(mes,data,horario,comunidade,membro_id) values ('2099-01-01','2099-01-03','19:00','x',(select id from acolitos_membros limit 1)); raise exception 'NAO-COORD INSERIU'; exception when insufficient_privilege then raise notice 'ok nao-coord bloqueado (ministros)'; end;
end $$;
reset role;

-- coordenador: passa
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'coord', 'role','authenticated')::text, true);
insert into tarcisio_escala_auto(semana,estado) values ('2099-01-03','gerando');
insert into acolitos_ministro_apelidos(nome_pdf,membro_id,pai_ou_mae,resposta) values ('x',:'membro','pai','sim');
insert into acolitos_escala_ministros(mes,data,horario,comunidade,membro_id) values ('2099-01-01','2099-01-03','19:00','x',:'membro');
select 'ok coord inseriu', (select count(*) from tarcisio_escala_auto) a, (select count(*) from acolitos_ministro_apelidos) b, (select count(*) from acolitos_escala_ministros) c;
reset role;

-- constraint e service role
do $$ begin
  begin insert into tarcisio_escala_auto(semana,estado) values ('2099-01-10','invalido'); raise exception 'CHECK FALHOU'; exception when check_violation then raise notice 'ok check estado'; end;
end $$;
select 'service/postgres ok', numero_conferencia, remetentes_pdf, ausencia_horas, ausencia_ultimo, ausencia_texto from tarcisio_config;
rollback;
