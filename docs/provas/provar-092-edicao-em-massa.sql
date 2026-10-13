begin;
do $$
declare v_coord uuid; a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); r jsonb; negou boolean:=false;
begin
  select pm.user_id into v_coord from public.pastoral_members pm join public.pastoral_modules md on md.id=pm.module_id where md.slug='acolitos' and pm.role='coord_admin' limit 1;
  if v_coord is null then raise exception 'Sem coordenação para prova'; end if;
  insert into public.acolitos_membros(id,nome,status,nivel) values(a,'Prova lote A','ativo','coroinha'),(b,'Prova lote B','ativo','coroinha');
  perform set_config('request.jwt.claim.sub',v_coord::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);
  execute 'set local role authenticated';
  r:=public.acolitos_jornada_editar_lote(array[a,b],'nivel','{"nivel":"acolito_guardiao"}');
  if r->>'total'<>'2' or (select count(*) from public.acolitos_membros where id=any(array[a,b]) and nivel='acolito_guardiao')<>2 then raise exception 'Nível não aplicado'; end if;
  perform public.acolitos_jornada_editar_lote(array[a,b],'funcoes','{"funcoes":["cruz","vela"],"proficiencia":"apto"}');
  if (select count(*) from public.acolitos_habilitacoes where membro_id=any(array[a,b]) and proficiencia='apto')<>4 then raise exception 'Aptidão não aplicada'; end if;
  perform public.acolitos_jornada_editar_lote(array[a,b],'disponibilidade','{"modo":"adicionar","horarios":[{"dia":"domingo","horario":"9h"}]}');
  perform public.acolitos_jornada_editar_lote(array[a,b],'disponibilidade','{"modo":"adicionar","horarios":[{"dia":"domingo","horario":"9h"}]}');
  if (select count(*) from public.acolitos_disponibilidade where membro_id=any(array[a,b]))<>2 then raise exception 'Horários duplicados'; end if;
  perform public.acolitos_jornada_editar_lote(array[a],'disponibilidade','{"modo":"substituir","horarios":[{"dia":"sabado","horario":"17h"}]}');
  if not exists(select 1 from public.acolitos_disponibilidade where membro_id=b and horario='9h') then raise exception 'Alterou não selecionado'; end if;
  begin
    perform public.acolitos_jornada_editar_lote(array[a,b],'disponibilidade','{"modo":"substituir","horarios":[{"dia":"sexta","horario":"9h"}]}');
  exception when others then negou:=true; end;
  if not negou or (select count(*) from public.acolitos_disponibilidade where membro_id=any(array[a,b]))<>2 then raise exception 'Falha não preservou os horários'; end if;
  perform public.acolitos_jornada_editar_lote(array[a],'disponibilidade','{"modo":"remover","horarios":[{"dia":"sabado","horario":"17h"}]}');
  perform public.acolitos_jornada_editar_lote(array[b],'disponibilidade','{"modo":"limpar"}');
  if exists(select 1 from public.acolitos_disponibilidade where membro_id=any(array[a,b])) then raise exception 'Limpeza falhou'; end if;
  negou:=false;perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
  begin perform public.acolitos_jornada_editar_lote(array[a,b],'nivel','{"nivel":"coroinha"}');exception when insufficient_privilege then negou:=true;end;
  if not negou then raise exception 'Sem papel conseguiu editar'; end if;
  execute 'reset role';
end $$;
rollback;
select 'Nível, aptidão, horários, isolamento, rollback e permissão: OK. Nenhuma alteração de teste mantida.' as prova;
