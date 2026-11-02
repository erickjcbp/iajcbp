-- Executar após137b em transação com ROLLBACK.
create temp table f137 as select
 (select id from acolitos_membros where nome like 'Adryan Miguel%') a,
 (select user_id from acolitos_membros where nome like 'Adryan Miguel%') a_user,
 (select id from acolitos_membros where nome like 'Marco Antonio Leite%') outro,
 (select user_id from pastoral_members where role='coord_admin' limit 1) coord,
 gen_random_uuid() irmao;
grant select on f137 to authenticated,anon,service_role;
delete from acolitos_crm where membro_id in((select a from f137),(select outro from f137));
-- membro comum
select set_config('request.jwt.claims',json_build_object('sub',a_user,'role','authenticated')::text,true) from f137;
set local role authenticated;
do $$declare f f137;n int;begin select * into f from f137;
 begin update acolitos_membros set eh_equipe=true where id=f.a;raise exception 'Editou eh_equipe';exception when insufficient_privilege then null;end;
 begin update acolitos_membros set permissoes='{tarefas}' where id=f.a;raise exception 'Editou permissoes';exception when insufficient_privilege then null;end;
 begin update acolitos_membros set setores='{liturgia}' where id=f.a;raise exception 'Editou setores';exception when insufficient_privilege then null;end;
 begin insert into acolitos_membros(nome,status,eh_equipe) values('Prova','em_integracao',true);raise exception 'Inseriu equipe';exception when insufficient_privilege then null;end;
 -- o que o membro faz de verdade continua funcionando
 update acolitos_membros set apelido='prova',foto_url='x',senha_provisoria=false,avisos='[]',nivel_visto='aspirante' where id=f.a;
 get diagnostics n=row_count;assert n=1,'Bloqueou edição legítima';
 -- CRM: etapa livre e membro alheio barrados
 begin insert into acolitos_crm(membro_id,etapa) values(f.a,'integrado');raise exception 'Entrou integrado';exception when insufficient_privilege then null;end;
 begin insert into acolitos_crm(membro_id,etapa) values(f.outro,'aprovacao_cadastro');raise exception 'Abriu CRM alheio';exception when insufficient_privilege then null;end;
 -- cadastro próprio e de irmão sem conta, como novos.html
 insert into acolitos_crm(membro_id,etapa) values(f.a,'aprovacao_cadastro');
 insert into acolitos_membros(id,nome,status) values(f.irmao,'Prova Irmão','em_integracao');
 insert into acolitos_crm(membro_id,etapa) values(f.irmao,'aprovacao_cadastro');
 begin truncate acolitos_crm;raise exception 'Autenticado truncou';exception when insufficient_privilege then null;end;
end $$;
reset role;
-- coordenação pelo app
select set_config('request.jwt.claims',json_build_object('sub',coord,'role','authenticated')::text,true) from f137;
set local role authenticated;
do $$declare f f137;n int;begin select * into f from f137;
 update acolitos_membros set eh_equipe=true,permissoes='{tarefas}',setores='{liturgia}' where id=f.outro;
 get diagnostics n=row_count;assert n=1,'Coordenação bloqueada';
 insert into acolitos_crm(membro_id,etapa) values(f.outro,'integracao');
end $$;
reset role;
-- serviço (API e robô)
select set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;
update acolitos_membros set eh_equipe=false,permissoes='{}' where id=(select outro from f137);
reset role;
-- anon
select set_config('request.jwt.claims','{"role":"anon"}',true);
set local role anon;
do $$declare n int;begin
 begin select count(*) into n from acolitos_membros;assert n=0,'Anon leu membros';exception when insufficient_privilege then null;end;
 begin update acolitos_membros set apelido='x';raise exception 'Anon com UPDATE';exception when insufficient_privilege then null;end;
 begin insert into acolitos_crm(membro_id,etapa) values(gen_random_uuid(),'aprovacao_cadastro');raise exception 'Anon com INSERT';exception when insufficient_privilege then null;end;
 begin delete from acolitos_crm;raise exception 'Anon com DELETE';exception when insufficient_privilege then null;end;
 begin truncate acolitos_membros;raise exception 'Anon truncou';exception when insufficient_privilege then null;end;
end $$;
reset role;
select '137b: campos, CRM e grants travados; membro, cadastro, coordenação e serviço seguem funcionando';
