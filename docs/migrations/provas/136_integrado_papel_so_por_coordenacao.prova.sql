-- Executar após136 em transação com ROLLBACK.
create temp table f136 as select
 (select id from acolitos_membros where nome like 'Adryan Miguel%') a,
 (select user_id from acolitos_membros where nome like 'Adryan Miguel%') a_user,
 (select id from acolitos_membros where nome like 'Isabeli Souza%') b,
 (select id from acolitos_membros where nome like 'Marco Antonio Leite%') c,
 (select user_id from pastoral_members where role='coord_admin' limit 1) coord;
grant select on f136 to authenticated;
delete from acolitos_crm where membro_id=(select a from f136);
-- ataque: o próprio membro marca equipe e se insere como integrado
select set_config('request.jwt.claims',json_build_object('sub',a_user,'role','authenticated')::text,true) from f136;
set local role authenticated;
do $$begin insert into acolitos_crm(membro_id,etapa) select a,'integrado' from f136;raise exception 'Membro se inseriu integrado';exception when insufficient_privilege then null;end $$;
reset role;
do $$begin assert (select pm.role from pastoral_members pm,f136 where pm.user_id=a_user)='novo','Membro se promoveu';end $$;
-- coordenação: libera, e eh_equipe não vira equipe
select set_config('request.jwt.claims',json_build_object('sub',coord,'role','authenticated')::text,true) from f136;
update acolitos_membros set eh_equipe=true where id=(select b from f136);
update acolitos_crm set etapa='integrado' where membro_id=(select b from f136);
do $$begin assert (select pm.role from pastoral_members pm join acolitos_membros m on m.user_id=pm.user_id,f136 where m.id=b)='aspirante','Coordenação não liberou ou virou equipe';end $$;
-- serviço (robô), sem usuário
select set_config('request.jwt.claims','{"role":"service_role"}',true);
update acolitos_crm set etapa='integrado' where membro_id=(select c from f136);
do $$begin assert (select pm.role from pastoral_members pm join acolitos_membros m on m.user_id=pm.user_id,f136 where m.id=c)='aspirante','Serviço não liberou';end $$;
select '136: ataque barrado, coordenação e serviço liberam, eh_equipe não promove';
