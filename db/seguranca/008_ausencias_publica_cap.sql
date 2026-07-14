-- 008 — Sobe o limite de celebrações por envio na ausência pública (2026-07-13)
-- Motivo: a nova UI permite marcar mês/semana inteiros; 30 era pouco.
-- Mantém TODAS as validações do 006 (ativos, data futura, dedupe, membros <= 20).

create or replace function public.acolitos_ausencia_publica_enviar(
  p_membros uuid[], p_celebracoes uuid[], p_motivo text, p_informante text, p_contato text)
returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare
  v_motivo text := nullif(left(btrim(coalesce(p_motivo,'')),200),'');
  v_inf    text := nullif(left(btrim(coalesce(p_informante,'')),200),'');
  v_con    text := nullif(left(btrim(coalesce(p_contato,'')),200),'');
  v_n int := 0;
begin
  if p_membros is null or array_length(p_membros,1) is null
     or p_celebracoes is null or array_length(p_celebracoes,1) is null then
    return jsonb_build_object('erro','sem_itens');
  end if;
  if v_inf is null or v_motivo is null or v_con is null then
    return jsonb_build_object('erro','campos_obrigatorios');
  end if;
  -- ANTES: p_celebracoes > 30. AGORA: 120.
  if array_length(p_membros,1) > 20 or array_length(p_celebracoes,1) > 120 then
    return jsonb_build_object('erro','muitos_itens');
  end if;

  insert into public.acolitos_ausencias_pendentes (membro_id, celebracao_id, data, motivo, informante_nome, informante_contato)
  select m.id, c.id, c.data, v_motivo, v_inf, v_con
  from unnest(p_membros) as mm(id)
  join public.acolitos_membros m on m.id = mm.id and m.status='ativo'
  cross join unnest(p_celebracoes) as cc(id)
  join public.acolitos_celebracoes c on c.id = cc.id and c.data >= current_date
  on conflict (membro_id, celebracao_id) where status='pendente' do nothing;

  get diagnostics v_n = row_count;
  if v_n = 0 then return jsonb_build_object('erro','sem_itens_validos'); end if;
  return jsonb_build_object('ok', true, 'criadas', v_n);
end; $$;

grant execute on function public.acolitos_ausencia_publica_enviar(uuid[],uuid[],text,text,text) to anon, authenticated;
