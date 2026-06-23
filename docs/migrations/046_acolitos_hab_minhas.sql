-- 046: RPC para o MEMBRO ler a própria grade de proficiência (todas as funções).
-- O membro não lê acolitos_habilitacoes direto (RLS). Esta RPC security-definer devolve
-- só as habilitações do próprio membro (ou de qualquer um, p/ coordenação) — mesmo padrão
-- de auth das demais (auth.uid() + acolitos_get_role + v_dono = membros.user_id = uid).
-- Usada no board "Minha Jornada" pra montar "Funções a desenvolver" (tudo abaixo de Apto).

create or replace function public.acolitos_hab_minhas(p_membro uuid)
returns table(funcao text, proficiencia text)
language plpgsql stable security definer set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_role text := acolitos_get_role(v_uid);
  v_dono boolean;
begin
  select (mm.user_id = v_uid) into v_dono from acolitos_membros mm where mm.id = p_membro;
  if coalesce(v_dono, false) = false
     and (v_role is null or v_role not in ('coord_admin','subadmin','membro_equipe','cerimonario')) then
    return; -- não autorizado → vazio
  end if;
  return query
    select h.funcao, h.proficiencia
    from acolitos_habilitacoes h
    where h.membro_id = p_membro;
end$function$;

revoke all on function public.acolitos_hab_minhas(uuid) from public, anon;
grant execute on function public.acolitos_hab_minhas(uuid) to authenticated;
