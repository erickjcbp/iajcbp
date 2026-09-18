-- Prova da 080: o rodízio do Orientador dá uma conversa por dia e passa por todos.
-- Rodar:  psql "$SUPABASE_DB_URL" -f docs/provas/provar-080-rodizio-do-orientador.sql
-- NÃO DEIXA NADA GRAVADO: tudo que escreve roda dentro de `begin … rollback`.
--
-- O QUE DEFENDE (18/09/2026): o dono quer falar com **todos** do acólito sentinela para cima —
-- 45 pessoas ativas —, estejam parados ou não, **uma por dia**. Quem orienta fica de fora da
-- fila: sem isso o app manda o orientador falar com ele mesmo.
\set ON_ERROR_STOP on
\timing off
\pset pager off

\echo '=== 1) a rotina aceita o tipo rodízio e guarda os degraus da roda ==='
select pg_get_constraintdef(oid) as fontes_DEVE_CITAR_rodizio
  from pg_constraint where conname = 'acolitos_rotinas_fonte_check';
select count(*) as coluna_alvo_niveis_DEVE_SER_1 from information_schema.columns
 where table_name = 'acolitos_rotinas' and column_name = 'alvo_niveis';

\echo ''
\echo '=== 2) O RODÍZIO RODANDO (com rollback) ==='
begin;
do $$
declare
  coord uuid; rot uuid;
  abertas integer; total integer; proprio integer; foraDoGrupo integer;
  primeiro text; segundo text; prox date;
  -- ⚠️ guardar a PESSOA, não a ordem de criação: dentro de uma transação `now()` é igual para
  -- todas as linhas, então `order by criada_em` não distingue a primeira da segunda tarefa.
  alvo1 uuid; alvo2 uuid;
  publico integer;
begin
  select m.user_id into coord from public.acolitos_membros m
   where public.acolitos_get_role(m.user_id) = 'coord_admin' and m.user_id is not null limit 1;
  perform set_config('request.jwt.claims',
    json_build_object('role','authenticated','sub',coord)::text, true);

  select count(*) into publico from public.acolitos_membros
   where coalesce(status,'') = 'ativo'
     and nivel in ('acolito_sentinela','aspirante_cerimoniario','cerimoniario_aspirante',
                   'cerimoniario_guardiao','cerimoniario_magistral','cerimoniario_mor');
  raise notice 'PÚBLICO: % pessoas ativas do sentinela para cima', publico;

  insert into public.acolitos_rotinas
    (time_slug, titulo, recorrencia, proxima, fonte, lote, descanso_dias, alvo_niveis)
  values ('orientador', 'Conversar com um acólito sentinela ou acima', 'diaria', current_date,
          'rodizio', 1, 30,
          array['acolito_sentinela','aspirante_cerimoniario','cerimoniario_aspirante',
                'cerimoniario_guardiao','cerimoniario_magistral','cerimoniario_mor'])
  returning id into rot;

  perform public.acolitos_rotinas_materializar();
  select count(*) into abertas from public.acolitos_tarefas where rotina_id = rot and concluida_em is null;
  select titulo, alvo_id into primeiro, alvo1 from public.acolitos_tarefas
   where rotina_id = rot and concluida_em is null limit 1;
  select proxima into prox from public.acolitos_rotinas where id = rot;
  if abertas = 1 and prox = current_date + 1 then
    raise notice 'UMA POR DIA: certo — "%" hoje, próxima amanhã (%)', primeiro, prox;
  else
    raise notice 'UMA POR DIA: ERRADO — % abertas, próxima em %', abertas, prox;
  end if;

  -- sem concluir, amanhã não nasce outra
  update public.acolitos_rotinas set proxima = current_date where id = rot;
  perform public.acolitos_rotinas_materializar();
  select count(*) into abertas from public.acolitos_tarefas where rotina_id = rot and concluida_em is null;
  if abertas = 1 then raise notice 'NÃO ACUMULA: certo — continua 1 conversa aberta';
  else raise notice 'NÃO ACUMULA: ERRADO — % abertas', abertas; end if;

  -- concluída, entra OUTRA pessoa
  update public.acolitos_tarefas set concluida_em = now() where rotina_id = rot and concluida_em is null;
  update public.acolitos_rotinas set proxima = current_date where id = rot;
  perform public.acolitos_rotinas_materializar();
  select titulo, alvo_id into segundo, alvo2 from public.acolitos_tarefas
   where rotina_id = rot and concluida_em is null limit 1;
  if alvo2 is distinct from alvo1 then
    raise notice 'A RODA GIRA: certo — depois de "%" veio "%"', primeiro, segundo;
  else
    raise notice 'A RODA GIRA: ERRADO — a mesma pessoa voltou no dia seguinte';
  end if;

  -- roda a volta inteira: ninguém do próprio setor, ninguém fora do grupo, ninguém repetido
  for i in 1..60 loop
    update public.acolitos_tarefas set concluida_em = now() where rotina_id = rot and concluida_em is null;
    update public.acolitos_rotinas set proxima = current_date where id = rot;
    perform public.acolitos_rotinas_materializar();
  end loop;

  select count(*) into total from public.acolitos_tarefas where rotina_id = rot;
  select count(*) into proprio
    from public.acolitos_tarefas t join public.acolitos_membros m on m.id = t.alvo_id
   where t.rotina_id = rot and 'orientador' = any(coalesce(m.setores,'{}'::text[]));
  select count(*) into foraDoGrupo
    from public.acolitos_tarefas t join public.acolitos_membros m on m.id = t.alvo_id
   where t.rotina_id = rot
     and m.nivel not in ('acolito_sentinela','aspirante_cerimoniario','cerimoniario_aspirante',
                         'cerimoniario_guardiao','cerimoniario_magistral','cerimoniario_mor');

  raise notice 'A VOLTA: % conversas no total (público %, menos quem é do próprio setor)', total, publico;
  if proprio = 0 then raise notice 'QUEM ORIENTA FICA FORA: certo — ninguém do setor Orientador na fila';
  else raise notice 'QUEM ORIENTA FICA FORA: ERRADO — % pessoas do próprio setor entraram', proprio; end if;
  if foraDoGrupo = 0 then raise notice 'SÓ O GRUPO: certo — ninguém abaixo de sentinela entrou';
  else raise notice 'SÓ O GRUPO: ERRADO — % pessoas fora do grupo entraram', foraDoGrupo; end if;

  if exists (select alvo_id from public.acolitos_tarefas where rotina_id = rot
              group by alvo_id having count(*) > 1) then
    raise notice 'SEM REPETIR: ERRADO — alguém foi procurado duas vezes antes de a volta fechar';
  else
    raise notice 'SEM REPETIR: certo — cada pessoa uma vez só na volta';
  end if;
end $$;
rollback;

\echo ''
\echo '=== 3) o acompanhamento (078) continua funcionando como antes ==='
begin;
do $$
declare coord uuid; rot uuid; comNome integer;
begin
  select m.user_id into coord from public.acolitos_membros m
   where public.acolitos_get_role(m.user_id) = 'coord_admin' and m.user_id is not null limit 1;
  perform set_config('request.jwt.claims',
    json_build_object('role','authenticated','sub',coord)::text, true);
  insert into public.acolitos_rotinas (time_slug, titulo, recorrencia, proxima, fonte, lote)
  values ('formacao', 'Falar com quem está parado', 'semanal', current_date, 'acompanhamento', 3)
  returning id into rot;
  perform public.acolitos_rotinas_materializar();
  select count(*) into comNome from public.acolitos_tarefas where rotina_id = rot and titulo like 'Falar com %';
  if comNome between 1 and 3 then raise notice 'ACOMPANHAMENTO: certo — % tarefas com nome', comNome;
  else raise notice 'ACOMPANHAMENTO: ERRADO — % tarefas', comNome; end if;
end $$;
rollback;

\echo ''
\echo '=== 4) quem não é da equipe leva RECUSA ==='
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
\echo '=== 5) nada ficou gravado ==='
select (select count(*) from public.acolitos_rotinas) as rotinas_DEVE_SER_0,
       (select count(*) from public.acolitos_tarefas) as tarefas_DEVE_SER_0;
