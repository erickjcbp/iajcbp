-- Acólitos 076 — nasce o setor "Orientador"
--
-- PEDIDO DO DONO (18/09/2026): um setor novo chamado Orientador, com **só ele por enquanto**.
-- A ideia é o setor ter tarefas de ACOMPANHAMENTO dos mais novos — "fazer um follow up, saber
-- como andam as coisas, um papel de aconselhador".
--
-- COMO EU ENTENDI (se estiver torto, é aqui que se corrige): quem ORIENTA são os mais
-- graduados, do **acólito sentinela para cima** — hoje 45 pessoas ativas (16 sentinelas, 11
-- cerimoniários aspirantes, 13 guardiões, 4 magistrais e 1 mor). Quem é ACOMPANHADO são os
-- mais novos. Por ora entra uma pessoa só; a entrada dos outros 44 é decisão da coordenação,
-- não desta migration.
--
-- O QUE ESTE SETOR JÁ GANHA DE GRAÇA: as Tarefas são por time (migration 057), então o
-- Orientador já tem quadro próprio e só ele o enxerga. As tarefas de acompanhamento em si
-- (quem fala com quem, e quando) dependem do gerador de tarefas por setor, que está na LISTA
-- como etapa seguinte.
--
-- IDEMPOTENTE: o setor só nasce se ainda não existir, e a pessoa só entra se ainda não estiver.

-- ── 1. O setor ───────────────────────────────────────────────────────────────
-- Os setores moram na mesma lista que a tela de Config edita (tipo='setor'); não se cria
-- catálogo novo, senão a tela para de enxergar o que a migration inventou.
insert into public.acolitos_listas (tipo, valor, label)
select 'setor', 'orientador', 'Orientador'
 where not exists (
   select 1 from public.acolitos_listas where tipo = 'setor' and valor = 'orientador');

-- ── 2. A primeira pessoa ─────────────────────────────────────────────────────
-- Erick Martins da Silva Valerian — o coordenador. (Existe outro Erick no cadastro, o Erick
-- Alves, coroinha: por isso aqui vai o id, e não o nome.)
update public.acolitos_membros
   set setores = array_append(coalesce(setores, '{}'::text[]), 'orientador')
 where id = '3133a8b9-75c1-463c-ba04-39963aa830da'
   and not ('orientador' = any(coalesce(setores, '{}'::text[])));
