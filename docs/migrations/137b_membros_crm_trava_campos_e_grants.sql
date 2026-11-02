-- Fecha três buracos vistos na revisão da 135:
-- 1) o próprio membro editava eh_equipe, permissoes e setores (a RLS olha a linha, não a coluna);
-- 2) qualquer autenticado inseria no CRM, em qualquer etapa e para qualquer membro;
-- 3) anon tinha escrita nessas tabelas e TRUNCATE, que a RLS não barra.
-- anon mantém SELECT: políticas de outras tabelas leem acolitos_membros e, sem ele,
-- dariam erro em vez de zero linhas.
begin;
create or replace function public._acolitos_proteger_acesso()
returns trigger language plpgsql set search_path to 'public','pg_temp' as $$
declare restrito boolean;begin
 restrito:=current_user in('authenticated','anon');
 if restrito then
  restrito:=coalesce(public.acolitos_get_role(auth.uid()),'') not in('coord_admin','subadmin','membro_equipe');
 end if;
 if not restrito then return new;end if;
 if tg_op='INSERT' then
  if coalesce(new.eh_equipe,false) or coalesce(new.permissoes,'{}')<>'{}' or coalesce(new.setores,'{}')<>'{}' then
   raise exception 'Acesso e setores são definidos pela coordenação' using errcode='42501';
  end if;
 elsif new.eh_equipe is distinct from old.eh_equipe
    or new.permissoes is distinct from old.permissoes
    or new.setores is distinct from old.setores then
  raise exception 'Acesso e setores são definidos pela coordenação' using errcode='42501';
 end if;
 return new;
end $$;
revoke all on function public._acolitos_proteger_acesso() from public,anon,authenticated;
drop trigger if exists proteger_acesso on public.acolitos_membros;
create trigger proteger_acesso before insert or update on public.acolitos_membros
for each row execute function public._acolitos_proteger_acesso();

-- Security definer: irmão cadastrado junto não tem dono e a RLS o esconderia da política.
create or replace function public.acolitos_crm_pode_abrir(p_membro uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.acolitos_membros m
  where m.id=p_membro and m.status='em_integracao'
    and (m.user_id=auth.uid() or m.user_id is null))
$$;
revoke all on function public.acolitos_crm_pode_abrir(uuid) from public,anon;
grant execute on function public.acolitos_crm_pode_abrir(uuid) to authenticated;
drop policy if exists "Autenticado insere crm" on public.acolitos_crm;
create policy "Cadastro abre crm na etapa inicial" on public.acolitos_crm for insert to authenticated
with check (etapa='aprovacao_cadastro' and public.acolitos_crm_pode_abrir(membro_id));

revoke insert,update,delete,truncate,trigger,references on public.acolitos_membros,public.acolitos_crm from anon;
revoke truncate,trigger,references on public.acolitos_membros,public.acolitos_crm from authenticated;
commit;
