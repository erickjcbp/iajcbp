from pathlib import Path
import json,uuid
p=json.loads(Path('/tmp/motor-ativacao-payload.json').read_text());tag='$payload_'+uuid.uuid4().hex+'$';data=json.dumps(p,ensure_ascii=False);assert tag not in data
body="""
create temporary table motor_carga(payload jsonb) on commit drop;
insert into motor_carga values ("""+tag+data+tag+"""::jsonb);
insert into public.acolitos_motor_lotes(id,estado,origem,metricas)
select (payload->>'lote_id')::uuid,'revisao','curadoria_autorizada',jsonb_build_object('autorizacao',payload->>'autorizacao','textos_livres_ia',false) from motor_carga on conflict(id) do nothing;
insert into public.acolitos_motor_fontes(id,versao,tipo,conteudo,proveniencia,estado)
select f.id,f.versao,f.tipo,f.conteudo,f.proveniencia,f.estado from motor_carga c cross join jsonb_to_recordset(c.payload->'fontes') as f(id text,versao int,tipo text,conteudo text,proveniencia jsonb,estado text) on conflict(id) do nothing;
insert into public.acolitos_motor_versoes(id,lote_id,conteudo,publico,alertas)
select v.id,(c.payload->>'lote_id')::uuid,v.conteudo,v.publico,v.alertas from motor_carga c cross join jsonb_to_recordset(c.payload->'versoes') as v(id uuid,conteudo jsonb,publico jsonb,alertas jsonb) on conflict(id) do nothing;
do $curar$ declare item record;actual acolitos_motor_versoes;begin
for item in select v.* from motor_carga c cross join jsonb_to_recordset(c.payload->'versoes') as v(id uuid,conteudo jsonb,publico jsonb,alertas jsonb) loop
 select * into actual from acolitos_motor_versoes where id=item.id for update;
 if actual.conteudo<>item.conteudo or actual.publico<>item.publico then raise exception 'Conteúdo alterado durante a preparação. Nenhuma ativação realizada.';end if;
 if actual.estado='arquivada' then raise exception 'Uma proposta foi recusada durante a preparação.';end if;
 if actual.estado='rascunho' then perform public.acolitos_motor_aprovar(actual.id,actual.revisao,null);end if;
end loop;
end $curar$;
select public.acolitos_motor_ativar_agora(jsonb_build_object('geracao_ativa',true,'capacidades',payload->'capacidades'),payload->'plano') from motor_carga;
"""
catalog=json.loads(Path('projetos/acolitos/aventuras-catalogo.json').read_text());ids=','.join("'"+x+"'" for x in catalog)
body+="\nupdate public.acolitos_missoes set criterio=coalesce(criterio,'{}'::jsonb)||'{\"motor_reserva_legada\":true}'::jsonb where id in ("+ids+") and tipo='bonus' and capitulo is null and nivel_alvo is null and validacao in ('reivindicada','avaliada');\n"
checks=r'''
do $verify$ begin
if has_function_privilege('authenticated','public.acolitos_motor_ativar_agora(jsonb,jsonb)','EXECUTE') or has_function_privilege('anon','public.acolitos_motor_ativar_agora(jsonb,jsonb)','EXECUTE') then raise exception 'Ativação pública indevida';end if;
if exists(select 1 from acolitos_membros m where status='ativo' and serve and user_id is not null and (select count(*) from acolitos_motor_atribuicoes a where a.membro_id=m.id and a.semana=date_trunc('week',now() at time zone 'America/Sao_Paulo')::date)<>8) then raise exception 'Seleção incompleta';end if;
if exists(select 1 from acolitos_motor_atribuicoes a join acolitos_missoes m on m.id=a.missao_id where a.semana=date_trunc('week',now() at time zone 'America/Sao_Paulo')::date group by a.membro_id having sum(m.xp)<>130 or count(*) filter(where m.criterio->'bonus_semanal'->>'tipo'='jogo')<>2) then raise exception 'XP ou jogos desiguais';end if;
raise notice 'PASS: todos os membros com oito ofertas, dois jogos e 130 XP; ativação restrita.';
end $verify$;
'''
proof=r'''
do $prepare$ declare a acolitos_motor_atribuicoes;v acolitos_motor_versoes;pub jsonb;answers jsonb;j jsonb;old_id uuid;blocked boolean:=false;begin
select * into a from acolitos_motor_atribuicoes where slot=6 limit 1;
select * into v from acolitos_motor_versoes where id=a.versao_id;
select m.id into old_id from acolitos_missoes m where m.ativo and m.criterio->'motor' is null and m.criterio->'bonus_semanal'->>'tipo'='jogo' and not exists(select 1 from acolitos_bonus_jogos j where j.membro_id=a.membro_id and j.missao_id=m.id) and not exists(select 1 from acolitos_missao_progresso p where p.membro_id=a.membro_id and p.missao_id=m.id) limit 1;
if old_id is not null then begin perform public.acolitos_bonus_iniciar(a.membro_id,old_id,'{}','[]');exception when others then blocked:=true;end;if not blocked then raise exception 'Legado ainda pode começar fora da oferta.';end if;end if;
raise notice 'PASS: RPC não inicia missão legada nova depois da ativação.';
select jsonb_build_object('rodadas',jsonb_agg(jsonb_build_object('texto',i->>'texto','ordenar',i->>'formato'<>'alternativas','opcoes',i->'opcoes'))),jsonb_agg(i->'correta') into pub,answers from jsonb_array_elements(v.conteudo->'avaliacao'->'itens') i;
j:=acolitos_motor_iniciar(a.membro_id,a.missao_id,pub,answers);
perform set_config('proof.membro',a.membro_id::text,true);perform set_config('proof.jogo',j->>'id',true);perform set_config('proof.respostas',answers::text,true);
perform set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',(select user_id from acolitos_membros where id=a.membro_id))::text,true);
end $prepare$;
set local role authenticated;
do $member$ declare qs jsonb;r jsonb;begin
qs:=acolitos_motor_minhas(current_setting('proof.membro')::uuid);if jsonb_array_length(qs)<>8 then raise exception 'Membro não recebeu oito missões';end if;
r:=acolitos_motor_responder(current_setting('proof.jogo')::uuid,current_setting('proof.respostas')::jsonb);if r->>'xp'<>'10' then raise exception 'Desafio real do banco não concedeu 10XP: %',r;end if;
r:=acolitos_motor_responder(current_setting('proof.jogo')::uuid,current_setting('proof.respostas')::jsonb);if r->>'xp'<>'0' then raise exception 'XP duplicado';end if;
raise notice 'PASS: membro autenticado vê oito; desafio do banco validado e repetição não concede XP.';
end $member$;
reset role;
'''
migration=Path('supabase/migrations/20261104140000_motor_missoes_ativacao.sql').read_text().replace('begin;','',1).rsplit('commit;',1)[0]
Path('/tmp/motor-ativacao-rollback.sql').write_text('begin;\n'+migration+body+checks+proof+'rollback;\n')
Path('/tmp/motor-ativacao-aplicar.sql').write_text('begin;\n'+body+checks+'commit;\n')
print('SQL de prova e aplicação preparados; nada foi aplicado por este script.')
