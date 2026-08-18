-- Acólitos — Tarefas dos times
-- Cada tarefa pertence a um TIME (obrigatório) e opcionalmente a um responsável.
-- O time é o mesmo 'setor' que já existe em acolitos_listas (tipo='setor') e no campo
-- setores de acolitos_membros — não se cria catálogo novo.
create table if not exists public.acolitos_tarefas (
  id            uuid primary key default gen_random_uuid(),
  titulo        text not null,
  time_slug     text not null,                      -- valor de acolitos_listas tipo='setor'
  responsavel_id uuid references public.acolitos_membros(id) on delete set null,
  prazo         date,
  observacao    text,
  recorrencia   text not null default 'nenhuma'
                check (recorrencia in ('nenhuma','semanal','mensal','anual','celebracao')),
  concluida_em  timestamptz,
  concluida_por uuid references public.acolitos_membros(id) on delete set null,
  criada_em     timestamptz not null default now(),
  criada_por    uuid
);

-- A tela abre agrupando por time e destacando atrasadas: os dois filtros da lista.
create index if not exists acolitos_tarefas_time_idx  on public.acolitos_tarefas (time_slug);
create index if not exists acolitos_tarefas_prazo_idx on public.acolitos_tarefas (prazo)
  where concluida_em is null;

alter table public.acolitos_tarefas enable row level security;

-- Quem lê e escreve é a coordenação com a permissão do módulo. Mesmo desenho das irmãs:
-- o helper acolitos_get_role, e não um join inline.
do $$ begin
  if not exists (select 1 from pg_policies
    where tablename='acolitos_tarefas' and policyname='Tarefas leitura coordenacao') then
    create policy "Tarefas leitura coordenacao" on public.acolitos_tarefas
      for select to authenticated
      using (public.acolitos_get_role(auth.uid()) in ('coord_admin','subadmin','membro_equipe'));
  end if;
  if not exists (select 1 from pg_policies
    where tablename='acolitos_tarefas' and policyname='Tarefas escrita coordenacao') then
    create policy "Tarefas escrita coordenacao" on public.acolitos_tarefas
      for all to authenticated
      using      (public.acolitos_get_role(auth.uid()) in ('coord_admin','subadmin','membro_equipe'))
      with check (public.acolitos_get_role(auth.uid()) in ('coord_admin','subadmin','membro_equipe'));
  end if;
end $$;
