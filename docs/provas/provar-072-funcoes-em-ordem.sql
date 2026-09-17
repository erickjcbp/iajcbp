-- Prova da 072 SEM gravar nada: 5 funções do banco ainda ordenam a hora da missa como TEXTO
-- (a coluna `minutos` já existe desde a 071 — este arquivo mostra que 4 funções e 1 view
-- ainda não a usam). Rodar:
--   psql "$SUPABASE_DB_URL" -f docs/provas/provar-072-funcoes-em-ordem.sql
--
-- O QUE DEFENDE: medido em produção nos domingos 20/09, 27/09, 04/10 e 11/10 de 2026 — dias
-- com missa às 7h, 9h e 19h — estas funções devolvem "19h, 7h, 9h" (ordem de TEXTO: '1' < '7' < '9'
-- na frente do '9h' e do '19h' comparados caractere a caractere) em vez de "7h, 9h, 19h" (ordem
-- de HORA de verdade). É o mesmo domingo, na MESMA tela, em duas ordens diferentes conforme o
-- pedaço da tela vier do JavaScript (já corrigido, usa `minutos`) ou de uma destas funções.
--
-- COMO LER: cada seção pega o dia (ou o registro) mais próximo onde a diferença aparece, e
-- mostra lado a lado "ordem certa (por minuto)" e "ordem que a função devolve hoje". A coluna
-- `ordena_por_texto_ainda` tem de ser `t` (true) ANTES da 072 nas seções 1, 2, 3 e 5 — é o
-- vermelho. DEPOIS da 072, as quatro têm de virar `f` — é o verde.
--
-- A seção 4 (acolitos_membro_card) é diferente: nenhum acólito, hoje, tem duas presenças
-- ('presente'/'atrasado') no MESMO dia de mais de uma missa — cada um serve uma vez por dia.
-- Por isso não há um exemplo de dado real que mostre a troca de ordem acontecendo NESTA função
-- especificamente (ela some no "empate de dia", que não ocorre na prática agora). A seção 4
-- registra essa checagem e explica por que ela não pode ser feita "no vermelho" com dado real —
-- o defeito no código é o mesmo (order by com o texto do horário), e a migration corrige as
-- 5 funções por igual, mas a PROVA com dado real de produção só é possível para 4 delas.
--
-- Ninguém aqui é membro da equipe de coordenação nem de suporte técnico: os comentários e as
-- mensagens deste arquivo são para quem só usa o site, não para quem programa.
--
-- Ninguém grava nada: é tudo `select`, dentro de uma transação que termina em `rollback`. A
-- única "escrita" é a troca de papel (`set local role`) para simular um login, e ela também
-- desaparece no rollback.

\set ON_ERROR_STOP on
\pset pager off

begin;
set local role authenticated;
-- Simula o login de uma pessoa que tem vaga aberta num domingo de 3 missas (achado por
-- `select`, sem inventar id) — serve só para a seção 3 (`acolitos_vagas_abertas_membro`),
-- que olha "minhas vagas". As outras 4 seções não dependem de quem está logado.
set local request.jwt.claims = '{"sub":"1506c85e-183f-40e6-a7fa-6eb259c5738d","role":"authenticated"}';

\echo ''
\echo '=== 1) acolitos_escalas_futuras() — próximo dia em que a ordem de texto e a de hora DIVERGEM ==='
with alvo as (
  select data from public.acolitos_celebracoes
   where data >= current_date
   group by data
  having count(*) > 1
     and array_agg(horario order by minutos) <> array_agg(horario order by horario)
   order by data limit 1
), certo as (
  select a.data, array_agg(c.horario order by c.minutos) as ordem_certa
    from alvo a join public.acolitos_celebracoes c on c.data = a.data
   group by a.data
), da_funcao as (
  select ce.data,
         (select array_agg(x->>'horario')
            from json_array_elements(acolitos_escalas_futuras()) x
           where (x->>'data')::date = ce.data) as ordem_hoje
    from certo ce
)
select ce.data,
       ce.ordem_certa as "ordem certa (por minuto)",
       f.ordem_hoje    as "ordem que a função devolve hoje",
       ce.ordem_certa <> f.ordem_hoje as ordena_por_texto_ainda
  from certo ce join da_funcao f on f.data = ce.data;

\echo ''
\echo '=== 2) acolitos_escalas_passadas() — dia mais recente no passado (com escala) em que a ordem DIVERGE ==='
with alvo as (
  select cel.data from public.acolitos_celebracoes cel
   where cel.data < current_date
     and exists (select 1 from public.acolitos_escalas e where e.celebracao_id = cel.id)
   group by cel.data
  having count(*) > 1
     and array_agg(cel.horario order by cel.minutos) <> array_agg(cel.horario order by cel.horario)
   order by cel.data desc limit 1
), certo as (
  select a.data, array_agg(c.horario order by c.minutos desc) as ordem_certa
    from alvo a join public.acolitos_celebracoes c on c.data = a.data
   group by a.data
), da_funcao as (
  select ce.data,
         (select array_agg(x->>'horario')
            from json_array_elements(acolitos_escalas_passadas()) x
           where (x->>'data')::date = ce.data) as ordem_hoje
    from certo ce
)
select ce.data,
       ce.ordem_certa as "ordem certa (por minuto, desc)",
       f.ordem_hoje    as "ordem que a função devolve hoje",
       ce.ordem_certa <> f.ordem_hoje as ordena_por_texto_ainda
  from certo ce join da_funcao f on f.data = ce.data;

\echo ''
\echo '=== 3) acolitos_vagas_abertas_membro() — vagas de quem está "logado" nesta prova, no 1º dia em que diverge ==='
-- Uma pessoa pode ter mais de uma vaga aberta NA MESMA missa (uma por função: cruz, vela...),
-- então o array bruto da função repete o horário. Aqui reduzimos a UM horário por missa,
-- guardando só a primeira posição em que ele aparece, para comparar ordem com ordem.
with dias_ruins as (
  select data from public.acolitos_celebracoes
   group by data
  having array_agg(horario order by minutos) <> array_agg(horario order by horario)
), bruto as (
  select ordinality, (v->>'data')::date as data, v->>'horario' as horario
    from jsonb_array_elements(acolitos_vagas_abertas_membro()->'vagas') with ordinality as t(v, ordinality)
), distintos as (
  select data, horario, min(ordinality) as primeira_posicao
    from bruto group by data, horario
), alvo as (
  select d.data from distintos d
   join dias_ruins r on r.data = d.data
   group by d.data having count(*) > 1
   order by d.data limit 1
), da_funcao as (
  select d.data, array_agg(d.horario order by d.primeira_posicao) as ordem_hoje
    from distintos d join alvo a on a.data = d.data
   group by d.data
), certo as (
  select t.data, array_agg(t.horario order by t.minutos) as ordem_certa
    from (select distinct c.data, c.horario, c.minutos from public.acolitos_celebracoes c) t
    join alvo a on a.data = t.data
   group by t.data
)
select coalesce(f.data, c.data) as data,
       c.ordem_certa as "ordem certa (por minuto)",
       f.ordem_hoje  as "ordem que a função devolve hoje",
       c.ordem_certa <> f.ordem_hoje as ordena_por_texto_ainda
  from certo c join da_funcao f on f.data = c.data;

\echo ''
\echo '=== 4) acolitos_membro_card() — procurando um membro com 2+ presenças no MESMO dia de mais de uma missa ==='
with dias_ruins as (
  select data from public.acolitos_celebracoes
   group by data
  having array_agg(horario order by minutos) <> array_agg(horario order by horario)
), candidato as (
  select e.membro_id, cel.data, count(*) as presencas_no_dia
    from public.acolitos_escalas e
    join public.acolitos_celebracoes cel on cel.id = e.celebracao_id
    join dias_ruins d on d.data = cel.data
   where e.status in ('presente','atrasado')
   group by e.membro_id, cel.data
  having count(*) > 1
   limit 1
)
select case when exists (select 1 from candidato)
            then 'existe candidato de dado real — ver seção com o cartão dele'
            else 'SEM EXEMPLO REAL hoje: nenhum acólito tem 2+ presenças no mesmo dia de mais de uma missa (cada um serve uma vez por dia). O código ainda ordena por `cel.horario` (texto) — visível lendo a função com pg_get_functiondef — mas não há um caso de produção que mostre a troca de ordem NESTA função. Ver nota no início do arquivo e no relatório da tarefa.'
       end as observacao_da_secao_4;

-- Se algum dia existir um candidato, esta consulta mostra o cartão dele e a ordem das "últimas":
with dias_ruins as (
  select data from public.acolitos_celebracoes
   group by data
  having array_agg(horario order by minutos) <> array_agg(horario order by horario)
), candidato as (
  select e.membro_id, cel.data
    from public.acolitos_escalas e
    join public.acolitos_celebracoes cel on cel.id = e.celebracao_id
    join dias_ruins d on d.data = cel.data
   where e.status in ('presente','atrasado')
   group by e.membro_id, cel.data
  having count(*) > 1
   limit 1
)
select m.nome,
       (select array_agg(u->>'horario') from json_array_elements(acolitos_membro_card(c.membro_id)::json -> 'ultimas') u
         where (u->>'data')::date = c.data) as "ordem que o cartão devolve hoje, no dia com 2+ presenças"
  from candidato c join public.acolitos_membros m on m.id = c.membro_id;

\echo ''
\echo '=== 5) acolitos_ausencia_publica_celebracoes() — página PÚBLICA — próximo dia em que a ordem DIVERGE ==='
with alvo as (
  select data from public.acolitos_celebracoes
   where data >= current_date and data <= (current_date + interval '3 months')::date
   group by data
  having count(*) > 1
     and array_agg(horario order by minutos) <> array_agg(horario order by horario)
   order by data limit 1
), certo as (
  select a.data, array_agg(c.horario order by c.minutos) as ordem_certa
    from alvo a join public.acolitos_celebracoes c on c.data = a.data
   group by a.data
), da_funcao as (
  select ce.data,
         (select array_agg(x->>'horario')
            from jsonb_array_elements(acolitos_ausencia_publica_celebracoes()) x
           where (x->>'data')::date = ce.data) as ordem_hoje
    from certo ce
)
select ce.data,
       ce.ordem_certa as "ordem certa (por minuto)",
       f.ordem_hoje    as "ordem que a função devolve hoje",
       ce.ordem_certa <> f.ordem_hoje as ordena_por_texto_ainda
  from certo ce join da_funcao f on f.data = ce.data;

rollback;
