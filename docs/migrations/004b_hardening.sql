-- Acólitos Fase 3 — Hardening pós-advisors do Supabase
-- Executar APÓS 004_indicadores_foto.sql

-- 1. Bucket 'avatars' é público: a policy de SELECT permitia LISTAR todos os
--    arquivos do bucket. Downloads por URL pública não precisam dela —
--    removida para evitar enumeração (lint 0025).
drop policy if exists "Avatars leitura publica" on storage.objects;

-- 2. Fixa search_path do helper SECURITY DEFINER (lint 0011).
alter function public.acolitos_get_role(uuid) set search_path = public;

-- 3. Remove execução anônima do helper via RPC (lints 0028/0029).
--    'authenticated' mantém EXECUTE pois o helper é usado dentro das RLS.
revoke execute on function public.acolitos_get_role(uuid) from anon;
