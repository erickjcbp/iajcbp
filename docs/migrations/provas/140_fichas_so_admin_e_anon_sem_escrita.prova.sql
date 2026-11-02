-- Executar após140 em transação com ROLLBACK.
create temp table f140 as select
 (select id from acolitos_membros where nome like 'Marco Antonio Leite%') outro,
 (select id from acolitos_membros where nome like 'Adryan Miguel%') integrando,
 (select id from acolitos_membros where nome like 'Franciele Cristina%') fran,
 (select user_id from acolitos_membros where nome like 'Franciele Cristina%') fran_user,
 (select id from acolitos_membros where nome like 'Michelly Keller%') mi,
 (select user_id from acolitos_membros where nome like 'Michelly Keller%') mi_user,
 (select m.id from acolitos_membros m join pastoral_members pm on pm.user_id=m.user_id where pm.role='coord_admin' limit 1) coord,
 (select user_id from pastoral_members where role='coord_admin' limit 1) coord_user;
grant select on f140 to authenticated;
update acolitos_crm set etapa='disponivel_escala' where membro_id=(select integrando from f140);
select set_config('request.jwt.claims',json_build_object('sub',fran_user,'role','authenticated')::text,true) from f140;
set local role authenticated;
do $$declare f f140;n int;begin select * into f from f140;
 begin update acolitos_membros set observacoes='x' where id=f.outro;raise exception 'Equipe editou observacoes';exception when insufficient_privilege then null;end;
 begin update acolitos_membros set nivel='coroinha' where id=f.outro;raise exception 'Equipe editou nivel';exception when insufficient_privilege then null;end;
 begin update acolitos_membros set status='afastado' where id=f.outro;raise exception 'Equipe editou status';exception when insufficient_privilege then null;end;
 begin update acolitos_membros set suspenso_em=now()::date where id=f.outro;raise exception 'Equipe suspendeu';exception when insufficient_privilege then null;end;
 begin update acolitos_membros set eh_equipe=true where id=f.outro;raise exception 'Equipe deu acesso';exception when insufficient_privilege then null;end;
 begin update acolitos_membros set permissoes=permissoes||'{config}' where id=f.fran;raise exception 'Equipe mudou o próprio acesso';exception when insufficient_privilege then null;end;
 begin update acolitos_membros set permissoes='{}' where id=f.coord;raise exception 'Equipe mexeu em admin';exception when insufficient_privilege then null;end;
 begin insert into acolitos_membros(nome,status) values('Prova','ativo');raise exception 'Equipe criou ficha ativa';exception when insufficient_privilege then null;end;
 update acolitos_membros set avisos=avisos||'["prova"]',no_grupo_whatsapp=true where id=f.outro;get diagnostics n=row_count;assert n=1,'Equipe perdeu recado e WhatsApp';
 update acolitos_membros set apelido='prova',telefone='19999999999' where id=f.fran;get diagnostics n=row_count;assert n=1,'Equipe perdeu a própria ficha';
 update acolitos_crm set etapa='integrado' where membro_id=f.integrando;
end $$;
reset role;
do $$begin
 assert (select status from acolitos_membros m,f140 where m.id=integrando)='ativo','Saída do CRM não ativou';
 assert (select pm.role from pastoral_members pm join acolitos_membros m on m.user_id=pm.user_id,f140 where m.id=integrando)='aspirante','Saída do CRM não liberou o app';
end $$;
select set_config('request.jwt.claims',json_build_object('sub',mi_user,'role','authenticated')::text,true) from f140;
set local role authenticated;
do $$declare f f140;begin select * into f from f140;
 begin update acolitos_membros set observacoes='x' where id=f.outro;raise exception 'Equipe sem permissão editou';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claims',json_build_object('sub',coord_user,'role','authenticated')::text,true) from f140;
set local role authenticated;
do $$declare f f140;n int;begin select * into f from f140;
 update acolitos_membros set observacoes='x',nivel='coroinha',status='afastado',eh_equipe=true,permissoes='{tarefas}' where id=f.outro;
 get diagnostics n=row_count;assert n=1,'Admin bloqueado';
end $$;
reset role;
do $$declare r record;begin
 for r in select tablename from pg_tables where schemaname='public' loop
  assert not has_table_privilege('anon','public.'||quote_ident(r.tablename),'UPDATE,DELETE,TRUNCATE,TRIGGER,REFERENCES'),'anon com escrita: '||r.tablename;
  assert r.tablename='access_requests' or not has_table_privilege('anon','public.'||quote_ident(r.tablename),'INSERT'),'anon com INSERT: '||r.tablename;
  assert not has_table_privilege('authenticated','public.'||quote_ident(r.tablename),'TRUNCATE,TRIGGER,REFERENCES'),'authenticated amplo: '||r.tablename;
 end loop;
 assert has_table_privilege('anon','public.access_requests','INSERT'),'Formulário público perdeu INSERT';
 assert has_table_privilege('anon','public.acolitos_membros','SELECT'),'anon perdeu SELECT';
end $$;
select '140: só admin edita fichas, equipe mantém recado e CRM, anon sem escrita OK';
