-- Acólitos 071 — a missa passa a guardar a hora em MINUTOS
--
-- O horário está guardado como texto sem zero na frente ('7h', '9h', '18h30', '19h30').
-- Ordenar por texto põe '9h' DEPOIS de '19h': medido em 17/09/2026, 20 dos 39 dias com mais
-- de uma missa saíam fora de ordem — todo domingo aparecia 19h, 7h, 9h, inclusive o próximo.
--
-- A coluna é CALCULADA pelo banco a partir do horário (a função veio na 070, e é imutável,
-- que é o que permite usá-la aqui). Ninguém escreve nela: some a chance de a hora e os
-- minutos discordarem. As telas passam a pedir a ordem por `minutos`.
--
-- Os EVENTOS não precisam disto: acolitos_eventos.hora já é hora de verdade (time).
--
-- IDEMPOTENTE: `add column if not exists`.

alter table public.acolitos_celebracoes
  add column if not exists minutos integer
  generated always as (public.acolitos_minutos_do_horario(horario)) stored;

comment on column public.acolitos_celebracoes.minutos is
  'A hora da missa em minutos do dia, calculada de `horario`. Serve para ORDENAR: horario é texto sem zero e ordena errado. Prova: docs/provas/provar-071-celebracao-em-ordem.sql';

-- O servidor de consultas só enxerga a coluna nova depois de recarregar.
notify pgrst, 'reload schema';
