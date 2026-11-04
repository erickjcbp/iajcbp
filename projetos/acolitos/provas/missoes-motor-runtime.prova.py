from pathlib import Path
sql='begin;\n'+''.join(p.read_text().replace('begin;','',1).rsplit('commit;',1)[0] for p in sorted(Path('supabase/migrations').glob('*_motor_missoes_*.sql')))
proof=r'''
insert into acolitos_motor_fontes values('fixture',1,'formacao','Conteúdo confirmado da prova.','{}','ativa');
-- Conteúdo fictício: só dentro desta transação revertida.
insert into acolitos_motor_versoes(id,estado,conteudo,publico)
select gen_random_uuid(),'aprovada',jsonb_build_object('tipo',t,'niveis',jsonb_build_array(n),'objetivo_chave','fixture-'||t||i||n,'alvo_local','fixture','avaliacao',jsonb_build_object('itens',jsonb_build_array(jsonb_build_object('explicacao','Explicação depois da tentativa.')))),jsonb_build_object('titulo','Missão fictícia de prova','gancho','Descubra uma pista fictícia.','passos',jsonb_build_array('Observe.','Registre.'),'pistas',jsonb_build_array('Uma pista.'),'xp',case t when 'investigacao' then 20 when 'interacao' then 40 else 10 end,'foto_obrigatoria',t<>'desafio')
from unnest(array['simples','investigacao','interacao','desafio']) t cross join generate_series(1,3) i cross join (select distinct nivel n from acolitos_membros where status='ativo' and serve and user_id is not null) levels;
update acolitos_motor_config set capacidades='{"fixture":10000}';
select public.acolitos_motor_publicar_semana(date_trunc('week',now() at time zone 'America/Sao_Paulo')::date,
(select jsonb_agg(jsonb_build_object('membro_id',m.id,'slot',s,'versao_id',(select v.id from acolitos_motor_versoes v where v.conteudo->>'tipo'=(array['simples','simples','simples','investigacao','investigacao','interacao','desafio','desafio'])[s+1] and v.conteudo->'niveis' ? m.nivel order by v.conteudo->>'objetivo_chave' offset (array[0,1,2,0,1,0,0,1])[s+1] limit 1))) from acolitos_membros m cross join generate_series(0,7) s where status='ativo' and serve and user_id is not null));
do $p$ declare rec record;j jsonb;begin
if exists(select 1 from acolitos_motor_atribuicoes a join acolitos_missoes m on m.id=a.missao_id group by a.membro_id having count(*)<>8 or sum(m.xp)<>130) then raise exception 'Semana injusta';end if;
select x.*,m.user_id into rec from acolitos_motor_atribuicoes x join acolitos_membros m on m.id=x.membro_id where x.slot=0 limit 1;
perform set_config('proof.member',rec.membro_id::text,true);perform set_config('proof.reward_before',(select count(*)::text from acolitos_motor_recompensas where membro_id=rec.membro_id),true);perform set_config('proof.user',rec.user_id::text,true);perform set_config('proof.mission',rec.missao_id::text,true);perform set_config('proof.assignment',rec.id::text,true);
perform acolitos_motor_iniciar(rec.membro_id,rec.missao_id,'{}','[]');
insert into storage.objects(bucket_id,name,metadata) values('acolitos-quests-evidencias',rec.user_id||'/'||rec.missao_id||'/motor-proof.jpg','{"mimetype":"image/jpeg"}');
select x.*,m.user_id into rec from acolitos_motor_atribuicoes x join acolitos_membros m on m.id=x.membro_id where x.membro_id=current_setting('proof.member')::uuid and x.slot=6;
j:=acolitos_motor_iniciar(rec.membro_id,rec.missao_id,'{"rodadas":[]}','[["a"]]');perform set_config('proof.game',j->>'id',true);
end $p$;
select set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',current_setting('proof.user'))::text,true);
set local role authenticated;
do $p$ declare bad boolean:=false;r jsonb;begin
begin perform acolitos_motor_enviar(current_setting('proof.member')::uuid,current_setting('proof.mission')::uuid,'VII',null);exception when others then bad:=true;end;if not bad then raise exception 'Foto ausente aceita';end if;
r:=acolitos_motor_enviar(current_setting('proof.member')::uuid,current_setting('proof.mission')::uuid,'VII',current_setting('proof.user')||'/'||current_setting('proof.mission')||'/motor-proof.jpg');if r->>'ok'<>'true' then raise exception 'Foto válida falhou';end if;
r:=acolitos_motor_responder(current_setting('proof.game')::uuid,'[["x"]]');if r->>'ok'<>'false' then raise exception 'Resposta errada aceita';end if;
r:=acolitos_motor_responder(current_setting('proof.game')::uuid,'[["a"]]');if r->>'xp'<>'10' then raise exception 'XP digital inválido';end if;
r:=acolitos_motor_responder(current_setting('proof.game')::uuid,'[["a"]]');if r->>'xp'<>'0' then raise exception 'XP duplicado';end if;
bad:=false;begin perform acolitos_missao_reivindicar(current_setting('proof.mission')::uuid,'tentativa sem foto',null);exception when others then bad:=true;end;
bad:=false;begin perform acolitos_motor_trocar(current_setting('proof.member')::uuid,current_setting('proof.assignment')::uuid);exception when others then bad:=true;end;if not bad then raise exception 'Troca após envio aceita';end if;
end $p$;
reset role;
do $p$ declare actor uuid;begin
select p.user_id into actor from pastoral_members p join pastoral_modules m on m.id=p.module_id where m.slug='acolitos' and m.ativo and p.role='coord_admin' limit 1;
if actor is null then raise exception 'Sem coordenação para prova';end if;
perform set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',actor)::text,true);
end $p$;
set local role authenticated;
do $p$ declare r jsonb;begin
r:=acolitos_missao_decidir(current_setting('proof.mission')::uuid,current_setting('proof.member')::uuid,'aprovar',null);if r->>'xp'<>'10' then raise exception 'Aprovação falhou: %',r;end if;
r:=acolitos_missao_decidir(current_setting('proof.mission')::uuid,current_setting('proof.member')::uuid,'aprovar',null);if coalesce((r->>'xp')::int,0)<>0 then raise exception 'Aprovação repetida premiou';end if;
end $p$;
reset role;
do $p$ begin if (select count(*) from acolitos_motor_recompensas where membro_id=current_setting('proof.member')::uuid)<>current_setting('proof.reward_before')::int+2 then raise exception 'Concessões divergentes';end if;raise notice 'PASS: 8 slots/130 XP, foto obrigatória e vinculada, envio real autenticado, desafio verificado, aprovação real e XP único.';end $p$;
rollback;
'''
Path('/tmp/motor-runtime-prova.sql').write_text(sql+proof)
