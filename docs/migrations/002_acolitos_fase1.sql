-- Acólitos Fase 1 — Executar no Supabase Dashboard da conta iajcbp
-- Supabase Dashboard → SQL Editor → New query → colar tudo → Run

-- ── 1. INFRAESTRUTURA COMPARTILHADA ──────────────────────────────────────

create table if not exists public.pastoral_modules (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  nome text not null,
  ativo boolean not null default true,
  created_at timestamptz default now()
);
alter table public.pastoral_modules enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename='pastoral_modules' and policyname='Autenticados leem módulos'
  ) then
    create policy "Autenticados leem módulos" on public.pastoral_modules
      for select using (auth.role() = 'authenticated');
  end if;
end $$;

create table if not exists public.pastoral_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  module_id uuid not null references public.pastoral_modules(id) on delete cascade,
  role text not null default 'novo' check (role in (
    'coord_admin','subadmin','membro_equipe',
    'cerimonario','acolito','coroinha','aspirante','novo'
  )),
  created_at timestamptz default now(),
  unique(user_id, module_id)
);
alter table public.pastoral_members enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename='pastoral_members' and policyname='Usuario le proprio vinculo'
  ) then
    create policy "Usuario le proprio vinculo" on public.pastoral_members
      for select using (auth.uid() = user_id);
  end if;
end $$;

insert into public.pastoral_modules (slug, nome)
values ('acolitos', 'Acólitos e Coroinhas')
on conflict (slug) do nothing;

-- ── 2. FUNÇÃO HELPER ─────────────────────────────────────────────────────

create or replace function public.acolitos_get_role(uid uuid)
returns text language sql security definer stable as $$
  select pm.role
  from public.pastoral_members pm
  join public.pastoral_modules pmod on pm.module_id = pmod.id
  where pm.user_id = uid and pmod.slug = 'acolitos'
  limit 1;
$$;

-- ── 3. MEMBROS ───────────────────────────────────────────────────────────

create table if not exists public.acolitos_membros (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  nome text not null,
  data_nascimento date,
  telefone text,
  responsavel text,
  comunidade text not null default 'matriz'
    check (comunidade in ('matriz','santo_antonio','outra')),
  pode_outras_comunidades boolean default true,
  tem_pai_ministro boolean default false,
  nome_pai_ministro text,
  tem_mae_ministro boolean default false,
  nome_mae_ministro text,
  comunidade_ministro text,
  escalar_com_pais boolean default false,
  tem_irmao_pastoral boolean default false,
  irmao_id uuid references public.acolitos_membros(id) on delete set null,
  escalar_com_irmao boolean default false,
  necessidades_especiais text,
  observacoes text,
  foto_url text,
  status text not null default 'ativo'
    check (status in ('ativo','afastado','desligado')),
  proxima_etapa text,
  created_at timestamptz default now()
);
alter table public.acolitos_membros enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='acolitos_membros' and policyname='Membro le proprio registro') then
    create policy "Membro le proprio registro" on public.acolitos_membros
      for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename='acolitos_membros' and policyname='Equipe le todos membros') then
    create policy "Equipe le todos membros" on public.acolitos_membros
      for select using (acolitos_get_role(auth.uid()) in ('coord_admin','subadmin','membro_equipe'));
  end if;
  if not exists (select 1 from pg_policies where tablename='acolitos_membros' and policyname='Equipe gerencia membros') then
    create policy "Equipe gerencia membros" on public.acolitos_membros
      for all using (acolitos_get_role(auth.uid()) in ('coord_admin','subadmin','membro_equipe'));
  end if;
end $$;

-- ── 4. DISPONIBILIDADE ───────────────────────────────────────────────────

create table if not exists public.acolitos_disponibilidade (
  id uuid primary key default gen_random_uuid(),
  membro_id uuid not null references public.acolitos_membros(id) on delete cascade,
  dia text not null check (dia in ('sabado','domingo')),
  horario text not null,
  comunidade text,
  restricao text
);
alter table public.acolitos_disponibilidade enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='acolitos_disponibilidade' and policyname='Membro le propria disp') then
    create policy "Membro le propria disp" on public.acolitos_disponibilidade
      for select using (
        exists (select 1 from public.acolitos_membros m where m.id = membro_id and m.user_id = auth.uid())
      );
  end if;
  if not exists (select 1 from pg_policies where tablename='acolitos_disponibilidade' and policyname='Equipe gerencia disp') then
    create policy "Equipe gerencia disp" on public.acolitos_disponibilidade
      for all using (acolitos_get_role(auth.uid()) in ('coord_admin','subadmin','membro_equipe'));
  end if;
end $$;

-- ── 5. HABILITAÇÕES ──────────────────────────────────────────────────────

create table if not exists public.acolitos_habilitacoes (
  id uuid primary key default gen_random_uuid(),
  membro_id uuid not null references public.acolitos_membros(id) on delete cascade,
  funcao text not null check (funcao in (
    'apoio','cruz','vela','sineta','sinao','altar',
    'turibulo','naveta','missal','cred_altar','cred_credencia','mitra','baculo'
  )),
  proficiencia text not null default 'nao_treinado' check (proficiencia in (
    'nao_treinado','em_formacao','apto','experiente','referencia'
  )),
  updated_at timestamptz default now(),
  unique(membro_id, funcao)
);
alter table public.acolitos_habilitacoes enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='acolitos_habilitacoes' and policyname='Membro le proprias hab') then
    create policy "Membro le proprias hab" on public.acolitos_habilitacoes
      for select using (
        exists (select 1 from public.acolitos_membros m where m.id = membro_id and m.user_id = auth.uid())
      );
  end if;
  if not exists (select 1 from pg_policies where tablename='acolitos_habilitacoes' and policyname='Equipe gerencia hab') then
    create policy "Equipe gerencia hab" on public.acolitos_habilitacoes
      for all using (acolitos_get_role(auth.uid()) in ('coord_admin','subadmin','membro_equipe'));
  end if;
end $$;

-- ── 6. CRM ───────────────────────────────────────────────────────────────

create table if not exists public.acolitos_crm (
  id uuid primary key default gen_random_uuid(),
  membro_id uuid not null references public.acolitos_membros(id) on delete cascade,
  etapa text not null default 'integracao' check (etapa in (
    'integracao','whatsapp','tunica','disponivel_escala','integrado'
  )),
  etapa_iniciada_em timestamptz default now(),
  observacoes text,
  unique(membro_id)
);
alter table public.acolitos_crm enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='acolitos_crm' and policyname='Membro le proprio crm') then
    create policy "Membro le proprio crm" on public.acolitos_crm
      for select using (
        exists (select 1 from public.acolitos_membros m where m.id = membro_id and m.user_id = auth.uid())
      );
  end if;
  if not exists (select 1 from pg_policies where tablename='acolitos_crm' and policyname='Equipe gerencia crm') then
    create policy "Equipe gerencia crm" on public.acolitos_crm
      for all using (acolitos_get_role(auth.uid()) in ('coord_admin','subadmin','membro_equipe'));
  end if;
end $$;

create table if not exists public.acolitos_crm_historico (
  id uuid primary key default gen_random_uuid(),
  membro_id uuid not null references public.acolitos_membros(id) on delete cascade,
  etapa_de text not null,
  etapa_para text not null,
  changed_by uuid references auth.users(id),
  changed_at timestamptz default now()
);
alter table public.acolitos_crm_historico enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='acolitos_crm_historico' and policyname='Equipe le historico crm') then
    create policy "Equipe le historico crm" on public.acolitos_crm_historico
      for all using (acolitos_get_role(auth.uid()) in ('coord_admin','subadmin','membro_equipe'));
  end if;
end $$;

-- ── 7. REGISTRAR TOOL NA CENTRAL ─────────────────────────────────────────

insert into public.tools (nome, descricao, icone, url, ativo)
values (
  'Acólitos e Coroinhas',
  'Gestão da pastoral de acólitos, coroinhas e cerimoniários',
  '⛪',
  '/acolitos',
  true
)
on conflict do nothing;
