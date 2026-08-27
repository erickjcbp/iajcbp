-- 063 — comentários do CRM: muitos, com autor e data, que nunca se apagam.
--
-- O QUE HAVIA: um campo `observacoes` na linha do CRM. Um só, por pessoa, e
-- SOBRESCRITO a cada avanço de etapa — quem escrevesse algo na integração perdia
-- o texto quando a pessoa chegasse na túnica. Em 27/08/2026 estava preenchido em
-- 0 das 18 linhas. Não era desuso: o campo se apagava sozinho.
--
-- O QUE PASSA A HAVER: uma linha por comentário, com quem escreveu e quando, e a
-- etapa em que a pessoa estava naquele momento. Junto com acolitos_crm_historico
-- (que guarda as mudanças de etapa), isso forma a linha do tempo da pessoa.
--
-- Comentar passou a ser OBRIGATÓRIO em toda mudança de etapa — decisão do dono.
-- Seis meses depois ninguém lembra por que fulano parou na túnica; agora fica escrito.

create table if not exists public.acolitos_crm_comentarios (
  id         uuid primary key default gen_random_uuid(),
  membro_id  uuid not null references public.acolitos_membros(id) on delete cascade,
  autor_id   uuid,
  texto      text not null check (btrim(texto) <> ''),
  quando     timestamptz not null default now(),
  -- em que etapa a pessoa estava quando o comentário foi escrito
  etapa      text,
  -- preenchidos quando o comentário acompanha uma mudança de etapa
  etapa_de   text,
  etapa_para text
);

create index if not exists acolitos_crm_comentarios_por_membro
  on public.acolitos_crm_comentarios (membro_id, quando desc);

alter table public.acolitos_crm_comentarios enable row level security;

-- Mesma porta do CRM: quem cuida da integração lê e escreve.
drop policy if exists "CRM lê comentários" on public.acolitos_crm_comentarios;
create policy "CRM lê comentários" on public.acolitos_crm_comentarios
  for select using (
    acolitos_is_superadmin(auth.uid())
    or acolitos_get_role(auth.uid()) = any (array['coord_admin','subadmin','membro_equipe'])
  );

-- Escrever é só INSERIR. Comentário não se edita nem se apaga: um histórico que
-- pode ser reescrito depois não serve para explicar decisão nenhuma.
drop policy if exists "CRM escreve comentários" on public.acolitos_crm_comentarios;
create policy "CRM escreve comentários" on public.acolitos_crm_comentarios
  for insert with check (
    autor_id = auth.uid()
    and (
      acolitos_is_superadmin(auth.uid())
      or acolitos_get_role(auth.uid()) = any (array['coord_admin','subadmin','membro_equipe'])
    )
  );

comment on table public.acolitos_crm_comentarios is
  'Linha do tempo do CRM: comentários com autor e data. Só inserção — não se edita nem se apaga.';
