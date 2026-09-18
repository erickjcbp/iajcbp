-- Prova da 073 SEM gravar nada: a trilha tem entrada, e o ensaio deixa de trancar a porta.
-- Rodar:  psql "$SUPABASE_DB_URL" -f docs/provas/provar-073-trilha-da-entrada.sql
--
-- O QUE DEFENDE (medido em 18/09/2026):
--   · 24 pessoas no degrau "Aspirante" tinham ZERO missões — o degrau onde todo mundo chega;
--   · o "Coroinha" (45 pessoas, o maior grupo) tinha só 10, em 2 capítulos;
--   · 45 missões dependiam de ensaio e TODAS travavam o capítulo. Houve 4 ensaios desde
--     junho, o último em 22/08: quem não foi parou, mesmo servindo toda semana.
\set ON_ERROR_STOP on
\timing off
\pset pager off

\echo '=== 1) nenhuma missão de ENSAIO trava mais o capítulo (deve ser 0) ==='
select count(*) filter (where obrigatoria) as de_ensaio_que_travam_DEVE_SER_0,
       count(*) as de_ensaio_no_total
  from public.acolitos_missoes
 where nivel_alvo is not null
   and (criterio->>'fonte' in ('ensaio','ensaios_ajudados','ensaios_total') or titulo ilike '%ensaio%');

\echo ''
\echo '=== 2) cada capítulo continua exigindo coisa de verdade (nenhum pode ficar em 0) ==='
select min(obrigatorias) as menor_capitulo, max(obrigatorias) as maior_capitulo,
       count(*) filter (where obrigatorias = 0) as capitulos_VAZIOS_DEVE_SER_0
  from (select nivel_alvo, capitulo, count(*) filter (where obrigatoria) as obrigatorias
          from public.acolitos_missoes where nivel_alvo is not null
         group by 1,2) t;

\echo ''
\echo '=== 3) o degrau da ENTRADA existe: Aspirante com 2 capítulos ==='
select capitulo, count(*) as missoes, count(*) filter (where obrigatoria) as obrigatorias
  from public.acolitos_missoes where nivel_alvo = 'aspirante'
 group by capitulo order by capitulo;

\echo ''
\echo '=== 4) o Coroinha ganhou o terceiro capítulo ==='
select capitulo, count(*) as missoes, count(*) filter (where obrigatoria) as obrigatorias
  from public.acolitos_missoes where nivel_alvo = 'coroinha'
 group by capitulo order by capitulo;

\echo ''
\echo '=== 5) cada degrau com gente tem trilha (nenhum pode ficar com 0 missões) ==='
select m.nivel, count(distinct m.id) as pessoas,
       (select count(*) from public.acolitos_missoes q where q.nivel_alvo = m.nivel) as missoes_DEVE_SER_MAIOR_QUE_0
  from public.acolitos_membros m
 where coalesce(m.nivel,'') <> ''
 group by m.nivel order by count(distinct m.id) desc;

\echo ''
\echo '=== 6) ninguém perdeu nada: missões antigas e progresso intactos ==='
select (select count(*) from public.acolitos_missoes) as missoes_hoje,
       (select count(*) from public.acolitos_missoes where nivel_alvo is null) as avulsas_DEVE_SER_143,
       (select count(*) from public.acolitos_missao_progresso) as progresso_DEVE_SER_212,
       (select count(*) from public.acolitos_missoes where not ativo) as desligadas;

\echo ''
\echo '=== 7) as missões novas respeitam as travas da tabela e têm critério legível ==='
select titulo, tipo, validacao, xp, obrigatoria, coalesce(criterio::text,'(marcada pela pessoa)') as criterio
  from public.acolitos_missoes
 where nivel_alvo = 'aspirante' or (nivel_alvo = 'coroinha' and capitulo = 3)
 order by nivel_alvo desc, capitulo, ordem;
