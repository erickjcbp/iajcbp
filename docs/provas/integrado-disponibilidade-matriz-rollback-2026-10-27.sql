-- Somente fixtures sintéticas, sem WhatsApp/push; toda a prova é revertida.
begin;
do $$
declare m uuid;m2 uuid;msg uuid;pid uuid;r jsonb;n int;
begin
  insert into public.acolitos_membros(nome,status,serve,data_nascimento)
  values('PROVA Matriz rollback','em_integracao',true,current_date-interval '12 years') returning id into m;
  insert into public.acolitos_crm(membro_id,etapa) values(m,'tunica');
  insert into public.acolitos_disponibilidade(membro_id,dia,horario,comunidade,restricao)
  values(m,'sabado','18h30','santo_antonio','preservar'),(m,'domingo','9h',null,'preservar');
  insert into public.tarcisio_acolhida(membro_id,acolhido_em) values(m,now());
  insert into public.tarcisio_mensagens(numero,direcao,texto,respondida)
  values('5519900000001','entrada','Já recebi a túnica',true) returning id into msg;
  perform set_config('request.jwt.claim.role','service_role',true);
  r:=public.tarcisio_acolhida_registrar(m,'5519900000001',msg,'tunica_recebida');
  select count(*) into n from public.acolitos_disponibilidade where membro_id=m;
  if n<>2 then raise exception 'ativou disponibilidade antes da confirmação humana';end if;
  select id into pid from public.tarcisio_acolhida_propostas where membro_id=m and acao='integrado' and estado='pendente';
  if pid is null then raise exception 'proposta ausente';end if;
  r:=public.tarcisio_acolhida_decidir(pid,true);
  if r->>'ok' is distinct from 'true' then raise exception 'confirmação falhou';end if;
  select count(*) into n from public.acolitos_disponibilidade where membro_id=m;
  if n<>5 then raise exception 'esperava 4 Matriz + 1 Santo Antônio, achei %',n;end if;
  if exists(select 1 from (values ('sabado','17h'),('domingo','7h'),('domingo','9h'),('domingo','19h')) h(dia,horario)
    where not exists(select 1 from public.acolitos_disponibilidade d where d.membro_id=m and d.dia=h.dia and d.horario=h.horario)) then raise exception 'horário da Matriz ausente';end if;
  if (select count(*) from public.acolitos_disponibilidade where membro_id=m and restricao='preservar')<>2 then raise exception 'apagou disponibilidade anterior';end if;
  if not exists(select 1 from public.acolitos_membros where id=m and nivel='aspirante' and status='ativo') then raise exception 'nível/status incorreto';end if;
  if not exists(select 1 from public.acolitos_habilitacoes where membro_id=m and funcao='apoio' and proficiencia='apto') then raise exception 'Apoio apto ausente';end if;
  update public.acolitos_crm set etapa='integrado' where membro_id=m;
  if (select count(*) from public.acolitos_disponibilidade where membro_id=m)<>5 then raise exception 'duplicou horários';end if;
  delete from public.acolitos_disponibilidade where membro_id=m and dia='domingo' and horario='7h';
  update public.acolitos_crm set etapa='integrado' where membro_id=m;
  if exists(select 1 from public.acolitos_disponibilidade where membro_id=m and dia='domingo' and horario='7h') then raise exception 'desfez edição posterior';end if;
  -- Inserção direta como integrado também ativa a grade sem rebaixar nível existente.
  insert into public.acolitos_membros(nome,status,serve,nivel) values('PROVA Matriz inserção rollback','ativo',true,'coroinha') returning id into m2;
  insert into public.acolitos_crm(membro_id,etapa) values(m2,'integrado');
  if (select count(*) from public.acolitos_disponibilidade where membro_id=m2)<>4 then raise exception 'inserção direta não recebeu grade';end if;
  if (select nivel from public.acolitos_membros where id=m2) is distinct from 'coroinha' then raise exception 'nível foi rebaixado';end if;
  raise notice 'PROVA OK: confirmação humana, 4 horários Matriz, preserva outros, sem duplicação, respeita edição posterior, nível/Apoio intactos';
end $$;
rollback;
