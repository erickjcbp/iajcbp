-- PROVA 059 — a aba Atividade só abre para superadmin, e o número dela é verdade
--
-- Roda a qualquer momento: MEDE o que está valendo, não aplica nada e não escreve
-- nada. Rodado ANTES da 059 falha porque a função não existe — é o esperado.
--
-- O que ele prova, e por que cada um está aqui:
--
--  1. O ANÔNIMO nem executa. Este projeto já teve 64 funções `security definer`
--     abertas para quem não está logado; a checagem é obrigatória, não enfeite.
--  2. PESSOA COMUM executa e não recebe dado. Poder EXECUTAR não é passar pelo
--     `if` de dentro — são portões diferentes, e só o segundo protege o dado.
--  3. SUPERADMIN recebe, e os números batem com a contagem direta do banco.
--     Função que devolve lista vazia sem erro é o defeito que mais machucou aqui.
--  4. O "último uso" NÃO é o `last_sign_in_at`. Esta é a razão de existir da
--     migration: existe gente com senha digitada em junho usando o app hoje. Se um
--     dia alguém "simplificar" a função trocando a fonte, esta linha fica vermelha.

\set ON_ERROR_STOP on
\pset pager off

-- Uma pessoa comum de verdade (cerimoniário, não superadmin) e o dono.
\set COMUM '1a729946-852f-4c01-b513-c52af7496e98'
\set DONO  'b6f27ee7-e19f-4444-a771-8fc6ef3c35cb'

begin;

-- ── 1. o anônimo nem executa ────────────────────────────────────────────────
select 'o anonimo NAO executa' as prova,
       case when has_function_privilege('anon','public.acolitos_atividade_listar()','execute')
            then 'FALHOU — anon pode executar' else 'ok' end as veredito;

-- ── 2. pessoa comum executa e não recebe dado ───────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"1a729946-852f-4c01-b513-c52af7496e98","role":"authenticated"}';
select 'pessoa comum e barrada pelo if de dentro' as prova,
       case when acolitos_atividade_listar() = jsonb_build_object('erro','sem_permissao')
            then 'ok' else 'FALHOU — veio dado para quem nao e superadmin' end as veredito;
reset role;

-- ── 3. o superadmin recebe, e os números batem ──────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"b6f27ee7-e19f-4444-a771-8fc6ef3c35cb","role":"authenticated"}';
create temp table _r on commit drop as select acolitos_atividade_listar() as j;
reset role;

select 'as contas listadas batem com o banco' as prova,
       (select jsonb_array_length(j->'contas') from _r) as a_funcao_diz,
       (select count(*) from acolitos_membros where status='ativo' and user_id is not null) as o_banco_tem,
       case when (select jsonb_array_length(j->'contas') from _r)
               = (select count(*) from acolitos_membros where status='ativo' and user_id is not null)
            then 'ok' else 'FALHOU' end as veredito
union all
select 'quem nao tem conta bate com o banco',
       (select jsonb_array_length(j->'sem_conta') from _r),
       (select count(*) from acolitos_membros where status='ativo' and user_id is null),
       case when (select jsonb_array_length(j->'sem_conta') from _r)
               = (select count(*) from acolitos_membros where status='ativo' and user_id is null)
            then 'ok' else 'FALHOU' end
union all
select 'o total de ativos bate',
       (select (j->>'ativos')::bigint from _r),
       (select count(*) from acolitos_membros where status='ativo'),
       case when (select (j->>'ativos')::bigint from _r) = (select count(*) from acolitos_membros where status='ativo')
            then 'ok' else 'FALHOU' end
union all
select 'quem tem o sino bate com as inscricoes',
       (select count(*) from _r, jsonb_array_elements(j->'contas') c where (c->>'sino')::boolean),
       (select count(distinct p.user_id) from acolitos_push_subs p join acolitos_membros m on m.user_id=p.user_id where m.status='ativo'),
       case when (select count(*) from _r, jsonb_array_elements(j->'contas') c where (c->>'sino')::boolean)
               = (select count(distinct p.user_id) from acolitos_push_subs p join acolitos_membros m on m.user_id=p.user_id where m.status='ativo')
            then 'ok' else 'FALHOU' end;

-- ── 4. o "último uso" não é o last_sign_in_at ───────────────────────────────
-- Existe gente cujo último uso é MUITO depois da última vez que digitou a senha.
-- Se a função passasse a devolver o last_sign_in_at, este número cairia para zero.
select 'usou o app DEPOIS de digitar a senha (a razao da migration existir)' as prova,
       count(*) as pessoas,
       case when count(*) > 0 then 'ok — a fonte certa esta em uso'
            else 'OLHAR — ou nao ha esse caso hoje, ou a funcao trocou de fonte' end as veredito
from _r, jsonb_array_elements(j->'contas') c
where (c->>'ultimo_uso') is not null and (c->>'entrou_em') is not null
  and (c->>'ultimo_uso')::timestamptz > (c->>'entrou_em')::timestamptz + interval '1 day';

-- ── e o retrato de hoje, para quem estiver lendo ────────────────────────────
select case when (c->>'ultimo_uso') is not null then 'usou (sessao viva)'
            when (c->>'entrou_em')  is not null then 'sessao expirou'
            else 'nunca entrou' end as estado,
       count(*) as pessoas,
       count(*) filter (where (c->>'sino')::boolean) as com_sino
from _r, jsonb_array_elements(j->'contas') c
group by 1 order by 2 desc;

rollback;
