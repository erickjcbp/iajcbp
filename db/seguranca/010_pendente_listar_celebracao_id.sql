-- 010 — acolitos_ausencia_pendente_listar() passa a devolver celebracao_id (2026-07-14)
-- Motivo: a auto-troca na aprovação (ausencias.html) precisa do FK exato da celebração.
-- Sem ele, o código resolvia a missa por (data,horario,comunidade), que NÃO é único garantido
-- (duas missas no mesmo horário/comunidade → troca na missa errada em silêncio). Aditivo/retrocompatível.

create or replace function public.acolitos_ausencia_pendente_listar()
returns jsonb language plpgsql stable security definer set search_path to 'public'
as $$
begin
  if acolitos_get_role(auth.uid()) not in ('coord_admin','subadmin','membro_equipe','cerimonario') then
    return jsonb_build_object('erro','sem_permissao');
  end if;
  return jsonb_build_object('pendentes', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id, 'membro_id', p.membro_id, 'nome', m.nome, 'data', p.data,
      'celebracao_id', p.celebracao_id,
      'horario', c.horario, 'comunidade', c.comunidade,
      'motivo', p.motivo, 'informante_nome', p.informante_nome,
      'informante_contato', p.informante_contato, 'created_at', p.created_at)
      order by p.created_at desc, m.nome)
    from public.acolitos_ausencias_pendentes p
    join public.acolitos_membros m on m.id = p.membro_id
    left join public.acolitos_celebracoes c on c.id = p.celebracao_id
    where p.status='pendente'
  ), '[]'::jsonb));
end; $$;
