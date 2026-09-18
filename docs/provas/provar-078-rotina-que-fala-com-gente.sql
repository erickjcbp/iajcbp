-- Prova da 078: a rotina do Orientador nomeia a pessoa, e nunca despeja a lista inteira.
-- Rodar:  psql "$SUPABASE_DB_URL" -f docs/provas/provar-078-rotina-que-fala-com-gente.sql
--
-- NÃO DEIXA NADA GRAVADO: tudo que escreve roda dentro de `begin … rollback`.
--
-- O QUE DEFENDE (18/09/2026): 11 pessoas travadas ou paradas e 148 que nunca abriram o app.
-- Uma tarefa por pessoa faria o Orientador abrir a tela e desistir; e "falar com 3 coroinhas
-- parados", sem nome, não diz com quem.
\set ON_ERROR_STOP on
\timing off
\pset pager off

\echo '=== 1) os campos novos existem, com os padrões certos ==='
select column_name, data_type, column_default
  from information_schema.columns
 where table_name = 'acolitos_rotinas' and column_name in ('fonte', 'lote')
 order by column_name;
select count(*) as elo_alvo_DEVE_SER_1 from information_schema.columns
 where table_name = 'acolitos_tarefas' and column_name = 'alvo_id';

\echo ''
\echo '=== 2) A ROTINA DE ACOMPANHAMENTO, do começo ao fim (com rollback) ==='
begin;
do $$
declare
  coord uuid; rot uuid;
  criadas integer; abertas integer; comNome integer; semAlvo integer;
  primeiro text;
begin
  select m.user_id into coord from public.acolitos_membros m
   where public.acolitos_get_role(m.user_id) = 'coord_admin' and m.user_id is not null limit 1;
  perform set_config('request.jwt.claims',
    json_build_object('role','authenticated','sub',coord)::text, true);

  insert into public.acolitos_rotinas (time_slug, titulo, recorrencia, proxima, fonte, lote)
  values ('orientador', 'Acompanhar quem está parado', 'semanal', current_date, 'acompanhamento', 3)
  returning id into rot;

  criadas := public.acolitos_rotinas_materializar();
  select count(*) into abertas from public.acolitos_tarefas where rotina_id = rot and concluida_em is null;
  select count(*) into comNome from public.acolitos_tarefas where rotina_id = rot and titulo like 'Falar com %';
  select count(*) into semAlvo from public.acolitos_tarefas where rotina_id = rot and alvo_id is null;
  select titulo into primeiro from public.acolitos_tarefas where rotina_id = rot order by criada_em limit 1;

  if abertas > 0 and abertas <= 3 then
    raise notice 'LOTE: certo — % tarefas abertas (teto 3). Primeira: "%"', abertas, primeiro;
  else
    raise notice 'LOTE: ERRADO — % abertas', abertas;
  end if;
  if comNome = abertas and semAlvo = 0 then
    raise notice 'NOMEIA A PESSOA: certo — toda tarefa diz o nome e guarda de quem fala';
  else
    raise notice 'NOMEIA A PESSOA: ERRADO — comNome=% semAlvo=%', comNome, semAlvo;
  end if;

  -- rodar de novo no mesmo dia não pode encher a fila
  update public.acolitos_rotinas set proxima = current_date where id = rot;
  perform public.acolitos_rotinas_materializar();
  select count(*) into abertas from public.acolitos_tarefas where rotina_id = rot and concluida_em is null;
  if abertas <= 3 then
    raise notice 'NÃO ENCHE: certo — continua no teto (% abertas)', abertas;
  else
    raise notice 'NÃO ENCHE: ERRADO — subiu para %', abertas;
  end if;

  -- a mesma pessoa não pode ganhar duas tarefas abertas
  if exists (select alvo_id from public.acolitos_tarefas
              where rotina_id = rot and concluida_em is null and alvo_id is not null
              group by alvo_id having count(*) > 1) then
    raise notice 'PESSOA REPETIDA: ERRADO — alguém ganhou duas tarefas abertas';
  else
    raise notice 'UMA POR PESSOA: certo — ninguém aparece duas vezes na fila';
  end if;

  -- concluída uma, a vaga abre para a PRÓXIMA pessoa (não para a mesma de novo)
  update public.acolitos_tarefas set concluida_em = now()
   where id = (select id from public.acolitos_tarefas where rotina_id = rot and concluida_em is null limit 1);
  update public.acolitos_rotinas set proxima = current_date where id = rot;
  criadas := public.acolitos_rotinas_materializar();
  select count(*) into abertas from public.acolitos_tarefas where rotina_id = rot and concluida_em is null;
  raise notice 'A FILA ANDA: % nova(s) ao concluir uma; % abertas agora', criadas, abertas;
end $$;
rollback;

\echo ''
\echo '=== 3) quem nunca entrou no app NÃO entra nesta fila (é problema de acesso) ==='
begin;
do $$
declare
  coord uuid; rot uuid; nuncaEntrou integer;
begin
  select m.user_id into coord from public.acolitos_membros m
   where public.acolitos_get_role(m.user_id) = 'coord_admin' and m.user_id is not null limit 1;
  perform set_config('request.jwt.claims',
    json_build_object('role','authenticated','sub',coord)::text, true);

  insert into public.acolitos_rotinas (time_slug, titulo, recorrencia, proxima, fonte, lote)
  values ('orientador', 'Acompanhar', 'semanal', current_date, 'acompanhamento', 20)
  returning id into rot;
  perform public.acolitos_rotinas_materializar();

  select count(*) into nuncaEntrou
    from public.acolitos_tarefas t
    join public.acolitos_membros m on m.id = t.alvo_id
    left join auth.users u on u.id = m.user_id
   where t.rotina_id = rot and u.last_sign_in_at is null;

  if nuncaEntrou = 0 then
    raise notice 'SÓ QUEM ESTÁ DENTRO: certo — ninguém que nunca abriu o app entrou na fila';
  else
    raise notice 'SÓ QUEM ESTÁ DENTRO: ERRADO — % pessoas que nunca entraram viraram tarefa', nuncaEntrou;
  end if;
end $$;
rollback;

\echo ''
\echo '=== 4) a rotina de título fixo continua funcionando igual (não quebrei a 077) ==='
begin;
do $$
declare coord uuid; rot uuid; abertas integer;
begin
  select m.user_id into coord from public.acolitos_membros m
   where public.acolitos_get_role(m.user_id) = 'coord_admin' and m.user_id is not null limit 1;
  perform set_config('request.jwt.claims',
    json_build_object('role','authenticated','sub',coord)::text, true);
  insert into public.acolitos_rotinas (time_slug, titulo, recorrencia, proxima)
  values ('formacao', 'PROVA — conferir as velas', 'semanal', current_date) returning id into rot;
  perform public.acolitos_rotinas_materializar();
  update public.acolitos_rotinas set proxima = current_date where id = rot;
  perform public.acolitos_rotinas_materializar();
  select count(*) into abertas from public.acolitos_tarefas where rotina_id = rot and concluida_em is null;
  if abertas = 1 then raise notice 'FIXA: certo — continua uma viva por vez';
  else raise notice 'FIXA: ERRADO — % abertas', abertas; end if;
end $$;
rollback;

\echo ''
\echo '=== 5) nada ficou gravado ==='
select (select count(*) from public.acolitos_rotinas) as rotinas_DEVE_SER_0,
       (select count(*) from public.acolitos_tarefas) as tarefas_DEVE_SER_0;
