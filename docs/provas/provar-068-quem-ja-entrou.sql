-- Prova da 068 SEM gravar nada: pergunta quem já entrou no app, fingindo ser cada pessoa.
-- Rodar:  psql "$SUPABASE_DB_URL" -f docs/provas/provar-068-quem-ja-entrou.sql
-- Regra do projeto: trava se prova RODANDO, não lendo o SQL.
--
-- O QUE ESTA PROVA DEFENDE: o filtro "já entrou / nunca entrou" da aba Membros. A data do
-- último acesso mora em auth.users, que o app não enxerga. A função devolve SÓ o id do
-- membro — nem e-mail, nem data — e só para quem abre a tela Membros.
\set ON_ERROR_STOP on
\timing off

\echo '=== 0) quem pode executar, e o que a função devolve ==='
select has_function_privilege('anon',          'public.acolitos_membros_ja_entraram()', 'execute') as anon_executa_DEVE_SER_f,
       has_function_privilege('authenticated', 'public.acolitos_membros_ja_entraram()', 'execute') as logado_executa_DEVE_SER_t,
       pg_get_function_result('public.acolitos_membros_ja_entraram()'::regprocedure) as devolve_DEVE_SER_so_membro_id;

\echo ''
\echo '=== 1) COORDENAÇÃO pergunta — tem de bater com a conta direta no banco ==='
select count(*) as direto
  from public.acolitos_membros m join auth.users u on u.id = m.user_id
 where u.last_sign_in_at is not null \gset
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"b6f27ee7-e19f-4444-a771-8fc6ef3c35cb","role":"authenticated"}';
select count(*) as pela_funcao, :direto as direto_DEVE_IGUALAR
  from public.acolitos_membros_ja_entraram();
rollback;

\echo ''
\echo '=== 2) quem NÃO abre a tela Membros leva ERRO — lista vazia seria mentira ==='
select m.user_id as uid_sem_acesso
  from public.acolitos_membros m
 where m.user_id is not null
   and coalesce(public.acolitos_get_role(m.user_id), '') not in ('coord_admin','subadmin','membro_equipe')
 limit 1 \gset
begin;
set local role authenticated;
select set_config('request.jwt.claims',
       json_build_object('sub', :'uid_sem_acesso', 'role', 'authenticated')::text, true) is not null as fingiu;
do $$
begin
  perform 1 from public.acolitos_membros_ja_entraram();
  raise notice 'RESULTADO: PASSOU — ERRADO, devia recusar';
exception when insufficient_privilege then
  raise notice 'RESULTADO: recusado — CERTO';
end $$;
rollback;
