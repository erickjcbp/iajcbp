-- Regra do dono (02/11/2026): só coord_admin e subadmin editam fichas; equipe é equipe.
-- Em ficha alheia, a equipe grava apenas o que o trabalho diário exige: `avisos` (recados e
-- boas-vindas) e `no_grupo_whatsapp` (sair dessa etapa do CRM). Na própria ficha, e na dos
-- irmãos da mesma conta de família, vale a lista de qualquer membro.
-- Ativar quem sai do CRM passa para o banco, porque a tela da equipe não pode mais gravar status.
-- anon perde toda escrita. Exceção: INSERT em access_requests, único formulário público com
-- política própria. O SELECT fica: as políticas de outras tabelas dependem dele.
begin;
create or replace function public._acolitos_proteger_acesso()
returns trigger language plpgsql set search_path to 'public','pg_temp' as $$
declare
 uid uuid:=auth.uid();papel text;
 editaveis constant text[]:=array['data_nascimento','telefone','telefone_whatsapp','comunidade','endereco',
  'celular_recado','responsavel','celular_mae','responsavel_whatsapp','pode_outras_comunidades',
  'necessidades_especiais','batismo','primeira_eucaristia','crisma','investido','tem_tunica',
  'no_grupo_whatsapp','foto_url','apelido','avisos','nivel_visto','senha_provisoria'];
 da_equipe constant text[]:=array['avisos','no_grupo_whatsapp'];
begin
 if current_user not in('authenticated','anon') then return new;end if;
 papel:=coalesce(public.acolitos_get_role(uid),'');
 if papel in('coord_admin','subadmin') then return new;end if;

 if tg_op='UPDATE' and papel='membro_equipe' and old.user_id is distinct from uid
    and (old.grupo_irmaos is null or old.grupo_irmaos is distinct from public.acolitos_meu_grupo()) then
  if (to_jsonb(new)-da_equipe) is distinct from (to_jsonb(old)-da_equipe) then
   raise exception 'Só administradores editam fichas' using errcode='42501';
  end if;
  return new;
 end if;

 if tg_op='INSERT' then
  if new.status is distinct from 'em_integracao' or coalesce(new.eh_equipe,false) or coalesce(new.permissoes,'{}')<>'{}'
     or coalesce(new.setores,'{}')<>'{}' or new.serve is false or new.casa_id is not null or new.grupo_irmaos is not null
     or new.irmao_id is not null or coalesce(new.xp_avulso,0)<>0 or new.suspenso_ate is not null or new.suspenso_em is not null
     or coalesce(new.avisos,'[]'::jsonb)<>'[]'::jsonb or new.mensagem_coordenacao is not null then
   raise exception 'Cadastro novo não define dados da coordenação' using errcode='42501';
  end if;
  new.cadastrado_por:=uid;
 elsif (to_jsonb(new)-editaveis) is distinct from (to_jsonb(old)-editaveis) then
  raise exception 'Este dado é definido pela coordenação' using errcode='42501';
 end if;
 return new;
end $$;
revoke all on function public._acolitos_proteger_acesso() from public,anon,authenticated;

create or replace function public.acolitos_integrado_atualiza_papel()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.etapa is distinct from 'integrado' then return new; end if;
 if auth.role() in ('authenticated','anon')
    and coalesce(public.acolitos_get_role(auth.uid()),'') not in ('coord_admin','subadmin','membro_equipe') then
  return new;
 end if;
 update public.acolitos_membros set status='ativo' where id=new.membro_id and status='em_integracao';
 update public.pastoral_members pm
    set role=public.acolitos_papel_do_nivel(m.nivel)
   from public.acolitos_membros m,public.pastoral_modules mo
  where m.id=new.membro_id and pm.user_id=m.user_id and mo.id=pm.module_id
    and mo.slug='acolitos' and pm.role='novo';
 return new;
end $$;
revoke all on function public.acolitos_integrado_atualiza_papel() from public,anon,authenticated;

do $$declare t text;begin
 for t in select tablename from pg_tables where schemaname='public' loop
  execute format('revoke insert,update,delete,truncate,trigger,references on public.%I from anon',t);
  execute format('revoke truncate,trigger,references on public.%I from authenticated',t);
 end loop;
end $$;
grant insert on public.access_requests to anon;
alter default privileges in schema public revoke insert,update,delete,truncate,trigger,references on tables from anon;
alter default privileges in schema public revoke truncate,trigger,references on tables from authenticated;
commit;
