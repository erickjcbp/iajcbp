-- Prova da 077: o cardápio de rotinas cria a tarefa quando vence, e só uma viva por vez.
-- Rodar:  psql "$SUPABASE_DB_URL" -f docs/provas/provar-077-rotinas-do-setor.sql
--
-- NÃO DEIXA NADA GRAVADO: tudo que escreve roda dentro de `begin … rollback`.
--
-- O QUE DEFENDE (medido em 18/09/2026): 13 setores cadastrados e a tabela de tarefas VAZIA.
-- A recorrência por tarefa já existia, mas a corrente só começa se alguém criar a primeira à
-- mão — e morre em silêncio se ninguém concluir.
\set ON_ERROR_STOP on
\timing off
\pset pager off

\echo '=== 1) a tabela, o elo com a tarefa e a trava de linha existem ==='
select (select count(*) from information_schema.tables
         where table_name = 'acolitos_rotinas') as tabela_DEVE_SER_1,
       (select count(*) from information_schema.columns
         where table_name = 'acolitos_tarefas' and column_name = 'rotina_id') as elo_DEVE_SER_1,
       (select relrowsecurity from pg_class where oid = 'public.acolitos_rotinas'::regclass) as rls_DEVE_SER_t;

\echo ''
\echo '=== 2) quem pode o quê: ler e criar é do setor, alterar e apagar é da coordenação ==='
select cmd, policyname from pg_policies
 where tablename = 'acolitos_rotinas' order by cmd, policyname;

\echo ''
\echo '=== 3) a função só deixa entrar quem é da equipe, e o anônimo nem executa ==='
select p.prosecdef as security_definer_DEVE_SER_t,
       has_function_privilege('authenticated', p.oid, 'execute') as authenticated_DEVE_SER_t,
       has_function_privilege('anon', p.oid, 'execute') as anon_DEVE_SER_f
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'acolitos_rotinas_materializar';

\echo ''
\echo '=== 4) O MOTOR FUNCIONANDO, do começo ao fim (com rollback) ==='
begin;
do $$
declare
  coord uuid;
  rot uuid;
  criadas1 integer; criadas2 integer; criadas3 integer;
  abertas integer;
  prazo1 date;
begin
  select m.user_id into coord from public.acolitos_membros m
   where public.acolitos_get_role(m.user_id) = 'coord_admin' and m.user_id is not null limit 1;
  perform set_config('request.jwt.claims',
    json_build_object('role','authenticated','sub',coord)::text, true);

  insert into public.acolitos_rotinas (time_slug, titulo, recorrencia, proxima)
  values ('formacao', 'PROVA — conferir quem está parado', 'semanal', current_date)
  returning id into rot;

  -- 1ª vez: a tarefa nasce
  criadas1 := public.acolitos_rotinas_materializar();
  select count(*) into abertas from public.acolitos_tarefas
   where rotina_id = rot and concluida_em is null;
  select prazo into prazo1 from public.acolitos_tarefas where rotina_id = rot limit 1;
  if criadas1 >= 1 and abertas = 1 then
    raise notice 'NASCEU: certo — 1 tarefa criada, com prazo %', prazo1;
  else
    raise notice 'NASCEU: ERRADO — criadas=% abertas=%', criadas1, abertas;
  end if;

  -- 2ª vez, no mesmo dia: NÃO pode nascer outra (só uma viva por vez)
  update public.acolitos_rotinas set proxima = current_date where id = rot;
  criadas2 := public.acolitos_rotinas_materializar();
  select count(*) into abertas from public.acolitos_tarefas
   where rotina_id = rot and concluida_em is null;
  if abertas = 1 then
    raise notice 'NÃO DUPLICA: certo — continua 1 aberta (a função criou % nesta rodada)', criadas2;
  else
    raise notice 'NÃO DUPLICA: ERRADO — ficaram % abertas', abertas;
  end if;

  -- depois de concluída, e vencida de novo, a próxima nasce
  update public.acolitos_tarefas set concluida_em = now() where rotina_id = rot;
  update public.acolitos_rotinas set proxima = current_date where id = rot;
  criadas3 := public.acolitos_rotinas_materializar();
  select count(*) into abertas from public.acolitos_tarefas
   where rotina_id = rot and concluida_em is null;
  if abertas = 1 then
    raise notice 'A CORRENTE SEGUE: certo — concluída a anterior, nasceu a próxima';
  else
    raise notice 'A CORRENTE SEGUE: ERRADO — % abertas', abertas;
  end if;

  -- a tarefa que nasce de rotina NÃO carrega recorrência própria (senão viram duas correntes)
  if exists (select 1 from public.acolitos_tarefas
              where rotina_id = rot and recorrencia <> 'nenhuma') then
    raise notice 'DUAS CORRENTES: ERRADO — a tarefa da rotina nasceu com recorrência própria';
  else
    raise notice 'UMA CORRENTE SÓ: certo — quem repete é a rotina, não a tarefa';
  end if;
end $$;
rollback;

\echo ''
\echo '=== 5) a data anda certo mesmo com atraso: semanal olhada tarde volta ao dia da semana ==='
begin;
do $$
declare
  coord uuid; rot uuid; prox date; dia_semana_antes int; dia_semana_depois int;
begin
  select m.user_id into coord from public.acolitos_membros m
   where public.acolitos_get_role(m.user_id) = 'coord_admin' and m.user_id is not null limit 1;
  perform set_config('request.jwt.claims',
    json_build_object('role','authenticated','sub',coord)::text, true);

  -- uma rotina semanal esquecida há 24 dias
  insert into public.acolitos_rotinas (time_slug, titulo, recorrencia, proxima)
  values ('formacao', 'PROVA — rotina esquecida', 'semanal', current_date - 24)
  returning id into rot;
  dia_semana_antes := extract(dow from (current_date - 24));

  perform public.acolitos_rotinas_materializar();
  select proxima into prox from public.acolitos_rotinas where id = rot;
  dia_semana_depois := extract(dow from prox);

  if prox > current_date and dia_semana_antes = dia_semana_depois then
    raise notice 'ATRASO: certo — próxima em % (mesmo dia da semana, já no futuro)', prox;
  else
    raise notice 'ATRASO: ERRADO — próxima em % (dia da semana % virou %)', prox, dia_semana_antes, dia_semana_depois;
  end if;

  if (select count(*) from public.acolitos_tarefas where rotina_id = rot) = 1 then
    raise notice 'SEM FILA DO PASSADO: certo — 1 tarefa, não 4 atrasadas';
  else
    raise notice 'SEM FILA DO PASSADO: ERRADO — % tarefas', (select count(*) from public.acolitos_tarefas where rotina_id = rot);
  end if;
end $$;
rollback;

\echo ''
\echo '=== 6) quem não é da equipe leva RECUSA, não zero ==='
begin;
do $$
begin
  perform set_config('request.jwt.claims',
    '{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000000"}', true);
  perform public.acolitos_rotinas_materializar();
  raise notice 'PORTÃO: ABERTO — ERRADO';
exception
  when insufficient_privilege then raise notice 'PORTÃO: recusou — CERTO';
  when others then raise notice 'PORTÃO: recusou com % (%)', sqlstate, sqlerrm;
end $$;
rollback;

\echo ''
\echo '=== 7) depois de tudo, nada ficou gravado ==='
select (select count(*) from public.acolitos_rotinas) as rotinas_DEVE_SER_0,
       (select count(*) from public.acolitos_tarefas) as tarefas_DEVE_SER_0;
