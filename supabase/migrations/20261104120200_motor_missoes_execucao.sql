begin;
create function public.acolitos_motor_coord() returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from pastoral_members p join pastoral_modules m on m.id=p.module_id where p.user_id=auth.uid() and m.slug='acolitos' and m.ativo and (p.role in ('coord_admin','subadmin') or (p.role='membro_equipe' and exists(select 1 from acolitos_membros a where a.user_id=auth.uid() and 'jornada'=any(a.permissoes)))));
$$;
create function public.acolitos_motor_progresso_guard() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare a acolitos_motor_atribuicoes;v acolitos_motor_versoes;
begin
 if not exists(select 1 from acolitos_missoes where id=coalesce(new.missao_id,old.missao_id) and criterio->'motor' is not null) then
  if tg_op<>'DELETE' and new.status='concluida' then
   if exists(select 1 from acolitos_missoes m where m.id=new.missao_id and m.criterio->'bonus_semanal'->>'modelo' like 'paroquia-%') then
    perform pg_advisory_xact_lock(hashtextextended('motor-xp:'||new.membro_id,0));
    if tg_op='UPDATE' and old.status='concluida' then raise exception 'Objetivo legado já concluído.';end if;
    if coalesce(new.xp_ganho,0)>0 and exists(select 1 from acolitos_motor_recompensas r join acolitos_missoes awarded on awarded.id=r.missao_id join acolitos_missoes current_m on current_m.id=new.missao_id where r.membro_id=new.membro_id and r.objetivo_chave=current_m.criterio->'bonus_semanal'->>'modelo' and r.missao_id<>new.missao_id and awarded.criterio->'motor' is not null) then raise exception 'Objetivo já recompensado pelo motor.';end if;
   end if;
   insert into acolitos_motor_recompensas(membro_id,objetivo_chave,missao_id) select new.membro_id,m.criterio->'bonus_semanal'->>'modelo',m.id from acolitos_missoes m where m.id=new.missao_id and m.criterio->'bonus_semanal'->>'modelo' like 'paroquia-%' on conflict do nothing;
   insert into acolitos_motor_historico(membro_id,semana,versao_id,objetivo_chave,missao_id,concluida) select new.membro_id,coalesce((m.criterio->'bonus_semanal'->>'semana')::date,date_trunc('week',now())::date),m.id,m.criterio->'bonus_semanal'->>'modelo',m.id,true from acolitos_missoes m where m.id=new.missao_id and m.criterio->'bonus_semanal'->>'modelo' like 'paroquia-%' on conflict(membro_id,missao_id) do update set concluida=true;
  end if;return coalesce(new,old);
 end if;
 if current_setting('app.motor_operacao',true) is distinct from coalesce(new.missao_id,old.missao_id)::text||':'||coalesce(new.membro_id,old.membro_id)::text then raise exception 'Use o fluxo da missão atribuída.' using errcode='42501';end if;
 if tg_op='DELETE' then raise exception 'Evidência do motor é preservada.';end if;
 select * into a from acolitos_motor_atribuicoes where missao_id=new.missao_id and membro_id=new.membro_id;
 if a.id is null then raise exception 'Missão não atribuída.';end if;
 select * into v from acolitos_motor_versoes where id=a.versao_id;
 if new.envolvidos is not null and cardinality(new.envolvidos)>0 then raise exception 'Cada participante envia sua própria evidência e recebe seu slot.';end if;
 if new.status='concluida' then
  if tg_op='UPDATE' and old.status='concluida' then raise exception 'Missão já recompensada.';end if;
  if new.xp_ganho<>(v.publico->>'xp')::int then raise exception 'Recompensa divergente.';end if;
  insert into acolitos_motor_recompensas(membro_id,objetivo_chave,missao_id) values(new.membro_id,v.conteudo->>'objetivo_chave',new.missao_id);
  update acolitos_motor_historico set concluida=true where membro_id=new.membro_id and missao_id=new.missao_id;
 end if;
 update acolitos_motor_atribuicoes set estado=case when new.status in ('em_analise','revisao','concluida') then new.status else estado end,ultimo_avanco=now() where id=a.id;
 return new;
end $$;
create trigger motor_progresso_guard before insert or update or delete on public.acolitos_missao_progresso for each row execute function public.acolitos_motor_progresso_guard();
create function public.acolitos_motor_iniciar(p_membro uuid,p_missao uuid,p_publico jsonb,p_resposta jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare a acolitos_motor_atribuicoes;v acolitos_motor_versoes;j acolitos_bonus_jogos;
begin
 select * into a from acolitos_motor_atribuicoes where membro_id=p_membro and missao_id=p_missao for update;
 if a.id is null or not exists(select 1 from acolitos_membros where id=p_membro and status='ativo' and serve) then raise exception 'Missão não atribuída ao perfil ativo.';end if;
 if a.estado in ('concluida','em_analise') then return jsonb_build_object('id',null,'concluido',true,'publico','{}'::jsonb);end if;
 if a.iniciado_em is null and (a.semana<>date_trunc('week',now() at time zone 'America/Sao_Paulo')::date) then raise exception 'Missão fora da semana.';end if;
 if a.iniciado_em is not null and a.prazo<now() then raise exception 'Prazo encerrado; escolha uma missão da semana.';end if;
 select * into v from acolitos_motor_versoes where id=a.versao_id;
 insert into acolitos_bonus_jogos(membro_id,missao_id,publico,resposta) values(p_membro,p_missao,p_publico,p_resposta) on conflict do nothing;
 select * into j from acolitos_bonus_jogos where membro_id=p_membro and missao_id=p_missao;
 update acolitos_motor_atribuicoes set estado='iniciada',iniciado_em=coalesce(iniciado_em,now()),prazo=coalesce(prazo,now()+interval '14 days'),ultimo_avanco=coalesce(ultimo_avanco,now()) where id=a.id;
 return jsonb_build_object('id',j.id,'publico',j.publico,'concluido',j.concluido_em is not null);
end $$;
create function public.acolitos_motor_enviar(p_membro uuid,p_missao uuid,p_relato text,p_foto text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare a acolitos_motor_atribuicoes;v acolitos_motor_versoes;
begin
 perform acolitos_xp_servico_meus(p_membro);
 select * into a from acolitos_motor_atribuicoes where membro_id=p_membro and missao_id=p_missao for update;
 if a.id is null or a.estado not in ('iniciada','revisao','em_analise') or a.prazo<now() then raise exception 'Comece uma missão atribuída dentro do prazo.';end if;
 if not exists(select 1 from acolitos_membros where id=p_membro and status='ativo' and serve) then raise exception 'Perfil indisponível.';end if;
 select * into v from acolitos_motor_versoes where id=a.versao_id;
 if v.conteudo->>'tipo'='desafio' then raise exception 'Responda ao desafio digital.';end if;
 if length(trim(coalesce(p_relato,''))) not between 1 and 1500 then raise exception 'Informe a resposta de até 1.500 caracteres.';end if;
 if p_foto is null or split_part(p_foto,'/',1)<>auth.uid()::text or split_part(p_foto,'/',2)<>p_missao::text or not exists(select 1 from storage.objects where bucket_id='acolitos-quests-evidencias' and name=p_foto) then raise exception 'Foto obrigatória: envie sua foto desta missão.';end if;
 perform set_config('app.motor_operacao',p_missao::text||':'||p_membro::text,true);
 insert into acolitos_missao_progresso(missao_id,membro_id,status,evidencia) values(p_missao,p_membro,'em_analise',jsonb_build_object('tipo','bonus_evidencia','relato',trim(p_relato),'foto',p_foto)::text)
 on conflict(missao_id,membro_id) do update set status='em_analise',evidencia=excluded.evidencia where acolitos_missao_progresso.status in ('em_analise','revisao');
 perform set_config('app.motor_operacao','',true);
 return jsonb_build_object('ok',true);
end $$;
create function public.acolitos_motor_concluir(p_membro uuid,p_missao uuid,p_ator uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare a acolitos_motor_atribuicoes;v acolitos_motor_versoes;temp uuid;from_xp int;gain int;
begin
 perform pg_advisory_xact_lock(hashtextextended('motor-xp:'||p_membro,0));
 select * into a from acolitos_motor_atribuicoes where membro_id=p_membro and missao_id=p_missao for update;
 if a.id is null then raise exception 'Missão não atribuída.';end if;
 if exists(select 1 from acolitos_missao_progresso where membro_id=p_membro and missao_id=p_missao and status='concluida') then return jsonb_build_object('ok',true,'novo',false,'xp',0);end if;
 select * into v from acolitos_motor_versoes where id=a.versao_id;gain:=(v.publico->>'xp')::int;
 if exists(select 1 from acolitos_missao_progresso p join acolitos_missoes m on m.id=p.missao_id where p.membro_id=p_membro and p.status='concluida' and m.criterio->'bonus_semanal'->>'modelo'=v.conteudo->>'objetivo_chave') or exists(select 1 from acolitos_motor_recompensas where membro_id=p_membro and objetivo_chave=v.conteudo->>'objetivo_chave') then raise exception 'Este objetivo já foi recompensado.';end if;
 select id into temp from acolitos_temporadas where ativa order by created_at desc limit 1;
 perform 1 from acolitos_membros where id=p_membro for update;
 select coalesce(sum(xp_ganho),0) into from_xp from acolitos_missao_progresso where membro_id=p_membro and status='concluida';
 perform set_config('app.motor_operacao',p_missao::text||':'||p_membro::text,true);
 update acolitos_missao_progresso set status='concluida',xp_ganho=gain,temporada_id=temp,concluida_em=now(),aprovado_por=p_ator where missao_id=p_missao and membro_id=p_membro;
 if not found then insert into acolitos_missao_progresso(missao_id,membro_id,status,xp_ganho,temporada_id,concluida_em,aprovado_por) values(p_missao,p_membro,'concluida',gain,temp,now(),p_ator);end if;
 perform set_config('app.motor_operacao','',true);
 perform acolitos_cred_temp(p_membro,gain,'missao');
 update acolitos_membros set avisos=coalesce(avisos,'[]'::jsonb)||jsonb_build_array(jsonb_build_object('tipo','xp_ganho','gain',gain,'from_xp',from_xp,'titulo',v.publico->>'titulo','seen',false,'ts',(extract(epoch from now())*1000)::bigint)) where id=p_membro;
 return jsonb_build_object('ok',true,'novo',true,'xp',gain);
end $$;
create function public.acolitos_motor_responder(p_jogo uuid,p_respostas jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare j acolitos_bonus_jogos;a acolitos_motor_atribuicoes;v acolitos_motor_versoes;r jsonb;
begin
 select * into j from acolitos_bonus_jogos where id=p_jogo for update;
 if j.id is null then raise exception 'Desafio indisponível.';end if;
 perform acolitos_xp_servico_meus(j.membro_id);
 select * into a from acolitos_motor_atribuicoes where membro_id=j.membro_id and missao_id=j.missao_id for update;
 select * into v from acolitos_motor_versoes where id=a.versao_id;
 if a.id is null or v.conteudo->>'tipo'<>'desafio' or a.prazo<now() then raise exception 'Desafio fora do prazo.';end if;
 if not exists(select 1 from acolitos_membros where id=j.membro_id and status='ativo' and serve) then raise exception 'Perfil indisponível.';end if;
 if j.concluido_em is not null then return jsonb_build_object('ok',true,'xp',0);end if;
 if j.liberado_em>now() then return jsonb_build_object('ok',false,'mensagem','Releia as pistas e tente daqui a um minuto.');end if;
 if p_respostas is null or jsonb_typeof(p_respostas)<>'array' or length(p_respostas::text)>3000 then raise exception 'Respostas inválidas.';end if;
 if p_respostas<>j.resposta then
  update acolitos_bonus_jogos set tentativas=tentativas+1,liberado_em=case when (tentativas+1)%3=0 then now()+interval '1 minute' else now() end where id=j.id;
  return jsonb_build_object('ok',false,'mensagem','Alguma escolha ainda não fechou. Leia as pistas e tente novamente.');
 end if;
 r:=acolitos_motor_concluir(j.membro_id,j.missao_id,null);
 update acolitos_bonus_jogos set concluido_em=now() where id=j.id;
 return r||jsonb_build_object('explicacoes',(select jsonb_agg(value->>'explicacao') from jsonb_array_elements(v.conteudo->'avaliacao'->'itens')));
end $$;
create function public.acolitos_motor_decidir(p_missao uuid,p_membro uuid,p_decisao text,p_obs text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare a acolitos_motor_atribuicoes;
begin
 if not acolitos_motor_coord() then raise exception 'Somente a coordenação da Jornada.' using errcode='42501';end if;
 select * into a from acolitos_motor_atribuicoes where membro_id=p_membro and missao_id=p_missao for update;
 if a.id is null then raise exception 'Missão não atribuída.';end if;
 if a.estado='concluida' then return jsonb_build_object('ok',true,'xp',0);end if;
 if a.estado<>'em_analise' then raise exception 'Aguarde evidência enviada pelo membro.';end if;
 if p_decisao='aprovar' then return acolitos_motor_concluir(p_membro,p_missao,auth.uid());end if;
 if p_decisao not in ('revisar','recusar') then raise exception 'Decisão inválida.';end if;
 perform set_config('app.motor_operacao',p_missao::text||':'||p_membro::text,true);
 update acolitos_missao_progresso set status='revisao',obs_revisao=left(coalesce(p_obs,'Confira a evidência e tente novamente.'),1500) where membro_id=p_membro and missao_id=p_missao;
 perform set_config('app.motor_operacao','',true);
 return jsonb_build_object('ok',true,'acao','revisao');
end $$;
revoke all on function public.acolitos_motor_coord(),public.acolitos_motor_progresso_guard(),public.acolitos_motor_concluir(uuid,uuid,uuid),public.acolitos_motor_iniciar(uuid,uuid,jsonb,jsonb),public.acolitos_motor_enviar(uuid,uuid,text,text),public.acolitos_motor_responder(uuid,jsonb),public.acolitos_motor_decidir(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.acolitos_motor_iniciar(uuid,uuid,jsonb,jsonb) to service_role;
grant execute on function public.acolitos_motor_enviar(uuid,uuid,text,text),public.acolitos_motor_responder(uuid,jsonb),public.acolitos_motor_decidir(uuid,uuid,text,text) to authenticated;
CREATE OR REPLACE FUNCTION public.acolitos_missao_decidir(p_missao uuid, p_membro uuid, p_decisao text, p_obs text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
 if exists(select 1 from public.acolitos_missoes where id=p_missao and criterio->'motor' is not null) then return public.acolitos_motor_decidir(p_missao,p_membro,p_decisao,p_obs);end if;
 if public.acolitos_get_role(auth.uid()) is null or public.acolitos_get_role(auth.uid()) not in ('coord_admin','subadmin','membro_equipe') then return jsonb_build_object('erro','sem_permissao');end if;
 perform pg_advisory_xact_lock(hashtextextended('missao:'||p_missao::text||':'||p_membro::text,0));
 if p_decisao='aprovar' and exists(select 1 from public.acolitos_missao_progresso where missao_id=p_missao and membro_id=p_membro and status='concluida') then return jsonb_build_object('ok',true,'acao','ja_concluida','xp',0);end if;
 if p_decisao='aprovar' and exists(select 1 from acolitos_missoes where id=p_missao and criterio->'bonus_semanal'->>'modelo' like 'paroquia-%') then
  perform pg_advisory_xact_lock(hashtextextended('motor-xp:'||p_membro,0));
  if exists(select 1 from acolitos_motor_recompensas r join acolitos_missoes old_m on old_m.id=r.missao_id join acolitos_missoes current_m on current_m.id=p_missao where r.membro_id=p_membro and r.objetivo_chave=current_m.criterio->'bonus_semanal'->>'modelo' and r.missao_id<>p_missao and old_m.criterio->'motor' is not null) then
   update acolitos_missao_progresso set status='concluida',xp_ganho=0,concluida_em=now(),aprovado_por=auth.uid() where membro_id=p_membro and missao_id=p_missao and status<>'concluida';
   return jsonb_build_object('ok',true,'acao','objetivo_ja_recompensado','xp',0);
  end if;
 end if;
 if p_decisao is null or p_decisao not in ('aprovar','recusar','revisar') then return jsonb_build_object('erro','decisao_invalida');end if;
 return public.acolitos_missao_decidir_antes_bonus(p_missao,p_membro,p_decisao,p_obs);
end $function$;
commit;
