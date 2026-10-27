-- 115: a integração é um único vídeo com legenda (decisão do dono, 27/10/2026)
begin;
CREATE OR REPLACE FUNCTION public.tarcisio_acolhida_entrega(p_envio uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$declare job public.tarcisio_acolhida_envios;ev public.tarcisio_envios;mid uuid;begin
 if auth.role()<>'service_role' then raise exception 'Sem permissão.' using errcode='42501';end if;
 select * into job from public.tarcisio_acolhida_envios where envio_id=p_envio for update;
 if not found or job.consolidado then return jsonb_build_object('ok',true,'nova',false);end if;
 select * into ev from public.tarcisio_envios where id=p_envio;if ev.estado<>'enviado' then return jsonb_build_object('ok',false);end if;
 insert into public.tarcisio_mensagens(numero,direcao,texto,membro_ids,respondida) values(job.numero,'saida',ev.texto,job.membros,true);
 foreach mid in array job.membros loop
 update public.tarcisio_acolhida set marcos=case when job.tipo in ('prazo30','prazo45') then marcos||jsonb_build_object(job.tipo,jsonb_build_object('em',now())) else marcos end,acolhido_em=case when job.tipo='acolhida' then coalesce(acolhido_em,ev.enviado_em) else acolhido_em end,ultimo_encontro=case when job.tipo='catequese' then greatest(ultimo_encontro,job.indice) else ultimo_encontro end,integracao_passo=case when job.tipo='integracao' then greatest(integracao_passo,job.indice) else integracao_passo end,ultimo_envio_em=ev.enviado_em,updated_at=now() where membro_id=mid;
 insert into public.acolitos_crm_comentarios(membro_id,texto) values(mid,'Tarcísio: '||case when job.tipo='catequese' then 'encontro '||job.indice||'/14 enviado' when job.tipo='integracao' then 'vídeo de integração enviado' else job.tipo||' enviado' end||'. Canal: '||job.canal||'. Envio não comprova leitura ou aprendizado.');
 end loop;
 if job.tipo='prazo45' then insert into public.tarcisio_pendencias(tipo,numero,resumo,dados) values('coordenacao',job.numero,'Túnica: prazo de45dias atingido sem confirmação de recebimento.',jsonb_build_object('membro_ids',job.membros));end if;
 update public.tarcisio_acolhida_envios set consolidado=true where envio_id=p_envio;return jsonb_build_object('ok',true,'nova',true);end$function$;
revoke all on function public.tarcisio_acolhida_entrega(uuid) from public,anon,authenticated;
grant execute on function public.tarcisio_acolhida_entrega(uuid) to service_role;
commit;
