-- Completa a 140: disponibilidade e funções também são parte da ficha, então só coord_admin e
-- subadmin gravam. A equipe segue lendo, e a família segue cuidando da própria disponibilidade
-- pela política dela. Gatilhos e o Tarcísio não passam pela RLS.
-- Também fecha o que a 140 deixou: a política FOR ALL da equipe permitia apagar ficha e criar
-- ficha com conta alheia ou nível. Equipe fica só com UPDATE, que o gatilho limita.
begin;
drop policy if exists "Equipe gerencia disp" on public.acolitos_disponibilidade;
create policy "Equipe le disp" on public.acolitos_disponibilidade for select to authenticated
 using (public.acolitos_get_role(auth.uid()) in ('coord_admin','subadmin','membro_equipe'));
create policy "Admin gerencia disp" on public.acolitos_disponibilidade for all to authenticated
 using (public.acolitos_get_role(auth.uid()) in ('coord_admin','subadmin'))
 with check (public.acolitos_get_role(auth.uid()) in ('coord_admin','subadmin'));
drop policy if exists "Equipe gerencia hab" on public.acolitos_habilitacoes;
create policy "Equipe le hab" on public.acolitos_habilitacoes for select to authenticated
 using (public.acolitos_get_role(auth.uid()) in ('coord_admin','subadmin','membro_equipe'));
create policy "Admin gerencia hab" on public.acolitos_habilitacoes for all to authenticated
 using (public.acolitos_get_role(auth.uid()) in ('coord_admin','subadmin'))
 with check (public.acolitos_get_role(auth.uid()) in ('coord_admin','subadmin'));
drop policy if exists "Equipe gerencia membros" on public.acolitos_membros;
create policy "Admin gerencia membros" on public.acolitos_membros for all to authenticated
 using (public.acolitos_get_role(auth.uid()) in ('coord_admin','subadmin'))
 with check (public.acolitos_get_role(auth.uid()) in ('coord_admin','subadmin'));
create policy "Equipe atualiza membros" on public.acolitos_membros for update to authenticated
 using (public.acolitos_get_role(auth.uid())='membro_equipe')
 with check (public.acolitos_get_role(auth.uid())='membro_equipe');
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
  if new.status is distinct from 'em_integracao' or (new.user_id is not null and new.user_id is distinct from uid)
     or coalesce(new.nivel,'aspirante')<>'aspirante' or coalesce(new.eh_equipe,false) or coalesce(new.permissoes,'{}')<>'{}'
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
commit;
