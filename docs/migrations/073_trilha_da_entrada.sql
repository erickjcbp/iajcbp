-- Acólitos 073 — a trilha ganha entrada, e o ensaio deixa de trancar a porta
--
-- O QUE ESTAVA ERRADO (medido em 18/09/2026, em produção):
--   · o degrau "Aspirante", onde toda pessoa chega, tinha ZERO missões — e 24 pessoas
--     estavam nele. Quem entrava não tinha para onde ir;
--   · o "Coroinha", o maior grupo (45 pessoas), tinha 10 missões em 2 capítulos, enquanto
--     os degraus do topo têm de 22 a 34. A trilha estava de cabeça para baixo;
--   · 45 missões dependem de ensaio e TODAS travavam o capítulo. Houve 4 ensaios desde
--     junho, o último em 22/08 — quem não pôde ir parou, mesmo servindo toda semana.
--
-- O QUE ESTA MIGRATION FAZ:
--   1. as missões de ensaio deixam de TRAVAR o capítulo. Elas continuam existindo, valendo
--      XP e aparecendo na tela: quem vai ao ensaio sobe mais rápido, quem não pode ir sobe
--      do mesmo jeito. Nenhum capítulo fica vazio — sobram de 6 a 9 obrigatórias em cada;
--   2. nasce o capítulo 1 e 2 do Aspirante (10 missões);
--   3. o Coroinha ganha o capítulo 3 (5 missões).
--
-- O QUE ELA NÃO FAZ: não apaga missão nenhuma, não mexe no progresso de ninguém, não muda
-- o nível de ninguém. As 19 pessoas sem nível continuam sem trilha até a coordenação dizer
-- em que degrau cada uma está — isso é decisão de gente, não de migration.
--
-- IDEMPOTENTE: o update é uma afirmação sobre o estado final, e cada missão nova só entra
-- se ainda não existir uma com o mesmo degrau, capítulo e título.

-- ── 1. O ensaio para de trancar ──────────────────────────────────────────────
-- Pega as três fontes automáticas de ensaio E o título, porque há missões de ensaio
-- escritas à mão, sem critério ("Ajudar em mais 1 ensaio de acólitos/coroinhas").
update public.acolitos_missoes
   set obrigatoria = false
 where nivel_alvo is not null
   and obrigatoria
   and (criterio->>'fonte' in ('ensaio', 'ensaios_ajudados', 'ensaios_total')
        or titulo ilike '%ensaio%');

-- ── 2. e 3. As missões novas ─────────────────────────────────────────────────
-- Uma linha por missão, no mesmo formato das que já existem: título curto, uma frase de
-- descrição, e o critério automático quando o app consegue contar sozinho.
insert into public.acolitos_missoes
  (nivel_alvo, capitulo, ordem, titulo, descricao, tipo, validacao, xp, seriedade, criterio, obrigatoria, ativo)
select v.nivel_alvo, v.capitulo, v.ordem, v.titulo, v.descricao, v.tipo, v.validacao, v.xp,
       v.seriedade, v.criterio::jsonb, v.obrigatoria, true
  from (values
    -- ASPIRANTE · capítulo 1 — "Cheguei"
    ('aspirante', 1, 1, 'Servir a primeira missa', 'Sirva a sua primeira missa.',
      'bonus', 'automatica', 15, 'seria', '{"fonte": "missas_servidas", "quantidade": 1}', true),
    ('aspirante', 1, 2, 'Onde mora cada coisa', 'Descubra onde ficam as túnicas, as velas e o turíbulo.',
      'requisito', 'reivindicada', 10, 'divertida', null, true),
    ('aspirante', 1, 3, 'Quem é quem', 'Aprenda o nome de 3 coroinhas e de quem coordena a pastoral.',
      'requisito', 'reivindicada', 10, 'divertida', null, true),
    ('aspirante', 1, 4, 'A oração de antes', 'Aprenda a oração que a equipe reza antes de entrar.',
      'requisito', 'reivindicada', 10, 'divertida', null, true),
    ('aspirante', 1, 5, 'Primeiro ensaio', 'Participe de 1 ensaio.',
      'bonus', 'automatica', 15, 'seria', '{"fonte": "ensaio", "quantidade": 1}', false),

    -- ASPIRANTE · capítulo 2 — "Já sei me virar"
    ('aspirante', 2, 1, 'Servir mais 2 missas', 'Chegue a 3 missas servidas.',
      'bonus', 'automatica', 15, 'seria', '{"fonte": "missas_servidas", "quantidade": 3}', true),
    ('aspirante', 2, 2, 'Túnica sozinho', 'Vista a túnica sozinho, do jeito certo, sem ninguém ajudar.',
      'requisito', 'reivindicada', 10, 'divertida', null, true),
    ('aspirante', 2, 3, 'O nome das coisas', 'Saiba dizer o nome de 5 objetos do altar e para que servem.',
      'requisito', 'reivindicada', 10, 'divertida', null, true),
    ('aspirante', 2, 4, 'Chegar antes', 'Chegue 15 minutos antes de uma missa em que você vai servir.',
      'requisito', 'reivindicada', 8, 'divertida', null, true),
    ('aspirante', 2, 5, 'Mais um ensaio', 'Chegue a 2 ensaios.',
      'bonus', 'automatica', 15, 'seria', '{"fonte": "ensaio", "quantidade": 2}', false),

    -- COROINHA · capítulo 3 — "Pronto para o próximo degrau"
    ('coroinha', 3, 1, 'Servir mais 2 missas', 'Chegue a 6 missas servidas.',
      'bonus', 'automatica', 15, 'seria', '{"fonte": "missas_servidas", "quantidade": 6}', true),
    ('coroinha', 3, 2, 'Apto em uma função', 'Fique habilitado em pelo menos uma função.',
      'bonus', 'automatica', 20, 'seria', '{"fonte": "funcoes_aptas", "quantidade": 1}', true),
    ('coroinha', 3, 3, 'A Missa por dentro', 'Saiba dizer, com as suas palavras, as quatro partes da Missa.',
      'requisito', 'reivindicada', 12, 'seria', null, true),
    ('coroinha', 3, 4, 'Ensinar quem chegou', 'Mostre a um aspirante onde fica cada coisa na sacristia.',
      'requisito', 'reivindicada', 12, 'divertida', null, true),
    ('coroinha', 3, 5, 'Mais 2 ensaios', 'Chegue a 6 ensaios.',
      'bonus', 'automatica', 15, 'seria', '{"fonte": "ensaio", "quantidade": 6}', false)
  ) as v(nivel_alvo, capitulo, ordem, titulo, descricao, tipo, validacao, xp, seriedade, criterio, obrigatoria)
 where not exists (
   select 1 from public.acolitos_missoes q
    where q.nivel_alvo = v.nivel_alvo and q.capitulo = v.capitulo and q.titulo = v.titulo);

-- O servidor de consultas não precisa recarregar (nenhuma coluna nova), mas a tela lê as
-- missões a cada abertura, então a trilha nova aparece na próxima vez que alguém abrir.
