-- Cartão autenticado mostra somente as medalhas conquistadas, sem critérios/dados pessoais.
create or replace function public.acolitos_medalhas_cartao(p_membro uuid) returns jsonb
language plpgsql stable security definer set search_path='public' as $$
begin
 if auth.uid() is null or public.acolitos_get_role(auth.uid()) is null then raise exception 'Sem acesso' using errcode='42501';end if;
 if not exists(select 1 from public.acolitos_membros where id=p_membro and status='ativo') then return '[]'::jsonb;end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',mi.id,'label',mi.badge_label,'icone',mi.badge_icone,'tier',mi.badge_tier,'nivel',mi.nivel_alvo,'desc',mi.badge_desc) order by mi.badge_label)
 from public.acolitos_missoes mi where mi.ativo and mi.concede_badge and mi.badge_label is not null and public._acolitos_medalha_possui(p_membro,mi.id)),'[]'::jsonb);
end $$;
revoke all on function public.acolitos_medalhas_cartao(uuid) from public,anon,authenticated;
grant execute on function public.acolitos_medalhas_cartao(uuid) to authenticated;

-- Uma transação para várias medalhas x vários membros. Preserva a RPC anterior.
create or replace function public.acolitos_medalhas_multiplas(p_medalhas uuid[],p_membros uuid[],p_motivo text default '',p_confirmar boolean default false) returns jsonb
language plpgsql security definer set search_path='public' as $$
declare medalhas uuid[];membros uuid[];medalha uuid;r jsonb;itens jsonb:='[]'::jsonb;novas integer:=0;existentes integer:=0;motivo text;
begin
 if coalesce(public.acolitos_get_role(auth.uid()),'') not in ('coord_admin','subadmin') then raise exception 'Só a coordenação pode conceder medalhas' using errcode='42501';end if;
 if p_confirmar is null then raise exception 'Confirmação inválida';end if;
 if coalesce(cardinality(p_medalhas),0)=0 or cardinality(p_medalhas)>50 or array_position(p_medalhas,null) is not null then raise exception 'Selecione de 1 a 50 medalhas';end if;
 if coalesce(cardinality(p_membros),0)=0 or cardinality(p_membros)>500 or array_position(p_membros,null) is not null then raise exception 'Selecione de 1 a 500 membros';end if;
 if length(coalesce(p_motivo,''))>500 then raise exception 'Motivo com no máximo 500 caracteres';end if;
 select array_agg(distinct x order by x) into medalhas from unnest(p_medalhas) x;
 select array_agg(distinct x order by x) into membros from unnest(p_membros) x;
 motivo:=coalesce(nullif(btrim(p_motivo),''),'Reconhecimento da coordenação');
 if length(motivo)<3 then motivo:='Reconhecimento: '||motivo;end if;
 -- Adquire todos os locks antes das escritas para evitar ordem invertida entre lotes.
 perform pg_advisory_xact_lock(hashtextextended('missao:'||b::text||':'||m::text,0)) from unnest(medalhas) b cross join unnest(membros) m order by b,m;
 foreach medalha in array medalhas loop
  r:=public.acolitos_medalhas_lote(medalha,membros,motivo,p_confirmar);
  novas:=novas+(r->>'novas')::integer;existentes:=existentes+(r->>'existentes')::integer;
  itens:=itens||jsonb_build_array(jsonb_build_object('medalha_id',medalha,'label',(select badge_label from public.acolitos_missoes where id=medalha),'novas',(r->>'novas')::integer,'existentes',(r->>'existentes')::integer,'membros',r->'membros'));
 end loop;
 return jsonb_build_object('ok',true,'confirmado',p_confirmar,'total_membros',cardinality(membros),'total_medalhas',cardinality(medalhas),'novas',novas,'existentes',existentes,'itens',itens);
end $$;
revoke all on function public.acolitos_medalhas_multiplas(uuid[],uuid[],text,boolean) from public,anon,authenticated;
grant execute on function public.acolitos_medalhas_multiplas(uuid[],uuid[],text,boolean) to authenticated;
notify pgrst,'reload schema';
