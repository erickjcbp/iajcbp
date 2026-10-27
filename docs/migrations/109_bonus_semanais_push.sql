begin;
create table if not exists public.acolitos_jornada_rotina (
 id boolean primary key default true check(id),cfg jsonb not null,
 atualizado_em timestamptz not null default now()
);
insert into public.acolitos_jornada_rotina values(true,'{"ativa":false,"renovar":true,"push":true,"resumo_coord":true,"limite_fim_semana":2,"sexta":"18:00","sabado":"10:00","domingo":"17:00","resumo":"19:00"}',now()) on conflict do nothing;
alter table public.acolitos_jornada_rotina enable row level security;
revoke all on public.acolitos_jornada_rotina from public,anon,authenticated;
grant all on public.acolitos_jornada_rotina to service_role;
create table if not exists public.acolitos_bonus_semanas (
 semana date primary key,modelos jsonb not null,origem text not null,criado_em timestamptz not null default now()
);
alter table public.acolitos_bonus_semanas enable row level security;
revoke all on public.acolitos_bonus_semanas from public,anon,authenticated;
grant all on public.acolitos_bonus_semanas to service_role;
create table if not exists public.acolitos_jornada_atividade (
 membro_id uuid primary key references public.acolitos_membros(id) on delete cascade,
 ultima_visita timestamptz, push_pausado boolean not null default false
);
alter table public.acolitos_jornada_atividade enable row level security;
revoke all on public.acolitos_jornada_atividade from public,anon,authenticated;
grant all on public.acolitos_jornada_atividade to service_role;
create table if not exists public.acolitos_bonus_jogos (
 id uuid primary key default gen_random_uuid(),membro_id uuid not null references public.acolitos_membros(id) on delete cascade,
 missao_id uuid not null references public.acolitos_missoes(id),publico jsonb not null,resposta jsonb not null,
 iniciado_em timestamptz not null default now(),tentativas int not null default 0,liberado_em timestamptz not null default now(),
 concluido_em timestamptz,unique(membro_id,missao_id)
);
alter table public.acolitos_bonus_jogos enable row level security;
revoke all on public.acolitos_bonus_jogos from public,anon,authenticated;
grant all on public.acolitos_bonus_jogos to service_role;
create table if not exists public.acolitos_jornada_push (
 id uuid primary key default gen_random_uuid(),usuario_id uuid not null,semana date not null,slot text not null,
 payload jsonb not null,estado text not null default 'reservado' check(estado in ('reservado','aceito','falhou','sem_inscricao')),
 criado_em timestamptz not null default now(),finalizado_em timestamptz,aceitos int not null default 0,
 unique(usuario_id,semana,slot)
);
alter table public.acolitos_jornada_push enable row level security;
revoke all on public.acolitos_jornada_push from public,anon,authenticated;
grant all on public.acolitos_jornada_push to service_role;

create or replace function public.acolitos_jornada_atividade(p_membro uuid,p_pausar boolean default null) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform public.acolitos_xp_servico_meus(p_membro);
 insert into public.acolitos_jornada_atividade(membro_id,ultima_visita,push_pausado) values(p_membro,now(),coalesce(p_pausar,false))
 on conflict(membro_id) do update set ultima_visita=now(),push_pausado=coalesce(p_pausar,acolitos_jornada_atividade.push_pausado);
 return (select jsonb_build_object('push_pausado',push_pausado) from public.acolitos_jornada_atividade where membro_id=p_membro);
end $$;
revoke all on function public.acolitos_jornada_atividade(uuid,boolean) from public,anon;
grant execute on function public.acolitos_jornada_atividade(uuid,boolean) to authenticated;

create or replace function public.acolitos_bonus_iniciar(p_membro uuid,p_missao uuid,p_publico jsonb,p_resposta jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare jogo record; mi record;
begin
 if auth.role()<>'service_role' then raise exception 'Sem permissão.' using errcode='42501';end if;
 select * into mi from public.acolitos_missoes where id=p_missao and ativo and criterio->'bonus_semanal'->>'tipo' in ('jogo','foto','grupo');
 if mi.id is null or mi.expira_em<(now() at time zone 'America/Sao_Paulo')::date then raise exception 'Este jogo não está disponível para começar.';end if;
 insert into public.acolitos_bonus_jogos(membro_id,missao_id,publico,resposta) values(p_membro,p_missao,p_publico,p_resposta) on conflict do nothing;
 select * into jogo from public.acolitos_bonus_jogos where membro_id=p_membro and missao_id=p_missao;
 return jsonb_build_object('id',jogo.id,'publico',jogo.publico,'concluido',jogo.concluido_em is not null);
end $$;
revoke all on function public.acolitos_bonus_iniciar(uuid,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.acolitos_bonus_iniciar(uuid,uuid,jsonb,jsonb) to service_role;

-- Serializa a aprovação existente e a conclusão automática no MESMO objetivo.
do $$begin if to_regprocedure('public.acolitos_missao_decidir_antes_bonus(uuid,uuid,text,text)') is null then
 alter function public.acolitos_missao_decidir(uuid,uuid,text,text) rename to acolitos_missao_decidir_antes_bonus;
end if;end$$;
revoke all on function public.acolitos_missao_decidir_antes_bonus(uuid,uuid,text,text) from public,anon,authenticated;
create or replace function public.acolitos_missao_decidir(p_missao uuid,p_membro uuid,p_decisao text,p_obs text default null) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if public.acolitos_get_role(auth.uid()) is null or public.acolitos_get_role(auth.uid()) not in ('coord_admin','subadmin','membro_equipe') then return jsonb_build_object('erro','sem_permissao');end if;
 perform pg_advisory_xact_lock(hashtextextended('missao:'||p_missao::text||':'||p_membro::text,0));
 if p_decisao='aprovar' and exists(select 1 from public.acolitos_missao_progresso where missao_id=p_missao and membro_id=p_membro and status='concluida') then return jsonb_build_object('ok',true,'acao','ja_concluida','xp',0);end if;
 if p_decisao is null or p_decisao not in ('aprovar','recusar','revisar') then return jsonb_build_object('erro','decisao_invalida');end if;
 return public.acolitos_missao_decidir_antes_bonus(p_missao,p_membro,p_decisao,p_obs);
end $$;
revoke all on function public.acolitos_missao_decidir(uuid,uuid,text,text) from public,anon;
grant execute on function public.acolitos_missao_decidir(uuid,uuid,text,text) to authenticated,service_role;

create or replace function public.acolitos_bonus_responder(p_jogo uuid,p_respostas jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare j record;mi record;temp uuid;novo boolean;from_xp int;
begin
 select * into j from public.acolitos_bonus_jogos where id=p_jogo;
 if j.id is null then raise exception 'Jogo não encontrado.';end if;
 perform public.acolitos_xp_servico_meus(j.membro_id);
 if not exists(select 1 from public.acolitos_membros where id=j.membro_id and status='ativo' and serve) then raise exception 'Perfil indisponível.' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('missao:'||j.missao_id::text||':'||j.membro_id::text,0));
 select * into j from public.acolitos_bonus_jogos where id=p_jogo for update;
 select * into mi from public.acolitos_missoes where id=j.missao_id;
 if j.concluido_em is not null then return jsonb_build_object('ok',true,'novo',false,'xp',0);end if;
 if mi.criterio->'bonus_semanal'->>'tipo'<>'jogo' or now()>((mi.expira_em+8)::timestamp at time zone 'America/Sao_Paulo') then raise exception 'O prazo deste jogo terminou.';end if;
 if j.liberado_em>now() then return jsonb_build_object('ok',false,'aguarde',true,'mensagem','Releia as pistas e tente daqui a um minuto.');end if;
 if jsonb_typeof(p_respostas) is distinct from 'array' or octet_length(p_respostas::text)>2000 then raise exception 'Resposta inválida.';end if;
 if p_respostas<>j.resposta then
  update public.acolitos_bonus_jogos set tentativas=tentativas+1,liberado_em=case when (tentativas+1)%3=0 then now()+interval '1 minute' else now() end where id=j.id;
  return jsonb_build_object('ok',false,'mensagem','Alguma decisão ainda não fechou. Leia o combinado de cada rodada e tente de novo.');
 end if;
 select id into temp from public.acolitos_temporadas where ativa order by created_at desc limit 1;
 perform 1 from public.acolitos_membros where id=j.membro_id for update;
 select coalesce(sum(xp_ganho),0) into from_xp from public.acolitos_missao_progresso where membro_id=j.membro_id and status='concluida';
 insert into public.acolitos_missao_progresso(missao_id,membro_id,status,xp_ganho,temporada_id,concluida_em,evidencia)
 values(mi.id,j.membro_id,'concluida',mi.xp,temp,now(),'Jogo concluído com validação das duas rodadas no servidor.') on conflict(missao_id,membro_id) do update set status='concluida',xp_ganho=excluded.xp_ganho,temporada_id=excluded.temporada_id,concluida_em=now() where acolitos_missao_progresso.status<>'concluida';
 novo:=found;
 if novo then
  perform public.acolitos_cred_temp(j.membro_id,mi.xp,'bonus_jogo');
  update public.acolitos_membros set avisos=coalesce(avisos,'[]'::jsonb)||jsonb_build_array(jsonb_build_object('tipo','xp_ganho','gain',mi.xp,'from_xp',from_xp,'titulo',mi.titulo,'seen',false,'ts',(extract(epoch from now())*1000)::bigint)) where id=j.membro_id;
 end if;
 update public.acolitos_bonus_jogos set concluido_em=now() where id=j.id;
 return jsonb_build_object('ok',true,'novo',novo,'xp',case when novo then mi.xp else 0 end);
end $$;
revoke all on function public.acolitos_bonus_responder(uuid,jsonb) from public,anon;
grant execute on function public.acolitos_bonus_responder(uuid,jsonb) to authenticated;

create or replace function public.acolitos_bonus_enviar(p_membro uuid,p_missao uuid,p_relato text,p_foto text default null) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare mi record;valor text;
begin
 perform public.acolitos_xp_servico_meus(p_membro);
 if not exists(select 1 from public.acolitos_membros where id=p_membro and status='ativo' and serve) then raise exception 'Perfil indisponível.' using errcode='42501';end if;
 select * into mi from public.acolitos_missoes where id=p_missao and criterio->'bonus_semanal'->>'tipo' in ('foto','grupo');
 if mi.id is null or now()>((mi.expira_em+8)::timestamp at time zone 'America/Sao_Paulo') then raise exception 'Missão fora do prazo.';end if;
 if (not mi.ativo or mi.expira_em<(now() at time zone 'America/Sao_Paulo')::date) and not exists(select 1 from public.acolitos_bonus_jogos where membro_id=p_membro and missao_id=p_missao and iniciado_em<((mi.expira_em+1)::timestamp at time zone 'America/Sao_Paulo')) then raise exception 'Comece uma aventura disponível nesta semana.';end if;
 if coalesce(length(trim(p_relato)),0)<5 or length(p_relato)>1500 then raise exception 'Conte sua descoberta em uma frase (até 1.500 caracteres).';end if;
 if mi.criterio->'bonus_semanal'->>'tipo'='foto' and p_foto is null then raise exception 'Escolha uma foto desta missão.';end if;
 if p_foto is not null then
  if split_part(p_foto,'/',1)<>auth.uid()::text or split_part(p_foto,'/',2)<>p_missao::text or not exists(select 1 from storage.objects where bucket_id='acolitos-quests-evidencias' and name=p_foto) then raise exception 'Escolha e envie uma foto válida desta missão.';end if;
 end if;
 valor:=jsonb_build_object('tipo','bonus_evidencia','relato',trim(p_relato),'foto',p_foto)::text;
 insert into public.acolitos_missao_progresso(missao_id,membro_id,status,evidencia) values(p_missao,p_membro,'em_analise',valor)
 on conflict(missao_id,membro_id) do update set status='em_analise',evidencia=excluded.evidencia where acolitos_missao_progresso.status in ('revisao','em_analise');
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.acolitos_bonus_enviar(uuid,uuid,text,text) from public,anon;
grant execute on function public.acolitos_bonus_enviar(uuid,uuid,text,text) to authenticated;

create or replace function public.acolitos_jornada_push_reservar(p_usuario uuid,p_semana date,p_slot text,p_payload jsonb,p_limite int default 2) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare id_novo uuid;
begin
 if auth.role()<>'service_role' then raise exception 'Sem permissão.' using errcode='42501';end if;
 if p_slot not in ('sexta','sabado','domingo','resumo') or p_limite not between 1 and 3 then raise exception 'Agendamento inválido.';end if;
 perform pg_advisory_xact_lock(hashtextextended('push-jornada:'||p_usuario::text||p_semana::text,0));
 if p_slot<>'resumo' and (select count(*) from public.acolitos_jornada_push where usuario_id=p_usuario and semana=p_semana and slot<>'resumo')>=p_limite then return null;end if;
 insert into public.acolitos_jornada_push(usuario_id,semana,slot,payload) values(p_usuario,p_semana,p_slot,p_payload) on conflict do nothing returning id into id_novo;
 return id_novo;
end $$;
revoke all on function public.acolitos_jornada_push_reservar(uuid,date,text,jsonb,int) from public,anon,authenticated;
grant execute on function public.acolitos_jornada_push_reservar(uuid,date,text,jsonb,int) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('acolitos-quests-evidencias','acolitos-quests-evidencias',false,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
drop policy if exists "Jornada envia propria evidencia" on storage.objects;
create policy "Jornada envia propria evidencia" on storage.objects for insert to authenticated with check(bucket_id='acolitos-quests-evidencias' and split_part(name,'/',1)=(select auth.uid())::text and exists(select 1 from public.pastoral_members pm join public.pastoral_modules mo on mo.id=pm.module_id where pm.user_id=(select auth.uid()) and mo.slug='acolitos' and pm.role<>'novo'));
drop policy if exists "Jornada le evidencia autorizada" on storage.objects;
create policy "Jornada le evidencia autorizada" on storage.objects for select to authenticated using(bucket_id='acolitos-quests-evidencias' and (split_part(name,'/',1)=(select auth.uid())::text or public.acolitos_get_role((select auth.uid())) in ('coord_admin','subadmin') or (public.acolitos_get_role((select auth.uid()))='membro_equipe' and exists(select 1 from public.acolitos_membros m where m.user_id=(select auth.uid()) and 'jornada'=any(m.permissoes)))));
commit;
