-- Executar após138 em transação com ROLLBACK.
create temp table f138 as select
 (select id from acolitos_membros where nome like 'Adryan Miguel%') a,
 (select user_id from acolitos_membros where nome like 'Adryan Miguel%') a_user,
 (select id from acolitos_membros where nome like 'Marco Antonio Leite%') outro,
 (select user_id from acolitos_membros where nome like 'Marco Antonio Leite%') outro_user,
 (select id from acolitos_membros where nome like 'Franciele Cristina%') fran,
 (select user_id from acolitos_membros where nome like 'Franciele Cristina%') fran_user,
 (select user_id from acolitos_membros where nome like 'Michelly Keller%') mi_user,
 (select id from acolitos_membros where nome like 'Michelly Keller%') mi,
 (select m.id from acolitos_membros m join pastoral_members pm on pm.user_id=m.user_id where pm.role='coord_admin' limit 1) coord,
 (select user_id from pastoral_members where role='coord_admin' limit 1) coord_user,
 gen_random_uuid() irmao,gen_random_uuid() alheio;
grant select on f138 to authenticated;
delete from acolitos_crm where membro_id in((select a from f138),(select outro from f138));
-- membro comum
select set_config('request.jwt.claims',json_build_object('sub',a_user,'role','authenticated')::text,true) from f138;
set local role authenticated;
do $$declare f f138;n int;begin select * into f from f138;
 begin update acolitos_membros set status='ativo' where id=f.a;raise exception 'status';exception when insufficient_privilege then null;end;
 begin update acolitos_membros set serve=false where id=f.a;raise exception 'serve';exception when insufficient_privilege then null;end;
 begin update acolitos_membros set suspenso_ate=null,suspenso_em=now()::date where id=f.a;raise exception 'suspenso';exception when insufficient_privilege then null;end;
 begin update acolitos_membros set xp_avulso=999 where id=f.a;raise exception 'xp';exception when insufficient_privilege then null;end;
 begin update acolitos_membros set grupo_irmaos=gen_random_uuid() where id=f.a;raise exception 'grupo';exception when insufficient_privilege then null;end;
 begin update acolitos_membros set cadastrado_por=f.a_user where id=f.a;raise exception 'cadastrado_por';exception when insufficient_privilege then null;end;
 begin update acolitos_membros set eh_equipe=true where id=f.a;raise exception 'equipe';exception when insufficient_privilege then null;end;
 update acolitos_membros set data_nascimento='2012-01-01',telefone='19999999999',telefone_whatsapp=true,comunidade='matriz',endereco='x',
  celular_recado='19999999999',responsavel='x',celular_mae='19999999999',responsavel_whatsapp=true,pode_outras_comunidades=false,
  necessidades_especiais='x',batismo=true,primeira_eucaristia=true,crisma=false,investido=false,tem_tunica=true,no_grupo_whatsapp=true,
  foto_url='x',apelido='x',avisos='[]',nivel_visto='aspirante',senha_provisoria=false where id=f.a;
 get diagnostics n=row_count;assert n=1,'Bloqueou cadastro legítimo';
 begin insert into acolitos_membros(nome,status) values('Prova','ativo');raise exception 'inseriu ativo';exception when insufficient_privilege then null;end;
 insert into acolitos_membros(id,nome,status) values(f.irmao,'Prova Irmão','em_integracao');
 insert into acolitos_crm(membro_id,etapa) values(f.a,'aprovacao_cadastro');
 insert into acolitos_crm(membro_id,etapa) values(f.irmao,'aprovacao_cadastro');
end $$;
reset role;
do $$begin assert (select cadastrado_por from acolitos_membros m,f138 where m.id=f138.irmao)=(select a_user from f138),'Dono não gravado';end $$;
insert into acolitos_membros(id,nome,status,cadastrado_por) select alheio,'Prova Alheio','em_integracao',outro_user from f138;
select set_config('request.jwt.claims',json_build_object('sub',a_user,'role','authenticated')::text,true) from f138;
set local role authenticated;
do $$declare f f138;begin select * into f from f138;
 begin insert into acolitos_crm(membro_id,etapa) values(f.alheio,'aprovacao_cadastro');raise exception 'CRM de ficha alheia';exception when insufficient_privilege then null;end;
end $$;
reset role;
-- coordenação
select set_config('request.jwt.claims',json_build_object('sub',coord_user,'role','authenticated')::text,true) from f138;
set local role authenticated;
do $$declare f f138;n int;begin select * into f from f138;
 update acolitos_membros set status='ativo',permissoes='{}' where id=f.outro;get diagnostics n=row_count;assert n=1,'Coordenação bloqueada';
end $$;
reset role;
select '138: lista de edição, dono da ficha e CRM OK; cadastro e coordenação funcionam; regras da equipe na prova 140';
