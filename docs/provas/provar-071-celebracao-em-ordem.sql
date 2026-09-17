-- Prova da 071 SEM gravar nada: a missa guarda a hora em minutos, e a ordem sai certa.
-- Rodar:  psql "$SUPABASE_DB_URL" -f docs/provas/provar-071-celebracao-em-ordem.sql
--
-- O QUE DEFENDE: o horário é texto sem zero ('7h','19h30'); ordenar por texto põe 9h depois
-- de 19h. Em 17/09/2026, 20 dos 39 dias com mais de uma missa saíam assim — todo domingo.
\set ON_ERROR_STOP on
\timing off

\echo '=== 0) a coluna existe e é calculada sozinha ==='
select column_name, data_type, is_generated, generation_expression
  from information_schema.columns
 where table_name = 'acolitos_celebracoes' and column_name = 'minutos';

\echo ''
\echo '=== 1) minutos bate com a função, em TODAS as linhas ==='
select count(*) as total,
       count(*) filter (where minutos is distinct from public.acolitos_minutos_do_horario(horario)) as diferentes_DEVE_SER_0,
       count(*) filter (where minutos is null) as sem_minutos_DEVE_SER_0
  from public.acolitos_celebracoes;

\echo ''
\echo '=== 2) cada horário do banco vira o minuto certo ==='
select horario, min(minutos) as minutos, count(*) as missas
  from public.acolitos_celebracoes group by horario order by min(minutos);

\echo ''
\echo '=== 3) a ordem por minutos conserta os dias que saíam errados ==='
with d as (
  select data,
         array_agg(horario order by minutos) as por_minutos,
         array_agg(horario order by horario) as por_texto,
         count(*) as n
    from public.acolitos_celebracoes group by data)
select count(*) filter (where n > 1) as dias_com_2_ou_mais,
       count(*) filter (where n > 1 and por_minutos <> por_texto) as dias_que_o_texto_errava
  from d;
-- e, para provar que a ordem por minutos é mesmo crescente, sem confiar no array acima:
select count(*) as pares_fora_de_ordem_DEVE_SER_0
  from (select data, minutos, lag(minutos) over (partition by data order by minutos) as anterior
          from public.acolitos_celebracoes) t
 where anterior is not null and minutos < anterior;

\echo ''
\echo '=== 4) o domingo mais próximo, do jeito certo ==='
with d as (select data, array_agg(horario order by minutos) as por_minutos, array_agg(horario order by horario) as por_texto
             from public.acolitos_celebracoes where data >= current_date group by data having count(*) > 1)
select data, por_texto::text as como_saia_antes, por_minutos::text as como_sai_agora
  from d order by data limit 3;

\echo ''
\echo '=== 5) a coluna é só de leitura: ninguém escreve nela ==='
do $$
begin
  update public.acolitos_celebracoes set minutos = 1 where false;
  raise notice 'ESCRITA: PASSOU — ERRADO (coluna deveria recusar)';
exception when others then
  raise notice 'ESCRITA: recusada — CERTO (%)', left(SQLERRM, 60);
end $$;
