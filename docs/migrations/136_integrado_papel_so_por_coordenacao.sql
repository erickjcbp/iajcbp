-- Endurece a 135. `eh_equipe` é editável pelo próprio membro e o CRM aceita INSERT de
-- qualquer autenticado: juntos, davam `membro_equipe` a quem pedisse. O gatilho agora só
-- deriva papel de membro a partir do nível (protegido) e só age para coordenação ou
-- serviço. Equipe continua concedida pela ficha do membro.
begin;
drop function if exists public.acolitos_papel_do_nivel(text,boolean);
create function public.acolitos_papel_do_nivel(p_nivel text)
returns text language sql immutable set search_path=public,pg_temp as $$
 select case
  when p_nivel like 'cerimoniario\_%' then 'cerimonario'
  when p_nivel like 'acolito\_%' or p_nivel='aspirante_cerimoniario' then 'acolito'
  when p_nivel='coroinha' then 'coroinha'
  else 'aspirante'
 end
$$;
create or replace function public.acolitos_integrado_atualiza_papel()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.etapa is distinct from 'integrado' then return new; end if;
 if auth.role() in ('authenticated','anon')
    and coalesce(public.acolitos_get_role(auth.uid()),'') not in ('coord_admin','subadmin','membro_equipe') then
  return new;
 end if;
 update public.pastoral_members pm
    set role=public.acolitos_papel_do_nivel(m.nivel)
   from public.acolitos_membros m,public.pastoral_modules mo
  where m.id=new.membro_id and pm.user_id=m.user_id and mo.id=pm.module_id
    and mo.slug='acolitos' and pm.role='novo';
 return new;
end $$;
revoke all on function public.acolitos_papel_do_nivel(text) from public,anon,authenticated;
revoke all on function public.acolitos_integrado_atualiza_papel() from public,anon,authenticated;
commit;
