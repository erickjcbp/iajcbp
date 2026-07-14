-- 009 — Auto-troca por ausência: grava a troca de forma atômica e cobre o cerimonário (2026-07-14)
-- Contexto: a RLS de acolitos_escalas só deixa coord_admin/subadmin/membro_equipe fazer INSERT/DELETE
-- ("Equipe gerencia escalas" = ALL). O cerimonário PODE aprovar ausência mas NÃO pode inserir a linha
-- do substituto → a troca ficaria pela metade. Estas RPCs SECURITY DEFINER gravam a troca com autoridade,
-- de forma atômica, cobrindo também o cerimonário. A ESCOLHA do substituto continua no motor JS
-- (gerador-substituto.js) — estas funções só PERSISTEM o que o JS decidiu.

-- 1) Roster ganha data_nascimento (necessário p/ o kit Santo Antônio no motor; aditivo/retrocompatível)
create or replace function public.acolitos_roster_substituicao()
returns jsonb language plpgsql stable security definer set search_path to 'public'
as $$
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
        'comunidade', m.comunidade, 'pode_outras_comunidades', m.pode_outras_comunidades,
        'grupo_irmaos', m.grupo_irmaos, 'escalar_com_irmao', m.escalar_com_irmao,
        'data_nascimento', m.data_nascimento
      ) order by m.nome)
      from acolitos_membros m where m.status = 'ativo'
    ), '[]'::jsonb),
    'habs', coalesce((
      select jsonb_agg(jsonb_build_object('membro_id', h.membro_id, 'funcao', h.funcao, 'proficiencia', h.proficiencia))
      from acolitos_habilitacoes h
    ), '[]'::jsonb)
  ) into v_result;
  return v_result;
end; $$;

-- 2) Aplicar a troca (atômica). O motor JS escolhe p_novo_membro_id (ou null = sem substituto).
--    Acha a linha ativa do ausente na celebração, marca 'substituido' (+substituto_id) e insere o substituto.
create or replace function public.acolitos_aplicar_troca_escala(
  p_celebracao_id uuid, p_membro_ausente_id uuid, p_novo_membro_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare v_role text; v_alvo_id uuid; v_funcao text; v_novo_id uuid;
begin
  v_role := acolitos_get_role(auth.uid());
  if v_role is null or v_role not in ('coord_admin','subadmin','membro_equipe','cerimonario') then
    return jsonb_build_object('erro','sem_permissao');
  end if;
  select id, funcao into v_alvo_id, v_funcao
  from public.acolitos_escalas
  where celebracao_id = p_celebracao_id and membro_id = p_membro_ausente_id
    and status in ('escalado','presente','atrasado')
  order by created_at limit 1;
  if v_alvo_id is null then
    return jsonb_build_object('ok', true, 'nao_escalado', true);   -- não estava escalado (ativo) nessa missa
  end if;
  update public.acolitos_escalas
    set status='substituido', substituto_id = p_novo_membro_id
    where id = v_alvo_id;
  if p_novo_membro_id is not null then
    insert into public.acolitos_escalas (celebracao_id, membro_id, funcao, status, created_by)
    values (p_celebracao_id, p_novo_membro_id, v_funcao, 'escalado', auth.uid())
    returning id into v_novo_id;
  end if;
  return jsonb_build_object('ok', true, 'funcao', v_funcao, 'alvo_id', v_alvo_id, 'novo_escala_id', v_novo_id);
end; $$;

-- 3) Desfazer a troca: apaga a linha do substituto e limpa o substituto_id do ausente (vaga vazia).
--    Mantém o ausente como 'substituido' (ele segue fora). Não mexe na ausência.
create or replace function public.acolitos_desfazer_troca_escala(
  p_alvo_id uuid, p_novo_escala_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare v_role text;
begin
  v_role := acolitos_get_role(auth.uid());
  if v_role is null or v_role not in ('coord_admin','subadmin','membro_equipe','cerimonario') then
    return jsonb_build_object('erro','sem_permissao');
  end if;
  if p_novo_escala_id is not null then
    delete from public.acolitos_escalas where id = p_novo_escala_id;
  end if;
  update public.acolitos_escalas set substituto_id = null where id = p_alvo_id;
  return jsonb_build_object('ok', true);
end; $$;

-- 4) Grants: só autenticados (internas). Revoga de public.
revoke execute on function public.acolitos_aplicar_troca_escala(uuid,uuid,uuid) from public;
revoke execute on function public.acolitos_desfazer_troca_escala(uuid,uuid) from public;
grant execute on function public.acolitos_aplicar_troca_escala(uuid,uuid,uuid) to authenticated;
grant execute on function public.acolitos_desfazer_troca_escala(uuid,uuid) to authenticated;
