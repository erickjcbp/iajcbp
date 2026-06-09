-- 005 — Correções do code review da fila de ausências públicas (2026-06-09)
-- C1: acolitos_ausencias.motivo tem CHECK in ('doenca','viagem','familia','outro').
--     A aprovação pública grava motivo='outro' e dobra o texto livre/informante em observacao.
-- m1: escapar % e _ (e \) na busca para não virarem wildcards.

create or replace function public.acolitos_ausencia_pendente_decidir(p_ids uuid[], p_acao text)
returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare v_n int := 0;
begin
  if acolitos_get_role(auth.uid()) not in ('coord_admin','subadmin','membro_equipe','cerimonario') then
    return jsonb_build_object('erro','sem_permissao');
  end if;
  if p_acao not in ('aprovar','rejeitar') then return jsonb_build_object('erro','acao_invalida'); end if;
  if p_ids is null or array_length(p_ids,1) is null then return jsonb_build_object('erro','sem_itens'); end if;

  if p_acao = 'aprovar' then
    insert into public.acolitos_ausencias (membro_id, data, celebracao_id, motivo, observacao)
    select p.membro_id, p.data, null,
           'outro',
           nullif(concat_ws(' | ',
             case when p.informante_nome is not null then 'Informado por '||p.informante_nome else null end,
             p.informante_contato,
             nullif(btrim(p.motivo),'')
           ), '')
    from public.acolitos_ausencias_pendentes p
    where p.id = any(p_ids) and p.status='pendente'
      and not exists (
        select 1 from public.acolitos_ausencias a
        where a.membro_id = p.membro_id and a.data = p.data and a.celebracao_id is null
      );
    get diagnostics v_n = row_count;
    update public.acolitos_ausencias_pendentes
      set status='aprovada', revisado_por=auth.uid(), revisado_em=now()
      where id = any(p_ids) and status='pendente';
    return jsonb_build_object('ok', true, 'aprovadas', v_n);
  else
    update public.acolitos_ausencias_pendentes
      set status='rejeitada', revisado_por=auth.uid(), revisado_em=now()
      where id = any(p_ids) and status='pendente';
    get diagnostics v_n = row_count;
    return jsonb_build_object('ok', true, 'rejeitadas', v_n);
  end if;
end; $$;

create or replace function public.acolitos_ausencia_publica_buscar(p_q text)
returns jsonb language sql stable security definer set search_path to 'public'
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'nome', s.nome) order by s.nome), '[]'::jsonb)
  from (
    select id, nome
    from public.acolitos_membros
    where status='ativo'
      and length(btrim(coalesce(p_q,''))) >= 2
      and nome ilike '%' || replace(replace(replace(btrim(p_q),'\','\\'),'%','\%'),'_','\_') || '%'
    order by nome
    limit 20
  ) s;
$$;
