-- Prova da 075: o acompanhamento da Formação diz com quem falar, e só para quem pode ver.
-- Rodar:  psql "$SUPABASE_DB_URL" -f docs/provas/provar-075-acompanhamento-da-formacao.sql
--
-- NÃO GRAVA NADA: tudo que finge papel roda dentro de `begin … rollback`.
--
-- POR QUE A PROVA PRECISA FINGIR SER ALGUÉM: a função tranca pelo papel de quem chama. No
-- psql não existe sessão de app, então `auth.uid()` é nulo e a função recusa — corretamente.
-- Ler como superusuário provaria o contrário do que interessa. Aqui ela é lida como o
-- COORDENADOR (é assim que a tela vai chamar) e depois como um desconhecido.
--
-- O QUE DEFENDE (medido em 18/09/2026): 148 de 193 pessoas nunca abriram o app e 155 nunca
-- progrediram em missão nenhuma — e NENHUMA tela mostrava isso, porque todas listam quem age.
--
-- ⚠️ ARMADILHA QUE ESTA PROVA JÁ PEGOU (18/09): `acolitos_get_role` devolve NULO para quem
-- não conhece, e `NULO not in (...)` é NULO, não FALSO. Sem `coalesce`, o portão ficava
-- escancarado e a seção 7 acusou. Se alguém mexer no portão, esta seção tem de continuar viva.
\set ON_ERROR_STOP on
\timing off
\pset pager off

\echo '=== 1) a função existe, tranca o caminho e não fica aberta ao anônimo ==='
select p.proname,
       p.prosecdef as security_definer_DEVE_SER_t,
       p.proconfig::text as search_path,
       has_function_privilege('authenticated', p.oid, 'execute') as authenticated_DEVE_SER_t,
       has_function_privilege('anon', p.oid, 'execute') as anon_DEVE_SER_f
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'acolitos_formacao_acompanhamento';

\echo ''
\echo '=== 2 a 6) lida como o COORDENADOR (com rollback no fim) ==='
begin;
-- quem vale é o coordenador de verdade, buscado pelo PAPEL (nada de id cravado):
select set_config('request.jwt.claims',
  json_build_object('role', 'authenticated',
                    'sub', (select m.user_id from public.acolitos_membros m
                             where public.acolitos_get_role(m.user_id) = 'coord_admin'
                               and m.user_id is not null limit 1))::text,
  true) is not null as ignorar;
set local role authenticated;

\echo '--- 2) toda pessoa não desligada aparece, e em exatamente UMA faixa ---'
select (select count(*) from public.acolitos_membros where coalesce(status,'') <> 'desligado') as membros,
       (select count(*) from public.acolitos_formacao_acompanhamento()) as linhas_DEVE_BATER,
       (select count(distinct membro_id) from public.acolitos_formacao_acompanhamento()) as pessoas_distintas_DEVE_BATER;

\echo '--- 3) quantos em cada faixa, hoje ---'
select faixa, count(*) as pessoas, count(*) filter (where telefone is not null) as com_telefone
  from public.acolitos_formacao_acompanhamento() group by faixa order by count(*) desc;

\echo '--- 4) já vem na ORDEM da urgência ---'
select faixa, nome from public.acolitos_formacao_acompanhamento() limit 3;

\echo '--- 5) a conta do capítulo é coerente; "sem degrau" são os que ainda estão no CRM ---'
select count(*) filter (where obrigatorias_feitas > obrigatorias_do_capitulo) as incoerentes_DEVE_SER_0,
       count(*) filter (where capitulo_atual is null and nivel is not null) as trilha_do_degrau_acabada,
       count(*) filter (where nivel is null) as sem_degrau_ainda_no_CRM
  from public.acolitos_formacao_acompanhamento();

\echo '--- 6) quem PAROU parou mesmo: nada nos últimos 30 dias ---'
select count(*) as parados,
       count(*) filter (where dias_parado is null or dias_parado <= 30) as mentirosos_DEVE_SER_0,
       min(dias_parado) as menor_parada
  from public.acolitos_formacao_acompanhamento() where faixa = 'parou';
rollback;

\echo ''
\echo '=== 7) o PORTÃO: quem não é da coordenação leva RECUSA, não lista vazia ==='
begin;
do $$
begin
  perform set_config('request.jwt.claims',
    '{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000000"}', true);
  set local role authenticated;
  perform * from public.acolitos_formacao_acompanhamento();
  raise notice 'PORTÃO: ABERTO — ERRADO (quem não é da coordenação leu a lista)';
exception
  when insufficient_privilege then
    raise notice 'PORTÃO: recusou — CERTO (erro de permissão, não lista vazia)';
  when others then
    raise notice 'PORTÃO: recusou com % (%) — conferir se é o erro certo', sqlstate, sqlerrm;
end $$;
rollback;

\echo ''
\echo '=== 8) e o visitante SEM LOGIN nem chega a executar ==='
select has_function_privilege('anon', 'public.acolitos_formacao_acompanhamento()', 'execute') as anon_DEVE_SER_f;
