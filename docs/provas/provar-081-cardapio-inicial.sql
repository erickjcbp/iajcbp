-- Prova da 081: o cardápio inicial entrou inteiro, no dia certo, e sem cobrar setor vazio.
-- Rodar:  psql "$SUPABASE_DB_URL" -f docs/provas/provar-081-cardapio-inicial.sql
-- SÓ LEITURA.
\set ON_ERROR_STOP on
\timing off
\pset pager off

\echo '=== 1) os 13 setores têm o que cada um É (nenhum pode ficar sem) ==='
select count(*) as setores,
       count(*) filter (where texto is null or texto = '') as sem_texto_DEVE_SER_0
  from (select l.valor,
               (select valor -> l.valor ->> 0 from public.acolitos_config where chave='responsabilidades') as ignorar,
               (select c.valor ->> l.valor from public.acolitos_config c where c.chave='responsabilidades') as texto
          from public.acolitos_listas l where l.tipo='setor') t;

\echo ''
\echo '=== 2) o texto de cada setor (é isto que aparece no topo do grupo em Tarefas) ==='
select l.label,
       left((select c.valor ->> l.valor from public.acolitos_config c where c.chave='responsabilidades'), 58) as responsabilidade
  from public.acolitos_listas l where l.tipo='setor' order by l.label;

\echo ''
\echo '=== 3) as rotinas, com o dia em que cada uma vence ==='
select r.time_slug, r.titulo, r.recorrencia, r.fonte, r.lote, r.proxima,
       to_char(r.proxima, 'TMDay') as dia_da_semana
  from public.acolitos_rotinas r where r.ativa order by r.time_slug, r.titulo;

\echo ''
\echo '=== 4) setor SEM NINGUÉM não pode ter rotina ==='
select r.time_slug, count(*) as rotinas,
       (select count(*) from public.acolitos_membros m
         where r.time_slug = any(coalesce(m.setores,'{}'::text[]))) as pessoas_DEVE_SER_MAIOR_QUE_0
  from public.acolitos_rotinas r where r.ativa group by r.time_slug order by r.time_slug;

\echo ''
\echo '=== 5) a rotina do Orientador está do jeito que o dono pediu ==='
select titulo, recorrencia as DEVE_SER_diaria, fonte as DEVE_SER_rodizio,
       lote as DEVE_SER_1, descanso_dias, array_length(alvo_niveis, 1) as degraus_DEVE_SER_6
  from public.acolitos_rotinas where time_slug = 'orientador' and ativa;

\echo ''
\echo '=== 6) rodar a migration de novo não duplica (quantas rotinas repetidas há) ==='
select count(*) as titulos_repetidos_DEVE_SER_0
  from (select time_slug, titulo from public.acolitos_rotinas where ativa
         group by time_slug, titulo having count(*) > 1) t;
