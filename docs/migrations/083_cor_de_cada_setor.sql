-- Acólitos 083 — cada setor ganha uma COR
--
-- PEDIDO DO DONO (18/09/2026): "quero badges coloridos para diferenciar os setores", e a visão
-- por time vira ÁREAS, com um card por setor — igual às Áreas do erickIA, onde cada área tem
-- a sua cor escolhida (não deduzida do nome).
--
-- POR QUE NO BANCO, E NÃO NO CÓDIGO: os setores são editáveis pela tela de Config (a
-- Integração nasceu por lá, com slug gerado `s_integracao_a5xb`). Cor cravada no código
-- deixaria todo setor novo sem cor, e obrigaria uma migration a cada setor criado. Aqui ela
-- mora no `meta` da própria lista, que é o campo que a tela de Config já grava.
--
-- A PALETA foi escolhida para o tema da casa (vinho e dourado, fundo escuro): tons claros o
-- bastante para ler em cima do escuro, e distantes entre si para não confundir dois setores
-- vizinhos numa etiqueta pequena.
--
-- IDEMPOTENTE: só escreve a cor de quem ainda não tem uma.

update public.acolitos_listas l
   set meta = coalesce(l.meta, '{}'::jsonb) || jsonb_build_object('cor', v.cor)
  from (values
    ('coordenacao',        '#e8b94a'),   -- dourado: a cor da casa, para quem responde pela casa
    ('vice_coordenacao',   '#d9a441'),
    ('secretaria',         '#5bd3c7'),
    ('tesouraria_compras', '#5bd67a'),
    ('almoxarifado',       '#c9a227'),
    ('escala',             '#6fa8ff'),
    ('formacao',           '#b98cff'),
    ('espiritualidade',    '#ff9ec7'),
    ('ordem_disciplina',   '#ff6b6b'),
    ('midia',              '#ff8a5b'),
    ('eventos_viagens',    '#ffd166'),
    ('s_integracao_a5xb',  '#7ee081'),
    ('orientador',         '#9bd1ff')
  ) as v(valor, cor)
 where l.tipo = 'setor'
   and l.valor = v.valor
   and coalesce(l.meta->>'cor', '') = '';

comment on column public.acolitos_listas.meta is
  'Extras da lista. Para tipo=setor: {"cor":"#rrggbb"} — a cor do setor nas etiquetas e no card da Área (migration 083).';
