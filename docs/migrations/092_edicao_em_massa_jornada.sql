-- Uma aplicação é uma transação; as mesmas permissões RLS das edições individuais.
create or replace function public.acolitos_jornada_editar_lote(p_membros uuid[], p_acao text, p_dados jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare v_ids uuid[]; v_total integer; v_nivel text; v_prof text; v_modo text; v_funcoes text[];
begin
  if coalesce(public.acolitos_get_role(auth.uid()),'') not in ('coord_admin','subadmin','membro_equipe') then
    raise exception 'Sem permissão para editar membros' using errcode='42501';
  end if;
  select array_agg(distinct x) into v_ids from unnest(p_membros) x where x is not null;
  v_total:=coalesce(cardinality(v_ids),0);
  if v_total=0 or v_total>500 then raise exception 'Selecione de 1 a 500 membros'; end if;
  -- Trava os membros na mesma ordem para serializar aplicações concorrentes.
  perform id from public.acolitos_membros where id=any(v_ids) and status='ativo' order by id for update;
  if (select count(*) from public.acolitos_membros where id=any(v_ids) and status='ativo')<>v_total then
    raise exception 'Um membro selecionado não está mais ativo ou acessível. Atualize a matriz';
  end if;
  if p_acao='nivel' then
    v_nivel:=p_dados->>'nivel';
    if v_nivel is null or not (v_nivel=any(array['aspirante','coroinha','acolito_aspirante','acolito_guardiao','acolito_sentinela','aspirante_cerimoniario','cerimoniario_aspirante','cerimoniario_guardiao','cerimoniario_magistral','cerimoniario_mor'])
      or exists(select 1 from public.acolitos_config c cross join lateral jsonb_array_elements(case when jsonb_typeof(c.valor)='array' then c.valor else '[]'::jsonb end) n where c.chave='niveis_full' and n->>'slug'=v_nivel)) then
      raise exception 'Nível inválido';
    end if;
    update public.acolitos_membros set nivel=v_nivel where id=any(v_ids);
  elsif p_acao='funcoes' then
    select array_agg(distinct x) into v_funcoes from jsonb_array_elements_text(p_dados->'funcoes') x;
    v_prof:=p_dados->>'proficiencia';
    if coalesce(cardinality(v_funcoes),0)=0 or exists(select 1 from unnest(v_funcoes) f where f<>all(array['apoio','cruz','vela','sineta','sinao','altar','turibulo','naveta','missal','cred_altar','cred_credencia','mitra','baculo'])) then raise exception 'Escolha funções válidas'; end if;
    if v_prof is null or v_prof<>all(array['nao_treinado','em_formacao','apto','experiente','referencia']) then raise exception 'Proficiência inválida'; end if;
    insert into public.acolitos_habilitacoes(membro_id,funcao,proficiencia,updated_at)
      select m,f,v_prof,now() from unnest(v_ids) m cross join unnest(v_funcoes) f
      on conflict(membro_id,funcao) do update set proficiencia=excluded.proficiencia,updated_at=excluded.updated_at;
  elsif p_acao='disponibilidade' then
    v_modo:=p_dados->>'modo';
    if v_modo is null or v_modo<>all(array['adicionar','remover','substituir','limpar']) then raise exception 'Modo inválido'; end if;
    if v_modo<>'limpar' then
      if jsonb_typeof(p_dados->'horarios') is distinct from 'array' or jsonb_array_length(p_dados->'horarios')=0 then raise exception 'Escolha ao menos um horário'; end if;
      if exists(select 1 from jsonb_array_elements(p_dados->'horarios') h where coalesce(h->>'dia','')<>all(array['sabado','domingo']) or coalesce(btrim(h->>'horario'),'')='' or length(h->>'horario')>30) then raise exception 'Horário inválido'; end if;
    end if;
    if v_modo in ('substituir','limpar') then
      delete from public.acolitos_disponibilidade where membro_id=any(v_ids);
    elsif v_modo='remover' then
      delete from public.acolitos_disponibilidade d where d.membro_id=any(v_ids)
        and exists(select 1 from jsonb_array_elements(p_dados->'horarios') h where h->>'dia'=d.dia and h->>'horario'=d.horario);
    end if;
    if v_modo in ('adicionar','substituir') then
      insert into public.acolitos_disponibilidade(membro_id,dia,horario)
        select m,h.dia,h.horario from unnest(v_ids) m cross join
          (select distinct x->>'dia' dia,x->>'horario' horario from jsonb_array_elements(p_dados->'horarios') x) h
        where not exists(select 1 from public.acolitos_disponibilidade d where d.membro_id=m and d.dia=h.dia and d.horario=h.horario);
    end if;
  else raise exception 'Ação inválida'; end if;
  return jsonb_build_object('ok',true,'total',v_total);
end $$;
revoke all on function public.acolitos_jornada_editar_lote(uuid[],text,jsonb) from public,anon;
grant execute on function public.acolitos_jornada_editar_lote(uuid[],text,jsonb) to authenticated;
