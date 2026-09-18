-- Prova da 079: a rotina de TODO DIA, com lote 1, dá uma conversa por dia — e só uma.
-- Rodar:  psql "$SUPABASE_DB_URL" -f docs/provas/provar-079-uma-por-dia.sql
-- NÃO DEIXA NADA GRAVADO: roda dentro de `begin … rollback`.
--
-- PEDIDO DO DONO (18/09/2026): "11 pessoas por dia é muita coisa, tem que ser uma por dia".
\set ON_ERROR_STOP on
\timing off
\pset pager off

\echo '=== 1) a rotina aceita "todo dia" ==='
select pg_get_constraintdef(oid) as trava_DEVE_CITAR_diaria
  from pg_constraint where conname = 'acolitos_rotinas_recorrencia_check';

\echo ''
\echo '=== 2) uma por dia, de verdade (com rollback) ==='
begin;
do $$
declare
  coord uuid; rot uuid; abertas integer; prox date; criadas integer;
begin
  select m.user_id into coord from public.acolitos_membros m
   where public.acolitos_get_role(m.user_id) = 'coord_admin' and m.user_id is not null limit 1;
  perform set_config('request.jwt.claims',
    json_build_object('role','authenticated','sub',coord)::text, true);

  insert into public.acolitos_rotinas (time_slug, titulo, recorrencia, proxima, fonte, lote)
  values ('orientador', 'Falar com uma pessoa parada', 'diaria', current_date, 'acompanhamento', 1)
  returning id into rot;

  criadas := public.acolitos_rotinas_materializar();
  select count(*) into abertas from public.acolitos_tarefas where rotina_id = rot and concluida_em is null;
  select proxima into prox from public.acolitos_rotinas where id = rot;
  if abertas = 1 and prox = current_date + 1 then
    raise notice 'UMA POR DIA: certo — 1 conversa hoje, próxima amanhã (%)', prox;
  else
    raise notice 'UMA POR DIA: ERRADO — % abertas, próxima em %', abertas, prox;
  end if;

  -- sem concluir a de hoje, amanhã NÃO nasce outra
  update public.acolitos_rotinas set proxima = current_date where id = rot;
  perform public.acolitos_rotinas_materializar();
  select count(*) into abertas from public.acolitos_tarefas where rotina_id = rot and concluida_em is null;
  if abertas = 1 then
    raise notice 'NÃO ACUMULA: certo — quem não falou ontem não recebe dois nomes hoje';
  else
    raise notice 'NÃO ACUMULA: ERRADO — % abertas', abertas;
  end if;

  -- concluída, a próxima pessoa entra
  update public.acolitos_tarefas set concluida_em = now() where rotina_id = rot and concluida_em is null;
  update public.acolitos_rotinas set proxima = current_date where id = rot;
  perform public.acolitos_rotinas_materializar();
  select count(*) into abertas from public.acolitos_tarefas where rotina_id = rot and concluida_em is null;
  if abertas = 1 and (select count(distinct alvo_id) from public.acolitos_tarefas where rotina_id = rot) = 2 then
    raise notice 'A FILA ANDA: certo — falou com um, o app trouxe OUTRO no dia seguinte';
  else
    raise notice 'A FILA ANDA: ERRADO — % abertas, % pessoas no total', abertas,
      (select count(distinct alvo_id) from public.acolitos_tarefas where rotina_id = rot);
  end if;

  -- E a pessoa com quem já se falou não pode voltar no dia seguinte.
  if exists (select 1 from public.acolitos_tarefas t1
              join public.acolitos_tarefas t2 on t2.alvo_id = t1.alvo_id and t2.id <> t1.id
             where t1.rotina_id = rot and t2.rotina_id = rot) then
    raise notice 'DESCANSO: ERRADO — a mesma pessoa foi procurada duas vezes seguidas';
  else
    raise notice 'DESCANSO: certo — quem já foi procurado sai da fila por 30 dias';
  end if;
end $$;
rollback;

\echo ''
\echo '=== 3) nada ficou gravado ==='
select (select count(*) from public.acolitos_rotinas) as rotinas_DEVE_SER_0,
       (select count(*) from public.acolitos_tarefas) as tarefas_DEVE_SER_0;
