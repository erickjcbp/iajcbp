begin;
do $$
declare c uuid; a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); negou boolean:=false; r jsonb;
begin
  select pm.user_id into c from public.pastoral_members pm join public.pastoral_modules md on md.id=pm.module_id where md.slug='acolitos' and pm.role='coord_admin' limit 1;
  insert into public.acolitos_membros(id,nome,status,serve,nivel) values(a,'Prova serve','ativo',true,'coroinha'),(b,'Prova não serve','ativo',false,'coroinha');
  insert into public.acolitos_habilitacoes(membro_id,funcao,proficiencia) values(b,'apoio','apto');
  insert into public.acolitos_disponibilidade(membro_id,dia,horario) values(b,'domingo','9h');
  perform set_config('request.jwt.claim.sub',c::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);
  execute 'set local role authenticated';
  r:=public.acolitos_roster_substituicao();
  if r->'membros' @> jsonb_build_array(jsonb_build_object('id',b)) then raise exception 'Quem não serve entrou no roster'; end if;
  if not(r->'membros' @> jsonb_build_array(jsonb_build_object('id',a))) then raise exception 'Quem serve desapareceu'; end if;
  if public.acolitos_roster_nomes() @> jsonb_build_array(jsonb_build_object('id',b)) then raise exception 'Quem não serve entrou na lista de nomes'; end if;
  if public.acolitos_habilitados_funcao('apoio')->'membros' @> jsonb_build_array(jsonb_build_object('id',b)) then raise exception 'Quem não serve virou candidato por aptidão'; end if;
  r:=public.acolitos_destaques()::jsonb;
  if r->'versateis' @> jsonb_build_array(jsonb_build_object('id',b)) or r->'prontos' @> jsonb_build_array(jsonb_build_object('id',b)) then raise exception 'Quem não serve apareceu nos destaques'; end if;
  if exists(select 1 from public.acolitos_formacao_acompanhamento() where membro_id=b) then raise exception 'Quem não serve apareceu na formação'; end if;
  begin perform public.acolitos_jornada_editar_lote(array[a,b],'nivel','{"nivel":"acolito_guardiao"}');exception when others then negou:=true;end;
  if not negou or (select nivel from public.acolitos_membros where id=a)<>'coroinha' then raise exception 'Lote misto não foi recusado inteiro'; end if;
  execute 'reset role';
end $$;
rollback;
select 'Listas de serviço, aptidão, destaques, formação e proteção do lote: OK. Testes descartados.' as prova;
