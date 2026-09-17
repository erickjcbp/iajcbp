-- Prova da 069 SEM gravar nada: filtros de Ausências no banco.
-- Rodar:  psql "$SUPABASE_DB_URL" -f docs/provas/provar-069-filtros-de-ausencias.sql
-- O QUE DEFENDE: (1) a vista das ausências obedece às MESMAS regras de acesso da tabela;
-- (2) a função de faltas filtra DENTRO do banco — a pessoa com 30 faltas aparece com 30,
-- não com as que caberiam nas 80 mais recentes; (3) sem permissão é ERRO, não lista vazia;
-- (4) a função antiga continua respondendo (a tela de hoje depende dela).
\set ON_ERROR_STOP on
\timing off

\echo '=== 0) quem pode ler/executar ==='
select has_table_privilege('anon', 'public.acolitos_ausencias_v', 'select') as anon_le_vista_DEVE_SER_f,
       has_table_privilege('authenticated', 'public.acolitos_ausencias_v', 'select') as logado_le_vista_DEVE_SER_t,
       has_function_privilege('anon', 'public.acolitos_faltas_filtradas(uuid[],date,date,text[],integer)', 'execute') as anon_faltas_DEVE_SER_f,
       has_function_privilege('anon', 'public.acolitos_faltas_contar(uuid[],date,date,text[])', 'execute') as anon_contar_DEVE_SER_f,
       (select reloptions from pg_class where oid = 'public.acolitos_ausencias_v'::regclass) as opcoes_DEVE_TER_security_invoker;

\echo ''
\echo '=== 1) a vista traz a data da missa de TODAS as ausências ==='
select count(*) as na_tabela, (select count(*) from public.acolitos_ausencias_v) as na_vista_DEVE_IGUALAR,
       (select count(*) from public.acolitos_ausencias_v where missa_data is null) as sem_data_DEVE_SER_0
  from public.acolitos_ausencias;

\echo ''
\echo '=== 2) a vista obedece às regras: para cada papel, vê o MESMO que a tabela ==='
select m.user_id as uid_membro from public.acolitos_membros m
 where m.user_id is not null and coalesce(public.acolitos_get_role(m.user_id), '') not in ('coord_admin','subadmin','membro_equipe','cerimonario')
   and exists (select 1 from public.acolitos_ausencias a where a.membro_id = m.id)
 limit 1 \gset
select m.user_id as uid_cerimo from public.acolitos_membros m
 where m.user_id is not null and public.acolitos_get_role(m.user_id) = 'cerimonario' limit 1 \gset
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'uid_membro', 'role', 'authenticated')::text, true) is not null as membro;
select (select count(*) from public.acolitos_ausencias) as tabela, (select count(*) from public.acolitos_ausencias_v) as vista_DEVE_IGUALAR;
select set_config('request.jwt.claims', json_build_object('sub', :'uid_cerimo', 'role', 'authenticated')::text, true) is not null as cerimoniario;
select (select count(*) from public.acolitos_ausencias) as tabela, (select count(*) from public.acolitos_ausencias_v) as vista_DEVE_IGUALAR;
select set_config('request.jwt.claims', '{"sub":"b6f27ee7-e19f-4444-a771-8fc6ef3c35cb","role":"authenticated"}', true) is not null as coordenacao;
select (select count(*) from public.acolitos_ausencias) as tabela, (select count(*) from public.acolitos_ausencias_v) as vista_DEVE_IGUALAR;
rollback;
\echo '   (o membro comum tem de ver MENOS que a coordenação — conferir nos números acima)'

\echo ''
\echo '=== 3) faltas: sem filtro bate com a função antiga; com pessoa, traz TODAS as dela ==='
select e.membro_id as membro_mais_faltas, count(*) as faltas_dele
  from public.acolitos_chamadas_itens ci join public.acolitos_escalas e on e.id = ci.escala_id
 where ci.resultado = 'ausente' group by e.membro_id order by count(*) desc limit 1 \gset
select count(*) as total_faltas from public.acolitos_chamadas_itens where resultado = 'ausente' \gset
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"b6f27ee7-e19f-4444-a771-8fc6ef3c35cb","role":"authenticated"}';
select jsonb_array_length(public.acolitos_faltas_recentes()) as antiga,
       jsonb_array_length(public.acolitos_faltas_filtradas()) as nova_DEVE_IGUALAR;
select public.acolitos_faltas_contar() as contar_tudo, :total_faltas as direto_DEVE_IGUALAR;
select jsonb_array_length(public.acolitos_faltas_filtradas(array[:'membro_mais_faltas']::uuid[], null, null, null, 500)) as da_pessoa,
       public.acolitos_faltas_contar(array[:'membro_mais_faltas']::uuid[]) as contar_pessoa,
       :faltas_dele as direto_DEVE_IGUALAR_OS_DOIS;
select count(*) as de_outra_pessoa_DEVE_SER_0
  from jsonb_array_elements(public.acolitos_faltas_filtradas(array[:'membro_mais_faltas']::uuid[], null, null, null, 500)) x
 where x->>'membro_id' <> :'membro_mais_faltas';
select count(*) as fora_do_periodo_DEVE_SER_0
  from jsonb_array_elements(public.acolitos_faltas_filtradas(null, '2026-08-01', '2026-08-31', null, 500)) x
 where (x->>'data')::date not between '2026-08-01' and '2026-08-31';
select count(*) as fora_da_comunidade_DEVE_SER_0
  from jsonb_array_elements(public.acolitos_faltas_filtradas(null, null, null, array['santo_antonio'], 500)) x
 where x->>'comunidade' <> 'santo_antonio';
select (select (x->>'data') from jsonb_array_elements(public.acolitos_faltas_filtradas()) with ordinality t(x, n) where n = 1)
       >= (select (x->>'data') from jsonb_array_elements(public.acolitos_faltas_filtradas()) with ordinality t(x, n) order by n desc limit 1)
       as mais_recente_primeiro_DEVE_SER_t;
rollback;

\echo ''
\echo '=== 4) sem permissão é ERRO (cerimoniário), não lista vazia ==='
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'uid_cerimo', 'role', 'authenticated')::text, true) is not null as cerimoniario;
do $$ begin
  perform public.acolitos_faltas_filtradas();
  raise notice 'LISTA: PASSOU — ERRADO';
exception when insufficient_privilege then raise notice 'LISTA: recusada — CERTO';
end $$;
do $$ begin
  perform public.acolitos_faltas_contar();
  raise notice 'CONTAR: PASSOU — ERRADO';
exception when insufficient_privilege then raise notice 'CONTAR: recusada — CERTO';
end $$;
rollback;

\echo ''
\echo '=== 5) hora crua vira minutos, e a ordem do dia usa minutos, não texto (070) ==='
select public.acolitos_minutos_do_horario('7h') as h7_DEVE_SER_420,
       public.acolitos_minutos_do_horario('9h') as h9_DEVE_SER_540,
       public.acolitos_minutos_do_horario('16h') as h16_DEVE_SER_960,
       public.acolitos_minutos_do_horario('17h') as h17_DEVE_SER_1020,
       public.acolitos_minutos_do_horario('18h30') as h1830_DEVE_SER_1110,
       public.acolitos_minutos_do_horario('19h') as h19_DEVE_SER_1140,
       public.acolitos_minutos_do_horario('19h30') as h1930_DEVE_SER_1170;
select public.acolitos_minutos_do_horario('19:00') as h1900_DEVE_SER_1140,
       public.acolitos_minutos_do_horario('08:15') as h0815_DEVE_SER_495,
       public.acolitos_minutos_do_horario(null) as nulo_DEVE_SER_null,
       public.acolitos_minutos_do_horario('sem hora') as invalido_DEVE_SER_null;

\echo ''
\echo '   -- a vista traz minutos batendo com a função, linha a linha --'
select count(*) as vista_minutos_errados_DEVE_SER_0
  from public.acolitos_ausencias_v
 where missa_minutos is distinct from public.acolitos_minutos_do_horario(missa_horario);

\echo ''
\echo '   -- achar o dia mais recente com faltas em 2+ horários DIFERENTES --'
select coalesce((
  select cel.data
    from public.acolitos_chamadas_itens ci
    join public.acolitos_chamadas ch on ch.id = ci.chamada_id
    join public.acolitos_escalas e on e.id = ci.escala_id
    join public.acolitos_celebracoes cel on cel.id = ch.celebracao_id
   where ci.resultado = 'ausente'
   group by cel.data
  having count(distinct cel.horario) >= 2
   order by cel.data desc
   limit 1
), '1900-01-01'::date) as dia_multi_hora,
exists (
  select 1
    from public.acolitos_chamadas_itens ci
    join public.acolitos_chamadas ch on ch.id = ci.chamada_id
    join public.acolitos_escalas e on e.id = ci.escala_id
    join public.acolitos_celebracoes cel on cel.id = ch.celebracao_id
   where ci.resultado = 'ausente'
   group by cel.data
  having count(distinct cel.horario) >= 2
) as existe_dia_multi_hora \gset

\echo '   dia escolhido:' :dia_multi_hora '  existe_dia_multi_hora:' :existe_dia_multi_hora
\echo '   (se existe_dia_multi_hora = f, NENHUM dia com 2+ horários foi achado — a checagem abaixo diz isso, não passa em silêncio)'
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"b6f27ee7-e19f-4444-a771-8fc6ef3c35cb","role":"authenticated"}';
select :'existe_dia_multi_hora' = 't' as existe_dia_multi_hora_DEVE_SER_t,
       case when :'existe_dia_multi_hora' <> 't' then null else (
         select count(*)
           from jsonb_array_elements(public.acolitos_faltas_filtradas(null, :'dia_multi_hora', :'dia_multi_hora', null, 500)) with ordinality as t1(x, n)
           join jsonb_array_elements(public.acolitos_faltas_filtradas(null, :'dia_multi_hora', :'dia_multi_hora', null, 500)) with ordinality as t2(x, n) on t2.n = t1.n + 1
          where public.acolitos_minutos_do_horario(t2.x->>'horario') > public.acolitos_minutos_do_horario(t1.x->>'horario')
       ) end as pares_fora_de_ordem_DEVE_SER_0_SE_t_ACIMA;
rollback;
