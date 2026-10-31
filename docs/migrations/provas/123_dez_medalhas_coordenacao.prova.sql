begin;
create temp table novas_medalhas_antes as select (select count(*) from public.acolitos_medalhas_manuais) manuais,(select count(*) from public.acolitos_missao_progresso) progressos,(select coalesce(sum(jsonb_array_length(coalesce(avisos,'[]'::jsonb))),0) from public.acolitos_membros) avisos;
\i docs/migrations/123_dez_medalhas_coordenacao.sql
\i docs/migrations/123_dez_medalhas_coordenacao.sql
do $$begin
 assert (select count(*)=10 from public.acolitos_missoes where id=any(array['ae02cb81-c38b-59ec-a46c-2b912e8f5436'::uuid,'0e6fa658-90e8-54cd-ab96-5cc4fe0091a7'::uuid,'a188d83c-07db-5c1f-867e-257b9be8940a'::uuid,'ffddc9fa-ceb9-57a1-a533-1cbff8aac446'::uuid,'2fbbe92b-3ce1-5bbc-82d9-7b03e985c5c5'::uuid,'64faf676-5d46-59c1-9b42-30e8d3fc7d21'::uuid,'e3e89247-dbe8-5d0c-9490-9fef78462626'::uuid,'501749da-47ba-524c-b843-3342317d9434'::uuid,'48c81656-d6db-5d56-a1f2-ca0301200696'::uuid,'a4bdff49-ed32-519a-b3af-55458abec35d'::uuid])),'Medalhas novas ausentes';
 assert (select bool_and(validacao='avaliada' and xp=0 and criterio is null and nivel_alvo is null and capitulo is null and obrigatoria=false and recorrente=false and concede_badge and ativo and badge_tier='ouro' and aplica_de='__coordenacao__') from public.acolitos_missoes where id=any(array['ae02cb81-c38b-59ec-a46c-2b912e8f5436'::uuid,'0e6fa658-90e8-54cd-ab96-5cc4fe0091a7'::uuid,'a188d83c-07db-5c1f-867e-257b9be8940a'::uuid,'ffddc9fa-ceb9-57a1-a533-1cbff8aac446'::uuid,'2fbbe92b-3ce1-5bbc-82d9-7b03e985c5c5'::uuid,'64faf676-5d46-59c1-9b42-30e8d3fc7d21'::uuid,'e3e89247-dbe8-5d0c-9490-9fef78462626'::uuid,'501749da-47ba-524c-b843-3342317d9434'::uuid,'48c81656-d6db-5d56-a1f2-ca0301200696'::uuid,'a4bdff49-ed32-519a-b3af-55458abec35d'::uuid])),'Configuração de reconhecimento manual inválida';
 assert not exists(select badge_label from public.acolitos_missoes where ativo and concede_badge group by badge_label having count(*)>1),'Catálogo duplicado';
 assert (select count(*) from public.acolitos_medalhas_manuais)=(select manuais from novas_medalhas_antes),'Concessão indevida';
 assert (select count(*) from public.acolitos_missao_progresso)=(select progressos from novas_medalhas_antes),'Progresso alterado';
 assert (select coalesce(sum(jsonb_array_length(coalesce(avisos,'[]'::jsonb))),0) from public.acolitos_membros)=(select avisos from novas_medalhas_antes),'Avisos enviados';
end $$;
create temp table novas123_fixture as select m.id membro,m.xp_avulso xp,(select count(*) from acolitos_missao_progresso where membro_id=m.id) progressos,
(select array_agg(id order by id) from acolitos_missoes where aplica_de='__coordenacao__') medalhas,
(select pm.user_id from pastoral_members pm join pastoral_modules mo on mo.id=pm.module_id where mo.slug='acolitos' and pm.role='coord_admin' limit 1) admin
from acolitos_membros m where status='ativo' and serve is true order by m.id limit 1;
grant select on novas123_fixture to authenticated;
do $$begin perform set_config('request.jwt.claim.sub',(select admin::text from novas123_fixture),true);end $$;
set local role authenticated;
do $$declare f record;r jsonb;begin
select * into f from novas123_fixture;
r:=public.acolitos_medalhas_multiplas(f.medalhas,array[f.membro],'Prova revertida',false);assert (r->>'novas')::int=10,'Prévia não inclui dez novas';
r:=public.acolitos_medalhas_multiplas(f.medalhas,array[f.membro],'Prova revertida',true);assert (r->>'novas')::int=10,'Concessão incompleta';
r:=public.acolitos_medalhas_multiplas(f.medalhas,array[f.membro],'Repetição revertida',true);assert (r->>'novas')::int=0 and (r->>'existentes')::int=10,'Duplicou';
assert (select count(*)=10 from jsonb_array_elements(public.acolitos_medalhas_cartao(f.membro)) b where b->>'id'=any(f.medalhas::text[])),'Cartão incompleto';
assert (select count(*)=10 from jsonb_array_elements(public.acolitos_badges_membro(f.membro)) b where b->>'id'=any(f.medalhas::text[]) and (b->>'ganho')::boolean and (b->>'concessao_manual')::boolean),'Coleção incompleta';
-- Mais de 50 entradas válidas são aceitas e deduplicadas; o novo teto é 100.
r:=public.acolitos_medalhas_multiplas(array_fill(f.medalhas[1],array[53]),array[f.membro],'',false);assert (r->>'total_medalhas')::int=1,'Deduplicação inválida';
begin perform public.acolitos_medalhas_multiplas(array_fill(f.medalhas[1],array[101]),array[f.membro],'',false);raise exception 'Limite ignorado';exception when raise_exception then if sqlerrm='Limite ignorado' then raise;end if;end;
end $$;
reset role;
do $$declare f record;begin select * into f from novas123_fixture;
assert (select xp_avulso is not distinct from f.xp from acolitos_membros where id=f.membro),'XP alterado';
assert (select count(*)=f.progressos from acolitos_missao_progresso where membro_id=f.membro),'Progresso alterado';
assert (select count(*)=10 from acolitos_medalhas_manuais where membro_id=f.membro and missao_id=any(f.medalhas)),'Auditoria incompleta';
end $$;
rollback;
select 'ENSAIO 123 REVERTIDO OK';
