-- Acólitos — Patch RLS: políticas de INSERT e UPDATE faltantes
-- Executar APÓS 002_acolitos_fase1.sql no Supabase Dashboard da conta iajcbp
-- Resolve: privilege escalation via client-side role assignment

-- ── PASTORAL_MEMBERS ─────────────────────────────────────────────────────

-- Permite que usuário autenticado se registre em uma pastoral APENAS como 'novo'
-- Impede qualquer self-assignment de role elevado
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename='pastoral_members' and policyname='Membro insere proprio vinculo como novo'
  ) then
    create policy "Membro insere proprio vinculo como novo" on public.pastoral_members
      for insert with check (
        auth.uid() = user_id AND
        role = 'novo'  -- banco rejeita qualquer tentativa de inserir role diferente de 'novo'
      );
  end if;
end $$;

-- Permite equipe ler todos os vínculos (necessário para crm.html e membros.html)
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename='pastoral_members' and policyname='Equipe le todos vinculos'
  ) then
    create policy "Equipe le todos vinculos" on public.pastoral_members
      for select using (
        acolitos_get_role(auth.uid()) in ('coord_admin','subadmin','membro_equipe')
      );
  end if;
end $$;

-- Permite apenas coord_admin e subadmin alterar roles (não membro_equipe)
-- O WITH CHECK impede elevação para coord_admin via CRM
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename='pastoral_members' and policyname='Admin altera roles pastorais'
  ) then
    create policy "Admin altera roles pastorais" on public.pastoral_members
      for update
      using (
        acolitos_get_role(auth.uid()) in ('coord_admin','subadmin')
      )
      with check (
        -- Evita que subadmin crie coord_admin via CRM
        case
          when role in ('aspirante','coroinha','acolito','cerimonario','membro_equipe','novo','integrado')
            then acolitos_get_role(auth.uid()) in ('coord_admin','subadmin')
          when role in ('subadmin','coord_admin')
            then acolitos_get_role(auth.uid()) = 'coord_admin'
          else false
        end
      );
  end if;
end $$;

-- ── ACOLITOS_MEMBROS ──────────────────────────────────────────────────────

-- Permite usuário autenticado inserir seu próprio registro ou de filhos (user_id null)
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename='acolitos_membros' and policyname='Autenticado insere membros'
  ) then
    create policy "Autenticado insere membros" on public.acolitos_membros
      for insert with check (
        auth.role() = 'authenticated' AND
        (user_id = auth.uid() OR user_id IS NULL)
      );
  end if;
end $$;

-- ── ACOLITOS_CRM ─────────────────────────────────────────────────────────

-- Permite usuário autenticado abrir própria entrada no CRM após registro
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename='acolitos_crm' and policyname='Autenticado insere crm'
  ) then
    create policy "Autenticado insere crm" on public.acolitos_crm
      for insert with check (auth.role() = 'authenticated');
  end if;
end $$;
