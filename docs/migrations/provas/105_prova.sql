-- Prova da 105: tudo dentro de transação revertida. Não grava nada real.
-- Rodar da raiz do repo: psql "$SUPABASE_DB_URL" -X -v ON_ERROR_STOP=1 -f docs/migrations/provas/105_prova.sql
begin;
\i docs/migrations/105_escala_auto_confirmando_e_arte_revive.sql
select pm.user_id as coord from pastoral_members pm join pastoral_modules m on m.id=pm.module_id
 where m.slug='acolitos' and pm.role='coord_admin' limit 1 \gset
update tarcisio_config set escala_ligada = true where id = 1;
-- um pedido de arte que falhou (domingo de mentira, 2099)
insert into tarcisio_envios (tipo, estado, domingo_data, chave_unica, destino_nome, erro, created_at)
values ('escala', 'falhou', '2099-01-04', 'escala:2099-01-04', 'Grupos', 'A arte não ficou pronta em 30 min.', now() - interval '2 days');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'coord', 'role','authenticated')::text, true);
do $$ declare r jsonb; l record; begin
  r := tarcisio_pedir_escala('2099-01-04');
  if not (r->>'novo')::boolean then raise exception 'NAO REVIVEU: %', r; end if;
  select estado, erro, created_at into l from tarcisio_envios where chave_unica = 'escala:2099-01-04';
  if l.estado <> 'aguardando_arte' or l.erro is not null or l.created_at < now() - interval '1 minute' then raise exception 'REVIVEU ERRADO: %', l; end if;
  raise notice 'ok falhou revive (novo=true, aguardando_arte, created_at novo)';
  r := tarcisio_pedir_escala('2099-01-04');
  if (r->>'novo')::boolean then raise exception 'REPETIU: %', r; end if;
  raise notice 'ok aguardando não é repetido (novo=false)';
end $$;
reset role;
update tarcisio_envios set estado = 'enviado' where chave_unica = 'escala:2099-01-04';
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'coord', 'role','authenticated')::text, true);
do $$ declare r jsonb; begin
  r := tarcisio_pedir_escala('2099-01-04');
  if (r->>'novo')::boolean or (select estado from tarcisio_envios where chave_unica = 'escala:2099-01-04') <> 'enviado' then raise exception 'REENVIOU A ARTE JA ENVIADA'; end if;
  raise notice 'ok enviada não volta (novo=false)';
  r := tarcisio_pedir_escala('2099-01-11');
  if not (r->>'novo')::boolean then raise exception 'PEDIDO NOVO NAO ENTROU: %', r; end if;
  raise notice 'ok pedido novo entra (novo=true)';
end $$;
reset role;
-- não coordenador: sem permissão
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role','authenticated')::text, true);
do $$ begin
  if tarcisio_pedir_escala('2099-01-18')->>'erro' <> 'sem_permissao' then raise exception 'NAO-COORD PEDIU ARTE'; end if;
  raise notice 'ok nao-coord sem_permissao';
end $$;
reset role;
-- estado 'confirmando' + coluna confirmando_em; estado inválido continua barrado
insert into tarcisio_escala_auto (semana, estado, confirmando_em) values ('2099-01-03', 'confirmando', now());
do $$ begin
  begin insert into tarcisio_escala_auto(semana,estado) values ('2099-01-10','invalido'); raise exception 'CHECK FALHOU'; exception when check_violation then raise notice 'ok check estado'; end;
end $$;
select 'ok confirmando', estado, confirmando_em is not null from tarcisio_escala_auto where semana = '2099-01-03';
rollback;
