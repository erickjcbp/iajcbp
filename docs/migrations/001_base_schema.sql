-- Central JCBP — Schema v1
-- Colar no Supabase Dashboard → SQL Editor → New query → Run

-- 1. groups
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text,
  lider_id uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);
alter table public.groups enable row level security;
create policy "Autenticados leem grupos" on public.groups
  for select using (auth.role() = 'authenticated');

-- 2. profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  email text not null,
  foto_url text,
  group_id uuid references public.groups(id) on delete set null,
  role text not null default 'membro' check (role in ('admin','lider','membro')),
  status text not null default 'ativo' check (status in ('ativo','bloqueado')),
  created_at timestamptz default now()
);
alter table public.profiles enable row level security;
create policy "Usuario le proprio perfil" on public.profiles
  for select using (auth.uid() = id);
create policy "Admin le todos" on public.profiles
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );
create policy "Admin gerencia" on public.profiles for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- 3. policy admin em groups (profiles já existe)
create policy "Admin gerencia grupos" on public.groups for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- 4. tools
create table public.tools (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text,
  icone text default '🔧',
  url text not null,
  ativo boolean default true,
  created_at timestamptz default now()
);
alter table public.tools enable row level security;
create policy "Autenticados leem tools ativas" on public.tools
  for select using (auth.role() = 'authenticated' and ativo = true);
create policy "Admin gerencia tools" on public.tools for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- 5. group_tools
create table public.group_tools (
  group_id uuid references public.groups(id) on delete cascade,
  tool_id  uuid references public.tools(id)  on delete cascade,
  primary key (group_id, tool_id)
);
alter table public.group_tools enable row level security;
create policy "Autenticados leem group_tools" on public.group_tools
  for select using (auth.role() = 'authenticated');
create policy "Admin gerencia group_tools" on public.group_tools for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- 6. access_requests
create table public.access_requests (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text not null,
  grupo_interesse text,
  mensagem text,
  status text not null default 'pendente'
    check (status in ('pendente','aprovado','rejeitado')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz default now()
);
alter table public.access_requests enable row level security;
create policy "Anonimo insere" on public.access_requests
  for insert with check (true);
create policy "Admin gerencia requests" on public.access_requests for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- 7. trigger: cria profile automaticamente ao criar usuário
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, nome, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email,'@',1)),
    new.email
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
