begin;
\i docs/migrations/124_medalhas_detalhes.sql
create temp table detalhes124_fixture as select m.id membro,
(select pm.user_id from pastoral_members pm join pastoral_modules mo on mo.id=pm.module_id where mo.slug='acolitos' and pm.role='coord_admin' limit 1) admin,
(select pm.user_id from pastoral_members pm join pastoral_modules mo on mo.id=pm.module_id where mo.slug='acolitos' and pm.role='coroinha' limit 1) comum
from acolitos_membros m where status='ativo' and serve is true order by id limit 1;
grant select on detalhes124_fixture to authenticated;
do $$begin
assert not has_function_privilege('anon','acolitos_medalhas_catalogo()','EXECUTE'),'Anônimo acessa catálogo';
assert not has_function_privilege('authenticated','_acolitos_medalha_detalhes(acolitos_missoes,boolean)','EXECUTE'),'Helper exposto';
assert not exists(select 1 from acolitos_missoes mi where ativo and concede_badge and badge_label is not null and (length(_acolitos_medalha_detalhes(mi)->>'desc')=0 or length(_acolitos_medalha_detalhes(mi)->>'requisito')=0 or length(_acolitos_medalha_detalhes(mi)->>'manutencao')=0)),'Detalhes incompletos';
assert (select _acolitos_medalha_detalhes(mi)->>'manutencao' like 'Manter a habilitação%' from acolitos_missoes mi where badge_label='Porta-Cruz'),'Aptidão sem condição';
assert (select _acolitos_medalha_detalhes(mi,true)->>'manutencao' like 'Concessão manual%' from acolitos_missoes mi where badge_label='Porta-Cruz'),'Manual aplicando perda automática';
assert (select _acolitos_medalha_detalhes(mi)->>'requisito' like 'Participar de uma ação solidária%' from acolitos_missoes mi where badge_label='Bom Samaritano'),'Missão manual genérica';
perform set_config('request.jwt.claim.sub',(select admin::text from detalhes124_fixture),true);
end $$;
set local role authenticated;
do $$declare r jsonb;b jsonb;begin
r:=public.acolitos_medalhas_catalogo();assert jsonb_array_length(r)=53,'Catálogo alterado';
for b in select * from jsonb_array_elements(r) loop assert b ?& array['desc','requisito','manutencao'],'Catálogo incompleto';assert not b ? 'criterio','Critério bruto exposto';end loop;
r:=public.acolitos_badges_membro((select membro from detalhes124_fixture));
for b in select * from jsonb_array_elements(r) loop assert b ?& array['desc','requisito','manutencao','ganho','concessao_manual'],'Coleção incompleta';end loop;
end $$;
reset role;
do $$begin perform set_config('request.jwt.claim.sub',(select comum::text from detalhes124_fixture),true);end $$;
set local role authenticated;
do $$declare b jsonb;begin
for b in select * from jsonb_array_elements(public.acolitos_medalhas_cartao((select membro from detalhes124_fixture))) loop
assert b ?& array['desc','requisito','manutencao'],'Cartão incompleto';assert not b ?| array['criterio','motivo','concedido_por','user_id'],'Cartão expõe dado privado';end loop;
end $$;
reset role;
rollback;
select 'ENSAIO 124 REVERTIDO OK';
