begin;
do $$
declare v_m uuid; v_c uuid; v_f text; v_f2 text; v jsonb; v_before jsonb;
begin
  select jsonb_agg(to_jsonb(e) order by e.id) into v_before
  from public.acolitos_escalas e join public.acolitos_celebracoes c on c.id=e.celebracao_id
  where c.data=date '2026-10-12';
  select id into v_m from public.acolitos_membros where status='ativo' and serve limit 1;
  v:=public.acolitos_novena_publica_missas(v_m);
  if (select count(*) from jsonb_array_elements(v) x where x->>'data'='2026-10-12') <> 3
    then raise exception 'Esperava as três missas de 12/10'; end if;
  update public.acolitos_celebracoes set observacoes='Texto editado no app'
    where data=date '2026-10-12';
  v:=public.acolitos_novena_publica_missas(v_m);
  if (select count(*) from jsonb_array_elements(v) x where x->>'data'='2026-10-12') <> 3
    then raise exception 'Editar observações escondeu as missas'; end if;
  select m.id,c.id into v_m,v_c
    from public.acolitos_membros m
    cross join public.acolitos_celebracoes c
    where m.status='ativo' and m.serve and c.data=date '2026-10-12'
      and c.tipo='aparecida_12_outubro'
      and not exists(select 1 from public.acolitos_escalas e where e.celebracao_id=c.id and e.membro_id=m.id)
      and (select count(*) from public.acolitos_modelos mo
           join public.acolitos_habilitacoes h on h.membro_id=m.id and h.funcao=mo.funcao
           where mo.tipo=c.tipo and mo.comunidade=c.comunidade and mo.quantidade>
             (select count(*) from public.acolitos_escalas e where e.celebracao_id=c.id and e.funcao=mo.funcao and e.status='escalado')) >= 2
    limit 1;
  if v_m is null then raise exception 'Sem membro para testar'; end if;
  v:=public.acolitos_novena_publica_missas(v_m);
  select x->'funcoes'->0->>'funcao',x->'funcoes'->1->>'funcao' into v_f,v_f2
    from jsonb_array_elements(v) x where x->>'id'=v_c::text;
  v:=public.acolitos_novena_publica_enviar(v_m,jsonb_build_array(jsonb_build_object('celebracao_id',v_c,'funcao',v_f)));
  if not coalesce((v->>'ok')::boolean,false) then raise exception 'Inscrição falhou: %',v; end if;
  if not exists(select 1 from jsonb_array_elements(public.acolitos_novena_publica_missas(v_m)) x
                where x->>'id'=v_c::text and x->>'minha_funcao'=v_f)
    then raise exception 'Inscrição não apareceu'; end if;
  v:=public.acolitos_novena_publica_alterar(v_m,v_c,'trocar',v_f2);
  if not coalesce((v->>'ok')::boolean,false) then raise exception 'Troca falhou: %',v; end if;
  v:=public.acolitos_novena_publica_alterar(v_m,v_c,'sair',null);
  if not coalesce((v->>'ok')::boolean,false) then raise exception 'Saída falhou: %',v; end if;
  if v_before is distinct from (select jsonb_agg(to_jsonb(e) order by e.id)
       from public.acolitos_escalas e join public.acolitos_celebracoes c on c.id=e.celebracao_id
       where c.data=date '2026-10-12')
    then raise exception 'Inscrições originais foram modificadas'; end if;
end $$;
rollback;
