begin;
\i docs/migrations/122_medalhas_galeria_multiplas.sql
create temp table medals122_fixture as
with pessoas as(select id from public.acolitos_membros where status='ativo' and serve is true order by id limit 2),
medalhas as(select mi.id from public.acolitos_missoes mi where ativo and concede_badge and badge_label is not null and not exists(select 1 from pessoas p where public._acolitos_medalha_possui(p.id,mi.id)) order by mi.id limit 3)
select (select array_agg(id order by id) from pessoas) pessoas,(select array_agg(id order by id) from medalhas) medalhas,
(select pm.user_id from pastoral_members pm join pastoral_modules mo on mo.id=pm.module_id where mo.slug='acolitos' and pm.role='coord_admin' limit 1) admin,
(select pm.user_id from pastoral_members pm join pastoral_modules mo on mo.id=pm.module_id where mo.slug='acolitos' and pm.role='coroinha' limit 1) comum;
grant select on medals122_fixture to authenticated;
do $$begin
 assert (select cardinality(pessoas)=2 and cardinality(medalhas)=3 from medals122_fixture),'Fixture insuficiente';
 assert not has_function_privilege('anon','public.acolitos_medalhas_cartao(uuid)','EXECUTE'),'Anônimo acessa cartão';
 assert not has_function_privilege('anon','public.acolitos_medalhas_multiplas(uuid[],uuid[],text,boolean)','EXECUTE'),'Anônimo concede';
 perform set_config('request.jwt.claim.sub',(select admin::text from medals122_fixture),true);
end $$;
set local role authenticated;
do $$declare f record;r jsonb;begin
 select * into f from medals122_fixture;
 r:=public.acolitos_medalhas_multiplas(f.medalhas[1:2],f.pessoas,'',false);assert (r->>'novas')::integer=4,'Prévia não cruza medalhas e pessoas';
 r:=public.acolitos_medalhas_multiplas(f.medalhas[1:2],f.pessoas,'',true);assert (r->>'novas')::integer=4,'Lote múltiplo não concedeu';
 r:=public.acolitos_medalhas_multiplas(f.medalhas[1:2],f.pessoas,'OK',true);assert (r->>'novas')::integer=0 and (r->>'existentes')::integer=4,'Duplicou concessões';
 begin perform public.acolitos_medalhas_multiplas(array[f.medalhas[3],'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid],f.pessoas,'Teste atomicidade',true);raise exception 'Medalha inválida aceita';exception when raise_exception then if sqlerrm='Medalha inválida aceita' then raise;end if;end;
 begin perform public.acolitos_medalhas_multiplas(array_fill(f.medalhas[1],array[51]),f.pessoas,'',true);raise exception 'Limite ignorado';exception when raise_exception then if sqlerrm='Limite ignorado' then raise;end if;end;
end $$;
reset role;
do $$declare f record;begin
 select * into f from medals122_fixture;
 assert (select count(*)=4 from public.acolitos_medalhas_manuais where membro_id=any(f.pessoas) and missao_id=any(f.medalhas)),'Lote inválido deixou concessão parcial';
 assert (select bool_and(motivo='Reconhecimento da coordenação') from public.acolitos_medalhas_manuais where membro_id=any(f.pessoas) and missao_id=any(f.medalhas[1:2])),'Motivo padrão ausente';
 perform set_config('request.jwt.claim.sub',f.comum::text,true);
end $$;
set local role authenticated;
do $$declare f record;r jsonb;begin
 select * into f from medals122_fixture;
 r:=public.acolitos_medalhas_cartao(f.pessoas[1]);
 assert (select count(*)=2 from jsonb_array_elements(r) x where x->>'id'=any(array[f.medalhas[1]::text,f.medalhas[2]::text])),'Membro não vê medalhas conquistadas de outro';
 assert not exists(select 1 from jsonb_array_elements(r) x where x->>'id'=f.medalhas[3]::text),'Cartão mostrou medalha não conquistada';
 assert not exists(select 1 from jsonb_array_elements(r) x where x ? 'motivo' or x ? 'criterio' or x ? 'requisito' or x ? 'concedido_por'),'Cartão expõe dados privados';
 begin perform public.acolitos_medalhas_multiplas(f.medalhas[1:2],f.pessoas,'',true);raise exception 'Membro concedeu';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
select 'ENSAIO 122 REVERTIDO OK';
