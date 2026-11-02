-- Executar após142 em transação com ROLLBACK.
create temp table f142 as select
 (select id from acolitos_membros where nome like 'Mayara Vit%') alvo,
 (select user_id from acolitos_membros where nome like 'Franciele Cristina%') fran_user,
 (select user_id from pastoral_members where role='coord_admin' limit 1) coord_user;
grant select on f142 to authenticated;
select set_config('request.jwt.claims',json_build_object('sub',fran_user,'role','authenticated')::text,true) from f142;
set local role authenticated;
do $$declare f f142;n int;begin select * into f from f142;
 select count(*) into n from acolitos_disponibilidade where membro_id=f.alvo;assert n>0,'Equipe parou de ler disp';
 select count(*) into n from acolitos_habilitacoes where membro_id=f.alvo;assert n>0,'Equipe parou de ler hab';
 delete from acolitos_disponibilidade where membro_id=f.alvo;get diagnostics n=row_count;assert n=0,'Equipe apagou disp';
 update acolitos_habilitacoes set proficiencia='experiente' where membro_id=f.alvo;get diagnostics n=row_count;assert n=0,'Equipe alterou hab';
 begin insert into acolitos_disponibilidade(membro_id,dia,horario) values(f.alvo,'sabado','18h30');raise exception 'Equipe inseriu disp';exception when insufficient_privilege then null;end;
 begin insert into acolitos_habilitacoes(membro_id,funcao,proficiencia) values(f.alvo,'cruz','apto');raise exception 'Equipe inseriu hab';exception when insufficient_privilege then null;end;
 delete from acolitos_membros where id=f.alvo;get diagnostics n=row_count;assert n=0,'Equipe apagou ficha';
 begin insert into acolitos_membros(nome,status,nivel) values('Prova','em_integracao','cerimoniario_guardiao');raise exception 'Equipe criou com nível';exception when insufficient_privilege then null;end;
 begin insert into acolitos_membros(nome,status,user_id) values('Prova','em_integracao',f.coord_user);raise exception 'Equipe criou com conta alheia';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claims',json_build_object('sub',coord_user,'role','authenticated')::text,true) from f142;
set local role authenticated;
do $$declare f f142;n int;begin select * into f from f142;
 insert into acolitos_disponibilidade(membro_id,dia,horario) values(f.alvo,'sabado','18h30');
 insert into acolitos_habilitacoes(membro_id,funcao,proficiencia) values(f.alvo,'cruz','apto') on conflict (membro_id,funcao) do update set proficiencia='apto';
 delete from acolitos_disponibilidade where membro_id=f.alvo and horario='18h30';get diagnostics n=row_count;assert n>0,'Admin bloqueado';
end $$;
reset role;
select '142: equipe só lê disponibilidade e funções, não apaga nem cria ficha privilegiada; admin grava';
