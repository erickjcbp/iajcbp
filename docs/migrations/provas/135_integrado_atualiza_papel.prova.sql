-- Executar após135 em transação com ROLLBACK.
do $$declare a uuid;b uuid;c uuid;papel text;begin
 assert not exists(select 1 from pastoral_members pm join acolitos_membros m on m.user_id=pm.user_id join acolitos_crm k on k.membro_id=m.id where pm.role='novo' and k.etapa='integrado'),'Integrado ficou em novo';
 assert (select count(*) from pastoral_members where role='novo')=5,'Correção alcançou quem segue em integração';
 assert (select count(*) from pastoral_members pm join acolitos_membros m on m.user_id=pm.user_id where m.status='ativo' and pm.role='novo')=0,'Ativo ficou em novo';
 assert (select pm.role from pastoral_members pm join acolitos_membros m on m.user_id=pm.user_id where m.nome like 'Mayara Vit%')='aspirante','Mayara';
 assert (select pm.role from pastoral_members pm join acolitos_membros m on m.user_id=pm.user_id where m.nome like 'Maria Eduarda Meirelles%')='acolito','Nível acólito não virou acolito';
 assert (select pm.role from pastoral_members pm join acolitos_membros m on m.user_id=pm.user_id where m.nome like 'Manuella Rodrigues%')='coroinha','Coroinha';
 select m.id into strict a from acolitos_membros m where m.nome like 'Adryan Miguel%';
 select m.id into strict b from acolitos_membros m where m.nome like 'Isabeli Souza%';
 select m.id into strict c from acolitos_membros m where m.nome like 'Marco Antonio Leite%';
 -- etapa intermediária não libera
 update acolitos_crm set etapa='disponivel_escala' where membro_id=a;
 assert (select pm.role from pastoral_members pm join acolitos_membros m on m.user_id=pm.user_id where m.id=a)='novo','Liberou antes de integrado';
 -- sem nível: gatilho anterior grava aspirante e o papel acompanha
 update acolitos_crm set etapa='integrado' where membro_id=a;
 assert (select nivel from acolitos_membros where id=a)='aspirante','Nível vazio não virou aspirante';
 assert (select pm.role from pastoral_members pm join acolitos_membros m on m.user_id=pm.user_id where m.id=a)='aspirante','Papel não acompanhou';
 assert exists(select 1 from acolitos_habilitacoes where membro_id=a and funcao='apoio' and proficiencia='apto'),'Perdeu Apoio apto';
 -- nível existente é respeitado
 update acolitos_membros set nivel='cerimoniario_guardiao' where id=b;
 update acolitos_crm set etapa='integrado' where membro_id=b;
 assert (select pm.role from pastoral_members pm join acolitos_membros m on m.user_id=pm.user_id where m.id=b)='cerimonario','Nível existente ignorado';
 -- equipe
 update acolitos_membros set eh_equipe=true where id=c;
 update acolitos_crm set etapa='integrado' where membro_id=c;
 assert (select pm.role from pastoral_members pm join acolitos_membros m on m.user_id=pm.user_id where m.id=c)='membro_equipe','Equipe';
 -- papel definido não é rebaixado
 update pastoral_members set role='coroinha' where user_id=(select user_id from acolitos_membros where id=a);
 update acolitos_crm set etapa='disponivel_escala' where membro_id=a;update acolitos_crm set etapa='integrado' where membro_id=a;
 assert (select pm.role from pastoral_members pm join acolitos_membros m on m.user_id=pm.user_id where m.id=a)='coroinha','Rebaixou papel definido';
 assert (select count(*) from information_schema.role_routine_grants where routine_name='acolitos_integrado_atualiza_papel' and grantee in('anon','authenticated','PUBLIC'))=0,'Função exposta';
end $$;
select '135: 8 corrigidos, 5 preservados, etapas, nível, equipe e não rebaixamento OK';
