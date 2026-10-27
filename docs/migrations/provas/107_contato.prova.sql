\set ON_ERROR_STOP on
begin;
do $$ declare u uuid; m uuid; a uuid; begin
  select pm.user_id into u from public.pastoral_members pm join public.pastoral_modules mod on mod.id=pm.module_id
    where mod.slug='acolitos' and pm.role='coord_admin' limit 1;
  select membro_id into m from public.tarcisio_envios where estado='sem_numero' and membro_id is not null limit 1;
  select id into a from public.tarcisio_avisos where ativo and chave='retiro-20261024-sexta';
  if u is null or m is null or a is null then raise exception 'Faltam dados autorizados para a prova'; end if;
  perform set_config('request.jwt.claim.sub',u::text,true);perform set_config('request.jwt.claim.role','authenticated',true);
  perform set_config('prova.membro',m::text,true);perform set_config('prova.aviso',a::text,true);
end $$;
set local role authenticated;
do $$ declare m uuid:=current_setting('prova.membro')::uuid; a uuid:=current_setting('prova.aviso')::uuid; r jsonb; begin
  r:=public.tarcisio_salvar_contato(m,'123','proprio');
  if r->>'erro'<>'numero_invalido' then raise exception 'Aceitou telefone inválido'; end if;
  insert into public.tarcisio_envios(tipo,estado,membro_id,aviso_id,agendado_para,chave_unica,texto) values
    ('aviso','sem_numero',m,a,date_trunc('minute',now())+interval '1 day','prova-contato:futuro:'||txid_current(),'Prova transacional'),
    ('aviso','sem_numero',m,a,date_trunc('minute',now())+interval '2 day','prova-contato:duplicado:'||txid_current(),'Prova transacional'),
    ('aviso','sem_numero',m,a,date_trunc('minute',now())-interval '1 day','prova-contato:antigo:'||txid_current(),'Prova transacional');
  insert into public.tarcisio_envios(tipo,estado,aviso_id,destino_numero,agendado_para,chave_unica,texto) values
    ('aviso','pendente',a,'5519999900001',date_trunc('minute',now())+interval '2 day','prova-contato:ja-incluido:'||txid_current(),'Prova transacional');
  r:=public.tarcisio_salvar_contato(m,'(19) 99990-0001','proprio');
  if not coalesce((r->>'ok')::boolean,false) then raise exception 'Falha ao salvar pelo perfil autenticado: %',r->>'erro'; end if;
  if not exists(select 1 from public.acolitos_membros where id=m and telefone='5519999900001') then raise exception 'Telefone próprio não persistiu'; end if;
  if not exists(select 1 from public.tarcisio_envios where chave_unica='prova-contato:futuro:'||txid_current() and estado='pendente' and destino_numero='5519999900001') then raise exception 'Aviso futuro não foi atualizado'; end if;
  if not exists(select 1 from public.tarcisio_envios where chave_unica='prova-contato:duplicado:'||txid_current() and estado='cancelado') then raise exception 'Contato duplicado não foi agrupado'; end if;
  if not exists(select 1 from public.tarcisio_envios where chave_unica='prova-contato:antigo:'||txid_current() and estado='cancelado') then raise exception 'Aviso antigo foi reativado'; end if;
  r:=public.tarcisio_salvar_contato(m,'(19) 99990-0002','responsavel');
  if not exists(select 1 from public.acolitos_membros where id=m and celular_recado='5519999900002' and telefone='5519999900001') then raise exception 'Não separou os campos do participante/responsável'; end if;
  perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
  r:=public.tarcisio_salvar_contato(m,'(19) 99990-0003','proprio');
  if r->>'erro'<>'sem_permissao' then raise exception 'Perfil não autorizado conseguiu alterar contato'; end if;
  raise notice 'OK: validação, RLS, telefone próprio/responsável, futuro, deduplicação e histórico';
end $$;
rollback;
