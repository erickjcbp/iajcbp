-- 117: controle humano — o Tarcísio PROPÕe sair da CRM (integrado) e entrar nos grupos; a coordenação confirma com um toque
begin;
-- BUG achado pela prova: com uid nulo/sem papel o OR dava NULL e `if not coord()` não barrava. NULL vira false.
CREATE OR REPLACE FUNCTION public.tarcisio_acolhida_coord()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$select coalesce(auth.role()='service_role' or public.acolitos_get_role(auth.uid()) in ('coord_admin','subadmin') or exists(select 1 from public.acolitos_membros where user_id=auth.uid() and 'crm'=any(permissoes)),false)$function$;
revoke all on function public.tarcisio_acolhida_coord() from public,anon;
grant execute on function public.tarcisio_acolhida_coord() to authenticated,service_role;
create table if not exists public.tarcisio_acolhida_propostas(
 id uuid primary key default gen_random_uuid(),
 membro_id uuid not null references public.acolitos_membros(id) on delete cascade,
 acao text not null check(acao in ('integrado','grupos')),
 motivo text not null default '',
 estado text not null default 'pendente' check(estado in ('pendente','confirmada','recusada')),
 criada_em timestamptz not null default now(),
 decidida_em timestamptz,
 decidida_por uuid);
create unique index if not exists tarcisio_acolhida_propostas_pendente on public.tarcisio_acolhida_propostas(membro_id,acao) where estado='pendente';
alter table public.tarcisio_acolhida_propostas enable row level security;
revoke all on public.tarcisio_acolhida_propostas from public,anon,authenticated;
grant select on public.tarcisio_acolhida_propostas to authenticated;
grant all on public.tarcisio_acolhida_propostas to service_role;
drop policy if exists acolhida_propostas_coord on public.tarcisio_acolhida_propostas;
create policy acolhida_propostas_coord on public.tarcisio_acolhida_propostas for select to authenticated using(public.tarcisio_acolhida_coord());
create or replace function public.tarcisio_acolhida_propor(p_membro uuid,p_acao text,p_motivo text) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$declare pid uuid;v_nome text;begin
 if auth.role()<>'service_role' then raise exception 'Sem permissão.' using errcode='42501';end if;
 if exists(select 1 from public.tarcisio_acolhida_propostas where membro_id=p_membro and acao=p_acao and estado in ('pendente','confirmada')) then return null;end if;
 insert into public.tarcisio_acolhida_propostas(membro_id,acao,motivo) values(p_membro,p_acao,left(coalesce(p_motivo,''),300)) returning id into pid;
 select m.nome into v_nome from public.acolitos_membros m where m.id=p_membro;
 insert into public.tarcisio_pendencias(tipo,numero,resumo,dados) values('coordenacao','','Tarcísio propõe '||case p_acao when 'integrado' then 'tirar '||coalesce(v_nome,'o membro')||' da CRM (integrado)' else 'adicionar '||coalesce(v_nome,'o membro')||' aos grupos de WhatsApp' end||': '||left(coalesce(p_motivo,''),200)||'. Confirme no CRM, em "Acolhida pelo Tarcísio".',jsonb_build_object('acolhida','proposta','proposta_id',pid,'membro_id',p_membro));
 return pid;end$$;
revoke all on function public.tarcisio_acolhida_propor(uuid,text,text) from public,anon,authenticated;
grant execute on function public.tarcisio_acolhida_propor(uuid,text,text) to service_role;
-- só a coordenação decide; confirmar 'integrado' faz o mesmo que o botão manual (o gatilho acolitos_crm_integrado dá o nível aspirante e Apoio apto)
create or replace function public.tarcisio_acolhida_decidir(p_proposta uuid,p_confirmar boolean) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$declare pr public.tarcisio_acolhida_propostas;e text;begin
 if not public.tarcisio_acolhida_coord() or auth.role()='anon' then raise exception 'Sem permissão.' using errcode='42501';end if;
 select * into pr from public.tarcisio_acolhida_propostas where id=p_proposta for update;
 if not found or pr.estado<>'pendente' then return jsonb_build_object('ok',false,'motivo','proposta_ja_decidida');end if;
 if p_confirmar and pr.acao='integrado' then
  select etapa into e from public.acolitos_crm where membro_id=pr.membro_id for update;
  if e is null or e='integrado' then update public.tarcisio_acolhida_propostas set estado='recusada',decidida_em=now(),decidida_por=auth.uid() where id=p_proposta;return jsonb_build_object('ok',false,'motivo','fora_da_crm');end if;
  update public.acolitos_crm set etapa='integrado',etapa_iniciada_em=now() where membro_id=pr.membro_id;
  insert into public.acolitos_crm_historico(membro_id,etapa_de,etapa_para,changed_by) values(pr.membro_id,e,'integrado',auth.uid());
  update public.acolitos_membros set status='ativo' where id=pr.membro_id and status='em_integracao';
  insert into public.acolitos_crm_comentarios(membro_id,autor_id,etapa,etapa_de,etapa_para,texto) values(pr.membro_id,auth.uid(),'integrado',e,'integrado','Coordenação confirmou a proposta do Tarcísio: '||pr.motivo);
 end if;
 update public.tarcisio_acolhida_propostas set estado=case when p_confirmar then 'confirmada' else 'recusada' end,decidida_em=now(),decidida_por=auth.uid() where id=p_proposta;
 update public.tarcisio_pendencias set estado='resolvida' where estado='aberta' and dados @> jsonb_build_object('acolhida','proposta','proposta_id',p_proposta);
 return jsonb_build_object('ok',true,'estado',case when p_confirmar then 'confirmada' else 'recusada' end);end$$;
revoke all on function public.tarcisio_acolhida_decidir(uuid,boolean) from public,anon;
grant execute on function public.tarcisio_acolhida_decidir(uuid,boolean) to authenticated,service_role;
CREATE OR REPLACE FUNCTION public.tarcisio_acolhida_registrar(p_membro uuid, p_numero text, p_mensagem uuid, p_marco text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$declare etapa_ant text;etapa_nova text;etapa_original text;txt text;novo boolean;fatos jsonb;begin
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
 etapa_nova:=case when etapa_ant='integracao' and fatos ? 'integracao_realizada' then 'whatsapp' when etapa_ant='whatsapp' and fatos ? 'grupo_confirmado' then 'tunica' when etapa_ant='tunica' and fatos ? 'tunica_recebida' then 'disponivel_escala' else etapa_ant end;
 exit when etapa_nova=etapa_ant;
 update public.acolitos_crm set etapa=etapa_nova,etapa_iniciada_em=now() where membro_id=p_membro;
 
 insert into public.acolitos_crm_historico(membro_id,etapa_de,etapa_para) values(p_membro,etapa_ant,etapa_nova);etapa_ant:=etapa_nova;
 end loop;
 if fatos ? 'tunica_recebida' and etapa_nova='disponivel_escala' then perform public.tarcisio_acolhida_propor(p_membro,'integrado','túnica recebida pela família ('||to_char(now() at time zone 'America/Sao_Paulo','DD/MM')||')');end if;
 if not novo and etapa_original=etapa_nova then return jsonb_build_object('ok',true,'novo',false,'etapa',etapa_nova);end if;
 insert into public.acolitos_crm_comentarios(membro_id,etapa,texto) values(p_membro,etapa_nova,'Tarcísio registrou '||p_marco||' pela conversa. Mensagem de referência: '||p_mensagem::text||'.');return jsonb_build_object('ok',true,'novo',novo,'etapa',etapa_nova);end$function$;
revoke all on function public.tarcisio_acolhida_registrar(uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.tarcisio_acolhida_registrar(uuid,text,uuid,text) to service_role;
commit;
