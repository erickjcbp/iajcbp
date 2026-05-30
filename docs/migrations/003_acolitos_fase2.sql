-- Acólitos Fase 2 — Celebrações, Escalas, Ausências, Chamadas
-- Executar no Supabase Dashboard da conta iajcbp após 002b_acolitos_rls_patch.sql

-- ── CELEBRAÇÕES ──────────────────────────────────────────────
create table if not exists public.acolitos_celebracoes (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  horario text not null,
  comunidade text not null default 'matriz'
    check (comunidade in ('matriz','santo_antonio')),
  tipo text not null default 'missa_comum' check (tipo in (
    'missa_comum','solenidade','casamento','batizado','crisma','ordenacao'
  )),
  observacoes text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);
alter table public.acolitos_celebracoes enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='acolitos_celebracoes' and policyname='Autenticados leem celebracoes') then
    create policy "Autenticados leem celebracoes" on public.acolitos_celebracoes
      for select using (auth.role() = 'authenticated');
  end if;
  if not exists (select 1 from pg_policies where tablename='acolitos_celebracoes' and policyname='Equipe gerencia celebracoes') then
    create policy "Equipe gerencia celebracoes" on public.acolitos_celebracoes
      for all using (acolitos_get_role(auth.uid()) in ('coord_admin','subadmin','membro_equipe'));
  end if;
end $$;

-- ── ESCALAS ───────────────────────────────────────────────────
create table if not exists public.acolitos_escalas (
  id uuid primary key default gen_random_uuid(),
  celebracao_id uuid not null references public.acolitos_celebracoes(id) on delete cascade,
  membro_id uuid not null references public.acolitos_membros(id) on delete cascade,
  funcao text not null check (funcao in (
    'apoio','cruz','vela','sineta','sinao','altar',
    'turibulo','naveta','missal','cred_altar','cred_credencia','mitra','baculo'
  )),
  status text not null default 'escalado' check (status in (
    'escalado','presente','ausente_justificado','ausente','atrasado','substituido'
  )),
  substituto_id uuid references public.acolitos_membros(id),
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);
alter table public.acolitos_escalas enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='acolitos_escalas' and policyname='Autenticados leem escalas') then
    create policy "Autenticados leem escalas" on public.acolitos_escalas
      for select using (auth.role() = 'authenticated');
  end if;
  if not exists (select 1 from pg_policies where tablename='acolitos_escalas' and policyname='Equipe gerencia escalas') then
    create policy "Equipe gerencia escalas" on public.acolitos_escalas
      for all using (acolitos_get_role(auth.uid()) in ('coord_admin','subadmin','membro_equipe'));
  end if;
  if not exists (select 1 from pg_policies where tablename='acolitos_escalas' and policyname='Cerimonario atualiza status') then
    create policy "Cerimonario atualiza status" on public.acolitos_escalas
      for update using (
        acolitos_get_role(auth.uid()) in ('coord_admin','subadmin','membro_equipe','cerimonario')
      )
      with check (status in ('presente','ausente','atrasado','substituido','ausente_justificado'));
  end if;
  -- Membro atualiza própria escala (para ausência justificada)
  if not exists (select 1 from pg_policies where tablename='acolitos_escalas' and policyname='Membro atualiza propria escala') then
    create policy "Membro atualiza propria escala" on public.acolitos_escalas
      for update using (
        exists (select 1 from public.acolitos_membros m where m.id = membro_id and m.user_id = auth.uid())
      )
      with check (status in ('ausente_justificado'));
  end if;
end $$;

-- ── AUSÊNCIAS ─────────────────────────────────────────────────
create table if not exists public.acolitos_ausencias (
  id uuid primary key default gen_random_uuid(),
  membro_id uuid not null references public.acolitos_membros(id) on delete cascade,
  celebracao_id uuid not null references public.acolitos_celebracoes(id) on delete cascade,
  motivo text not null default 'outro' check (motivo in ('doenca','viagem','familia','outro')),
  observacao text,
  created_at timestamptz default now(),
  unique(membro_id, celebracao_id)
);
alter table public.acolitos_ausencias enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='acolitos_ausencias' and policyname='Membro le proprias ausencias') then
    create policy "Membro le proprias ausencias" on public.acolitos_ausencias
      for select using (
        exists (select 1 from public.acolitos_membros m where m.id = membro_id and m.user_id = auth.uid())
      );
  end if;
  if not exists (select 1 from pg_policies where tablename='acolitos_ausencias' and policyname='Membro insere propria ausencia') then
    create policy "Membro insere propria ausencia" on public.acolitos_ausencias
      for insert with check (
        exists (select 1 from public.acolitos_membros m where m.id = membro_id and m.user_id = auth.uid())
      );
  end if;
  if not exists (select 1 from pg_policies where tablename='acolitos_ausencias' and policyname='Equipe le todas ausencias') then
    create policy "Equipe le todas ausencias" on public.acolitos_ausencias
      for all using (acolitos_get_role(auth.uid()) in ('coord_admin','subadmin','membro_equipe'));
  end if;
end $$;

-- ── CHAMADAS ──────────────────────────────────────────────────
create table if not exists public.acolitos_chamadas (
  id uuid primary key default gen_random_uuid(),
  celebracao_id uuid not null references public.acolitos_celebracoes(id) on delete cascade,
  realizada_por uuid references auth.users(id),
  realizada_em timestamptz default now(),
  unique(celebracao_id)
);
alter table public.acolitos_chamadas enable row level security;

create table if not exists public.acolitos_chamadas_itens (
  id uuid primary key default gen_random_uuid(),
  chamada_id uuid not null references public.acolitos_chamadas(id) on delete cascade,
  escala_id uuid not null references public.acolitos_escalas(id) on delete cascade,
  resultado text not null check (resultado in ('presente','ausente','atrasado')),
  substituto_id uuid references public.acolitos_membros(id)
);
alter table public.acolitos_chamadas_itens enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='acolitos_chamadas' and policyname='Equipe e cerimonario gerenciam chamadas') then
    create policy "Equipe e cerimonario gerenciam chamadas" on public.acolitos_chamadas
      for all using (
        acolitos_get_role(auth.uid()) in ('coord_admin','subadmin','membro_equipe','cerimonario')
      );
  end if;
  if not exists (select 1 from pg_policies where tablename='acolitos_chamadas_itens' and policyname='Equipe e cerimonario gerenciam itens') then
    create policy "Equipe e cerimonario gerenciam itens" on public.acolitos_chamadas_itens
      for all using (
        acolitos_get_role(auth.uid()) in ('coord_admin','subadmin','membro_equipe','cerimonario')
      );
  end if;
end $$;

-- ── CALENDÁRIO FIXO INICIAL (próximas 8 semanas) ─────────────
do $$
declare
  d date := current_date;
  end_date date := current_date + interval '8 weeks';
  dow int;
begin
  while d <= end_date loop
    dow := extract(dow from d);
    if dow = 6 then
      insert into public.acolitos_celebracoes (data, horario, comunidade, tipo)
        values (d, '17h', 'matriz', 'missa_comum') on conflict do nothing;
      insert into public.acolitos_celebracoes (data, horario, comunidade, tipo)
        values (d, '18h30', 'santo_antonio', 'missa_comum') on conflict do nothing;
    end if;
    if dow = 0 then
      insert into public.acolitos_celebracoes (data, horario, comunidade, tipo)
        values (d, '7h', 'matriz', 'missa_comum') on conflict do nothing;
      insert into public.acolitos_celebracoes (data, horario, comunidade, tipo)
        values (d, '9h', 'matriz', 'missa_comum') on conflict do nothing;
      insert into public.acolitos_celebracoes (data, horario, comunidade, tipo)
        values (d, '19h', 'matriz', 'missa_comum') on conflict do nothing;
    end if;
    d := d + 1;
  end loop;
end $$;
