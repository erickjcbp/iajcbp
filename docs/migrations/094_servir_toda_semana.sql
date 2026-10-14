alter table public.acolitos_membros add column if not exists servir_toda_semana boolean not null default false;
comment on column public.acolitos_membros.servir_toda_semana is 'Plano mensal: quatro escalas em semanas distintas, duas funções aptas e dois apoios.';
CREATE OR REPLACE FUNCTION public.acolitos_roster_substituicao()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_role text; v_result jsonb;
begin
  v_role := acolitos_get_role(auth.uid());
  if v_role is null or v_role not in ('coord_admin','subadmin','membro_equipe','cerimonario') then
    return jsonb_build_object('membros', '[]'::jsonb, 'habs', '[]'::jsonb);
  end if;
  select jsonb_build_object(
    'membros', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'nome', m.nome, 'apelido', m.apelido, 'foto_url', m.foto_url, 'nivel', m.nivel,
        'casa_id', m.casa_id,
        'comunidade', m.comunidade, 'pode_outras_comunidades', m.pode_outras_comunidades,
        'grupo_irmaos', m.grupo_irmaos, 'escalar_com_irmao', m.escalar_com_irmao,
        'data_nascimento', m.data_nascimento,
        'servir_toda_semana', m.servir_toda_semana,
        'suspenso_ate', m.suspenso_ate
      ) order by m.nome)
      from acolitos_membros m where m.status = 'ativo' and m.serve is true
    ), '[]'::jsonb),
    'habs', coalesce((
      select jsonb_agg(jsonb_build_object('membro_id', h.membro_id, 'funcao', h.funcao, 'proficiencia', h.proficiencia))
      from acolitos_habilitacoes h
    ), '[]'::jsonb)
  ) into v_result;
  return v_result;
end; $function$
;
