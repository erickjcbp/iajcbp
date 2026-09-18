-- Acólitos 081 — o cardápio inicial dos setores (o primeiro rascunho, cortado pelo dono)
--
-- POR QUE EXISTE: o motor de rotinas subiu em 18/09/2026 e o cardápio ficou VAZIO — zero
-- rotinas, 13 setores. E o campo onde o app guarda *o que cada time é* (a responsabilidade
-- fixa, que aparece no topo do grupo em Tarefas → Por time) estava vazio para os 13: conferido,
-- esse texto não existia escrito em lugar nenhum do projeto. O dono pediu o primeiro rascunho
-- e aprovou o que está aqui.
--
-- ⚠️ CORREÇÃO DE REGISTRO: a migration 076 diz que "quem ORIENTA são os mais graduados e quem
-- é ACOMPANHADO são os mais novos". Está ERRADO — foi uma leitura minha, e o dono corrigiu em
-- 18/09: o Orientador conversa com **todos do acólito sentinela para cima**, estejam parados ou
-- não. É o que a rotina semeada aqui faz (fonte `rodizio`, migration 080).
--
-- AS REGRAS QUE O DONO DEU, e que explicam os dias escolhidos:
--   · o que exige estar na igreja cai no FIM DE SEMANA; o que se resolve pelo celular fica
--     durante a semana;
--   · setor SEM NINGUÉM não ganha rotina — cobrança no vazio só ensina a ignorar tarefa. Por
--     isso Tesouraria, Almoxarifado, Eventos e Viagens e Integração ficam só com a
--     responsabilidade escrita, sem rotina.
--
-- IDEMPOTENTE: a responsabilidade entra por MERGE (o objeto é compartilhado por todos os
-- times: gravar por cima apagaria o dos outros), e cada rotina só nasce se ainda não existir
-- uma ativa com o mesmo time e o mesmo título.

-- ── 1. O que cada time É ─────────────────────────────────────────────────────
-- Uma chave só (`responsabilidades`) com um objeto `{slug: texto}` dentro. O `||` do jsonb
-- funde: o que já estivesse escrito continua lá.
insert into public.acolitos_config (chave, valor)
values ('responsabilidades', jsonb_build_object(
  'coordenacao',        'Responde pela pastoral: decide o rumo, fala com a paróquia e cuida para que os times funcionem.',
  'vice_coordenacao',   'Substitui a coordenação quando ela não está e toca o que ficou pendente.',
  'secretaria',         'Cuida do cadastro: fichas, contatos e a lista de quem está ativo, afastado ou desligado.',
  'tesouraria_compras', 'Cuida do dinheiro da pastoral: caixa, contribuições e as compras do que falta.',
  'almoxarifado',       'Cuida do que se usa no altar: túnicas, velas, incenso — o que tem, o que falta e o que precisa ser reposto.',
  'escala',             'Monta a escala das missas, cuida das trocas e mantém a arte do fim de semana.',
  'formacao',           'Cuida de a pastoral crescer: a trilha de cada um, os ensaios e quem está parado.',
  'espiritualidade',    'Cuida da oração da pastoral e da vida espiritual de quem serve.',
  'ordem_disciplina',   'Cuida da postura no altar e do respeito às combinações da pastoral.',
  'midia',              'Cuida do que a pastoral publica: a arte da escala, as fotos e os avisos no grupo.',
  'eventos_viagens',    'Organiza as saídas da pastoral: eventos, passeios e viagens.',
  's_integracao_a5xb',  'Recebe quem chega: acompanha o cadastro novo até a pessoa estar servindo.',
  'orientador',         'Conversa com os acólitos mais graduados, um por vez, para saber como andam as coisas — na pastoral e fora dela.'
))
on conflict (chave) do update
  set valor = coalesce(public.acolitos_config.valor, '{}'::jsonb) || excluded.valor;

-- ── 2. As rotinas ────────────────────────────────────────────────────────────
-- `proxima` cai no primeiro dia-da-semana pedido a partir de hoje (0=domingo … 6=sábado).
-- Se hoje já é o dia, começa hoje: rotina que só aparece semana que vem nasce esquecida.
insert into public.acolitos_rotinas
  (time_slug, titulo, observacao, recorrencia, proxima, fonte, lote, descanso_dias, alvo_niveis)
select v.time_slug, v.titulo, v.observacao, v.recorrencia,
       case
         when v.recorrencia = 'diaria' then current_date
         when v.recorrencia = 'mensal' then (date_trunc('month', current_date) + interval '1 month')::date
         else current_date + ((v.dia - extract(dow from current_date)::int + 7) % 7)
       end,
       v.fonte, v.lote, v.descanso, v.niveis
  from (values
    -- ORIENTADOR — a volta completa pelos mais graduados, uma conversa por dia
    ('orientador', 'Conversar com um acólito sentinela ou acima',
     null, 'diaria', 0, 'rodizio', 1, 30,
     array['acolito_sentinela','aspirante_cerimoniario','cerimoniario_aspirante',
           'cerimoniario_guardiao','cerimoniario_magistral','cerimoniario_mor']),

    -- ESCALA — terça monta, sexta gera a arte (a arte precisa da escala pronta)
    ('escala', 'Montar a escala do próximo fim de semana',
     'Abra a tela de Escala e monte as missas do sábado e do domingo.', 'semanal', 2, 'fixa', 1, 30, null),
    ('escala', 'Gerar a arte da escala',
     'Escala → Arte da semana → Gerar/Atualizar. ATENÇÃO: desde 18/09/2026 isso NÃO acontece mais sozinho — o robô que fazia saiu para dar lugar ao aviso diário da CRM.',
     'semanal', 5, 'fixa', 1, 30, null),

    -- FORMAÇÃO
    ('formacao', 'Olhar quem está travado na trilha',
     'Abra a Jornada: o cartão "Acompanhamento da Formação" mostra quem nunca entrou no app, quem entrou e não começou, e quem parou.',
     'semanal', 4, 'fixa', 1, 30, null),
    ('formacao', 'Preparar o próximo encontro de formação',
     null, 'mensal', 0, 'fixa', 1, 30, null),

    -- MÍDIA
    ('midia', 'Postar a escala e a arte no grupo',
     'Depois que a Escala gerar a arte da semana.', 'semanal', 5, 'fixa', 1, 30, null),

    -- SECRETARIA
    ('secretaria', 'Conferir cadastros novos e fichas incompletas',
     null, 'semanal', 3, 'fixa', 1, 30, null),
    ('secretaria', 'Atualizar quem saiu ou se afastou',
     null, 'mensal', 0, 'fixa', 1, 30, null),

    -- ORDEM E DISCIPLINA — segunda, logo depois do fim de semana
    ('ordem_disciplina', 'Olhar as faltas do fim de semana e falar com quem faltou sem avisar',
     null, 'semanal', 1, 'fixa', 1, 30, null),

    -- ESPIRITUALIDADE
    ('espiritualidade', 'Mandar a oração da semana no grupo',
     null, 'semanal', 1, 'fixa', 1, 30, null),

    -- COORDENAÇÃO e VICE
    ('coordenacao', 'Passar o quadro de tarefas dos times em revista',
     null, 'semanal', 1, 'fixa', 1, 30, null),
    ('vice_coordenacao', 'Conferir com a coordenação o que ficou do fim de semana',
     null, 'semanal', 1, 'fixa', 1, 30, null)
  ) as v(time_slug, titulo, observacao, recorrencia, dia, fonte, lote, descanso, niveis)
 where not exists (
   select 1 from public.acolitos_rotinas q
    where q.time_slug = v.time_slug and q.titulo = v.titulo and q.ativa);
