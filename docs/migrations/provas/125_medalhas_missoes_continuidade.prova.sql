begin;
create temp table continuidade125_antes as select id,public._acolitos_medalha_detalhes(mi) detalhes from public.acolitos_missoes mi where ativo and concede_badge and validacao='automatica';
create temp table continuidade125_contagem as select (select count(*) from acolitos_medalhas_manuais) concessoes,(select count(*) from acolitos_missao_progresso) progressos;
\i docs/migrations/125_medalhas_missoes_continuidade.sql
\i docs/migrations/125_medalhas_missoes_continuidade.sql
do $$begin
assert (select count(*)=22 from acolitos_missoes where ativo and concede_badge and validacao<>'automatica' and length(badge_manutencao)>50),'Missões de continuidade ausentes';
assert (select count(distinct badge_manutencao)=22 from acolitos_missoes where ativo and concede_badge and validacao<>'automatica'),'Orientações genéricas repetidas';
assert not exists(select 1 from acolitos_missoes mi join continuidade125_antes a using(id) where a.detalhes is distinct from public._acolitos_medalha_detalhes(mi)),'Medalhas automáticas alteradas';
assert not exists(select 1 from acolitos_missoes mi where ativo and concede_badge and validacao<>'automatica' and (public._acolitos_medalha_detalhes(mi,true)->>'manutencao' is distinct from mi.badge_manutencao or public._acolitos_medalha_detalhes(mi,false)->>'manutencao' is distinct from mi.badge_manutencao)),'Concessão manual esconde missão de continuidade';
assert (select count(*) from acolitos_medalhas_manuais)=(select concessoes from continuidade125_contagem),'Migração concedeu medalhas';
assert (select count(*) from acolitos_missao_progresso)=(select progressos from continuidade125_contagem),'Migração criou tarefas';
assert not has_function_privilege('authenticated','_acolitos_medalha_detalhes(acolitos_missoes,boolean)','EXECUTE'),'Helper exposto';
end $$;
create temp table continuidade125_fixture as select m.id membro,mi.id medalha,mi.badge_manutencao texto,
(select pm.user_id from pastoral_members pm join pastoral_modules mo on mo.id=pm.module_id where mo.slug='acolitos' and pm.role='coord_admin' limit 1) admin
from acolitos_membros m cross join acolitos_missoes mi where m.status='ativo' and m.serve is true and mi.badge_label='Amigo de Todos' and not public._acolitos_medalha_possui(m.id,mi.id) limit 1;
grant select on continuidade125_fixture to authenticated;
do $$begin assert (select count(*)=1 from continuidade125_fixture),'Sem fixture';perform set_config('request.jwt.claim.sub',(select admin::text from continuidade125_fixture),true);end $$;
set local role authenticated;
do $$declare f record;r jsonb;begin
select * into f from continuidade125_fixture;
assert exists(select 1 from jsonb_array_elements(acolitos_medalhas_catalogo()) b where b->>'id'=f.medalha::text and b->>'manutencao'=f.texto),'Catálogo sem missão';
r:=acolitos_medalhas_multiplas(array[f.medalha],array[f.membro],'Prova revertida',true);assert (r->>'novas')::int=1,'Concessão de prova falhou';
assert exists(select 1 from jsonb_array_elements(acolitos_badges_membro(f.membro)) b where b->>'id'=f.medalha::text and (b->>'concessao_manual')::boolean and b->>'manutencao'=f.texto),'Coleção manual sem missão';
assert exists(select 1 from jsonb_array_elements(acolitos_medalhas_cartao(f.membro)) b where b->>'id'=f.medalha::text and b->>'manutencao'=f.texto),'Destaques sem missão';
end $$;
reset role;
rollback;
select 'ENSAIO 125 REVERTIDO OK';
