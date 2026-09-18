-- Prova da 084: o projeto existe, os passos obedecem ao time, e ninguém espia o time alheio.
-- Rodar:  psql "$SUPABASE_DB_URL" -f docs/provas/provar-084-projeto-e-passos.sql
-- NÃO DEIXA NADA GRAVADO: tudo que escreve roda dentro de `begin … rollback`.
--
-- O QUE DEFENDE: a separação por time (migration 057) foi feita com a tabela de tarefas VAZIA
-- justamente para não errar com trabalho real dentro. O passo é uma porta nova para o mesmo
-- dado — se ela ficar aberta, basta ler os passos para saber o que o outro time está fazendo.
\set ON_ERROR_STOP on
\timing off
\pset pager off

\echo '=== 1) os campos do projeto e a tabela dos passos existem ==='
select (select count(*) from information_schema.columns
         where table_name='acolitos_tarefas' and column_name in ('tipo','inicio','checkpoints')) as campos_DEVE_SER_3,
       (select count(*) from information_schema.tables
         where table_name='acolitos_tarefa_passos') as tabela_DEVE_SER_1,
       (select relrowsecurity from pg_class where oid='public.acolitos_tarefa_passos'::regclass) as rls_DEVE_SER_t;

\echo ''
\echo '=== 2) tipo só aceita tarefa ou projeto ==='
select pg_get_constraintdef(oid) as trava from pg_constraint where conname='acolitos_tarefas_tipo_check';

\echo ''
\echo '=== 3) as políticas do passo ==='
select cmd, policyname from pg_policies where tablename='acolitos_tarefa_passos' order by policyname;

\echo ''
\echo '=== 4) A TRAVA FUNCIONANDO: quem é de um time NÃO vê o passo do outro (com rollback) ==='
begin;
do $$
declare
  coord uuid; equipe uuid; equipeTimes text[];
  proj uuid; passoOutro uuid; viu integer;
  timeDele text; timeAlheio text;
begin
  select m.user_id into coord from public.acolitos_membros m
   where public.acolitos_get_role(m.user_id) = 'coord_admin' and m.user_id is not null limit 1;
  -- alguém de equipe que esteja em ALGUM time, e um time que não seja dele
  select m.user_id, coalesce(m.setores,'{}') into equipe, equipeTimes
    from public.acolitos_membros m
   where public.acolitos_get_role(m.user_id) = 'membro_equipe'
     and coalesce(array_length(m.setores,1),0) > 0 limit 1;
  if equipe is null then
    raise notice 'SEM CASO PARA TESTAR: ninguém de equipe está em um time.';
    return;
  end if;
  timeDele := equipeTimes[1];
  select l.valor into timeAlheio from public.acolitos_listas l
   where l.tipo='setor' and not (l.valor = any(equipeTimes)) limit 1;

  -- a coordenação cria um projeto do time ALHEIO, com um passo
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',coord)::text, true);
  insert into public.acolitos_tarefas (titulo, time_slug, tipo, inicio, prazo)
  values ('PROVA — projeto de outro time', timeAlheio, 'projeto', current_date, current_date + 30)
  returning id into proj;
  insert into public.acolitos_tarefa_passos (tarefa_id, titulo, prazo)
  values (proj, 'PROVA — marco alheio', current_date + 10) returning id into passoOutro;

  -- agora quem é de equipe tenta enxergar
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',equipe)::text, true);
  set local role authenticated;
  select count(*) into viu from public.acolitos_tarefa_passos where id = passoOutro;
  reset role;

  if viu = 0 then
    raise notice 'TRAVA DO PASSO: certo — quem é do time "%" não enxerga o passo do time "%"', timeDele, timeAlheio;
  else
    raise notice 'TRAVA DO PASSO: ERRADO — enxergou % linha(s) do time alheio', viu;
  end if;
end $$;
rollback;

\echo ''
\echo '=== 5) o passo morre junto com o projeto (não deixa órfão) ==='
begin;
do $$
declare coord uuid; proj uuid; sobrou integer;
begin
  select m.user_id into coord from public.acolitos_membros m
   where public.acolitos_get_role(m.user_id) = 'coord_admin' and m.user_id is not null limit 1;
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',coord)::text, true);
  insert into public.acolitos_tarefas (titulo, time_slug, tipo) values ('PROVA — some junto', 'formacao', 'projeto')
    returning id into proj;
  insert into public.acolitos_tarefa_passos (tarefa_id, titulo) values (proj, 'PROVA — passo');
  delete from public.acolitos_tarefas where id = proj;
  select count(*) into sobrou from public.acolitos_tarefa_passos where tarefa_id = proj;
  if sobrou = 0 then raise notice 'SEM ÓRFÃO: certo — apagar o projeto levou os passos junto';
  else raise notice 'SEM ÓRFÃO: ERRADO — sobraram % passos sem dono', sobrou; end if;
end $$;
rollback;

\echo ''
\echo '=== 6) nada ficou gravado ==='
select (select count(*) from public.acolitos_tarefa_passos) as passos,
       (select count(*) from public.acolitos_tarefas where tipo='projeto') as projetos;
