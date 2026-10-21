-- 100 — São Tarcísio: imagem só das pastas do próprio projeto (2026-10-20)
-- A Evolution baixa a imagem DE DENTRO da VPS. Um link livre faria ela buscar endereços internos
-- (a Evolution da SATOR ou da Pink, o banco do gateway). Só passa a pasta dos avisos e a das artes.
alter table public.tarcisio_avisos add constraint tarcisio_avisos_imagem_do_projeto check (
  imagem_url is null
  or imagem_url like 'https://fttjgsotuosjfrasttds.supabase.co/storage/v1/object/public/tarcisio/%');
alter table public.tarcisio_envios add constraint tarcisio_envios_imagem_do_projeto check (
  imagem_url is null
  or imagem_url like 'https://fttjgsotuosjfrasttds.supabase.co/storage/v1/object/public/tarcisio/%'
  or imagem_url like 'https://fttjgsotuosjfrasttds.supabase.co/storage/v1/object/public/artes-escala/%');
