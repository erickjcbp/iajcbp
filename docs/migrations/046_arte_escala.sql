-- Acólitos — Arte Automática da Escala
-- Tabelas para a arte gerada semanalmente (PNG do fim de semana seguinte) e o
-- override litúrgico manual, mais o bucket público que guarda os PNGs.
-- Escrita das artes é feita pelo cron/API com a SERVICE ROLE (bypassa RLS).
-- O override é editado pela coordenação direto pelo app → policy de escrita por papel.

-- ── 1. ARTES GERADAS ─────────────────────────────────────────────────────
create table if not exists public.acolitos_escala_artes (
  domingo_data date primary key,
  png_url      text not null,
  tempo        text,
  descricao    text,
  cor          text,
  gerado_em    timestamptz not null default now(),
  gerado_por   text not null default 'cron'
);

-- ── 2. OVERRIDE LITÚRGICO MANUAL ─────────────────────────────────────────
create table if not exists public.acolitos_liturgia_override (
  domingo_data date primary key,
  tempo        text not null,
  descricao    text not null,
  cor          text not null,
  criado_por   uuid,
  criado_em    timestamptz not null default now()
);

-- ── 3. RLS ───────────────────────────────────────────────────────────────
alter table public.acolitos_escala_artes    enable row level security;
alter table public.acolitos_liturgia_override enable row level security;

-- Artes: leitura liberada a autenticados (o PNG já é público no bucket).
-- Escrita só pela service role (cron/API), que ignora RLS — sem policy de write.
do $$ begin
  if not exists (select 1 from pg_policies
    where tablename='acolitos_escala_artes' and policyname='Artes leitura autenticada') then
    create policy "Artes leitura autenticada" on public.acolitos_escala_artes
      for select to authenticated using (true);
  end if;
end $$;

-- Override: leitura a autenticados; escrita só coordenação (usa o helper canônico).
do $$ begin
  if not exists (select 1 from pg_policies
    where tablename='acolitos_liturgia_override' and policyname='Override leitura autenticada') then
    create policy "Override leitura autenticada" on public.acolitos_liturgia_override
      for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies
    where tablename='acolitos_liturgia_override' and policyname='Override escrita coordenacao') then
    create policy "Override escrita coordenacao" on public.acolitos_liturgia_override
      for all to authenticated
      using      (public.acolitos_get_role(auth.uid()) in ('coord_admin','subadmin'))
      with check (public.acolitos_get_role(auth.uid()) in ('coord_admin','subadmin'));
  end if;
end $$;

-- ── 4. BUCKET PÚBLICO DAS ARTES ──────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('artes-escala','artes-escala', true)
on conflict (id) do nothing;
