begin;
create function public.acolitos_motor_arte(c jsonb) returns text language sql immutable set search_path=public,pg_temp as $$ select case c->>'objetivo_chave' when 'paroquia-d01' then 'vitral' when 'paroquia-d02' then 'barco' when 'paroquia-d03' then 'pedra' when 'paroquia-d04' then 'oferta' when 'paroquia-d05' then 'caminho' when 'paroquia-d06' then 'pomba' when 'paroquia-d07' then 'asas' when 'paroquia-d08' then 'jogo' when 'paroquia-d09' then 'biblioteca' when 'paroquia-d10' then 'caderno' when 'paroquia-d11' then 'biblioteca' when 'paroquia-d12' then 'sala' when 'paroquia-d13' then 'asas' when 'paroquia-d14' then 'sala' when 'paroquia-d15' then 'sacristia' when 'paroquia-d16' then 'igreja' when 'paroquia-d17' then 'igreja' when 'paroquia-d18' then 'sacristia' else case when c->>'tipo'='desafio' then 'jogo' when c->>'tipo'='interacao' then 'equipe' when c->>'objetivo_chave' like 'investigar:D09%' or c->>'objetivo_chave' like 'investigar:D11%' then 'biblioteca' when c->>'objetivo_chave' like 'investigar:D15%' or c->>'objetivo_chave' like 'investigar:D16%' then 'sacristia' else 'igreja' end end $$;
revoke all on function public.acolitos_motor_arte(jsonb) from public,anon,authenticated;
grant execute on function public.acolitos_motor_arte(jsonb) to service_role;
CREATE OR REPLACE FUNCTION public.acolitos_motor_minhas(p_membro uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
 perform acolitos_xp_servico_meus(p_membro);
 return coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'titulo',m.titulo,'descricao',m.descricao,'xp',m.xp,'criterio',m.criterio,'expira_em',m.expira_em,'motor',v.publico,'atribuicao',a.id,'status',coalesce(p.status,'pendente'),'revisao',p.obs_revisao,'iniciada',a.iniciado_em is not null,'semana_anterior',a.semana<date_trunc('week',now() at time zone 'America/Sao_Paulo')::date,'parada',a.ultimo_avanco<now()-interval '7 days','prazo',a.prazo,'troca_usada',exists(select 1 from acolitos_motor_atribuicoes t where t.membro_id=p_membro and t.semana=a.semana and t.troca_usada)) order by a.semana desc,a.slot)
 from acolitos_motor_atribuicoes a join acolitos_missoes m on m.id=a.missao_id join acolitos_motor_versoes v on v.id=a.versao_id left join acolitos_missao_progresso p on p.membro_id=a.membro_id and p.missao_id=a.missao_id where a.membro_id=p_membro and a.semana<=date_trunc('week',now() at time zone 'America/Sao_Paulo')::date and (a.semana=date_trunc('week',now() at time zone 'America/Sao_Paulo')::date or a.estado='em_analise' or (a.iniciado_em is not null and a.prazo>=now())) and a.estado<>'arquivada'),'[]'::jsonb);
end $function$;

CREATE OR REPLACE FUNCTION public.acolitos_motor_publicar_semana(p_semana date, p_plano jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
  alvo:=v.conteudo->>'alvo_local';cap:=case when v.conteudo->>'tipo'='desafio' then 2147483647 else (cfg.capacidades->>alvo)::int end;
  select count(*) into uses from acolitos_motor_atribuicoes a join acolitos_motor_versoes b on b.id=a.versao_id where a.semana=p_semana and b.conteudo->>'alvo_local'=alvo;
  if cap is null or cap<=uses then raise exception 'Capacidade esgotada: %',alvo;end if;
  select a.missao_id into mi from acolitos_motor_atribuicoes a where a.semana=p_semana and a.versao_id=v.id limit 1;
  if mi is null then
   mi:=gen_random_uuid();insert into acolitos_missoes(id,titulo,descricao,tipo,validacao,xp,exclusiva,aplica_de,obrigatoria,ativo,expira_em,criterio) values(mi,v.publico->>'titulo',v.publico->>'gancho','bonus','reivindicada',(v.publico->>'xp')::int,true,'__exclusiva__',false,true,p_semana+6,jsonb_build_object('motor',jsonb_build_object('versao',v.id,'semana',p_semana),'bonus_semanal',jsonb_build_object('tipo',case when v.conteudo->>'tipo'='desafio' then 'jogo' when v.conteudo->>'tipo'='interacao' then 'grupo' else 'descoberta' end,'modelo','motor:'||v.id,'semana',p_semana,'passos',v.publico->'passos','ajuda',v.publico->'pistas'->>0,'foto_obrigatoria',v.publico->'foto_obrigatoria','arte',public.acolitos_motor_arte(v.conteudo))));
  end if;
  insert into acolitos_motor_atribuicoes(membro_id,semana,slot,versao_id,missao_id) values(m.id,p_semana,r.slot,v.id,mi);
  insert into acolitos_motor_historico(membro_id,semana,versao_id,objetivo_chave,missao_id) values(m.id,p_semana,v.id,v.conteudo->>'objetivo_chave',mi);
 end loop;
 drop table motor_plano;
 return jsonb_build_object('ok',true,'atribuicoes',jsonb_array_length(p_plano),'xp_semana',130);
end $function$;

CREATE OR REPLACE FUNCTION public.acolitos_motor_trocar(p_membro uuid, p_atribuicao uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
 and (b.conteudo->>'tipo'='desafio' or coalesce((cfg.capacidades->>(b.conteudo->>'alvo_local'))::int,0)>(select count(*) from acolitos_motor_atribuicoes x join acolitos_motor_versoes y on y.id=x.versao_id where x.semana=a.semana and x.id<>a.id and y.conteudo->>'alvo_local'=b.conteudo->>'alvo_local'))
 order by b.id limit 1 for share of b;
 if v.id is null then raise exception 'Sem alternativa equivalente com vaga. A missão atual continua disponível.';end if;
 mi:=gen_random_uuid();insert into acolitos_missoes(id,titulo,descricao,tipo,validacao,xp,exclusiva,aplica_de,obrigatoria,ativo,expira_em,criterio) values(mi,v.publico->>'titulo',v.publico->>'gancho','bonus','reivindicada',(v.publico->>'xp')::int,true,'__exclusiva__',false,true,a.semana+6,jsonb_build_object('motor',jsonb_build_object('versao',v.id,'semana',a.semana),'bonus_semanal',jsonb_build_object('tipo',case when v.conteudo->>'tipo'='desafio' then 'jogo' when v.conteudo->>'tipo'='interacao' then 'grupo' else 'descoberta' end,'modelo','motor:'||v.id,'semana',a.semana,'passos',v.publico->'passos','ajuda',v.publico->'pistas'->>0,'foto_obrigatoria',v.publico->'foto_obrigatoria','arte',public.acolitos_motor_arte(v.conteudo))));
 update acolitos_motor_historico set trocada=true where membro_id=p_membro and missao_id=a.missao_id;
 update acolitos_motor_atribuicoes set versao_id=v.id,missao_id=mi,troca_usada=true,estado='pendente',iniciado_em=null,prazo=null,ultimo_avanco=null where id=a.id;
 insert into acolitos_motor_historico(membro_id,semana,versao_id,objetivo_chave,missao_id) values(p_membro,a.semana,v.id,v.conteudo->>'objetivo_chave',mi);
 return jsonb_build_object('ok',true,'missao_id',mi);
end $function$;


-- Ativação explícita solicitada pelo dono para a semana corrente. Uso restrito ao servidor.
create function public.acolitos_motor_ativar_agora(p_config jsonb,p_plano jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare semana date:=date_trunc('week',now() at time zone 'America/Sao_Paulo')::date;r jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended('motor-semana:'||semana::text,0));
 perform 1 from acolitos_motor_config where id=true for update;
 if jsonb_typeof(p_config->'capacidades') is distinct from 'object' or jsonb_typeof(p_plano) is distinct from 'array' then raise exception 'Configuração/plano inválido.';end if;
 if exists(select 1 from jsonb_each(p_config->'capacidades') c where jsonb_typeof(c.value)<>'number' or (c.value::text)::numeric<0 or (c.value::text)::numeric<>floor((c.value::text)::numeric)) then raise exception 'Limite de distribuição inválido.';end if;
 update acolitos_motor_config set capacidades=p_config->'capacidades',atualizado_em=now() where id=true;
 r:=acolitos_motor_publicar_semana(semana,p_plano);
 update acolitos_motor_config set distribuicao_desde=semana,geracao_ativa=coalesce((p_config->>'geracao_ativa')::boolean,geracao_ativa),atualizado_em=now() where id=true;
 return r||jsonb_build_object('ativada_desde',semana);
end $$;
revoke all on function public.acolitos_motor_ativar_agora(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.acolitos_motor_ativar_agora(jsonb,jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.acolitos_bonus_enviar(p_membro uuid, p_missao uuid, p_relato text, p_foto text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare mi record;valor text;
begin
 perform public.acolitos_xp_servico_meus(p_membro);
 if not exists(select 1 from public.acolitos_membros where id=p_membro and status='ativo' and serve) then raise exception 'Perfil indisponível.' using errcode='42501';end if;
 select * into mi from public.acolitos_missoes where id=p_missao and criterio->'bonus_semanal'->>'tipo' in ('foto','grupo','descoberta');
 if exists(select 1 from public.acolitos_motor_config where id=true and distribuicao_desde<=date_trunc('week',now() at time zone 'America/Sao_Paulo')::date) and mi.criterio->'motor' is null
 and not exists(select 1 from public.acolitos_bonus_jogos where membro_id=p_membro and missao_id=p_missao)
 and not exists(select 1 from public.acolitos_missao_progresso where membro_id=p_membro and missao_id=p_missao)
 then raise exception 'Esta missão foi para a reserva. Escolha uma missão desta semana.';end if;
 if mi.id is null or now()>((mi.expira_em+8)::timestamp at time zone 'America/Sao_Paulo') then raise exception 'Missão fora do prazo.';end if;
 if (not mi.ativo or mi.expira_em<(now() at time zone 'America/Sao_Paulo')::date) and not exists(select 1 from public.acolitos_bonus_jogos where membro_id=p_membro and missao_id=p_missao and iniciado_em<((mi.expira_em+1)::timestamp at time zone 'America/Sao_Paulo')) then raise exception 'Comece uma aventura disponível nesta semana.';end if;
 if coalesce(length(trim(p_relato)),0)<(case when mi.criterio->'bonus_semanal'->>'tipo'='descoberta' then 1 else 5 end) or length(p_relato)>1500 then raise exception 'Conte sua descoberta em uma frase (até 1.500 caracteres).';end if;
 if mi.criterio->'bonus_semanal'->>'tipo' in ('foto','grupo','descoberta') and p_foto is null then raise exception 'Escolha uma foto desta missão.';end if;
 if p_foto is not null then
  if split_part(p_foto,'/',1)<>auth.uid()::text or split_part(p_foto,'/',2)<>p_missao::text or not exists(select 1 from storage.objects where bucket_id='acolitos-quests-evidencias' and name=p_foto) then raise exception 'Escolha e envie uma foto válida desta missão.';end if;
 end if;
 valor:=jsonb_build_object('tipo','bonus_evidencia','relato',trim(p_relato),'foto',p_foto)::text;
 insert into public.acolitos_missao_progresso(missao_id,membro_id,status,evidencia) values(p_missao,p_membro,'em_analise',valor)
 on conflict(missao_id,membro_id) do update set status='em_analise',evidencia=excluded.evidencia where acolitos_missao_progresso.status in ('revisao','em_analise');
 return jsonb_build_object('ok',true);
end $function$;

CREATE OR REPLACE FUNCTION public.acolitos_missao_reivindicar(p_missao uuid, p_evidencia text, p_envolvidos uuid[] DEFAULT NULL::uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_uid uuid:=auth.uid(); v_membro uuid; v_val text; v_doc jsonb; v_foto text;
begin
  select id into v_membro from acolitos_membros where user_id=v_uid;
  if v_membro is null then return jsonb_build_object('erro','sem_membro'); end if;
  if coalesce(btrim(p_evidencia),'')='' then return jsonb_build_object('erro','evidencia_obrigatoria'); end if;
  select validacao into v_val from acolitos_missoes where id=p_missao and ativo;
  if v_val is null then return jsonb_build_object('erro','missao_invalida'); end if;
  if exists(select 1 from public.acolitos_motor_config where id=true and distribuicao_desde<=date_trunc('week',now() at time zone 'America/Sao_Paulo')::date)
    and exists(select 1 from public.acolitos_missoes where id=p_missao and criterio->>'motor_reserva_legada'='true')
    and not exists(select 1 from public.acolitos_missao_progresso where membro_id=v_membro and missao_id=p_missao)
    then return jsonb_build_object('erro','use_missoes_da_semana');end if;
  if v_val not in ('reivindicada','automatica','avaliada') then return jsonb_build_object('erro','nao_reivindicavel'); end if;
  if exists(select 1 from public.acolitos_missoes where id=p_missao and criterio->'bonus_semanal' is not null) then return jsonb_build_object('erro','use_fluxo_aventura');end if;
  if exists(select 1 from public.acolitos_missoes where id=p_missao and criterio->>'foto_obrigatoria'='true') then
    begin v_doc:=p_evidencia::jsonb;exception when others then return jsonb_build_object('erro','foto_obrigatoria');end;
    v_foto:=v_doc->>'foto';
    if coalesce(v_doc->>'tipo','')<>'bonus_evidencia' or v_foto is null or split_part(v_foto,'/',1)<>v_uid::text or split_part(v_foto,'/',2)<>p_missao::text
      or not exists(select 1 from storage.objects where bucket_id='acolitos-quests-evidencias' and name=v_foto)
      then return jsonb_build_object('erro','foto_obrigatoria');end if;
  end if;

  insert into acolitos_missao_progresso (missao_id, membro_id, status, evidencia, envolvidos)
    values (p_missao, v_membro, 'em_analise', p_evidencia, p_envolvidos)
  on conflict (missao_id, membro_id) do update set status='em_analise', evidencia=excluded.evidencia, envolvidos=excluded.envolvidos
    where acolitos_missao_progresso.status <> 'concluida';
  return jsonb_build_object('ok', true);
end; $function$;


CREATE OR REPLACE FUNCTION public.acolitos_bonus_iniciar(p_membro uuid, p_missao uuid, p_publico jsonb, p_resposta jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare jogo record; mi record;
begin
 if auth.role()<>'service_role' then raise exception 'Sem permissão.' using errcode='42501';end if;
 select * into mi from public.acolitos_missoes where id=p_missao and ativo and criterio->'bonus_semanal'->>'tipo' in ('jogo','foto','grupo','descoberta');
 if mi.id is null or mi.expira_em<(now() at time zone 'America/Sao_Paulo')::date then raise exception 'Este jogo não está disponível para começar.';end if;
 if exists(select 1 from public.acolitos_motor_config where id=true and distribuicao_desde<=date_trunc('week',now() at time zone 'America/Sao_Paulo')::date) and mi.criterio->'motor' is null
 and not exists(select 1 from public.acolitos_bonus_jogos where membro_id=p_membro and missao_id=p_missao)
 and not exists(select 1 from public.acolitos_missao_progresso where membro_id=p_membro and missao_id=p_missao)
 then raise exception 'Esta missão foi para a reserva. Escolha uma das oito missões desta semana.';end if;
 insert into public.acolitos_bonus_jogos(membro_id,missao_id,publico,resposta) values(p_membro,p_missao,p_publico,p_resposta) on conflict do nothing;
 select * into jogo from public.acolitos_bonus_jogos where membro_id=p_membro and missao_id=p_missao;
 return jsonb_build_object('id',jogo.id,'publico',jogo.publico,'concluido',jogo.concluido_em is not null);
end $function$;


commit;
