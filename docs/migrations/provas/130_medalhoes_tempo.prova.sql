-- Executar após a 130, sempre dentro de BEGIN / ROLLBACK.
do $$begin
 assert to_regclass('public.acolitos_tempo_config') is not null,'Configuração dos marcos ausente';
end $$;
create temp table tempo130_fixture as select m.id,m.user_id,m.xp_avulso,m.nivel,coalesce((select sum(xp_ganho) from acolitos_missao_progresso where membro_id=m.id and status='concluida'),0) xp,
 (select user_id from pastoral_members where role='coord_admin' and user_id is not null limit 1) admin
 from acolitos_membros m where m.status='ativo' and m.serve and m.user_id is not null limit 1;
select set_config('request.jwt.claim.sub',(select user_id::text from tempo130_fixture),true);
update acolitos_tempo_config set ativo=true where id;
delete from acolitos_medalhas_manuais where membro_id=(select id from tempo130_fixture) and missao_id in(select id from acolitos_missoes where criterio->>'fonte' in('tenure','tenure_nivel'));
delete from acolitos_badge_ganhos where membro_id=(select id from tempo130_fixture) and missao_id in(select id from acolitos_missoes where criterio->>'fonte' in('tenure','tenure_nivel'));
delete from acolitos_missao_progresso where membro_id=(select id from tempo130_fixture) and missao_id in(select id from acolitos_missoes where criterio->>'fonte' in('tenure','tenure_nivel'));
update acolitos_membros set servindo_desde=((now() at time zone 'America/Sao_Paulo')::date-interval '3 years 1 month')::date,nivel='coroinha',avisos='[]'::jsonb where id=(select id from tempo130_fixture);
do $$declare f record;r jsonb;delta integer;begin
 select * into f from tempo130_fixture;
 r:=acolitos_tempo_processar(f.id);assert (r->>'novas')::int=3,'Três primeiros marcos não concedidos';
 select coalesce(sum(xp_ganho),0) into delta from acolitos_missao_progresso p join acolitos_missoes mi on mi.id=p.missao_id where p.membro_id=f.id and mi.criterio->>'fonte' in('tenure','tenure_nivel');
 assert delta=120,'XP dos três marcos incorreto';assert (select xp_avulso from acolitos_membros where id=f.id) is not distinct from f.xp_avulso,'XP avulso alterado';
 assert (select nivel from acolitos_membros where id=f.id)='coroinha','Promoveu nível';
 assert (select jsonb_array_length(avisos) from acolitos_membros where id=f.id)=3,'Avisos duplicados ou ausentes';
 assert not exists(select 1 from acolitos_badge_ganhos g join acolitos_missoes mi on mi.id=g.missao_id join acolitos_membros m on m.id=g.membro_id where g.membro_id=f.id and mi.criterio->>'fonte'='tenure' and g.ganho_em is distinct from ((m.servindo_desde+make_interval(months=>(mi.criterio->>'meses')::int))::timestamp at time zone 'America/Sao_Paulo')),'Data retroativa incorreta';
 r:=acolitos_tempo_processar(f.id);assert (r->>'novas')::int=0,'Repetiu concessão';
 perform acolitos_medalhas_avaliar(f.id);perform acolitos_badges_registrar(f.id);
 assert (select count(*) from jsonb_array_elements((select avisos from acolitos_membros where id=f.id)) a where a->>'tempo_marco' is not null)=3,'Avaliador duplicou aviso de tempo';
 assert ((acolitos_tempo_marcos_lote(array[f.id])->f.id::text)->>'marco')='3','Avatar não recebe maior marco';
 update acolitos_membros set servindo_desde=((now() at time zone 'America/Sao_Paulo')::date-interval '5 years 1 month')::date where id=f.id;
 r:=acolitos_tempo_processar(f.id);assert (r->>'novas')::int=1,'Coroinha recebeu Veterano ou faltou ônix';
 update acolitos_membros set nivel='acolito_sentinela' where id=f.id;
 r:=acolitos_tempo_processar(f.id);assert (r->>'novas')::int=1,'Sentinela não recebeu Veterano';
 assert (select sum(p.xp_ganho) from acolitos_missao_progresso p join acolitos_missoes mi on mi.id=p.missao_id where membro_id=f.id and mi.criterio->>'fonte' in('tenure','tenure_nivel'))=290,'Total de XP incorreto';
 assert ((acolitos_tempo_marcos_lote(array[f.id])->f.id::text)->>'marco')='V','Avatar não prioriza Veterano';
 assert not has_function_privilege('anon','public.acolitos_tempo_processar(uuid)','execute'),'Anon executa processador';
 assert not has_function_privilege('authenticated','public.acolitos_tempo_processar(uuid)','execute'),'Autenticado executa lote global';
 assert not has_function_privilege('authenticated','public._acolitos_tempo_conceder(uuid,uuid,timestamptz,boolean)','execute'),'Helper de XP exposto';
end $$;
-- Data desconhecida/importação e data futura não rendem medalhões automáticos.
do $$declare f record;c jsonb;begin
 select * into f from tempo130_fixture;c:='{"fonte":"tenure","meses":12}';
 update acolitos_membros set servindo_desde=null,created_at='2020-06-01' where id=f.id;
 assert not coalesce(acolitos_badge_cumpre(f.id,c),false),'Usou cadastro como início real';
 update acolitos_membros set servindo_desde=((now() at time zone 'America/Sao_Paulo')::date+1) where id=f.id;
 assert not coalesce(acolitos_badge_cumpre(f.id,c),false),'Data futura concedeu marco';
end $$;
-- Concessão manual continua possível e não duplica XP quando o automático passar a cumprir.
select set_config('request.jwt.claim.sub',(select admin::text from tempo130_fixture),true);
do $$declare f record;mi uuid;r jsonb;begin
 select * into f from tempo130_fixture;
 select id into mi from acolitos_missoes where badge_icone='tempo_altar';
 delete from acolitos_missao_progresso where membro_id=f.id and missao_id=mi;
 delete from acolitos_badge_ganhos where membro_id=f.id and missao_id=mi;
 r:=acolitos_medalhas_multiplas(array[mi],array[f.id],'Prova com rollback',true);
 assert (r->>'novas')::int=1,'Não concedeu marco manualmente';
 assert (select xp_ganho from acolitos_missao_progresso where membro_id=f.id and missao_id=mi)=70,'Manual de tempo não creditou XP';
 update acolitos_membros set servindo_desde=((now() at time zone 'America/Sao_Paulo')::date-interval '6 years')::date where id=f.id;
 r:=acolitos_tempo_processar(f.id);assert (r->>'novas')::int=0,'Automático repetiu concessão manual';
 assert (select count(*) from acolitos_badge_ganhos where membro_id=f.id and missao_id=mi)=1,'Duplicou registro de data';
end $$;
select '130: marcos, XP, datas, avisos, níveis, manual e permissões OK';
-- Exercita os papéis reais do PostgREST, não apenas claims sob postgres.
select set_config('request.jwt.claim.role','authenticated',true);
grant select on tempo130_fixture to authenticated;
select set_config('request.jwt.claim.sub',(select user_id::text from tempo130_fixture),true);
set local role authenticated;
do $$declare f record;r jsonb;begin
 select * into f from tempo130_fixture;
 r:=public.acolitos_tempo_sincronizar(f.id);assert not(r?'erro'),'Titular não sincroniza';
 r:=public.acolitos_tempo_sincronizar('00000000-0000-0000-0000-000000000000');assert r->>'erro'='sem_permissao','Sincroniza outro membro';
 assert jsonb_typeof(public.acolitos_tempo_marcos_lote(array[f.id]))='object','Membro não consulta avatar';
 begin perform public.acolitos_tempo_processar();raise exception 'Processador global exposto';exception when insufficient_privilege then null;end;
 begin perform public._acolitos_tempo_conceder(f.id,'00000000-0000-0000-0000-000000000000',now(),true);raise exception 'Helper exposto';exception when insufficient_privilege then null;end;
 begin perform public.acolitos_tempo_marcos_lote(array_fill(f.id,array[501]));raise exception 'Sem limite de lote';exception when raise_exception then assert sqlerrm='Lista de membros inválida';end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000000',true);
set local role authenticated;
do $$begin
 begin perform public.acolitos_tempo_marcos_lote('{}'::uuid[]);raise exception 'Conta sem vínculo consulta avatar';exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role anon;
do $$begin
 begin perform public.acolitos_tempo_marcos_lote('{}'::uuid[]);raise exception 'Anon consulta avatar';exception when insufficient_privilege then null;end;
 begin perform public.acolitos_tempo_sincronizar('00000000-0000-0000-0000-000000000000');raise exception 'Anon sincroniza';exception when insufficient_privilege then null;end;
end $$;
reset role;
select '130: titular, terceiro, sem vínculo e anon testados com papéis reais OK';
-- Dados que geram XP precisam de origem confiável, inclusive INSERT sem login do filho.
create temp table tempo130_comum as select id,user_id from acolitos_membros where user_id is not null and status='ativo' and serve is true and coalesce(acolitos_get_role(user_id),'') not in('coord_admin','subadmin','membro_equipe') limit 1;
grant select on tempo130_comum to authenticated;
select set_config('request.jwt.claim.sub',(select user_id::text from tempo130_comum),true);
set local role authenticated;
do $$declare f record;novo uuid;begin
 select * into strict f from tempo130_comum;
 begin update public.acolitos_membros set servindo_desde='2000-01-01' where id=f.id;raise exception 'Membro adulterou tempo para ganhar XP';exception when insufficient_privilege then null;end;
 begin update public.acolitos_membros set nivel='acolito_sentinela' where id=f.id;raise exception 'Membro adulterou nível para ganhar Veterano';exception when insufficient_privilege then null;end;
 begin insert into public.acolitos_membros(nome,user_id,nivel,servindo_desde) values('Prova ataque rollback',f.user_id,'acolito_sentinela','2000-01-01');raise exception 'INSERT forjou tempo/nível';exception when insufficient_privilege then null;end;
 begin insert into public.acolitos_membros(nome,nivel,servindo_desde) values('Prova filho ataque rollback','aspirante','2000-01-01');raise exception 'INSERT sem dono forjou tempo';exception when insufficient_privilege then null;end;
 update public.acolitos_membros set apelido=apelido where id=f.id;
 insert into public.acolitos_membros(nome,user_id,status) values('Prova cadastro legítimo rollback',f.user_id,'em_integracao') returning id into novo;
 assert (select servindo_desde from public.acolitos_membros where id=novo)=(now() at time zone 'America/Sao_Paulo')::date,'Cadastro novo sem início';
 assert (public.acolitos_tempo_sincronizar(novo)->>'novas')::int=0,'Cadastro novo ganhou XP indevido';
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select admin::text from tempo130_fixture),true);
set local role authenticated;
do $$declare f record;begin
 select * into f from tempo130_fixture;
 update public.acolitos_membros set servindo_desde='2020-01-01',nivel='acolito_sentinela' where id=f.id;
 assert found,'Coordenação não consegue corrigir tempo/nível';
end $$;
reset role;
select '130: UPDATE/INSERT fraudulentos bloqueados, perfil/cadastro/coordenação preservados OK';
