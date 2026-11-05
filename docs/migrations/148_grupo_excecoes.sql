-- Exceções de entrada nos grupos de SERVOS (Acólitos e Cerimoniários).
-- Regra do dono (05/11/2026): esses grupos são dos servos; família entra no grupo de Pais. O robô só adiciona
-- número que seja telefone PRÓPRIO de uma ficha (tarcisio-robo/guarda-grupos.mjs) e avisa a coordenação
-- quando acha família lá dentro. Esta tabela é a exceção que a coordenação registra DE PROPÓSITO
-- (ex.: um contato de família que o dono decidiu manter no grupo).
-- Chave = últimos 8 dígitos do número + grupo; a exceção de um grupo não vale no outro.
begin;

create table if not exists public.tarcisio_grupo_excecoes (
  numero_fim text not null check (numero_fim ~ '^[0-9]{8}$'),
  papel text not null check (papel in ('acolitos', 'cerimoniarios')),
  motivo text not null,
  criado_em timestamptz not null default now(),
  primary key (numero_fim, papel)
);

alter table public.tarcisio_grupo_excecoes enable row level security;
drop policy if exists "Coordenacao gere" on public.tarcisio_grupo_excecoes;
create policy "Coordenacao gere" on public.tarcisio_grupo_excecoes for all
  using (tarcisio_pode_gerir()) with check (tarcisio_pode_gerir());
revoke all on public.tarcisio_grupo_excecoes from anon;
grant select, insert, update, delete on public.tarcisio_grupo_excecoes to authenticated;
grant all on public.tarcisio_grupo_excecoes to service_role;

-- A exceção de hoje (1 número, mantido pelo dono em 05/11/2026) foi cadastrada direto no banco, fora deste arquivo,
-- para não gravar nome de família no repositório. Nova exceção: insert na tabela, com os 8 últimos dígitos.

commit;
