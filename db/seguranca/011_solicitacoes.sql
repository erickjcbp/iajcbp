-- 011 — Solicitações do membro (troca / candidatura) + Caixa de Aprovações (2026-07-15)
-- Autoatendimento: o membro pede troca (colega aceita → coordenação homologa) ou se candidata a vaga.
-- A mutação real da escala reusa acolitos_aplicar_troca_escala (009). Ausências (fila) e novos
-- cadastros (CRM) NÃO entram aqui — a Caixa só os agrega.

create table if not exists public.acolitos_solicitacoes (
  id                  uuid primary key default gen_random_uuid(),
  membro_id           uuid not null references public.acolitos_membros(id) on delete cascade,
  celebracao_id       uuid not null references public.acolitos_celebracoes(id) on delete cascade,
  escala_id           uuid references public.acolitos_escalas(id) on delete set null,
  funcao              text not null,
  tipo                text not null check (tipo in ('troca','candidatura')),
  alvo_membro_id      uuid references public.acolitos_membros(id) on delete set null,
  status              text not null default 'aguardando_coordenacao',
  motivo              text,
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now(),
  decidido_por        uuid,
  resultado_escala_id uuid
);
create index if not exists idx_solic_status   on public.acolitos_solicitacoes(status);
create index if not exists idx_solic_membro   on public.acolitos_solicitacoes(membro_id);
create index if not exists idx_solic_alvo     on public.acolitos_solicitacoes(alvo_membro_id);
create index if not exists idx_solic_celebra  on public.acolitos_solicitacoes(celebracao_id);

alter table public.acolitos_solicitacoes enable row level security;

-- Dono OU alvo (colega convidado) lê. Coordenação lê tudo.
drop policy if exists solic_select on public.acolitos_solicitacoes;
create policy solic_select on public.acolitos_solicitacoes for select using (
  membro_id     in (select id from public.acolitos_membros where user_id = auth.uid())
  or alvo_membro_id in (select id from public.acolitos_membros where user_id = auth.uid())
  or public.acolitos_get_role(auth.uid()) in ('coord_admin','subadmin','membro_equipe','cerimonario')
);
-- Sem policies de INSERT/UPDATE/DELETE diretas: todo write é via RPC SECURITY DEFINER (abaixo).
