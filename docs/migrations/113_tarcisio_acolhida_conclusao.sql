-- 113: túnica recebida conclui a integração (tunica -> disponivel_escala -> integrado; o gatilho acolitos_crm_integrado dá o degrau aspirante e Apoio apto);
-- catequese continua para quem já saiu da CRM por este fluxo; novo marco respondeu_tunica. Decisão do dono em 27/10/2026.
begin;
create or replace function public.tarcisio_acolhida_agendar(p_numero text,p_canal text,p_membros uuid[],p_tipo text,p_indice int,p_texto text,p_chave text,p_data date) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$declare eid uuid;mid uuid;begin
 if auth.role()<>'service_role' then raise exception 'Sem permissão.' using errcode='42501';end if;
 if not (select ativa from public.tarcisio_acolhida_config where id) then return null;end if;
 if p_numero!~'^55[0-9]{11}$' or length(p_texto)<30 or cardinality(p_membros)<1 or p_data<>(now() at time zone 'America/Sao_Paulo')::date or p_chave not like 'acolhida:%' or p_indice not between 0 and 14 then raise exception 'Agendamento inválido.';end if;
 perform pg_advisory_xact_lock(hashtextextended('acolhida:'||p_numero||p_data::text,0));
 if exists(select 1 from public.tarcisio_acolhida_envios where numero=p_numero and data_sp=p_data) then return null;end if;
 foreach mid in array p_membros loop
 if not (exists(select 1 from public.acolitos_crm where membro_id=mid and etapa in ('integracao','whatsapp','tunica','disponivel_escala')) or (p_tipo='catequese' and exists(select 1 from public.acolitos_crm c join public.tarcisio_acolhida a on a.membro_id=c.membro_id where c.membro_id=mid and c.etapa='integrado' and a.acolhido_em is not null))) or exists(select 1 from public.tarcisio_acolhida where membro_id=mid and pausado) then return null;end if;
 insert into public.tarcisio_acolhida(membro_id) values(mid) on conflict do nothing;
 end loop;
 insert into public.tarcisio_envios(tipo,destino_numero,texto,chave_unica,membro_id) values('aviso',p_numero,p_texto,p_chave,p_membros[1]) on conflict(chave_unica) do nothing returning id into eid;
 if eid is null then return null;end if;
 insert into public.tarcisio_acolhida_envios(envio_id,membros,numero,canal,tipo,indice,data_sp) values(eid,p_membros,p_numero,p_canal,p_tipo,p_indice,p_data);
 return eid;end$$;
revoke all on function public.tarcisio_acolhida_agendar(text,text,uuid[],text,int,text,text,date) from public,anon,authenticated;
grant execute on function public.tarcisio_acolhida_agendar(text,text,uuid[],text,int,text,text,date) to service_role;
create or replace function public.tarcisio_acolhida_registrar(p_membro uuid,p_numero text,p_mensagem uuid,p_marco text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$declare etapa_ant text;etapa_nova text;etapa_original text;txt text;novo boolean;fatos jsonb;begin
 if auth.role()<>'service_role' then raise exception 'Sem permissão.' using errcode='42501';end if;
 if p_marco not in ('contato_raquel','pedido_confirmado','confeccao_iniciada','tunica_recebida','integracao_realizada','grupo_confirmado','respondeu_tunica','pausar','retomar','interacao') then raise exception 'Marco inválido.';end if;
 select texto into txt from public.tarcisio_mensagens where id=p_mensagem and numero=p_numero and direcao='entrada' and created_at>now()-interval '24 hours';if txt is null then raise exception 'Mensagem não comprovada.';end if;
 perform pg_advisory_xact_lock(hashtextextended('acolhida-membro:'||p_membro::text,0));
 select etapa into etapa_ant from public.acolitos_crm where membro_id=p_membro for update;if etapa_ant is null or (etapa_ant not in ('integracao','whatsapp','tunica','disponivel_escala') and not (etapa_ant='integrado' and exists(select 1 from public.tarcisio_acolhida where membro_id=p_membro and acolhido_em is not null))) then return jsonb_build_object('erro','fora_da_integracao');end if;
 insert into public.tarcisio_acolhida(membro_id) values(p_membro) on conflict do nothing;
 novo:=not (select marcos ? p_marco from public.tarcisio_acolhida where membro_id=p_membro) or p_marco in ('pausar','retomar','interacao');etapa_original:=etapa_ant;
 update public.tarcisio_acolhida set marcos=case when novo then marcos||jsonb_build_object(p_marco,jsonb_build_object('em',now(),'mensagem',p_mensagem)) else marcos end,pausado=case when p_marco='pausar' then true when p_marco='retomar' then false else pausado end,updated_at=now() where membro_id=p_membro;
 if p_marco='tunica_recebida' then update public.acolitos_membros set tem_tunica=true where id=p_membro;end if;
 if p_marco='grupo_confirmado' then update public.acolitos_membros set no_grupo_whatsapp=true where id=p_membro;end if;
 select marcos into fatos from public.tarcisio_acolhida where membro_id=p_membro;
 loop
 etapa_nova:=case when etapa_ant='integracao' and fatos ? 'integracao_realizada' then 'whatsapp' when etapa_ant='whatsapp' and fatos ? 'grupo_confirmado' then 'tunica' when etapa_ant='tunica' and fatos ? 'tunica_recebida' then 'disponivel_escala' when etapa_ant='disponivel_escala' and fatos ? 'tunica_recebida' then 'integrado' else etapa_ant end;
 exit when etapa_nova=etapa_ant;
 update public.acolitos_crm set etapa=etapa_nova,etapa_iniciada_em=now() where membro_id=p_membro;
 if etapa_nova='integrado' then update public.acolitos_membros set status='ativo' where id=p_membro and status='em_integracao';end if;
 insert into public.acolitos_crm_historico(membro_id,etapa_de,etapa_para) values(p_membro,etapa_ant,etapa_nova);etapa_ant:=etapa_nova;
 end loop;
 if not novo and etapa_original=etapa_nova then return jsonb_build_object('ok',true,'novo',false,'etapa',etapa_nova);end if;
 insert into public.acolitos_crm_comentarios(membro_id,etapa,texto) values(p_membro,etapa_nova,'São Tarcísio registrou '||p_marco||' pela conversa. Mensagem de referência: '||p_mensagem::text||'.');return jsonb_build_object('ok',true,'novo',novo,'etapa',etapa_nova);end$$;
revoke all on function public.tarcisio_acolhida_registrar(uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.tarcisio_acolhida_registrar(uuid,text,uuid,text) to service_role;
commit;
