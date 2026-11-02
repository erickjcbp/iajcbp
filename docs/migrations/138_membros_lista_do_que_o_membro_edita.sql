-- Substitui a trava da 137, que listava só três colunas proibidas. Agora vale o contrário:
-- membro comum altera apenas as colunas de CAMPOS_OBRIGATORIOS (shared.js) e as de perfil
-- abaixo. Coluna nova nasce protegida. Quem está na coordenação segue a regra por papel:
-- coord_admin e subadmin livres; membro_equipe só mexe em acesso com permissão membros ou
-- casas, nunca no próprio acesso nem no de coord_admin/subadmin. O servidor (sync_role)
-- continua sendo o único caminho que troca papel de verdade.
-- `cadastrado_por` liga a ficha sem conta (irmão) a quem a criou, para o CRM conferir o dono.
begin;
alter table public.acolitos_membros add column if not exists cadastrado_por uuid;
comment on column public.acolitos_membros.cadastrado_por is
'Conta que criou a ficha pelo app; gravada pelo gatilho proteger_acesso, nunca pelo cliente.';

create or replace function public._acolitos_proteger_acesso()
returns trigger language plpgsql set search_path to 'public','pg_temp' as $$
declare
 uid uuid:=auth.uid();papel text;mudou_acesso boolean;pode boolean;
 editaveis constant text[]:=array['data_nascimento','telefone','telefone_whatsapp','comunidade','endereco',
  'celular_recado','responsavel','celular_mae','responsavel_whatsapp','pode_outras_comunidades',
  'necessidades_especiais','batismo','primeira_eucaristia','crisma','investido','tem_tunica',
  'no_grupo_whatsapp','foto_url','apelido','avisos','nivel_visto','senha_provisoria'];
begin
 if current_user not in('authenticated','anon') then return new;end if;
 papel:=coalesce(public.acolitos_get_role(uid),'');
 if papel in('coord_admin','subadmin') then return new;end if;

 if papel='membro_equipe' then
  if tg_op='INSERT' then
   mudou_acesso:=coalesce(new.eh_equipe,false) or coalesce(new.permissoes,'{}')<>'{}' or coalesce(new.setores,'{}')<>'{}' or new.user_id is not null;
  else
   mudou_acesso:=new.eh_equipe is distinct from old.eh_equipe or new.permissoes is distinct from old.permissoes
    or new.setores is distinct from old.setores or new.user_id is distinct from old.user_id
    or new.cadastrado_por is distinct from old.cadastrado_por;
  end if;
  if not mudou_acesso then return new;end if;
  select coalesce(c.permissoes,'{}') && array['membros','casas'] into pode from public.acolitos_membros c where c.user_id=uid;
  if not coalesce(pode,false) or (tg_op='UPDATE' and (old.user_id=uid or new.user_id is distinct from old.user_id or new.cadastrado_por is distinct from old.cadastrado_por))
     or exists(select 1 from public.pastoral_members pm where pm.user_id=new.user_id and pm.role in('coord_admin','subadmin')) then
   raise exception 'Acesso e setores são definidos pela coordenação' using errcode='42501';
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

create or replace function public.acolitos_crm_pode_abrir(p_membro uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select auth.uid() is not null and exists(select 1 from public.acolitos_membros m
  where m.id=p_membro and m.status='em_integracao'
    and (m.user_id=auth.uid() or (m.user_id is null and m.cadastrado_por=auth.uid())))
$$;
revoke all on function public.acolitos_crm_pode_abrir(uuid) from public,anon;
grant execute on function public.acolitos_crm_pode_abrir(uuid) to authenticated;
commit;
