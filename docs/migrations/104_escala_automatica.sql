-- 104 — São Tarcísio: escala automática (2026-10-20)
-- Projeto: docs/superpowers/specs/2026-10-20-escala-automatica-design.md
-- O robô (service_role) grava; a coordenação (tarcisio_pode_gerir) gere; anon não vê nada.

-- 1) Estado da escala automática de cada semana (semana = sábado)
create table if not exists public.tarcisio_escala_auto (
  semana date primary key,
  estado text not null check (estado in ('gerando','aguardando','em_revisao','confirmada','falhou','sem_missas','ja_confirmada')),
  gerada_em timestamptz,
  resumo jsonb,
  mensagem_dono_id text,
  lembretes int not null default 0,
  erro text
);

-- 2) Ministros da Palavra/Eucaristia lidos do PDF mensal
create table if not exists public.acolitos_escala_ministros (
  id uuid primary key default gen_random_uuid(),
  mes date not null,
  data date not null,
  horario text not null,
  comunidade text not null,
  membro_id uuid not null references public.acolitos_membros(id) on delete cascade,
  pai_ou_mae text check (pai_ou_mae in ('pai','mae')),
  arquivo text,
  unique (data, horario, comunidade, membro_id)
);
create index if not exists acolitos_escala_ministros_data on public.acolitos_escala_ministros (data);

-- 3) Apelidos aprendidos: nome do PDF -> membro (confirmado pelo dono)
create table if not exists public.acolitos_ministro_apelidos (
  id uuid primary key default gen_random_uuid(),
  nome_pdf text not null,
  membro_id uuid not null references public.acolitos_membros(id) on delete cascade,
  pai_ou_mae text not null check (pai_ou_mae in ('pai','mae')),
  resposta text not null check (resposta in ('sim','nao')),
  respondido_por text,
  em timestamptz not null default now(),
  unique (nome_pdf, membro_id, pai_ou_mae)
);

-- 4) Ajustes na configuração (linha única)
alter table public.tarcisio_config
  add column if not exists numero_conferencia text not null default '5519999071702',
  add column if not exists remetentes_pdf text[] not null default '{}',
  add column if not exists ausencia_horas text[] not null default '{09:00}',
  add column if not exists ausencia_ultimo text not null default '15:00',
  add column if not exists ausencia_texto text;

-- 5) RLS
alter table public.tarcisio_escala_auto enable row level security;
alter table public.acolitos_escala_ministros enable row level security;
alter table public.acolitos_ministro_apelidos enable row level security;
drop policy if exists "Coordenacao gere" on public.tarcisio_escala_auto;
drop policy if exists "Coordenacao gere" on public.acolitos_escala_ministros;
drop policy if exists "Coordenacao gere" on public.acolitos_ministro_apelidos;
create policy "Coordenacao gere" on public.tarcisio_escala_auto for all using (tarcisio_pode_gerir()) with check (tarcisio_pode_gerir());
create policy "Coordenacao gere" on public.acolitos_escala_ministros for all using (tarcisio_pode_gerir()) with check (tarcisio_pode_gerir());
create policy "Coordenacao gere" on public.acolitos_ministro_apelidos for all using (tarcisio_pode_gerir()) with check (tarcisio_pode_gerir());
revoke all on public.tarcisio_escala_auto, public.acolitos_escala_ministros, public.acolitos_ministro_apelidos from anon;
grant select, insert, update, delete on public.tarcisio_escala_auto, public.acolitos_escala_ministros, public.acolitos_ministro_apelidos to authenticated;
