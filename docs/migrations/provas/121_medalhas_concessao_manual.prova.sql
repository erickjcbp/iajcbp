begin;
\i docs/migrations/121_medalhas_concessao_manual.sql
create temp table medalhas_prova as
 select (select pm.user_id from pastoral_members pm join pastoral_modules mo on mo.id=pm.module_id where mo.slug='acolitos' and pm.role='coord_admin' limit 1) admin,
 m.id membro,m.user_id usuario,mi.id medalha,m.avisos avisos,m.xp_avulso xp,
 (select count(*) from acolitos_missao_progresso where membro_id=m.id) progressos
 from acolitos_membros m cross join acolitos_missoes mi
 where m.status='ativo' and m.serve is true and m.user_id is not null and mi.ativo and mi.concede_badge and mi.badge_label is not null
 and not public._acolitos_medalha_possui(m.id,mi.id) limit 1;
grant select on medalhas_prova to authenticated;
do $$begin
 assert (select count(*)=1 from medalhas_prova),'Fixture não encontrado';
 assert not has_table_privilege('authenticated','public.acolitos_medalhas_manuais','SELECT'),'Tabela exposta';
 assert not has_function_privilege('authenticated','public._acolitos_medalha_possui(uuid,uuid)','EXECUTE'),'Helper exposto';
 assert not has_function_privilege('anon','public.acolitos_medalhas_lote(uuid,uuid[],text,boolean)','EXECUTE'),'Anônimo executa lote';
end $$;
do $$begin perform set_config('request.jwt.claim.sub',(select admin::text from medalhas_prova),true);end $$;
set local role authenticated;
do $$declare f record; r jsonb;begin
 select * into f from medalhas_prova;
 begin perform public.acolitos_medalhas_lote(f.medalha,array_fill(f.membro,array[501]),'Teste limite',true);raise exception 'Limite excedido aceito'; exception when raise_exception then if sqlerrm='Limite excedido aceito' then raise;end if;end;
 begin perform public.acolitos_medalhas_lote(f.medalha,array[f.membro,null::uuid],'Teste nulo',true);raise exception 'Membro nulo aceito'; exception when raise_exception then if sqlerrm='Membro nulo aceito' then raise;end if;end;
 r:=public.acolitos_medalhas_lote(f.medalha,array[f.membro],'',false);
 assert (r->>'novas')::int=1 and (r->>'confirmado')::boolean=false,'Prévia inválida';
 begin perform public.acolitos_medalhas_lote(f.medalha,array[f.membro],'',true);raise exception 'Motivo vazio aceito'; exception when raise_exception then if sqlerrm='Motivo vazio aceito' then raise;end if;end;
 begin perform public.acolitos_medalhas_lote(f.medalha,array[f.membro,'00000000-0000-0000-0000-000000000000'::uuid],'Teste transação',true);raise exception 'Lote inválido aceito'; exception when raise_exception then if sqlerrm='Lote inválido aceito' then raise;end if;end;
 r:=public.acolitos_medalhas_lote(f.medalha,array[f.membro],'Prova revertida, nenhuma concessão real',true);
 assert (r->>'novas')::int=1,'Não concedeu';
 assert exists(select 1 from jsonb_array_elements(public.acolitos_badges_membro(f.membro)) b where b->>'id'=f.medalha::text and (b->>'ganho')::boolean and (b->>'concessao_manual')::boolean),'Não aparece no mural';
 r:=public.acolitos_medalhas_lote(f.medalha,array[f.membro],'Repetição da prova',true);
 assert (r->>'novas')::int=0 and (r->>'existentes')::int=1,'Duplicou';
 assert jsonb_array_length(public.acolitos_medalhas_historico(f.medalha))>=1,'Sem histórico';
end $$;
reset role;
do $$declare f record;begin
 select * into f from medalhas_prova;
 assert (select xp_avulso is not distinct from f.xp from acolitos_membros where id=f.membro),'XP alterado';
 assert (select count(*)=f.progressos from acolitos_missao_progresso where membro_id=f.membro),'Missões alteradas';
 assert (select count(*)=1 from acolitos_medalhas_manuais where membro_id=f.membro and missao_id=f.medalha),'Auditoria inválida';
 assert (select jsonb_array_length(avisos)=jsonb_array_length(coalesce(f.avisos,'[]'::jsonb))+1 from acolitos_membros where id=f.membro),'Aviso duplicado';
 assert (select avisos->-1->>'icone' is not null from acolitos_membros where id=f.membro),'Aviso sem arte';
end $$;
do $$begin perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000000',true);end $$;
set local role authenticated;
do $$declare f record;begin
 select * into f from medalhas_prova;
 begin perform public.acolitos_medalhas_lote(f.medalha,array[f.membro],'Fraude',true);raise exception 'Intruso concedeu';exception when insufficient_privilege then null;end;
 begin perform public.acolitos_medalhas_historico(f.medalha);raise exception 'Intruso leu histórico';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$declare uid uuid;begin
 select pm.user_id into uid from public.pastoral_members pm join public.pastoral_modules mo on mo.id=pm.module_id where mo.slug='acolitos' and pm.role='coroinha' limit 1;
 assert uid is not null,'Sem fixture de membro comum';perform set_config('request.jwt.claim.sub',uid::text,true);
end $$;
set local role authenticated;
do $$declare f record;begin
 select * into f from medalhas_prova;
 assert jsonb_array_length(public.acolitos_medalhas_catalogo())>0,'Catálogo não acessível ao membro';
 begin perform public.acolitos_medalhas_lote(f.medalha,array[f.membro],'Tentativa indevida',true);raise exception 'Membro concedeu';exception when insufficient_privilege then null;end;
 begin perform public._acolitos_medalha_possui(f.membro,f.medalha);raise exception 'Membro acessou helper';exception when insufficient_privilege then null;end;
 begin perform 1 from public.acolitos_medalhas_manuais;raise exception 'Membro leu auditoria';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
select 'ENSAIO REVERTIDO OK';
