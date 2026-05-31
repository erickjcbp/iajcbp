-- Central JCBP — Fix: recursão infinita de RLS (erro 42P17) que quebrava o login
--
-- Causa raiz: as policies de admin da Central faziam
--   exists (select 1 from public.profiles where id = auth.uid() and role='admin')
-- DENTRO de policies sobre a própria tabela profiles → recursão infinita.
-- Consequência: todo select em profiles falhava → central.html não achava o
-- perfil → signOut() → loop de volta ao login.
--
-- Solução (mesmo padrão do módulo Acólitos): função SECURITY DEFINER que lê o
-- role bypassando a RLS, eliminando a recursão.

create or replace function public.is_central_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;
-- anon mantém EXECUTE: a RLS de access_requests (insert anônimo) pode avaliar
-- a policy de admin durante o INSERT; sem execute daria "permission denied".

-- ── profiles ──────────────────────────────────────────────────────────────
drop policy if exists "Admin le todos" on public.profiles;
create policy "Admin le todos" on public.profiles
  for select using (public.is_central_admin());

drop policy if exists "Admin gerencia" on public.profiles;
create policy "Admin gerencia" on public.profiles
  for all using (public.is_central_admin()) with check (public.is_central_admin());

-- ── groups ────────────────────────────────────────────────────────────────
drop policy if exists "Admin gerencia grupos" on public.groups;
create policy "Admin gerencia grupos" on public.groups
  for all using (public.is_central_admin()) with check (public.is_central_admin());

-- ── tools ─────────────────────────────────────────────────────────────────
drop policy if exists "Admin gerencia tools" on public.tools;
create policy "Admin gerencia tools" on public.tools
  for all using (public.is_central_admin()) with check (public.is_central_admin());

-- ── group_tools ───────────────────────────────────────────────────────────
drop policy if exists "Admin gerencia group_tools" on public.group_tools;
create policy "Admin gerencia group_tools" on public.group_tools
  for all using (public.is_central_admin()) with check (public.is_central_admin());

-- ── access_requests ───────────────────────────────────────────────────────
drop policy if exists "Admin gerencia requests" on public.access_requests;
create policy "Admin gerencia requests" on public.access_requests
  for all using (public.is_central_admin()) with check (public.is_central_admin());
