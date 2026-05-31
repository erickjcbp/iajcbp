-- Acólitos — correções do code review (pós F6)
-- 1) Membro não conseguia atualizar o próprio registro (foto/perfil) — faltava policy.
-- 2) Vínculo de irmãos no auto-cadastro era bloqueado pela RLS do usuário 'novo'.

-- ── 1. Membro atualiza o PRÓPRIO registro ────────────────────────────────
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename='acolitos_membros' and policyname='Membro atualiza proprio registro'
  ) then
    create policy "Membro atualiza proprio registro" on public.acolitos_membros
      for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

-- ── 2. Vincular irmãos no auto-cadastro (SECURITY DEFINER, restrito) ──────
-- O responsável (dono do 1º filho) pode vincular o grupo recém-cadastrado.
-- Só toca em linhas do próprio responsável ou sem dono (filhos sem login).
create or replace function public.acolitos_link_irmaos(p_ids uuid[])
returns void language plpgsql security definer set search_path = public as $$
declare n int := coalesce(array_length(p_ids,1),0);
begin
  if n < 2 then return; end if;
  if not exists (
    select 1 from public.acolitos_membros where id = any(p_ids) and user_id = auth.uid()
  ) then
    return; -- chamador precisa ser dono de ao menos um membro do grupo
  end if;
  for i in 1..n loop
    update public.acolitos_membros
      set tem_irmao_pastoral = true, escalar_com_irmao = true,
          irmao_id = p_ids[ case when i = 1 then 2 else 1 end ]
      where id = p_ids[i] and (user_id = auth.uid() or user_id is null);
  end loop;
end $$;
revoke execute on function public.acolitos_link_irmaos(uuid[]) from anon;
