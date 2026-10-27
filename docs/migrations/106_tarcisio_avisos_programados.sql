-- Avisos com registro único na configuração e destinos/agendamento dinâmicos.
-- Supabase CLI indisponível neste ambiente (SIGKILL); segue a convenção SQL deste projeto.
alter table public.tarcisio_avisos add column if not exists chave text;
alter table public.tarcisio_avisos add column if not exists configuracao jsonb not null default '{}'::jsonb;
create unique index if not exists tarcisio_avisos_chave on public.tarcisio_avisos(chave) where chave is not null;
-- RLS e permissões existentes permanecem vigentes. Nenhum segredo é guardado nestes campos.
