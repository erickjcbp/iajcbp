-- Prova da 057 SEM gravar nada: cria tarefas de mentira, testa fingindo ser cada pessoa, e desfaz.
-- Rodar:  psql "$SUPABASE_DB_URL" -f docs/provar-057-tarefas-por-time.sql
-- Regra do projeto: trava se prova RODANDO, não lendo o SQL.
\set ON_ERROR_STOP on
\timing off
begin;

\echo '=== o que está VALENDO no banco agora ==='
-- Esta prova NÃO aplica nada: ela mede a trava que está no ar. Rodar depois de qualquer
-- mexida em acolitos_tarefas — inclusive meses depois, para conferir que ninguém afrouxou.
select polname, polcmd, polroles::regrole[] as papeis
from pg_policy where polrelid = 'public.acolitos_tarefas'::regclass order by polname;
select has_function_privilege('anon',          'public.acolitos_meus_times(uuid)', 'execute') as anon_executa,
       has_function_privilege('authenticated', 'public.acolitos_meus_times(uuid)', 'execute') as logado_executa;

-- Cenário: uma tarefa da Secretaria e uma da Formação. Inseridas como dono da conexão, que
-- não passa pela trava — o que se quer provar é a LEITURA de quem está logado no app.
insert into public.acolitos_tarefas (id, titulo, time_slug) values
  ('11111111-1111-1111-1111-111111111111', 'PROVA — tarefa da Secretaria', 'secretaria'),
  ('22222222-2222-2222-2222-222222222222', 'PROVA — tarefa da Formação',  'formacao');

\echo ''
\echo '=== 1) COORDENAÇÃO (Tio Erick) — tem de ver AS DUAS ==='
set local role authenticated;
set local request.jwt.claims = '{"sub":"b6f27ee7-e19f-4444-a771-8fc6ef3c35cb","role":"authenticated"}';
select count(*) as ve, 2 as esperado from public.acolitos_tarefas;
reset role;

\echo ''
\echo '=== 2) Maria E. Carli (só Secretaria) — tem de ver SÓ a da Secretaria ==='
set local role authenticated;
set local request.jwt.claims = '{"sub":"987ed8ee-c742-447b-975d-427a1e1c686b","role":"authenticated"}';
select count(*) as ve, 1 as esperado, string_agg(time_slug, ',') as quais from public.acolitos_tarefas;
reset role;

\echo ''
\echo '=== 3) Tia Fran (Coordenação/Formação/Espiritualidade) — tem de ver SÓ a da Formação ==='
set local role authenticated;
set local request.jwt.claims = '{"sub":"83bc27e2-61eb-469d-9f9d-b14e9bee4fae","role":"authenticated"}';
select count(*) as ve, 1 as esperado, string_agg(time_slug, ',') as quais from public.acolitos_tarefas;
reset role;

\echo ''
\echo '=== 4) ESCRITA: Maria E. Carli tenta APAGAR a tarefa da Formação — tem de sair 0 ==='
set local role authenticated;
set local request.jwt.claims = '{"sub":"987ed8ee-c742-447b-975d-427a1e1c686b","role":"authenticated"}';
with x as (
  delete from public.acolitos_tarefas
  where id = '22222222-2222-2222-2222-222222222222' returning 1
) select count(*) as apagou, 0 as esperado from x;
reset role;

\echo ''
\echo '=== 5) ESCRITA: ela edita a PRÓPRIA e muda o time para Formação — tem de RECUSAR ==='
set local role authenticated;
set local request.jwt.claims = '{"sub":"987ed8ee-c742-447b-975d-427a1e1c686b","role":"authenticated"}';
-- Este é o buraco que ninguém procura: sem `with check`, a separação vazaria pela EDIÇÃO.
do $$
begin
  update public.acolitos_tarefas set time_slug = 'formacao'
   where id = '11111111-1111-1111-1111-111111111111';
  raise notice 'FALHOU A PROVA: conseguiu mover a tarefa para um time que não é dela';
exception when insufficient_privilege then
  raise notice 'OK: recusado (%).', sqlerrm;
end $$;
reset role;

\echo ''
\echo '=== 6) ESCRITA: ela CRIA tarefa para a Formação — tem de RECUSAR ==='
set local role authenticated;
set local request.jwt.claims = '{"sub":"987ed8ee-c742-447b-975d-427a1e1c686b","role":"authenticated"}';
do $$
begin
  insert into public.acolitos_tarefas (titulo, time_slug) values ('PROVA — intrusa', 'formacao');
  raise notice 'FALHOU A PROVA: criou tarefa em time que não é dela';
exception when insufficient_privilege then
  raise notice 'OK: recusado (%).', sqlerrm;
end $$;
reset role;

\echo ''
\echo '=== 7) ESCRITA: ela CRIA no PRÓPRIO time — tem de DEIXAR ==='
set local role authenticated;
set local request.jwt.claims = '{"sub":"987ed8ee-c742-447b-975d-427a1e1c686b","role":"authenticated"}';
do $$
begin
  insert into public.acolitos_tarefas (titulo, time_slug) values ('PROVA — legítima', 'secretaria');
  raise notice 'OK: criou no time dela.';
exception when insufficient_privilege then
  raise notice 'FALHOU A PROVA: recusou no PRÓPRIO time — a aba ficaria inútil';
end $$;
reset role;

\echo ''
\echo '=== 8) SEM LOGIN (anon) — não pode ler nada nem rodar a função ==='
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
-- Esperar "0 linhas" aqui seria medir a coisa errada: desde a 056 o anônimo não tem nem
-- permissão na tabela, então o banco RECUSA antes de chegar na política. Recusa é mais forte
-- que lista vazia — e uma prova que espera 0 daria vermelho num comportamento melhor.
do $$
declare n int;
begin
  select count(*) into n from public.acolitos_tarefas;
  raise notice 'FALHOU A PROVA: anon leu a tabela (% linhas)', n;
exception when insufficient_privilege then
  raise notice 'OK: anon nem alcança a tabela (%).', sqlerrm;
end $$;
do $$
begin
  perform public.acolitos_meus_times('b6f27ee7-e19f-4444-a771-8fc6ef3c35cb');
  raise notice 'FALHOU A PROVA: anon executou a função';
exception when insufficient_privilege then
  raise notice 'OK: anon não executa a função.';
end $$;
reset role;

\echo ''
\echo '=== desfazendo tudo (nada fica gravado) ==='
rollback;

\echo ''
\echo '=== confirmação: a tabela continua como estava (as tarefas de prova sumiram) ==='
select count(*) as tarefas_no_banco from public.acolitos_tarefas;
select polname from pg_policy where polrelid='public.acolitos_tarefas'::regclass order by polname;
