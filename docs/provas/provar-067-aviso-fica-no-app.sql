-- Prova da 067 SEM avisar ninguém de verdade: manda o aviso dentro de uma transação e desfaz.
-- Rodar:  psql "$SUPABASE_DB_URL" -f docs/provas/provar-067-aviso-fica-no-app.sql
-- Regra do projeto: trava se prova RODANDO, não lendo o SQL.
--
-- O QUE ESTA PROVA DEFENDE: o "Enviar aviso" da Caixa mandava SÓ push. O push é uma tarja
-- no celular que some — o app não guardava nada, então o sininho ficava vazio e o pop-up
-- nunca abria. Quem não tinha notificação ligada não ficava sabendo de nada.
-- Esta prova fica VERMELHA se alguém voltar a desligar a gravação do aviso.
\set ON_ERROR_STOP on
\timing off

\echo '=== 0) a função existe, e quem pode executar? ==='
select has_function_privilege('anon',          'public.acolitos_avisar_todos(text,uuid[])', 'execute') as anon_executa_DEVE_SER_f,
       has_function_privilege('authenticated', 'public.acolitos_avisar_todos(text,uuid[])', 'execute') as logado_executa_DEVE_SER_t;

begin;

\echo ''
\echo '=== 1) COORDENAÇÃO manda o aviso — tem de gravar em TODO ativo com login ==='
set local role authenticated;
set local request.jwt.claims = '{"sub":"b6f27ee7-e19f-4444-a771-8fc6ef3c35cb","role":"authenticated"}';
select public.acolitos_avisar_todos('PROVA 067 — aviso de mentira', null) as resposta;
reset role;

select count(*) filter (where status='ativo' and user_id is not null) as alvos_no_banco
  from public.acolitos_membros;

select count(*) as receberam_DEVE_IGUALAR_alvos
  from public.acolitos_membros m
 where exists (select 1 from jsonb_array_elements(m.avisos) a
                where a->>'msg' = 'PROVA 067 — aviso de mentira');

\echo ''
\echo '=== 2) o aviso nasce NÃO VISTO (é isso que faz o pop-up abrir e a bolinha acender) ==='
select count(*) as nao_vistos_DEVE_IGUALAR_alvos
  from public.acolitos_membros m
 where exists (select 1 from jsonb_array_elements(m.avisos) a
                where a->>'msg' = 'PROVA 067 — aviso de mentira'
                  and (a->>'seen')::boolean is false);

\echo ''
\echo '=== 3) a forma tem de ser a que a tela sabe desenhar (campo msg, sem logout) ==='
-- avisoEl() do shared.js escreve aviso.msg; showAvisoUnico() cai no ramo "Aviso da Coordenação".
-- Se o campo mudar de nome, a notificação aparece EM BRANCO — e nada quebra, o que é pior.
select a->>'tipo' as tipo, (a->>'seen')::boolean as visto, (a->>'logout')::boolean as pede_logout,
       (a->>'ts') is not null as tem_data, length(a->>'msg') > 0 as tem_texto
  from public.acolitos_membros m, jsonb_array_elements(m.avisos) a
 where a->>'msg' = 'PROVA 067 — aviso de mentira'
 limit 1;

rollback;

\echo ''
\echo '=== 4) QUEM NÃO É COORDENAÇÃO tem de ser recusado, e não gravar nada ==='
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"987ed8ee-c742-447b-975d-427a1e1c686b","role":"authenticated"}';
select public.acolitos_avisar_todos('PROVA 067 — NÃO PODE PASSAR', null) as resposta_DEVE_SER_sem_permissao;
reset role;
select count(*) as gravou_DEVE_SER_0
  from public.acolitos_membros m
 where exists (select 1 from jsonb_array_elements(m.avisos) a
                where a->>'msg' = 'PROVA 067 — NÃO PODE PASSAR');
rollback;

\echo ''
\echo '=== 5) texto vazio tem de ser recusado (senão vira aviso em branco pra todo mundo) ==='
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"b6f27ee7-e19f-4444-a771-8fc6ef3c35cb","role":"authenticated"}';
select public.acolitos_avisar_todos('   ', null) as resposta_DEVE_SER_sem_texto;
reset role;
rollback;

\echo ''
\echo '=== 6) escolher PESSOAS avisa só elas ==='
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"b6f27ee7-e19f-4444-a771-8fc6ef3c35cb","role":"authenticated"}';
select public.acolitos_avisar_todos('PROVA 067 — só para uma pessoa',
         array(select id from public.acolitos_membros
                where status='ativo' and user_id is not null order by id limit 1)) as resposta;
reset role;
select count(*) as receberam_DEVE_SER_1
  from public.acolitos_membros m
 where exists (select 1 from jsonb_array_elements(m.avisos) a
                where a->>'msg' = 'PROVA 067 — só para uma pessoa');
rollback;

\echo ''
\echo '=== 7) confirmação final: NENHUM aviso de prova ficou gravado ==='
select count(*) as sobrou_DEVE_SER_0
  from public.acolitos_membros m
 where exists (select 1 from jsonb_array_elements(m.avisos) a
                where a->>'msg' like 'PROVA 067%');
