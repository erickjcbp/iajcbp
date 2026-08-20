-- PROVA 058 — a casa da pessoa chega nas funções que alimentam os avatares
--
-- Roda a qualquer momento: ele MEDE o que está valendo, não aplica nada e não
-- escreve nada. Serve para as duas pontas — rodado ANTES da 058 mostra o buraco
-- (nenhuma função devolve o campo), rodado DEPOIS mostra o campo em todas.
--
-- COMO LER: três colunas.
--   itens            = quantas pessoas a função devolveu. Se este número CAIR entre
--                      o antes e o depois, algo quebrou — é o defeito perigoso deste
--                      projeto (tela vazia sem erro nenhum). Tem de ser igual.
--   tem_o_campo      = de quantas dessas pessoas a função mandou o campo `casa_id`.
--                      Depois da 058 tem de ser igual a `itens`.
--   casa_preenchida  = de quantas o campo veio com uma casa de verdade dentro.
--                      Este número é PEQUENO de propósito: em 20/08/2026 só 1 das
--                      176 pessoas ativas está em alguma casa. Isso é distribuição
--                      de gente, feita pela coordenação em Casas — não é defeito do
--                      código e não se conserta por aqui.
--
-- Finge ser o Erick (coord_admin) porque a `acolitos_roster_substituicao` recusa
-- quem não é da coordenação: rodada como superusuário ela devolve lista vazia e a
-- prova pareceria falhar sem nada de errado.

\set ON_ERROR_STOP on
\pset pager off

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"b6f27ee7-e19f-4444-a771-8fc6ef3c35cb","role":"authenticated"}';

with esperado(funcao) as (values
  ('acolitos_membros_display  (Agenda)'),
  ('acolitos_roster_substituicao (Chamada)'),
  ('acolitos_destaques (Destaques)'),
  ('acolitos_ranking_temporada (Temporada)'),
  ('acolitos_campeoes (Campeões)'),
  ('acolitos_solicitos (Solícitos)'),
  ('acolitos_membro_card (o cartão)')
),
amostra as (
  select array_agg(id) as ids from (
    select id from acolitos_membros where status='ativo' order by nome limit 30
  ) t
),
tudo as (
  -- Agenda: os rostinhos de quem confirmou presença no evento
  select 'acolitos_membros_display  (Agenda)' as funcao, v
    from amostra, jsonb_each(acolitos_membros_display(amostra.ids)) as e(k, v)

  -- Chamada e Caixa: a lista de quem pode substituir
  union all
  select 'acolitos_roster_substituicao (Chamada)',
         jsonb_array_elements(acolitos_roster_substituicao() -> 'membros')

  -- Destaques, aba 1: as três listas (serviu mais / mais funções / mais disponível)
  union all
  select 'acolitos_destaques (Destaques)',
         jsonb_array_elements((acolitos_destaques()::jsonb -> 'servos')
                              || (acolitos_destaques()::jsonb -> 'versateis')
                              || (acolitos_destaques()::jsonb -> 'prontos'))

  -- Destaques, aba Temporada + a Jornada do admin
  union all
  select 'acolitos_ranking_temporada (Temporada)',
         jsonb_array_elements(jsonb_path_query_array(acolitos_ranking_temporada(), '$.ligas[*].membros[*]'))

  -- Destaques, aba Campeões
  union all
  select 'acolitos_campeoes (Campeões)',
         jsonb_array_elements(acolitos_campeoes())

  -- Destaques, aba Solícitos
  union all
  select 'acolitos_solicitos (Solícitos)',
         jsonb_array_elements(acolitos_solicitos())

  -- O cartão que abre ao tocar num nome, em qualquer uma das abas
  union all
  select 'acolitos_membro_card (o cartão)',
         acolitos_membro_card(id)::jsonb
    from (select id from acolitos_membros where status='ativo' order by nome limit 30) t
)
select e.funcao,
       count(t.v)                                            as itens,
       count(*) filter (where t.v ? 'casa_id')               as tem_o_campo,
       count(*) filter (where t.v->>'casa_id' is not null)   as casa_preenchida,
       case when count(t.v) = 0                             then 'VAZIA (nada a medir hoje)'
            when count(*) filter (where t.v ? 'casa_id') = count(t.v) then 'ok — manda a casa'
            when count(*) filter (where t.v ? 'casa_id') = 0          then 'NAO manda a casa'
            else 'PELA METADE — olhar' end                   as veredito
from esperado e left join tudo t on t.funcao = e.funcao
group by e.funcao
order by e.funcao;


-- ── SEGUNDA PARTE: o VALOR chega, não só o campo ────────────────────────────
-- A primeira parte prova que as funções mandam o campo `casa_id`. Não prova que
-- ele chega PREENCHIDO — a amostra pega as 30 primeiras por nome, e a única
-- pessoa com casa pode não estar entre elas (foi o que aconteceu em 20/08). Aqui
-- eu vou buscar de propósito quem TEM casa e conferir que a casa certa chega, com
-- o nome dela por extenso. Se um dia ninguém tiver casa, esta parte não devolve
-- linha nenhuma — e a primeira parte continua valendo.

with alguem as (
  select m.id, m.nome, m.casa_id, c.slug
  from acolitos_membros m join acolitos_casas c on c.id = m.casa_id
  where m.status='ativo' order by m.nome limit 3
)
select a.nome,
       a.slug                                                        as casa_no_banco,
       (acolitos_membros_display(array[a.id]) -> a.id::text ->> 'casa_id') = a.casa_id::text as agenda_ok,
       (acolitos_membro_card(a.id)::jsonb ->> 'casa_id')             = a.casa_id::text       as cartao_ok,
       exists (select 1 from jsonb_array_elements(acolitos_roster_substituicao() -> 'membros') r
               where r->>'id' = a.id::text and r->>'casa_id' = a.casa_id::text)              as chamada_ok
from alguem a;

rollback;
