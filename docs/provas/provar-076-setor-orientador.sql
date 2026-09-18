-- Prova da 076: o setor Orientador existe, tem uma pessoa, e não estragou os outros setores.
-- Rodar:  psql "$SUPABASE_DB_URL" -f docs/provas/provar-076-setor-orientador.sql
-- SÓ LEITURA.
\set ON_ERROR_STOP on
\timing off
\pset pager off

\echo '=== 1) o setor está na mesma lista que a tela de Config edita ==='
select tipo, valor, label from public.acolitos_listas
 where tipo = 'setor' and valor = 'orientador';

\echo ''
\echo '=== 2) quem está nele hoje (o dono pediu: só o coordenador) ==='
select m.nome, m.nivel, public.acolitos_get_role(m.user_id) as papel
  from public.acolitos_membros m
 where 'orientador' = any(coalesce(m.setores, '{}'::text[]))
 order by m.nome;

\echo ''
\echo '=== 3) nenhum setor foi perdido no caminho (eram 12, viram 13) ==='
select count(*) as setores_DEVE_SER_13 from public.acolitos_listas where tipo = 'setor';

\echo ''
\echo '=== 4) ninguém perdeu os setores que já tinha ==='
select count(*) as pessoas_em_algum_setor,
       count(*) filter (where array_length(setores, 1) > 1) as em_mais_de_um
  from public.acolitos_membros
 where coalesce(array_length(setores, 1), 0) > 0;

\echo ''
\echo '=== 5) quem PODERIA orientar pela regra do dono (sentinela pra cima, ativos) ==='
select nivel, count(*) from public.acolitos_membros
 where nivel in ('acolito_sentinela','aspirante_cerimoniario','cerimoniario_aspirante',
                 'cerimoniario_guardiao','cerimoniario_magistral','cerimoniario_mor')
   and coalesce(status,'') = 'ativo'
 group by 1 order by 2 desc;
