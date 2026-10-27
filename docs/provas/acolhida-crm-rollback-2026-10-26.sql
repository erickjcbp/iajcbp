begin;

create table if not exists public.tarcisio_acolhida_config(id boolean primary key default true check(id),ativa boolean not null default false,updated_at timestamptz not null default now());
insert into public.tarcisio_acolhida_config(id) values(true) on conflict do nothing;
create table if not exists public.tarcisio_acolhida(membro_id uuid primary key references public.acolitos_membros(id) on delete cascade,pausado boolean not null default false,marcos jsonb not null default '{}',acolhido_em timestamptz,ultimo_encontro int not null default 0 check(ultimo_encontro between 0 and 14),ultimo_envio_em timestamptz,updated_at timestamptz not null default now());
create table if not exists public.tarcisio_acolhida_envios(envio_id uuid primary key references public.tarcisio_envios(id) on delete cascade,membros uuid[] not null,numero text not null,canal text not null check(canal in ('jovem','responsavel')),tipo text not null check(tipo in ('acolhida','catequese','prazo30','prazo45')),indice int not null default 0,data_sp date not null,consolidado boolean not null default false,created_at timestamptz not null default now());
create or replace function public.tarcisio_acolhida_coord() returns boolean language sql stable security invoker set search_path=public,pg_temp as $$select auth.role()='service_role' or public.acolitos_get_role(auth.uid()) in ('coord_admin','subadmin') or exists(select 1 from public.acolitos_membros where user_id=auth.uid() and 'crm'=any(permissoes))$$;
revoke all on function public.tarcisio_acolhida_coord() from public,anon;
grant execute on function public.tarcisio_acolhida_coord() to authenticated,service_role;
alter table public.tarcisio_acolhida_config enable row level security;
alter table public.tarcisio_acolhida enable row level security;
alter table public.tarcisio_acolhida_envios enable row level security;
revoke all on public.tarcisio_acolhida_config,public.tarcisio_acolhida,public.tarcisio_acolhida_envios from public,anon,authenticated;
grant select on public.tarcisio_acolhida_config,public.tarcisio_acolhida,public.tarcisio_acolhida_envios to authenticated;
grant all on public.tarcisio_acolhida_config,public.tarcisio_acolhida,public.tarcisio_acolhida_envios to service_role;
drop policy if exists acolhida_coord_config on public.tarcisio_acolhida_config;
create policy acolhida_coord_config on public.tarcisio_acolhida_config for select to authenticated using(public.tarcisio_acolhida_coord());
drop policy if exists acolhida_coord_estado on public.tarcisio_acolhida;
create policy acolhida_coord_estado on public.tarcisio_acolhida for select to authenticated using(public.tarcisio_acolhida_coord());
drop policy if exists acolhida_coord_envios on public.tarcisio_acolhida_envios;
create policy acolhida_coord_envios on public.tarcisio_acolhida_envios for select to authenticated using(public.tarcisio_acolhida_coord());
create or replace function public.tarcisio_acolhida_controlar(p_membro uuid default null,p_ativa boolean default null,p_pausado boolean default null) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$begin
 if not public.tarcisio_acolhida_coord() then raise exception 'Sem permissão.' using errcode='42501';end if;
 if p_ativa is not null then update public.tarcisio_acolhida_config set ativa=p_ativa,updated_at=now();end if;
 if p_membro is not null and p_pausado is not null then
 insert into public.tarcisio_acolhida(membro_id,pausado) values(p_membro,p_pausado) on conflict(membro_id) do update set pausado=excluded.pausado,updated_at=now();
 insert into public.acolitos_crm_comentarios(membro_id,autor_id,texto) values(p_membro,auth.uid(),case when p_pausado then 'Acompanhamento do Tarcísio pausado pela coordenação.' else 'Acompanhamento do Tarcísio retomado pela coordenação.' end);
 end if;
 return jsonb_build_object('ok',true);end$$;
revoke all on function public.tarcisio_acolhida_controlar(uuid,boolean,boolean) from public,anon;
grant execute on function public.tarcisio_acolhida_controlar(uuid,boolean,boolean) to authenticated,service_role;
create or replace function public.tarcisio_acolhida_agendar(p_numero text,p_canal text,p_membros uuid[],p_tipo text,p_indice int,p_texto text,p_chave text,p_data date) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$declare eid uuid;mid uuid;begin
 if auth.role()<>'service_role' then raise exception 'Sem permissão.' using errcode='42501';end if;
 if not (select ativa from public.tarcisio_acolhida_config where id) then return null;end if;
 if p_numero!~'^55[0-9]{11}$' or length(p_texto)<30 or cardinality(p_membros)<1 or p_data<>(now() at time zone 'America/Sao_Paulo')::date or p_chave not like 'acolhida:%' or p_indice not between 0 and 14 then raise exception 'Agendamento inválido.';end if;
 perform pg_advisory_xact_lock(hashtextextended('acolhida:'||p_numero||p_data::text,0));
 if exists(select 1 from public.tarcisio_acolhida_envios where numero=p_numero and data_sp=p_data) then return null;end if;
 foreach mid in array p_membros loop
 if not exists(select 1 from public.acolitos_crm where membro_id=mid and etapa in ('integracao','whatsapp','tunica','disponivel_escala')) or exists(select 1 from public.tarcisio_acolhida where membro_id=mid and pausado) then return null;end if;
 insert into public.tarcisio_acolhida(membro_id) values(mid) on conflict do nothing;
 end loop;
 insert into public.tarcisio_envios(tipo,destino_numero,texto,chave_unica,membro_id) values('aviso',p_numero,p_texto,p_chave,p_membros[1]) on conflict(chave_unica) do nothing returning id into eid;
 if eid is null then return null;end if;
 insert into public.tarcisio_acolhida_envios(envio_id,membros,numero,canal,tipo,indice,data_sp) values(eid,p_membros,p_numero,p_canal,p_tipo,p_indice,p_data);
 return eid;end$$;
revoke all on function public.tarcisio_acolhida_agendar(text,text,uuid[],text,int,text,text,date) from public,anon,authenticated;
grant execute on function public.tarcisio_acolhida_agendar(text,text,uuid[],text,int,text,text,date) to service_role;
create or replace function public.tarcisio_acolhida_entrega(p_envio uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$declare job public.tarcisio_acolhida_envios;ev public.tarcisio_envios;mid uuid;begin
 if auth.role()<>'service_role' then raise exception 'Sem permissão.' using errcode='42501';end if;
 select * into job from public.tarcisio_acolhida_envios where envio_id=p_envio for update;
 if not found or job.consolidado then return jsonb_build_object('ok',true,'nova',false);end if;
 select * into ev from public.tarcisio_envios where id=p_envio;if ev.estado<>'enviado' then return jsonb_build_object('ok',false);end if;
 insert into public.tarcisio_mensagens(numero,direcao,texto,membro_ids,respondida) values(job.numero,'saida',ev.texto,job.membros,true);
 foreach mid in array job.membros loop
 update public.tarcisio_acolhida set marcos=case when job.tipo in ('prazo30','prazo45') then marcos||jsonb_build_object(job.tipo,jsonb_build_object('em',now())) else marcos end,acolhido_em=case when job.tipo='acolhida' then coalesce(acolhido_em,ev.enviado_em) else acolhido_em end,ultimo_encontro=case when job.tipo='catequese' then greatest(ultimo_encontro,job.indice) else ultimo_encontro end,ultimo_envio_em=ev.enviado_em,updated_at=now() where membro_id=mid;
 insert into public.acolitos_crm_comentarios(membro_id,texto) values(mid,'São Tarcísio: '||case when job.tipo='catequese' then 'encontro '||job.indice||'/14 enviado' else job.tipo||' enviado' end||'. Canal: '||job.canal||'. Envio não comprova leitura ou aprendizado.');
 end loop;
 if job.tipo='prazo45' then insert into public.tarcisio_pendencias(tipo,numero,resumo,dados) values('coordenacao',job.numero,'Túnica: prazo de45dias atingido sem confirmação de recebimento.',jsonb_build_object('membro_ids',job.membros));end if;
 update public.tarcisio_acolhida_envios set consolidado=true where envio_id=p_envio;return jsonb_build_object('ok',true,'nova',true);end$$;
revoke all on function public.tarcisio_acolhida_entrega(uuid) from public,anon,authenticated;
grant execute on function public.tarcisio_acolhida_entrega(uuid) to service_role;
create or replace function public.tarcisio_acolhida_registrar(p_membro uuid,p_numero text,p_mensagem uuid,p_marco text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$declare etapa_ant text;etapa_nova text;etapa_original text;txt text;novo boolean;fatos jsonb;begin
 if auth.role()<>'service_role' then raise exception 'Sem permissão.' using errcode='42501';end if;
 if p_marco not in ('contato_raquel','pedido_confirmado','confeccao_iniciada','tunica_recebida','integracao_realizada','grupo_confirmado','pausar','retomar','interacao') then raise exception 'Marco inválido.';end if;
 select texto into txt from public.tarcisio_mensagens where id=p_mensagem and numero=p_numero and direcao='entrada' and created_at>now()-interval '24 hours';if txt is null then raise exception 'Mensagem não comprovada.';end if;
 perform pg_advisory_xact_lock(hashtextextended('acolhida-membro:'||p_membro::text,0));
 select etapa into etapa_ant from public.acolitos_crm where membro_id=p_membro for update;if etapa_ant not in ('integracao','whatsapp','tunica','disponivel_escala') or etapa_ant is null then return jsonb_build_object('erro','fora_da_integracao');end if;
 insert into public.tarcisio_acolhida(membro_id) values(p_membro) on conflict do nothing;
 novo:=not (select marcos ? p_marco from public.tarcisio_acolhida where membro_id=p_membro) or p_marco in ('pausar','retomar','interacao');etapa_original:=etapa_ant;
 update public.tarcisio_acolhida set marcos=case when novo then marcos||jsonb_build_object(p_marco,jsonb_build_object('em',now(),'mensagem',p_mensagem)) else marcos end,pausado=case when p_marco='pausar' then true when p_marco='retomar' then false else pausado end,updated_at=now() where membro_id=p_membro;
 if p_marco='tunica_recebida' then update public.acolitos_membros set tem_tunica=true where id=p_membro;end if;
 if p_marco='grupo_confirmado' then update public.acolitos_membros set no_grupo_whatsapp=true where id=p_membro;end if;
 select marcos into fatos from public.tarcisio_acolhida where membro_id=p_membro;
 loop
 etapa_nova:=case when etapa_ant='integracao' and fatos ? 'integracao_realizada' then 'whatsapp' when etapa_ant='whatsapp' and fatos ? 'grupo_confirmado' then 'tunica' when etapa_ant='tunica' and fatos ? 'tunica_recebida' then 'disponivel_escala' else etapa_ant end;
 exit when etapa_nova=etapa_ant;
 update public.acolitos_crm set etapa=etapa_nova,etapa_iniciada_em=now() where membro_id=p_membro;
 insert into public.acolitos_crm_historico(membro_id,etapa_de,etapa_para) values(p_membro,etapa_ant,etapa_nova);etapa_ant:=etapa_nova;
 end loop;
 if not novo and etapa_original=etapa_nova then return jsonb_build_object('ok',true,'novo',false,'etapa',etapa_nova);end if;
 insert into public.acolitos_crm_comentarios(membro_id,etapa,texto) values(p_membro,etapa_nova,'São Tarcísio registrou '||p_marco||' pela conversa. Mensagem de referência: '||p_mensagem::text||'.');return jsonb_build_object('ok',true,'novo',novo,'etapa',etapa_nova);end$$;
revoke all on function public.tarcisio_acolhida_registrar(uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.tarcisio_acolhida_registrar(uuid,text,uuid,text) to service_role;

do $proof$
declare mid uuid:=gen_random_uuid();eid uuid;eid2 uuid;msg uuid;before_msgs int;result jsonb;
begin
 perform set_config('request.jwt.claim.role','service_role',true);
 insert into public.acolitos_membros(id,nome,nivel,status,serve,data_nascimento,telefone,telefone_whatsapp,celular_mae,responsavel_whatsapp,pode_outras_comunidades) values(mid,'Prova acolhida transacional','aspirante','em_integracao',true,'2016-01-01','19999990000',false,'19999990001',true,false);
 insert into public.acolitos_crm(membro_id,etapa) values(mid,'tunica') on conflict(membro_id) do update set etapa='tunica';
 update public.tarcisio_acolhida_config set ativa=true;
 eid:=public.tarcisio_acolhida_agendar('5519999990001','responsavel',array[mid],'acolhida',0,'Mensagem sintética de prova transacional, sem envio externo.','acolhida:prova:'||mid::text,(now() at time zone 'America/Sao_Paulo')::date);
 if eid is null then raise exception 'não reservou';end if;
 eid2:=public.tarcisio_acolhida_agendar('5519999990001','responsavel',array[mid],'catequese',1,'Outra mensagem sintética de teste que não deve ser reservada.','acolhida:prova2:'||mid::text,(now() at time zone 'America/Sao_Paulo')::date);
 if eid2 is not null then raise exception 'reserva duplicada no mesmo dia';end if;
 select count(*) into before_msgs from public.tarcisio_mensagens where numero='5519999990001';
 update public.tarcisio_envios set estado='enviado',enviado_em=now() where id=eid;
 perform public.tarcisio_acolhida_entrega(eid);perform public.tarcisio_acolhida_entrega(eid);
 if (select count(*) from public.tarcisio_mensagens where numero='5519999990001')<>before_msgs+1 then raise exception 'histórico duplicado';end if;
 insert into public.tarcisio_mensagens(numero,direcao,texto,respondida) values('5519999990001','entrada','Recebi a túnica ontem.',true) returning id into msg;
 result:=public.tarcisio_acolhida_registrar(mid,'5519999990001',msg,'tunica_recebida');
 if result->>'etapa'<>'disponivel_escala' or not (select tem_tunica from public.acolitos_membros where id=mid) then raise exception 'transição incorreta';end if;
 result:=public.tarcisio_acolhida_registrar(mid,'5519999990001',msg,'tunica_recebida');if result->>'novo'<>'false' then raise exception 'registro não idempotente';end if;
 perform set_config('request.jwt.claim.role','authenticated',true);
 begin
 perform public.tarcisio_acolhida_registrar(mid,'5519999990001',msg,'grupo_confirmado');raise exception 'autorização falhou';
 exception when insufficient_privilege then null;end;
 if has_table_privilege('anon','public.tarcisio_acolhida','SELECT') then raise exception 'anon tem acesso';end if;
 perform set_config('request.jwt.claim.role','service_role',true);
 update public.acolitos_crm set etapa='integracao' where membro_id=mid;update public.tarcisio_acolhida set marcos='{}' where membro_id=mid;
 perform public.tarcisio_acolhida_registrar(mid,'5519999990001',msg,'grupo_confirmado');
 perform public.tarcisio_acolhida_registrar(mid,'5519999990001',msg,'tunica_recebida');
 result:=public.tarcisio_acolhida_registrar(mid,'5519999990001',msg,'integracao_realizada');
 if result->>'etapa'<>'disponivel_escala' then raise exception 'marcos fora da ordem travam fluxo';end if;
 raise notice 'PASS: reserva única, entrega/histórico únicos, marco/transição auditados, idempotência e serviço restrito.';
end $proof$;



set local request.jwt.claim.role='authenticated';
set local role authenticated;
select count(*) as dados_visiveis_para_conta_sem_permissao from public.tarcisio_acolhida;
reset role;
rollback;
