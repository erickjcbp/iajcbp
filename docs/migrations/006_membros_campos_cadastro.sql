-- Acólitos Fase 6 — Colunas que faltavam para o cadastro (novos.html perdia dados)
-- Executar APÓS 005. Idempotente.

alter table public.acolitos_membros
  add column if not exists batismo boolean default false,
  add column if not exists primeira_eucaristia boolean default false,
  add column if not exists crisma boolean default false,
  add column if not exists tem_tunica boolean default false,
  add column if not exists no_grupo_whatsapp boolean default false,
  add column if not exists endereco text,
  add column if not exists celular_mae text,
  add column if not exists celular_recado text;
