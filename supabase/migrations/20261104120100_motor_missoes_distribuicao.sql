begin;

-- Equivalência com as 18 descobertas legadas: conclusão não volta a pagar XP.
insert into public.acolitos_motor_recompensas(membro_id,objetivo_chave,missao_id)
select p.membro_id,m.criterio->'bonus_semanal'->>'modelo',m.id from public.acolitos_missao_progresso p join public.acolitos_missoes m on m.id=p.missao_id where p.status='concluida' and m.criterio->'bonus_semanal'->>'modelo' like 'paroquia-%' on conflict do nothing;
insert into public.acolitos_motor_historico(membro_id,semana,versao_id,objetivo_chave,missao_id,concluida)
select p.membro_id,coalesce((m.criterio->'bonus_semanal'->>'semana')::date,date_trunc('week',p.created_at)::date),m.id,m.criterio->'bonus_semanal'->>'modelo',m.id,p.status='concluida' from public.acolitos_missao_progresso p join public.acolitos_missoes m on m.id=p.missao_id where m.criterio->'bonus_semanal'->>'modelo' like 'paroquia-%' on conflict do nothing;

create function public.acolitos_motor_publicar_semana(p_semana date,p_plano jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare r record;v acolitos_motor_versoes;m acolitos_membros;mi uuid;cfg acolitos_motor_config;types text[]:=array['simples','simples','simples','investigacao','investigacao','interacao','desafio','desafio'];alvo text;cap int;uses int;
begin
 perform pg_advisory_xact_lock(hashtextextended('motor-semana:'||p_semana::text,0));
 select * into cfg from acolitos_motor_config where id=true for update;
 if extract(isodow from p_semana)<>1 or p_semana<date_trunc('week',now() at time zone 'America/Sao_Paulo')::date then raise exception 'Semana inválida.';end if;
 if jsonb_typeof(p_plano)<>'array' then raise exception 'Plano inválido.';end if;
 create temporary table motor_plano(membro_id uuid,versao_id uuid,slot int) on commit drop;
 insert into motor_plano select membro_id,versao_id,slot from jsonb_to_recordset(p_plano) as x(membro_id uuid,versao_id uuid,slot int);
 if exists(select 1 from motor_plano group by membro_id,slot having count(*)<>1) then raise exception 'Slot duplicado.';end if;
 if exists(select 1 from acolitos_membros a where status='ativo' and serve and user_id is not null and (select count(*) from (select slot from motor_plano p where p.membro_id=a.id union select slot from acolitos_motor_atribuicoes e where e.membro_id=a.id and e.semana=p_semana) z)<>8) then raise exception 'Oportunidades incompletas para membros ativos.';end if;
 if exists(select 1 from motor_plano p left join acolitos_membros a on a.id=p.membro_id where a.id is null or a.status<>'ativo' or not a.serve or a.user_id is null) then raise exception 'Perfil inválido.';end if;
 if exists(select 1 from motor_plano p join acolitos_motor_atribuicoes a on a.membro_id=p.membro_id and a.semana=p_semana and a.slot=p.slot) then raise exception 'Semana já atribuída. Atualize a prévia.';end if;
 insert into acolitos_motor_semanas(semana,estado) values(p_semana,'publicada') on conflict do nothing;
 for r in select * from motor_plano order by membro_id,slot loop
  select * into m from acolitos_membros where id=r.membro_id;
  select * into v from acolitos_motor_versoes where id=r.versao_id and estado='aprovada' for share;
  if v.id is null or r.slot not between 0 and 7 or v.conteudo->>'tipo'<>types[r.slot+1] or not (v.conteudo->'niveis' ? m.nivel) then raise exception 'Versão/nível/faixa inválida.';end if;
  if exists(select 1 from acolitos_motor_historico h where h.membro_id=m.id and h.objetivo_chave=v.conteudo->>'objetivo_chave' and (concluida or semana>=p_semana-28)) then raise exception 'Objetivo repetido.';end if;
  alvo:=v.conteudo->>'alvo_local';cap:=(cfg.capacidades->>alvo)::int;
  select count(*) into uses from acolitos_motor_atribuicoes a join acolitos_motor_versoes b on b.id=a.versao_id where a.semana=p_semana and b.conteudo->>'alvo_local'=alvo;
  if cap is null or cap<=uses then raise exception 'Capacidade esgotada: %',alvo;end if;
  select a.missao_id into mi from acolitos_motor_atribuicoes a where a.semana=p_semana and a.versao_id=v.id limit 1;
  if mi is null then
   mi:=gen_random_uuid();insert into acolitos_missoes(id,titulo,descricao,tipo,validacao,xp,exclusiva,aplica_de,obrigatoria,ativo,expira_em,criterio) values(mi,v.publico->>'titulo',v.publico->>'gancho','bonus','reivindicada',(v.publico->>'xp')::int,true,'__exclusiva__',false,true,p_semana+6,jsonb_build_object('motor',jsonb_build_object('versao',v.id,'semana',p_semana),'bonus_semanal',jsonb_build_object('tipo',case when v.conteudo->>'tipo'='desafio' then 'jogo' else 'descoberta' end,'modelo','motor:'||v.id,'semana',p_semana,'passos',v.publico->'passos','ajuda',v.publico->'pistas'->>0,'foto_obrigatoria',v.publico->'foto_obrigatoria')));
  end if;
  insert into acolitos_motor_atribuicoes(membro_id,semana,slot,versao_id,missao_id) values(m.id,p_semana,r.slot,v.id,mi);
  insert into acolitos_motor_historico(membro_id,semana,versao_id,objetivo_chave,missao_id) values(m.id,p_semana,v.id,v.conteudo->>'objetivo_chave',mi);
 end loop;
 drop table motor_plano;
 return jsonb_build_object('ok',true,'atribuicoes',jsonb_array_length(p_plano),'xp_semana',130);
end $$;
create function public.acolitos_motor_trocar(p_membro uuid,p_atribuicao uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare a acolitos_motor_atribuicoes;v acolitos_motor_versoes;oldv acolitos_motor_versoes;cfg acolitos_motor_config;mi uuid;cap int;uses int;
begin
 perform acolitos_xp_servico_meus(p_membro);
 if not exists(select 1 from acolitos_membros where id=p_membro and status='ativo' and serve) then raise exception 'Perfil indisponível.';end if;
 perform pg_advisory_xact_lock(hashtextextended('motor-troca:'||p_membro,0));
 select * into a from acolitos_motor_atribuicoes where id=p_atribuicao and membro_id=p_membro for update;
 if a.id is null or a.semana<>date_trunc('week',now() at time zone 'America/Sao_Paulo')::date or a.estado not in ('pendente','iniciada','revisao') then raise exception 'Missão indisponível para troca.';end if;
 if exists(select 1 from acolitos_motor_atribuicoes where membro_id=p_membro and semana=a.semana and troca_usada) then raise exception 'Troca semanal já utilizada.';end if;
 select * into cfg from acolitos_motor_config where id=true for update;
 select * into oldv from acolitos_motor_versoes where id=a.versao_id;
 select b.* into v from acolitos_motor_versoes b join acolitos_membros m on m.id=p_membro where b.estado='aprovada' and b.conteudo->>'tipo'=oldv.conteudo->>'tipo' and b.conteudo->'niveis' ? m.nivel
 and not exists(select 1 from acolitos_motor_historico h where h.membro_id=p_membro and h.objetivo_chave=b.conteudo->>'objetivo_chave' and (h.concluida or h.semana>=a.semana-28))
 and coalesce((cfg.capacidades->>(b.conteudo->>'alvo_local'))::int,0)>(select count(*) from acolitos_motor_atribuicoes x join acolitos_motor_versoes y on y.id=x.versao_id where x.semana=a.semana and x.id<>a.id and y.conteudo->>'alvo_local'=b.conteudo->>'alvo_local')
 order by b.id limit 1 for share of b;
 if v.id is null then raise exception 'Sem alternativa equivalente com vaga. A missão atual continua disponível.';end if;
 mi:=gen_random_uuid();insert into acolitos_missoes(id,titulo,descricao,tipo,validacao,xp,exclusiva,aplica_de,obrigatoria,ativo,expira_em,criterio) values(mi,v.publico->>'titulo',v.publico->>'gancho','bonus','reivindicada',(v.publico->>'xp')::int,true,'__exclusiva__',false,true,a.semana+6,jsonb_build_object('motor',jsonb_build_object('versao',v.id,'semana',a.semana),'bonus_semanal',jsonb_build_object('tipo',case when v.conteudo->>'tipo'='desafio' then 'jogo' else 'descoberta' end,'modelo','motor:'||v.id,'semana',a.semana,'passos',v.publico->'passos','ajuda',v.publico->'pistas'->>0,'foto_obrigatoria',v.publico->'foto_obrigatoria')));
 update acolitos_motor_historico set trocada=true where membro_id=p_membro and missao_id=a.missao_id;
 update acolitos_motor_atribuicoes set versao_id=v.id,missao_id=mi,troca_usada=true,estado='pendente',iniciado_em=null,prazo=null,ultimo_avanco=null where id=a.id;
 insert into acolitos_motor_historico(membro_id,semana,versao_id,objetivo_chave,missao_id) values(p_membro,a.semana,v.id,v.conteudo->>'objetivo_chave',mi);
 return jsonb_build_object('ok',true,'missao_id',mi);
end $$;
create function public.acolitos_motor_minhas(p_membro uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform acolitos_xp_servico_meus(p_membro);
 return coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'titulo',m.titulo,'descricao',m.descricao,'xp',m.xp,'criterio',m.criterio,'expira_em',m.expira_em,'motor',v.publico,'atribuicao',a.id,'status',coalesce(p.status,'pendente'),'revisao',p.obs_revisao,'iniciada',a.iniciado_em is not null,'parada',a.ultimo_avanco<now()-interval '7 days','prazo',a.prazo,'troca_usada',exists(select 1 from acolitos_motor_atribuicoes t where t.membro_id=p_membro and t.semana=a.semana and t.troca_usada)) order by a.semana desc,a.slot)
 from acolitos_motor_atribuicoes a join acolitos_missoes m on m.id=a.missao_id join acolitos_motor_versoes v on v.id=a.versao_id left join acolitos_missao_progresso p on p.membro_id=a.membro_id and p.missao_id=a.missao_id where a.membro_id=p_membro and a.semana<=date_trunc('week',now() at time zone 'America/Sao_Paulo')::date and (a.semana=date_trunc('week',now() at time zone 'America/Sao_Paulo')::date or a.estado='em_analise' or (a.iniciado_em is not null and a.prazo>=now())) and a.estado<>'arquivada'),'[]'::jsonb);
end $$;
revoke all on function public.acolitos_motor_publicar_semana(date,jsonb),public.acolitos_motor_trocar(uuid,uuid),public.acolitos_motor_minhas(uuid) from public,anon,authenticated;
grant execute on function public.acolitos_motor_publicar_semana(date,jsonb) to service_role;
grant execute on function public.acolitos_motor_trocar(uuid,uuid),public.acolitos_motor_minhas(uuid) to authenticated;
create function public.acolitos_motor_programar(p_config jsonb,p_plano jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare desde date;antiga date;begin
 select distribuicao_desde into antiga from acolitos_motor_config where id=true for update;
 desde:=(p_config->>'distribuicao_desde')::date;
 if desde=antiga and antiga<=date_trunc('week',now() at time zone 'America/Sao_Paulo')::date then update acolitos_motor_config set geracao_ativa=(p_config->>'geracao_ativa')::boolean,capacidades=p_config->'capacidades',atualizado_em=now() where id=true;return jsonb_build_object('ok',true);end if;
 if desde<=date_trunc('week',now() at time zone 'America/Sao_Paulo')::date or extract(isodow from desde)<>1 then raise exception 'Ative numa próxima segunda-feira.';end if;
 update acolitos_motor_config set geracao_ativa=(p_config->>'geracao_ativa')::boolean,distribuicao_desde=desde,capacidades=p_config->'capacidades',atualizado_em=now() where id=true;
 perform acolitos_motor_publicar_semana(desde,p_plano);
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.acolitos_motor_programar(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.acolitos_motor_programar(jsonb,jsonb) to service_role;
commit;
