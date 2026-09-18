-- Acólitos 082 — a tarefa pode ter HORA, não só dia
--
-- PEDIDO DO DONO (18/09/2026): "não tem como marcar horário nas tarefas".
--
-- A tarefa sempre teve `prazo` (uma data pura) e nada mais. Para "conferir as velas até
-- domingo" isso basta; para "gerar a arte da escala sexta às 18h" ou "chegar 15 minutos antes
-- da missa das 19h", o dia sozinho não diz nada — e a pessoa acaba perguntando a hora no
-- WhatsApp, que é justamente o que o app existe para evitar.
--
-- POR QUE UMA COLUNA `time` E NÃO UM CARIMBO COM FUSO: a hora de uma tarefa é uma combinação
-- humana ("às 18h"), não um instante no tempo. Guardar com fuso faria a mesma tarefa aparecer
-- às 18h aqui e às 21h para quem abrisse o app em Lisboa — e este projeto já pagou caro por
-- confundir as duas coisas (a dívida de fuso, quitada em agosto). O horário das missas, na
-- tabela de celebrações, é guardado pelo mesmo motivo como texto.
--
-- NULO continua valendo, e é o caso comum: tarefa sem hora é tarefa do dia inteiro.
--
-- IDEMPOTENTE: `add column if not exists`.

alter table public.acolitos_tarefas
  add column if not exists hora time;

comment on column public.acolitos_tarefas.hora is
  'Hora combinada da tarefa (opcional). Sem fuso de propósito: é uma combinação humana ("às 18h"), não um instante. Vazio = tarefa do dia inteiro.';

notify pgrst, 'reload schema';
